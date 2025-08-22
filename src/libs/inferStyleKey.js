// src/libs/inferStyleKey.js
// Lightweight keyword-based style classifier used by the wizard and payload builder.

export function inferStyleKey({
  title = "",
  subject = "",
  referenceText = "",
  tags = "",
  route = "",
  style = "",
  packHints = {},
  personaKind = ""
} = {}) {
  const text = [
    title, subject, referenceText, tags, route, style,
    packHints?.base, packHints?.style, packHints?.look, packHints?.motion
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const RULES = [
    { key: "podcast",  any: [/podcast|mic|microphone|studio|hosted by|sit[- ]?down|interview|roundtable/] },
    { key: "vlog",     any: [/vlog|selfie|walk ?and ?talk|walking tour|street|travel vlog|daily vlog|on the go|front camera/] },
    { key: "pov",      any: [/pov|first person|from my view|through my eyes|hands in frame|point of view/] },
    { key: "cooking",  any: [/cook|recipe|kitchen|knife|pan|stir|whisk|chop|fry|bake|ingredient|asmr food|griddle|sizzle|flip/] },
    { key: "explainer",any: [/explain|tutorial|how it works|saas|infographic|whiteboard|motion graphics|after effects|animated|explainer/] },
    { key: "vlog-street", any: [/street vlog|city day|travel day|outdoor vlog|walking vlog|busy street|handheld/] },
  ];

  const matches = [];
  for (const rule of RULES) {
    const hit = rule.any?.some((rx) => rx.test(text));
    if (hit) matches.push({ key: rule.key, score: 1 });
  }
  matches.sort((a, b) => b.score - a.score);

  let styleKey = matches[0]?.key || "generic-video";

  const r = String(route || "").toLowerCase();
  if (r === "aroll" && styleKey === "generic-video") styleKey = "podcast";

  const pk = String(personaKind || packHints?.personaKind || "").toLowerCase();
  if (pk.includes("baby") && styleKey === "podcast") styleKey = "baby-podcast";

  return styleKey;
}