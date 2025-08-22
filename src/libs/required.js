// src/libs/required.js
// Central place for defaults & required-field validation.

export const DEFAULTS = {
  minimalInput: {
    title: "Untitled Video",
    subject: "",
    durationSec: 60,
    route: "aroll",
    style: "default",
    tone: "neutral",
    characters: [{ id: "char1", name: "Host", voiceId: "" }],
    flags: { captions: true, music: true, podcastStill: false },
    packHints: {
      base: "base_creator_video",
      style: "pack_style_presenter",
      look: "pack_look_clean_host",
      motion: "pack_motion_confident",
      props: "pack_props_none",
      mouth: "pack_mouth_subtle",
      environment: "env_auto",
      personaKind: "human",
    },
  },
  referenceText: "",
  tags: "",
  location: "",
  music: { mood: "light underscore", tempo: "95-110bpm" },
};

export function ensureDefaults(state = {}) {
  const merged = { ...DEFAULTS, ...(state || {}) };
  merged.minimalInput = { ...DEFAULTS.minimalInput, ...(state?.minimalInput || {}) };

  // characters
  const chars = Array.isArray(merged.minimalInput.characters)
    ? merged.minimalInput.characters
    : [];
  merged.minimalInput.characters =
    chars.length > 0 ? chars : [{ id: "char1", name: "Host", voiceId: "" }];

  // flags
  merged.minimalInput.flags = {
    ...DEFAULTS.minimalInput.flags,
    ...(state?.minimalInput?.flags || {}),
  };

  // packHints
  merged.minimalInput.packHints = {
    ...DEFAULTS.minimalInput.packHints,
    ...(state?.minimalInput?.packHints || {}),
  };

  return merged;
}

export const REQUIRED_FIELDS = [
  "minimalInput.title",
  "minimalInput.durationSec",
  "minimalInput.route",
  "minimalInput.characters.0.name",
];

export function findMissingRequired(state) {
  const s = ensureDefaults(state);
  const missing = [];
  if (!s.minimalInput?.title?.trim()) missing.push("Title");
  if (!s.minimalInput?.durationSec || Number(s.minimalInput.durationSec) <= 0)
    missing.push("Duration (sec)");
  if (!s.minimalInput?.route?.trim()) missing.push("Route");
  if (!s.minimalInput?.characters?.[0]?.name?.trim())
    missing.push("Character name");
  return { missing, ok: missing.length === 0, state: s };
}