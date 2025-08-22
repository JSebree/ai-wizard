// src/libs/buildN8nPayload.js
// Turns wizard state into a render-friendly payload preview.

import { inferStyleKey } from "./inferStyleKey.js";

export function buildN8nPayload(state = {}) {
  const mi = state.minimalInput || {};
  const flags = { captions: true, music: true, podcastStill: false, ...(mi.flags || {}) };

  const styleKey = state.styleKey || inferStyleKey({
    title: mi.title,
    subject: mi.subject,
    referenceText: state.referenceText,
    tags: state.tags,
    route: mi.route,
    style: mi.style,
    packHints: mi.packHints,
    personaKind: mi.packHints?.personaKind
  });

  return {
    kind: "WizardPreviewV1",
    minimalInput: {
      title: mi.title || "Untitled Video",
      subject: mi.subject || "",
      durationSec: Number(mi.durationSec) || 60,
      route: mi.route || "aroll",
      style: mi.style || "default",
      tone: mi.tone || "neutral",
      characters: Array.isArray(mi.characters) && mi.characters.length
        ? mi.characters
        : [{ id: "char1", name: "Host", voiceId: "" }],
      flags,
      packHints: mi.packHints || {}
    },
    referenceText: state.referenceText || "",
    tags: state.tags || "",
    location: state.location || "",
    packs: mi.packs || {},
    packHints: mi.packHints || {},
    speech: state.speech || { wordsPerSecond: 2 },
    storyboard: state.storyboard || null,
    styleKey
  };
}