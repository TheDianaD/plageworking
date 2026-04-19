// SCENE_IMAGES — full registry of all scene image filenames.
// The scene controller in index.html reads this to set img.src values.
// Add new images here; logic lives in the IMAGE_DEFS block in index.html.
const SCENE_IMAGES = {
  // ── special ──────────────────────────────────────
  start_map:            "Start_Map.webp",
  start_interior:       "Start_Interior.webp",
  grave:                "Grave.webp",

  // ── start phase (early game) ─────────────────────
  start_spring:         "Start_Spring.webp",
  start_spring_rain:    "Start_Spring_Rain.webp",
  start_summer:         "Start_Summer.webp",
  start_summer_rain:    "Start_Summer_Rain.webp",
  start_fall:           "Start_Fall.webp",
  start_fall_rain:      "Start_Fall_Rain.webp",
  start_winter:         "Start_Winter.webp",
  start_winter_rabbit:  "Start_Winter_Rabbit.webp",
  start_winter_cow:     "Start_Winter_Cow.webp",

  // ── ct phase (Customary Tenant) ──────────────────
  ct_spring:            "CT_Spring.webp",
  ct_summer:            "Ct_Cummer.webp",   // note: file is named Ct_Cummer.webp
  ct_fall:              "CT_Fall.webp",

  // ── l phase (Leaseholder) ────────────────────────
  l_spring:             "L_Spring.webp",
  l_summer:             "L_Summer.webp",
  l_summer_cow:         "L_Summer_Cow.webp",
  l_summer_ale:         "L_Summer_Ale.webp",
  l_fall:               "L_Fall.webp",
  l_fall_ale:           "L_Fall_Ale.webp",
  l_winter:             "L_Winter.webp",
  l_winter_cow:         "L_Winter_Cow.webp",
  l_winter_grain:       "L_Winter_Grain.webp",
  l_winter_ale:         "L_Winter_Ale.webp",
  l_winter_ale_grain:   "L_Winter_Ale_Grain.webp",

  // ── cl phase → now using CT_ filenames ───────────
  cl_winter:            "CT_Winter.webp",
  cl_winter_cow:        "CT_Winter_Cow.webp",
  cl_winter_grain:      "CT_Winter_Grain.webp",
};
