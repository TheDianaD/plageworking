(function(storyContent) {

    // ── INK STORY ────────────────────────────────────
    var story = new inkjs.Story(storyContent);

    var savePoint      = "";
    var lastChoiceText = "";
    var vocabNoticeShown = false;

    // ── GLOBAL TAGS ──────────────────────────────────
    var globalTags = story.globalTags;
    var globalTagTheme;
    if (globalTags) {
        globalTags.forEach(function (globalTag) {
            var splitTag = splitPropertyTag(globalTag);
            if (splitTag) {
                var prop = splitTag.property.toLowerCase();
                if (prop === 'theme') {
                    globalTagTheme = splitTag.val;
                } else if (prop === 'author') {
                    // Write to both the header byline and the top-bar byline element
                    var bylines = document.querySelectorAll('.byline, #byline-el');
                    bylines.forEach(function (el) { el.innerHTML = 'by ' + splitTag.val; });
                }
            }
        });
    }

    var storyContainer     = document.querySelector('#story');
    var outerScrollContainer = document.querySelector('.outerContainer');

    setupTheme(globalTagTheme);
    var hasSave = loadSavePoint();
    setupButtons(hasSave);

    savePoint = story.state.toJson();
    continueStory(true);

    // Sync on first load
    syncLivestockState();
    syncPhaseState();
    updateHUD();

    // ── MAIN LOOP ─────────────────────────────────────
    function continueStory(firstTime) {

        var previousBottomEdge = firstTime ? 0 : contentBottomEdgeY();

        while (story.canContinue) {

            var paragraphText = story.Continue();
            var tags          = story.currentTags;
            var customClasses = [];

            // ── TAG HANDLING ──────────────────────────
            tags.forEach(function (tag) {
                var splitTag = splitPropertyTag(tag);
                if (splitTag) splitTag.property = splitTag.property.toUpperCase();

                // AUDIO: src
                if (splitTag && splitTag.property === 'AUDIO') {
                    if (continueStory._audio) {
                        continueStory._audio.pause();
                        continueStory._audio.removeAttribute('src');
                        continueStory._audio.load();
                    }
                    continueStory._audio = new Audio(splitTag.val);
                    continueStory._audio.play();
                }
                // AUDIOLOOP: src
                else if (splitTag && splitTag.property === 'AUDIOLOOP') {
                    if (continueStory._audioLoop) {
                        continueStory._audioLoop.pause();
                        continueStory._audioLoop.removeAttribute('src');
                        continueStory._audioLoop.load();
                    }
                    continueStory._audioLoop = new Audio(splitTag.val);
                    continueStory._audioLoop.play();
                    continueStory._audioLoop.loop = true;
                }
                // IMAGE: src  (inline image in story flow)
                else if (splitTag && splitTag.property === 'IMAGE') {
                    var img = document.createElement('img');
                    img.src = splitTag.val;
                    storyContainer.appendChild(img);
                    img.onload = function () { scrollDown(previousBottomEdge); };
                    showAfter(0, img);
                }
                // LINK / LINKOPEN: url
                else if (splitTag && splitTag.property === 'LINK') {
                    window.location.href = splitTag.val;
                }
                else if (splitTag && splitTag.property === 'LINKOPEN') {
                    window.open(splitTag.val);
                }
                // BACKGROUND: src
                else if (splitTag && splitTag.property === 'BACKGROUND') {
                    outerScrollContainer.style.backgroundImage = 'url(' + splitTag.val + ')';
                }
                // CLASS: className
                else if (splitTag && splitTag.property === 'CLASS') {
                    customClasses.push(splitTag.val);
                }

                // ── SCENE TAGS ────────────────────────────────
                // These are the canonical way to trigger scene changes.
                // Format:  # SCENE: key
                //   key = map | interior | spring | summer | fall | winter
                // The phase (start/ct/l/cl) is tracked separately via PHASE tags.
                else if (splitTag && splitTag.property === 'SCENE') {
                    applySceneTag(splitTag.val);
                }
                // # PHASE: start | ct | l | cl
                else if (splitTag && splitTag.property === 'PHASE') {
                    applyPhaseTag(splitTag.val);
                }
                // # RAIN: true | false
                else if (splitTag && splitTag.property === 'RAIN') {
                    var rainVal = splitTag.val.trim().toLowerCase();
                    if (window.sceneState) window.sceneState.rain = (rainVal !== 'false' && rainVal !== '0');
                    if (window.updateScene) window.updateScene();
                }

                // JOURNAL: SEASON:Label | Entry text
                // Written into the journal panel as a first-person diary entry.
                // Season label groups entries under a heading; repeated same-season
                // entries are appended under the existing heading rather than
                // creating a duplicate.
                else if (tag.trim().toUpperCase().indexOf('JOURNAL') === 0) {
                    // Raw Ink tag: "JOURNAL Spring 1351: diary text"
                    // splitPropertyTag can't handle this (splits on first colon, eating the season)
                    // So we parse the raw tag directly instead.
                    var rawJournal = tag.trim();
                    // Strip the leading "JOURNAL " word
                    var afterKey = rawJournal.substr('JOURNAL'.length).trim();
                    // afterKey is now "Spring 1351: diary text"
                    var colonPos = afterKey.indexOf(':');
                    var journalSeason = '';
                    var journalText = afterKey;
                    if (colonPos !== -1) {
                        journalSeason = afterKey.substr(0, colonPos).trim();
                        journalText   = afterKey.substr(colonPos + 1).trim();
                    }
                    addJournalEntry(journalText, journalSeason);
                }


                // CLEAR / RESTART
                else if (tag === 'CLEAR' || tag === 'RESTART') {
                    removeAll('p');
                    removeAll('img');
                    setVisible('.header', false);
                    if (tag === 'RESTART') {
                        restart();
                        return;
                    }
                }
            });

            // ── PARAGRAPH FILTERING ───────────────────
            if (paragraphText.trim().length === 0) continue;

            // Swallow echoed choice text
            if (lastChoiceText && paragraphText.trim() === lastChoiceText.trim()) {
                lastChoiceText = '';
                continue;
            }

            // Swallow character-selection artifacts
            if (paragraphText.trim() === 'John' || paragraphText.trim() === 'Colette') continue;
            if (paragraphText.includes('choose your character') ||
                paragraphText.includes('But first, choose')) continue;

            // Vocab blocks — extract terms but don't render raw text
            if (paragraphText.includes('VOCAB UNLOCKED') ||
                paragraphText.includes('______________________') ||
                paragraphText.includes('New Vocab Unlocked') ||
                paragraphText.includes('VOCAB') ||
                paragraphText.trim().startsWith('—') ||
                paragraphText.trim().startsWith('–') ||
                paragraphText.includes('Fun fact:')) {
                extractVocabTerms(paragraphText);
                if (!vocabNoticeShown && (paragraphText.includes('VOCAB UNLOCKED') || paragraphText.includes('New Vocab Unlocked'))) {
                    showVocabNotice();
                    vocabNoticeShown = true;
                }
                continue;
            }

            // ── SEASON / SCENE INFERENCE FROM TEXT ───
            // FALLBACK only — ink tags (# SCENE, # PHASE) are preferred.
            // Scene image is updated once per continueStory batch to avoid flicker.
            updateSeasonFromParagraph(paragraphText);

            // ── DEATH DETECTION ───────────────────────
            syncDeathState(paragraphText);

            // ── BUILD PARAGRAPH ELEMENT ───────────────
            var paragraphElement = document.createElement('p');

            // Highlight numbers + key item words in gold
            var processedText = paragraphText
                .replace(/(\d+)\s+(pennies|bushels?|acres?|cows?|rabbits?)/gi, '<strong>$1 $2</strong>')
                .replace(/(\d+)%/g, '<strong>$1%</strong>');

            paragraphElement.innerHTML = processedText;

            // Drop-cap on major section headings
            if (/^(ESSEX|The year is|You stand outside|Your lord still|There is much|You walk the muddy|Some days later|Time passes|Late summer|WINTER|MID AUTUMN|EARLY AUTUMN|LATE AUTUMN|HARVEST|RENT|LEASEHOLDER|As a leaseholder)/i.test(paragraphText)) {
                paragraphElement.classList.add('section-start');
            }

            customClasses.forEach(function (cls) { paragraphElement.classList.add(cls); });

            storyContainer.appendChild(paragraphElement);
            // No stagger delay — show each paragraph immediately.
            // The cumulative 200ms-per-paragraph stagger caused noticeable lag
            // on long story passages. Paragraphs fade in via CSS transition instead.
            showAfter(0, paragraphElement);
        }

        // ── POST-BATCH SCENE SYNC ─────────────────────
        // Update scene once per continueStory call, not per paragraph.
        syncLivestockState();
        syncPhaseState();
        if (window.updateScene) window.updateScene();

        updateHUD();

        // ── AUTO-SELECT CHARACTER ─────────────────────
        if (story.currentChoices.length > 0) {
            var first = story.currentChoices[0];
            if (first && (first.text === 'John' || first.text === 'Colette')) {
                var johnIndex = story.currentChoices.findIndex(function (c) { return c.text === 'John'; });
                if (johnIndex !== -1) {
                    story.ChooseChoiceIndex(johnIndex);
                    savePoint = story.state.toJson();
                    continueStory();
                    return;
                }
            }
        }

        // ── RENDER CHOICES INTO HUD ───────────────────
        var hudChoices = document.getElementById('hud-choices');
        if (hudChoices) {
            hudChoices.innerHTML = '';
            if (story.currentChoices.length === 0) {
                hudChoices.innerHTML = '<span class="hud-no-choices">— reading —</span>';
            } else {
                story.currentChoices.forEach(function (choice) {
                    var isClickable = true;
                    if (choice.tags) {
                        choice.tags.forEach(function (t) {
                            if (t.toUpperCase() === 'UNCLICKABLE') isClickable = false;
                        });
                    }

                    var item = document.createElement('div');
                    item.className = 'hud-choice-item' + (isClickable ? '' : ' disabled');
                    item.textContent = choice.text;

                    if (isClickable) {
                        item.addEventListener('click', function () {
                            storyContainer.style.height = contentBottomEdgeY() + 'px';
                            hudChoices.innerHTML = '<span class="hud-no-choices">— reading —</span>';

                            // Choice-level livestock inference — reliable immediate feedback
                            // on purchase choices before ink variables update.
                            var lc = choice.text.toLowerCase();
                            if (lc.includes('buy rabbit') || lc.includes('get rabbit') ||
                                lc.includes('pay for a single rabbit') || lc.includes('rabbit')) {
                                window.sceneState.hasRabbit = true;
                                window.sceneState.hasCow    = false;
                                window.sceneState._cowPurchasedThisRun = true; // rabbit counts too
                            }
                            if (lc.includes('buy cow') || lc.includes('get cow') ||
                                lc.includes('purchase cow') || lc.includes('buy a cow')) {
                                window.sceneState.hasCow    = true;
                                window.sceneState.hasRabbit = false;
                                window.sceneState._cowPurchasedThisRun = true;
                            }
                            if (lc.includes('brew ale') || lc.includes('sell ale') ||
                                lc.includes('alehouse')) {
                                window.sceneState.hasAle = true;
                            }

                            lastChoiceText = choice.text;
                            // Journal entries are now written via # JOURNAL: tags in the ink
                            story.ChooseChoiceIndex(choice.index);
                            savePoint = story.state.toJson();

                            syncLivestockState();
                            syncPhaseState();
                            if (window.updateScene) window.updateScene();
                            updateHUD();
                            continueStory();
                        });
                    }
                    hudChoices.appendChild(item);
                });
            }
        }

        if (!firstTime) scrollDown(previousBottomEdge);
    }

    // ── SCENE TAG HANDLERS ────────────────────────────
    function applySceneTag(val) {
        if (!window.sceneState) return;
        var v = val.trim().toLowerCase();
        // Just update the data, don't trigger the render yet
        if (v === 'map')      { window.sceneState.season = 'map'; }
        else if (v === 'interior') { window.sceneState.season = 'interior'; }
        else if (v === 'spring')   { window.sceneState.season = 'spring'; }
        else if (v === 'summer')   { window.sceneState.season = 'summer'; }
        else if (v === 'fall' || v === 'autumn') { window.sceneState.season = 'fall'; }
        else if (v === 'winter') { window.sceneState.season = 'winter'; }
        // REMOVED: window.updateScene() call from here
    }

    function applyPhaseTag(val) {
        if (!window.sceneState) return;
        var v = val.trim().toLowerCase();
        if (v === 'start' || v === 'ct' || v === 'l' || v === 'cl') {
            window.sceneState.phase = v;
            // REMOVED: window.updateScene() call from here
        }
    }

    // ── SEASON INFERENCE (FALLBACK) ───────────────────
    // Maps specific story text to scene state changes.
    // Triggers are derived from actual ink node content in Plague.js.
    // Priority rule: once isDead=true nothing else runs.
    // Scene image is NOT updated here — deferred to post-batch in continueStory.
    var currentSeason = '—';

    function updateSeasonFromParagraph(text) {
        if (!window.sceneState || window.sceneState.isDead) return;

        var t     = text.trim().toUpperCase();
        var lower = text.trim().toLowerCase();

        // ── INTERIOR ─────────────────────────────────
        // "Inside, it has been stripped to almost nothing" — holding_intro node
        if (lower.includes('inside, it has been stripped')) {
            window.sceneState.season = 'interior';
            return;
        }
        // Any of these lines mean we are back outside
        if (lower.includes('you stand outside what is left') ||
            lower.includes('you walk the muddy') ||
            lower.includes('you step outside') ||
            lower.includes('you leave the cottage')) {
            if (window.sceneState.season === 'interior') {
                window.sceneState.season = window.sceneState._lastOutdoorSeason || 'map';
            }
        }
        // Cache last outdoor season for restoring after interior
        if (window.sceneState.season !== 'interior' && window.sceneState.season !== 'map') {
            window.sceneState._lastOutdoorSeason = window.sceneState.season;
        }

        // ── MAP → SPRING transition ───────────────────
        // Stay on map through the alehouse/town-crier passage.
        // Only leave map on "Some days later." (week_work_bailiff node) —
        // that's the first outdoor scene after the opening.
        if (lower.startsWith('some days later')) {
            currentSeason = 'Spring, 1351';
            window.sceneState.season = 'fall';   // "Some days later" is rainy/fall-feel
            window.sceneState.rain   = true;
            window.sceneState.phase  = 'start';
            return;
        }

        // Stay on map until "Some days later"
        if (window.sceneState.season === 'map') return;

        // ── PHASE: Customary Tenant ───────────────────
        // custom_tenant_levelup_intro node: "Late summer, 1352." + "Customary Tenant"
        if (lower.includes('customary tenant') || lower.includes('level up: customary tenant')) {
            if (window.sceneState.phase === 'start') {
                window.sceneState.phase  = 'ct';
                window.sceneState.season = 'summer';
                window.sceneState.rain   = false;
            }
        }
        // ── PHASE: Leaseholder ────────────────────────
        if (lower.includes('as a leaseholder') || lower.includes('level up: leaseholder') ||
            lower.includes('leaseholder market')) {
            window.sceneState.phase = 'l';
        }

        // ── SEASON HEADINGS (exact node openings) ─────
        if (t.startsWith('WINTER, 1351') || t.startsWith('WINTER, 1352') ||
            t.startsWith('WINTER, 1354') || t === 'WINTER') {
            var winterLabels = {
                'WINTER, 1351': 'Winter, 1351–52',
                'WINTER, 1352': 'Winter, 1352–53',
                'WINTER, 1354': 'Winter, 1354–55',
            };
            Object.keys(winterLabels).forEach(function(k) {
                if (t.startsWith(k)) currentSeason = winterLabels[k];
            });
            if (!currentSeason || currentSeason === '—') currentSeason = 'Winter';
            window.sceneState.season = 'winter';
            window.sceneState.rain   = false;
        } else if (t.startsWith('EARLY AUTUMN')) {
            currentSeason = 'Early Autumn, 1352';
            window.sceneState.season = 'fall';
            window.sceneState.rain   = true;
        } else if (t.startsWith('MID AUTUMN')) {
            currentSeason = 'Mid Autumn, 1352';
            window.sceneState.season = 'fall';
            window.sceneState.rain   = true;
        } else if (t.startsWith('LATE AUTUMN')) {
            currentSeason = 'Late Autumn, 1352';
            window.sceneState.season = 'fall';
            window.sceneState.rain   = true;
        } else if (t.startsWith('HARVEST')) {
            currentSeason = 'Harvest, 1353';
            window.sceneState.season = 'summer';
            window.sceneState.rain   = false;
        } else if (t.startsWith('LATE SUMMER')) {
            currentSeason = 'Late Summer, 1353';
            window.sceneState.season = 'summer';
            window.sceneState.rain   = false;
        } else if (t.startsWith('ESSEX')) {
            currentSeason = 'Essex, 1351';
            // stays on map — handled above
        } else if (t.startsWith('LEASEHOLDER MARKET')) {
            currentSeason = 'Market Day, 1354';
        } else if (t.startsWith('RENT, 1353')) {
            currentSeason = 'Michaelmas, 1353';
        }

        // ── START PHASE DEFAULT: always rainy until CT ─
        if (window.sceneState.phase === 'start' &&
            window.sceneState.season !== 'winter' &&
            window.sceneState.season !== 'interior' &&
            window.sceneState.season !== 'map') {
            window.sceneState.rain = true;
        }

        // Scene update is deferred to continueStory post-batch — don't call here.
    }

    // ── LIVESTOCK SYNC ────────────────────────────────
    // bought_cow_early and bought_cow_late are permanent ink booleans.
    // The livestock counter drops back to 0 after winter in start phase
    // (ink consumes the animal), so we rely on the purchase flag instead.
    // hasRabbit is not an ink variable — it's tracked via choice-click handler.
    function syncLivestockState() {
        if (!window.sceneState) return;
        try {
            var livestock      = Number(story.variablesState.$('livestock'))    || 0;
            var boughtCowEarly = !!story.variablesState.$('bought_cow_early');
            var boughtCowLate  = !!story.variablesState.$('bought_cow_late');
            var grainVal       = Number(story.variablesState.$('grain'))        || 0;

            // Cow: live animal OR ever purchased (start phase shows it even after ink
            // removes it, because it's the visually meaningful state for winter scene)
            if (livestock >= 1 && !window.sceneState.hasRabbit) {
                window.sceneState.hasCow = true;
            } else if (boughtCowEarly || boughtCowLate) {
                window.sceneState.hasCow = true;
                window.sceneState._cowPurchasedThisRun = true;
            } else if (!window.sceneState._cowPurchasedThisRun) {
                window.sceneState.hasCow = false;
            }

            window.sceneState.hasGrain = (grainVal > 0);

            // hasAle not a real ink var yet — leave whatever choice-click set
        } catch (e) {}
    }

    // ── PHASE SYNC ────────────────────────────────────
    // Reads the `status` ink variable which is set explicitly in ink nodes:
    //   villein → customary tenant → leaseholder → freeholder
    function syncPhaseState() {
        if (!window.sceneState) return;
        try {
            var status = (story.variablesState.$('status') || '').toLowerCase().trim();
            if ((status === 'leaseholder' || status === 'freeholder') &&
                 window.sceneState.phase !== 'l') {
                window.sceneState.phase = 'l';
            } else if (status === 'customary tenant' && window.sceneState.phase === 'start') {
                window.sceneState.phase = 'ct';
                // Upgrade also switches to summer start image
                if (window.sceneState.season !== 'summer') {
                    window.sceneState.season = 'summer';
                    window.sceneState.rain   = false;
                }
            }
        } catch (e) {}
    }

    // ── DEATH DETECTION ───────────────────────────────
    // Check ink's death_check variable first (set to "dead" by PlagueRoll).
    // Fall back to text matching for ending nodes that don't use PlagueRoll.
    function syncDeathState(text) {
        if (!window.sceneState || window.sceneState.isDead) return;

        try {
            if (story.variablesState.$('death_check') === 'dead') {
                window.sceneState.isDead = true;
                if (window.updateScene) window.updateScene();
                return;
            }
        } catch(e) {}

        var lower = (text || '').trim().toLowerCase();
        if (lower === 'dead' ||
            lower.includes('you die') ||
            lower.includes('you are dead') ||
            lower.includes('you have died') ||
            lower.includes('starvation claims') ||
            lower.includes('ending: death') ||
            lower.includes('you fall with it')) {
            window.sceneState.isDead = true;
            if (window.updateScene) window.updateScene();
        }
    }

    // ── VOCAB ─────────────────────────────────────────
    function extractVocabTerms(text) {
        var lines = text.split('\n');
        lines.forEach(function (line) {
            var trimmed = line.trim();
            if (trimmed.match(/^[—–]\s*.+:\s*.+/)) {
                var parts = trimmed.substring(1).split(':');
                if (parts.length >= 2) {
                    addVocabEntry(parts[0].trim(), parts.slice(1).join(':').trim());
                }
            }
            if (trimmed.toLowerCase().includes('fun fact:')) {
                var m = trimmed.match(/fun fact:\s*(.+)/i);
                if (m) addVocabEntry('Fun Fact', m[1].trim());
            }
        });
    }

    function addVocabEntry(term, definition) {
        var vocabList = document.getElementById('vocab-list');
        if (!vocabList) return;
        var placeholder = vocabList.querySelector('p');
        if (placeholder) placeholder.remove();
        var existing = vocabList.querySelectorAll('.vocab-term');
        for (var i = 0; i < existing.length; i++) {
            if (existing[i].textContent === term) return;
        }
        var entry = document.createElement('div');
        entry.className = 'vocab-entry';
        var termEl = document.createElement('div');
        termEl.className = 'vocab-term';
        termEl.textContent = term;
        var defEl = document.createElement('div');
        defEl.className = 'vocab-def';
        defEl.textContent = definition;
        entry.appendChild(termEl);
        entry.appendChild(defEl);
        vocabList.appendChild(entry);
    }

    function showVocabNotice() {
        if (document.querySelector('.vocab-notice')) return;
        var note = document.createElement('p');
        note.className = 'vocab-notice';
        note.innerHTML = '<strong>You have unlocked new vocabulary.</strong> See it in the Vocab tab.';
        storyContainer.appendChild(note);
        showAfter(0, note);
    }

    // ── JOURNAL ───────────────────────────────────────
    var _lastJournalSeason = null;

    function addJournalEntry(text, season) {
        var journal = document.getElementById('journal-entries');
        if (!journal) return;

        // Remove placeholder paragraph if present
        var placeholder = journal.querySelector('p');
        if (placeholder) placeholder.remove();

        // Insert a season header if the season has changed
        if (season && season !== _lastJournalSeason) {
            _lastJournalSeason = season;
            var header = document.createElement('div');
            header.className = 'journal-season-header';
            header.textContent = season;
            journal.appendChild(header);
        }

        var entry = document.createElement('div');
        entry.className = 'journal-entry';
        entry.textContent = text;
        journal.appendChild(entry);
    }

    // ── HUD ───────────────────────────────────────────
    // Track previous values so we can show deltas
    var _prevStats = { money: null, grain: null, livestock: null, health: null, reputation: null };
    var _deltaTimer = null;

    function showStatDelta(deltas) {
        var ticker = document.getElementById('stat-delta');
        if (!ticker || deltas.length === 0) return;

        // Clear any pending fade
        if (_deltaTimer) clearTimeout(_deltaTimer);
        ticker.classList.remove('fading');

        // Build items
        ticker.innerHTML = '';
        deltas.forEach(function(d) {
            var el = document.createElement('span');
            el.className = 'delta-item ' + (d.val > 0 ? 'pos' : d.val < 0 ? 'neg' : 'neu');
            el.textContent = (d.val > 0 ? '+' : '') + d.val + ' ' + d.label;
            ticker.appendChild(el);
        });

        ticker.classList.add('visible');

        // Fade out after 2.4s
        _deltaTimer = setTimeout(function() {
            ticker.classList.add('fading');
            setTimeout(function() {
                ticker.classList.remove('visible', 'fading');
            }, 850);
        }, 2400);
    }

    function updateHUD() {
        try {
            var set = function (id, val) {
                var el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            var money      = Number(story.variablesState.$('money'))      || 0;
            var grain      = Number(story.variablesState.$('grain'))      || 0;
            var livestock  = Number(story.variablesState.$('livestock'))  || 0;
            var health     = Number(story.variablesState.$('health'))     || 100;
            var reputation = Number(story.variablesState.$('reputation')) || 100;

            // Compute deltas vs previous known values
            var deltas = [];
            var checks = [
                { key: 'money',      val: money,      label: 'coin' },
                { key: 'grain',      val: grain,      label: 'grain' },
                { key: 'livestock',  val: livestock,  label: 'stock' },
                { key: 'health',     val: health,     label: 'health' },
                { key: 'reputation', val: reputation, label: 'rep' },
            ];
            checks.forEach(function(c) {
                if (_prevStats[c.key] !== null && _prevStats[c.key] !== c.val) {
                    var diff = Math.round(c.val - _prevStats[c.key]);
                    if (diff !== 0) deltas.push({ val: diff, label: c.label });
                }
                _prevStats[c.key] = c.val;
            });

            if (deltas.length > 0) showStatDelta(deltas);

            set('money-value',      money);
            set('grain-value',      grain);
            set('livestock-value',  livestock);
            set('health-value',     health + '%');
            set('reputation-value', reputation + '%');

            var status = story.variablesState.$('status') || 'Villein';
            set('status-value', status.charAt(0).toUpperCase() + status.slice(1));
            set('season-label', currentSeason);

            // Mirror season label onto scene overlay (keep it in sync)
            var overlay = document.getElementById('scene-season-overlay');
            if (overlay) overlay.textContent = currentSeason !== '—' ? currentSeason : '';
        } catch (e) {
            console.debug('HUD update skipped:', e);
        }
    }

    // ── SAVE / LOAD ───────────────────────────────────
    function loadSavePoint() {
        try {
            var saved = window.localStorage.getItem('save-state');
            if (saved) { story.state.LoadJson(saved); return true; }
        } catch (e) { console.debug("Couldn't load save state"); }
        return false;
    }

    function setupTheme(globalTagTheme) {
        var savedTheme;
        try { savedTheme = window.localStorage.getItem('theme'); } catch (e) {}
        var browserDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' ||
            (savedTheme == null && globalTagTheme === 'dark') ||
            (savedTheme == null && globalTagTheme == null && browserDark)) {
            document.body.classList.add('dark');
        }
    }

    function setupButtons(hasSave) {
        var rewindEl = document.getElementById('rewind');
        if (rewindEl) rewindEl.addEventListener('click', function () {
            removeAll('p'); removeAll('img'); removeAll('.choice');
            var hc = document.getElementById('hud-choices');
            if (hc) hc.innerHTML = '<span class="hud-no-choices">— reading —</span>';
            setVisible('.header', false);
            restart();
        });

        var saveEl = document.getElementById('save');
        if (saveEl) saveEl.addEventListener('click', function () {
            try {
                window.localStorage.setItem('save-state', savePoint);
                var reloadEl2 = document.getElementById('reload');
                if (reloadEl2) reloadEl2.removeAttribute('disabled');
                window.localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : '');
            } catch (e) { console.warn("Couldn't save state"); }
        });

        var reloadEl = document.getElementById('reload');
        if (!hasSave && reloadEl) reloadEl.setAttribute('disabled', 'disabled');
        if (reloadEl) reloadEl.addEventListener('click', function () {
            if (reloadEl.getAttribute('disabled')) return;
            removeAll('p'); removeAll('img');
            var hc = document.getElementById('hud-choices');
            if (hc) hc.innerHTML = '<span class="hud-no-choices">— reading —</span>';
            try {
                var saved = window.localStorage.getItem('save-state');
                if (saved) story.state.LoadJson(saved);
            } catch (e) { console.debug("Couldn't load save state"); }
            continueStory(true);
        });

        var themeEl = document.getElementById('theme-switch');
        if (themeEl) themeEl.addEventListener('click', function () {
            document.body.classList.add('switched');
            document.body.classList.toggle('dark');
        });
    }

    function restart() {
        story.ResetState();
        setVisible('.header', true);
        vocabNoticeShown = false;

        // Reset scene state fully
        if (window.sceneState) {
            window.sceneState.phase                = 'start';
            window.sceneState.season               = 'map';
            window.sceneState.rain                 = true;
            window.sceneState.hasCow               = false;
            window.sceneState.hasRabbit            = false;
            window.sceneState.hasAle               = false;
            window.sceneState.hasGrain             = false;
            window.sceneState.isDead               = false;
            window.sceneState._cowPurchasedThisRun = false;
            window.sceneState._lastOutdoorSeason   = null;
            if (window.updateScene) window.updateScene();
        }

        // Clear journal
        var journal = document.getElementById('journal-entries');
        if (journal) {
            journal.innerHTML = '<p style="font-family:var(--font-ui);font-size:0.82rem;color:rgba(223,228,240,0.22);font-style:italic;line-height:1.5;">Choices recorded as you play.</p>';
        }

        // Reset journal season tracker
        _lastJournalSeason = null;

        // Clear vocab list
        var vocabList = document.getElementById('vocab-list');
        if (vocabList) {
            vocabList.innerHTML = '<p style="font-family:var(--font-ui);font-size:0.82rem;color:rgba(223,228,240,0.22);font-style:italic;line-height:1.5;">Terms unlock as you progress.</p>';
        }

        currentSeason = '—';
        _prevStats = { money: null, grain: null, livestock: null, health: null, reputation: null };
        savePoint = story.state.toJson();
        continueStory(true);
        outerScrollContainer.scrollTo(0, 0);
    }

    // ── SCROLL ────────────────────────────────────────
    function scrollDown(previousBottomEdge) {
        if (!isAnimationEnabled()) return;
        var target = previousBottomEdge;
        var limit  = outerScrollContainer.scrollHeight - outerScrollContainer.clientHeight;
        if (target > limit) target = limit;
        var start  = outerScrollContainer.scrollTop;
        var dist   = target - start;
        if (Math.abs(dist) < 4) return;
        var duration = 300 + 300 * dist / 100;
        var startTime = null;
        function step(time) {
            if (startTime == null) startTime = time;
            var t = (time - startTime) / duration;
            var lerp = 3*t*t - 2*t*t*t;
            outerScrollContainer.scrollTo(0, (1.0 - lerp) * start + lerp * target);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // ── UTILITIES ─────────────────────────────────────
    function isAnimationEnabled() {
        return window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    }

    function showAfter(delay, el) {
        if (!isAnimationEnabled() || delay === 0) {
            // Show immediately — no timeout overhead
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
            setTimeout(function () { el.classList.remove('hide'); }, delay);
        }
    }

    function contentBottomEdgeY() {
        var bottom = storyContainer.lastElementChild;
        return bottom ? bottom.offsetTop + bottom.offsetHeight : 0;
    }

    function removeAll(selector) {
        storyContainer.querySelectorAll(selector).forEach(function (el) { el.parentNode.removeChild(el); });
    }

    function setVisible(selector, visible) {
        storyContainer.querySelectorAll(selector).forEach(function (el) {
            el.classList.toggle('invisible', !visible);
        });
    }

    function splitPropertyTag(tag) {
        var idx = tag.indexOf(':');
        if (idx === -1) return null;
        return { property: tag.substr(0, idx).trim(), val: tag.substr(idx + 1).trim() };
    }

})(storyContent);


/* ── PANEL COLLAPSE (mobile) ─────────────────────────
   Not needed in new layout since there's no side panel toggle,
   but kept stub in case old Plague.js references it.
─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
    var wrapper = document.getElementById('game-wrapper');
    var btn     = document.getElementById('panel-toggle');
    if (!wrapper || !btn) return;

    function setCollapsed(c) {
        wrapper.classList.toggle('panel-collapsed', c);
        btn.textContent = c ? '⟩' : '⟨';
        btn.setAttribute('aria-expanded', !c);
    }
    btn.addEventListener('click', function () {
        setCollapsed(!wrapper.classList.contains('panel-collapsed'));
    });
    setCollapsed(true);
});
