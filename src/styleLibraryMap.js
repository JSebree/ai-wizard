// Canonical Style Library map — derived from n8n Style Library node
export const STYLE_LIBRARY = {
  podcast: {
    name: "Studio Podcast",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_auto",
    style: "pack_style_presenter",
    motion: "pack_motion_confident",
    props: "pack_props_studio_backdrop",
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "light underscore", tempo: "90-110bpm" },
    flagDefaults: { captions: true, music: true, podcastStill: true }
  },
  "baby-podcast": {
    name: "Baby Podcast",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_auto",
    style: "pack_style_presenter",
    motion: "pack_motion_confident",
    props: "pack_props_studio_backdrop",
    mouth: "pack_mouth_subtle",
    personaKind: "baby",
    music: { mood: "whimsical underscore", tempo: "85-100bpm" },
    flagDefaults: { captions: true, music: true, podcastStill: true }
  },
  vlog: {
    name: "Street Vlog",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_city_day",
    style: "pack_style_presenter",
    motion: "pack_motion_expressive",
    props: null,
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "upbeat vlog", tempo: "100-120bpm" },
    flagDefaults: { captions: true, music: true }
  },
  pov: {
    name: "Point of View",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_auto",
    style: "pack_style_presenter",
    motion: "pack_motion_expressive",
    props: null,
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "cinematic light", tempo: "80-100bpm" },
    flagDefaults: { captions: true, music: true }
  },
  cooking: {
    name: "Cooking / Recipe",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_kitchen_day",
    style: "pack_style_presenter",
    motion: "pack_motion_confident",
    props: "pack_props_kitchen_minimal",
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "light rhythmic", tempo: "95-110bpm" },
    flagDefaults: { captions: true, music: true }
  },
  explainer: {
    name: "2D Explainer",
    look: "pack_look_flat_illustration",
    base: "base_motion_graphics",
    environment: "env_flat_bg",
    style: "pack_style_presenter",
    motion: "pack_motion_graphic",
    props: null,
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "corporate friendly", tempo: "105-115bpm" },
    flagDefaults: { captions: true, music: true }
  },
  "generic-video": {
    name: "Generic Video",
    look: "pack_look_clean_host",
    base: "base_podcast_studio_video",
    environment: "env_auto",
    style: "pack_style_presenter",
    motion: "pack_motion_confident",
    props: null,
    mouth: "pack_mouth_subtle",
    personaKind: "adult",
    music: { mood: "light underscore", tempo: "95-110bpm" },
    flagDefaults: { captions: true, music: true }
  }
};

// --- Defaults & template→style mapping -------------------------------

// Which style should a brand-new user land on?
export const DEFAULT_STYLE_KEY = "podcast";

/**
 * Human-readable template labels coming from UI or upstream nodes
 * mapped to canonical STYLE_LIBRARY keys.
 * Feel free to expand these as you add templates.
 */
export const TEMPLATE_TO_STYLEKEY = {
  // Primary templates
  "Podcast / Presenter": "podcast",
  "Baby Podcast": "baby-podcast",
  "Street Vlog": "vlog",
  "POV / First-Person": "pov",
  "Cooking / Recipe": "cooking",
  "2D Explainer": "explainer",
  "Generic": "generic-video",

  // Short aliases that may appear in menus
  "Podcast": "podcast",
  "Presenter": "podcast",
  "Vlog": "vlog",
  "POV": "pov",
  "Explainer": "explainer",
};

/**
 * Best-effort resolver for arbitrary template labels.
 * - Exact match against TEMPLATE_TO_STYLEKEY
 * - Contains-match against TEMPLATE_TO_STYLEKEY keys
 * - Direct key use if label already equals a STYLE_LIBRARY key
 * - Fuzzy synonyms
 * - Fallback to DEFAULT_STYLE_KEY
 */
export function template_to_stylekey(label) {
  if (!label) return DEFAULT_STYLE_KEY;
  const raw = String(label).trim();
  const lc = raw.toLowerCase();

  // 1) Exact key match
  if (TEMPLATE_TO_STYLEKEY[raw]) return TEMPLATE_TO_STYLEKEY[raw];

  // 2) Contains-match over mapping keys (case-insensitive)
  for (const [k, v] of Object.entries(TEMPLATE_TO_STYLEKEY)) {
    if (lc.includes(k.toLowerCase())) return v;
  }

  // 3) Already a canonical key?
  if (STYLE_LIBRARY[lc]) return lc;

  // 4) Fuzzy synonyms
  const synonyms = {
    "podcast": ["presenter", "host", "studio podcast", "studio"],
    "baby-podcast": ["baby"],
    "vlog": ["street", "daily vlog"],
    "pov": ["first person", "first-person"],
    "cooking": ["cook", "kitchen", "recipe"],
    "explainer": ["2d", "motion graphics", "infographic"],
    "generic-video": ["generic", "default"],
  };
  for (const [styleKey, words] of Object.entries(synonyms)) {
    if (words.some(w => lc.includes(w))) return styleKey;
  }

  // 5) Fallback
  return DEFAULT_STYLE_KEY;
}