// SCENE_IMAGES — full registry of all scene image filenames.
// The scene controller in index.html reads this to set img.src values.
// Add new images here; logic lives in the IMAGE_DEFS block in index.html.
const SCENE_IMAGES = {
  // ── special ──────────────────────────────────────
  start_map:            "start_map.gif",
  start_interior:       "start_interior.gif",
  grave:                "grave.gif",

  // ── start phase (early game) ─────────────────────
  start_spring:         "start_spring.gif",
  start_spring_rain:    "start_spring_rain.gif",
  start_summer:         "start_summer.gif",
  start_summer_rain:    "start_summer_rain.gif",
  start_fall:           "start_fall.gif",
  start_fall_rain:      "start_fall_rain.gif",
  start_winter:         "start_winter.gif",
  start_winter_rabbit:  "start_winter_rabbit.gof",
  start_winter_cow:     "start_winter_cow.gif",

  // ── ct phase (Customary Tenant) ──────────────────
  ct_spring:            "ct_spring.gif",
  ct_summer:            "ct_summer.gif",   // note: file is named Ct_Cummer.webp
  ct_fall:              "ct_fall.gif",

  // ── l phase (Leaseholder) ────────────────────────
  l_spring:             "l_spring.gif",
  l_summer:             "l_summer.gif",
  l_summer_cow:         "l_summer_cow.gifp",
  l_summer_ale:         "l_summer_ale.gif",
  l_fall:               "l_fall.gif",
  l_fall_ale:           "l_fall_ale.gif",
  l_winter:             "l_winter.gif",
  l_winter_cow:         "l_winter_cow.gif",
  l_winter_grain:       "l_winter_grain.gif",
  l_winter_ale:         "l_winter_ale.gif",
  l_winter_ale_grain:   "l_winter_ale_grain.gif",

  // ── cl phase → now using CT_ filenames ───────────
  cl_winter:            "ct_winter.gif",
  cl_winter_cow:        "ct_winter_cow.gif",
  cl_winter_grain:      "ct_winter_grain.gif",
};
