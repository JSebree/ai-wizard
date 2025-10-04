import React, { useMemo, useState, useEffect } from "react";
import VoiceStep from "./steps/VoiceStep.jsx";
import ReviewStep from "./steps/ReviewStep.jsx";
import AdvancedSettingsStep from "./steps/AdvancedSettingsStep.jsx";
// ---- Global Reset Helper (legacy-compatible) ----
export function resetWizardFormGlobal() {
  try {
    // Current wizard keys
    localStorage.removeItem("interview_answers_v1");
    localStorage.removeItem("interview_step_v1");
    // Legacy/compat keys
    localStorage.removeItem("ai-wizard-ui");
    localStorage.removeItem("n8nJobState");
    localStorage.removeItem("ai-wizard-activeStep");
    localStorage.removeItem("ai-wizard-state");
    localStorage.removeItem("n8nNoCors");
    localStorage.removeItem("last_job_id");
  } catch {}
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("jobId");
    window.history.replaceState({}, "", url);
  } catch {}
  window.location.reload();
}
/**
 * InterviewPage.jsx
 *
 * A single-page, 12-step guided interview that replaces the form-style UX.
 * The page asks one question at a time and builds a `ui` payload shaped like:
 *
 * {
 *   scene, driver, wantsCutaways, character, setting, action, directorsNotes,
 *   wantsMusic, musicDesc, wantsCaptions, durationSec, referenceText,
 *   voiceId, characterGender, title, characterName
 * }
 *
 * Notes:
 * - We infer gender from the selected voice display name (which contains the gender string).
 * - Minimal client-side validation is applied to keep the flow smooth.
 * - You can wire `onComplete` prop to submit the payload upstream. If not provided, we show a preview.
 */

// Local storage keys for refresh-proof persistence
const LS_KEY_ANS = "interview_answers_v1";
const LS_KEY_STEP = "interview_step_v1";
const TEMPLATE_KEY = "interview_template_v1";

const EMAIL_KEY = "interview_email_v1";
function readEmail() {
  try { return String(localStorage.getItem(EMAIL_KEY) || "").trim(); } catch { return ""; }
}
const FIRSTNAME_KEY = "interview_firstname_v1";
const LASTNAME_KEY = "interview_lastname_v1";
function readFirstName() {
  try { return String(localStorage.getItem(FIRSTNAME_KEY) || "").trim(); } catch { return ""; }
}
function readLastName() {
  try { return String(localStorage.getItem(LASTNAME_KEY) || "").trim(); } catch { return ""; }
}

// Attempt to read JSON safely
function readJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    try { return JSON.parse(s); } catch { return s; }
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function coerceVolume10(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  // v is 0.1..1.0 → scale to 1..10
  return Math.max(1, Math.min(10, Math.round(n * 10)));
}

function mapTemplateToAnswers(ui, defaults) {
  if (!ui || typeof ui !== "object") return null;
  const adv = ui.advanced || {};
  return {
    ...defaults,
    // Core prompts
    scene: ui.scene ?? defaults.scene,
    driver: ui.driver ?? defaults.driver,
    wantsCutaways:
      typeof ui.wantsCutaways === "boolean" ? ui.wantsCutaways : defaults.wantsCutaways,
    character: ui.character ?? defaults.character,
    // Voice
    voiceId: ui.voiceId ?? defaults.voiceId,
    voiceLabel: defaults.voiceLabel, // keep empty; will be derived by voices loader
    characterGender: ui.characterGender ?? defaults.characterGender,
    characterName: ui.characterName ?? defaults.characterName,
    // Setting / action
    setting: ui.setting ?? defaults.setting,
    action: ui.action ?? defaults.action,
    directorsNotes: ui.directorsNotes ?? defaults.directorsNotes,
    // Music
    wantsMusic:
      typeof ui.wantsMusic === "boolean" ? ui.wantsMusic : defaults.wantsMusic,
    musicCategoryLabel: ui.musicCategoryLabel ?? defaults.musicCategoryLabel,
    musicIncludeVocals:
      typeof adv.includeVocals === "boolean"
        ? adv.includeVocals
        : ((ui.lyrics || ui.musicLyrics) ? true : defaults.musicIncludeVocals),
    musicLyrics: (ui.lyrics ?? ui.musicLyrics ?? defaults.musicLyrics),
    // Captions & duration
    wantsCaptions:
      typeof ui.wantsCaptions === "boolean" ? ui.wantsCaptions : defaults.wantsCaptions,
    durationSec: Number(ui.durationSec ?? defaults.durationSec),
    // Title & references
    title: ui.title ?? defaults.title,
    referenceText: ui.referenceText ?? defaults.referenceText,
    // Advanced
    advancedEnabled:
      typeof adv.enabled === "boolean" ? adv.enabled : defaults.advancedEnabled,
    stylePreset: adv.style ?? defaults.stylePreset,
    musicVolume10:
      adv.musicVolume !== undefined ? coerceVolume10(adv.musicVolume) : defaults.musicVolume10,
    voiceVolume10:
      adv.voiceVolume !== undefined ? coerceVolume10(adv.voiceVolume) : defaults.voiceVolume10,
    musicSeed:
      adv.seed !== undefined && adv.seed !== null ? String(adv.seed) : defaults.musicSeed,
  };
}

// Reusable defaults for answers
function getDefaultAnswers() {
  return {
    // 1
    scene: "",
    // 2
    driver: "", // "character" | "narrator"
    wantsCutaways: undefined, // boolean (only if character)
    character: "", // description if character flow
    // 3
    voiceId: "", // store the selection id/string; display text can be same
    voiceLabel: "", // optional: a human-friendly label including gender
    characterGender: undefined, // persist derived gender
    // 4
    characterName: "",
    // 5
    setting: "",
    // 6
    action: "",
    // 7
    directorsNotes: "",
    // 8
    wantsMusic: undefined, // boolean
    musicCategoryLabel: "",
    musicSeed: "",
    musicLyrics: "",
    // 9
    wantsCaptions: undefined, // boolean
    // 10
    durationSec: 45,
    // 11
    title: "",
    // 12
    referenceText: "",
    // Advanced settings
    advancedEnabled: true,
    stylePreset: "Photorealistic",
    musicVolume10: 1,     // 1..10 -> 0.1..1.0
    voiceVolume10: 10,    // 1..10 -> 0.1..1.0
    musicIncludeVocals: undefined, // shown only if wantsMusic === true
  };
}

// ----------------------------- helpers ---------------------------------

function limitChars(s, n) {
  const str = String(s ?? "");
  return n && n > 0 ? str.slice(0, n) : str;
}

function meetsMin(s, n) {
  const str = String(s ?? "").trim();
  return typeof n === "number" && n > 0 ? str.length >= n : req(str);
}

/** Extract gender from the voice display label. */
function inferGenderFromVoiceName(label = "") {
  const s = String(label || "").toLowerCase().trim();
  // Normalize underscores/hyphens and detect obvious gender tokens
  const norm = (" " + s.replace(/[_-]/g, " ") + " ").replace(/\s+/g, " ");
  if (/(^|\s)(female|woman|feminine)(\s|$)/.test(norm)) return "female";
  if (/(^|\s)(male|man|masculine)(\s|$)/.test(norm)) return "male";
  if (/(^|\s)(nonbinary|non\s*binary|neutral)(\s|$)/.test(norm)) return "nonbinary";

  // direct tokens and synonyms
  const direct = [
    "female",
    "male",
    "woman",
    "man",
    "nonbinary",
    "non-binary",
    "gender neutral",
    "neutral",
    "masculine",
    "feminine",
  ];
  for (const t of direct) {
    if (s.includes(t)) {
      if (t === "woman" || t === "feminine") return "female";
      if (t === "man" || t === "masculine") return "male";
      if (t === "gender neutral" || t === "neutral") return "nonbinary";
      if (t === "non-binary") return "nonbinary";
      return t; // "female" | "male" | "nonbinary"
    }
  }

  // bracketed short codes like "(F)", "[M]", "{NB}"
  const short = s.match(/[\(\[\{]\s*(f|m|nb|nonbinary|non-binary)\s*[\)\]\}]/i);
  if (short) {
    const code = short[1].toLowerCase();
    if (code === "f") return "female";
    if (code === "m") return "male";
    return "nonbinary";
  }

  // trailing or leading short codes like "- F", "F -", " NB "
  const edge = s.match(/(?:^|\s|-|\/)(f|m|nb)(?:\s|$)/i);
  if (edge) {
    const code = edge[1].toLowerCase();
    if (code === "f") return "female";
    if (code === "m") return "male";
    return "nonbinary";
  }

  // no match → undefined; upstream can choose a default
  return undefined;
}

/** Tiny required check */
const req = (v) => (v !== undefined && v !== null && String(v).trim().length > 0);


// --------------------------- Music categories (labels only) ---------------------------
const MUSIC_CATEGORIES = [
  "Rock Instrumental",
  "Jazz Instrumental",
  "Hip-Hop / Trap Beat",
  "Orchestral / Cinematic",
  "Lo-Fi / Chillhop",
  "EDM / House",
  "Ambient / Soundscape",
  "Reggae / Dub",
  "Funk / Groove",
  "Country / Folk",
  "Blues",
  "Metal",
  "Techno",
  "Latin / Salsa",
  "R&B / Soul",
  "Gospel",
  "Indian Classical / Sitar",
  "African Percussion",
  "Celtic / Folk",
  "Synthwave / Retro",
];
// --------------------------- UI primitives ------------------------------

function RadioGroup({ name, value, onChange, options, inline = false }) {
  return (
    <div className={inline ? "radio-inline" : "radio-block"}>
      {options.map((o) => (
        <label key={o.value} style={{ marginRight: 16, display: inline ? "inline-flex" : "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={(e) => onChange(e.target.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function FieldRow({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
      {hint ? <div style={{ color: "#667085", fontSize: 12, marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}

function NavBar({ stepIndex, total, onReset }) {
  const pct = Math.round(((stepIndex + 1) / total) * 100);
  return (
    <div style={{ position: "sticky", top: 0, background: "#fff", padding: "8px 0 14px", zIndex: 5 }}>
      {/* Top row with Reset aligned right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          onClick={onReset}
          className="btn"
          title="Clear all answers and start over"
          style={{ padding: "6px 10px" }}
        >
          Reset all
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: "#EEF2F7", borderRadius: 999 }}>
        <div
          style={{
            width: `${pct}%`,
            height: 6,
            background: "#3B82F6",
            borderRadius: 999,
            transition: "width .25s ease",
          }}
        />
      </div>

      <style>{`
        .btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #fff; cursor: pointer; }
        .btn[disabled] { opacity: .5; cursor: not-allowed; }
        .btn-primary[disabled] { opacity: .6; }
        .btn-primary { background: #111827; color: white; border-color: #111827; }
        .btn-secondary { background: #fff; color: #111827; }
        textarea { width: 100%; min-height: 120px; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; }
        input[type="text"], input[type="number"] { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; }
        .page { max-width: 860px; margin: 0 auto; padding: 24px; }
        .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 18px; }
        .radio-inline input[type="radio"] { transform: translateY(1px); }
      `}</style>
    </div>
  );
}

// --------------------------- Main component -----------------------------

export default function InterviewPage({ onComplete }) {
  // Core answer state
  const [answers, setAnswers] = useState(() => {
    const defaults = getDefaultAnswers();
    const saved = readJSON(LS_KEY_ANS, null);
    if (saved && saved.advancedEnabled === undefined) {
      saved.advancedEnabled = true;
    }
    return saved ? { ...defaults, ...saved } : defaults;
  });

  const [stepIndex, setStepIndex] = useState(() => Number(readJSON(LS_KEY_STEP, 0)) || 0);

  useEffect(() => {
    function onGoReview() {
      const last = steps.length - 1;
      if (last >= 0) setStepIndex(last);
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    }
    window.addEventListener("interview:goReviewStep", onGoReview);
    return () => window.removeEventListener("interview:goReviewStep", onGoReview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow external components (e.g., ReviewStep) to jump to a specific step by key
  useEffect(() => {
    function onGoSpecificStep(e) {
      const d = e?.detail;
      const key = (d && (d.key || d.stepKey || d.targetKey || d)) || null;
      if (!key) return;
      const idx = steps.findIndex((s) => s.key === key);
      if (idx >= 0) {
        setStepIndex(idx);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      }
    }

    window.addEventListener("interview:goStep", onGoSpecificStep);
    window.addEventListener("interview:editStep", onGoSpecificStep);

    return () => {
      window.removeEventListener("interview:goStep", onGoSpecificStep);
      window.removeEventListener("interview:editStep", onGoSpecificStep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const N8N_WEBHOOK_URL =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_N8N_WEBHOOK_URL : undefined) ||
    (typeof window !== "undefined" ? window.N8N_WEBHOOK_URL : undefined) ||
    "https://n8n.simplifies.click/webhook/sceneme" ||
    "/api/interview"; // final local dev/proxy fallback

  const N8N_AUTH_TOKEN =
    (typeof window !== "undefined" ? window.N8N_TOKEN : undefined) ||
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_N8N_TOKEN : undefined) ||
    undefined;

  // Legacy toggle to bypass CORS preflight via proxy/worker if needed
  const n8nNoCors = (() => {
    try { return localStorage.getItem("n8nNoCors") === "1"; } catch { return false; }
  })();

  // Supabase (read-only) envs
  const SUPABASE_URL =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : undefined) ||
    (typeof window !== "undefined" ? window.SUPABASE_URL : undefined) || "";

  const SUPABASE_ANON =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
    (typeof window !== "undefined" ? window.SUPABASE_ANON_KEY : undefined) || "";

  // Voices cache config (legacy-ish)
  const VOICES_CACHE_KEY = "voices_cache_v1";
  const VOICES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  // Voices cache: local state + helpers (legacy-parity)
  const [voices, setVoices] = useState(() => {
    try {
      const raw = localStorage.getItem(VOICES_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.ts) return null;
      if (Date.now() - parsed.ts > VOICES_CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  });

  function cacheVoices(list) {
    try {
      localStorage.setItem(
        VOICES_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), data: Array.isArray(list) ? list : [] })
      );
    } catch {}
  }

  function normalizeVoices(list = []) {
    return list
      .map((v) => {
        const id = v.id ?? v.voice_id ?? v.tts_id ?? "";
        const name = v.voice_name ?? v.name ?? v.label ?? "";
        const audio_url = v.audio_url ?? v.preview ?? v.sample ?? "";
        return { id, name, audio_url };
      })
      .filter((v) => v.id && v.name);
  }

  async function loadVoices() {
    // 1) Try static file
    try {
      const res = await fetch("/voices.json", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const list = normalizeVoices(Array.isArray(json) ? json : json?.voices || []);
        if (list.length) {
          cacheVoices(list);
          setVoices(list);
          return list;
        }
      }
    } catch {}

    // 2) Fallback to Supabase REST (read-only)
    if (!SUPABASE_URL || !SUPABASE_ANON) return null;
    try {
      const url = new URL("/rest/v1/voices_public", SUPABASE_URL);
      url.searchParams.set("select", "id,voice_name,name,audio_url,active");
      url.searchParams.set("active", "eq.true");
      const res = await fetch(url.toString(), {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
      });
      if (res.ok) {
        const rows = await res.json();
        const list = normalizeVoices(rows);
        if (list.length) {
          cacheVoices(list);
          setVoices(list);
          return list;
        }
      }
    } catch {}

    return null;
  }

  // Persist on change (refresh-proof)
  useEffect(() => {
    writeJSON(LS_KEY_ANS, answers);
  }, [answers]);

  useEffect(() => {
    writeJSON(LS_KEY_STEP, stepIndex);
  }, [stepIndex]);

  // Listen for app-level request to jump to first step without clearing answers
  useEffect(() => {
    function handleGoFirstStep() {
      setStepIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("interview:goFirstStep", handleGoFirstStep);
    return () => {
      window.removeEventListener("interview:goFirstStep", handleGoFirstStep);
    };
  }, []);

  // Load voices on mount and gently default to Emma if no voice is chosen
  useEffect(() => {
    let cancelled = false;

    async function ensureVoices() {
      if (!voices) {
        const list = await loadVoices();
        if (cancelled) return;

        // If user hasn’t picked a voice yet, gently set Emma (or first entry)
        if (list && (!answers.voiceId || String(answers.voiceId).trim() === "")) {
          const emma = list.find((v) => /emma/i.test(v.name)) || list[0];
          if (emma) {
            setAnswers((s) => ({
              ...s,
              voiceId: emma.id,
              voiceLabel: emma.name,
            }));
          }
        }
      } else {
        // Voices restored from cache; also ensure default if needed
        if (!answers.voiceId || String(answers.voiceId).trim() === "") {
          const emma = voices.find((v) => /emma/i.test(v.name)) || voices[0];
          if (emma) {
            setAnswers((s) => ({
              ...s,
              voiceId: emma.id,
              voiceLabel: emma.name,
            }));
          }
        }
      }
    }

    ensureVoices();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep characterGender in answers whenever the voice changes
  useEffect(() => {
    const labelFromObject =
      (answers.voiceId && typeof answers.voiceId === "object"
        ? (answers.voiceId.voice_name || answers.voiceId.name || "")
        : "");

    // If we have an id but no label yet, try to backfill from voices[]
    if ((!answers.voiceLabel || !String(answers.voiceLabel).trim())
        && Array.isArray(voices)
        && answers.voiceId
        && typeof answers.voiceId !== 'object') {
      const m = voices.find(v => v.id === answers.voiceId);
      if (m && m.name) {
        setAnswers((s) => ({ ...s, voiceLabel: m.name }));
      }
    }

    const labelForGender = answers.voiceLabel || labelFromObject || String(answers.voiceId || "");
    const g = inferGenderFromVoiceName(labelForGender);

    setAnswers((s) => (s.characterGender === g ? s : { ...s, characterGender: g }));
  }, [answers.voiceId, answers.voiceLabel, voices]);

  // Derived fields (kept for quick display if you want)
  const characterGender = useMemo(
    () => inferGenderFromVoiceName(answers.voiceLabel || answers.voiceId),
    [answers.voiceId, answers.voiceLabel]
  );

  // Build final UI payload (live preview)
  const uiPayload = useMemo(() => {
    const {
      scene, driver, wantsCutaways, character, setting, action, directorsNotes,
      wantsMusic, wantsCaptions, durationSec, referenceText,
      voiceId, characterName, title,
    } = answers;

    const normalizedVoiceId =
      typeof voiceId === "object"
        ? (voiceId.id || voiceId.voice_id || voiceId.tts_id || "")
        : voiceId;
    const userEmail = readEmail();
    const userFirstName = readFirstName();
    const userLastName = readLastName();

    return {
      scene: req(scene) ? scene : undefined,
      driver: req(driver) ? driver : undefined,
      wantsCutaways: driver === "character" ? Boolean(wantsCutaways) : undefined,
      character: driver === "character" && req(character) ? character : null,
      setting: req(setting) ? setting : undefined,
      action: req(action) ? action : undefined,
      directorsNotes: req(directorsNotes) ? directorsNotes : undefined,
      wantsMusic: typeof wantsMusic === "boolean" ? wantsMusic : undefined,
      musicCategoryLabel: req(answers.musicCategoryLabel) ? answers.musicCategoryLabel : undefined,
      wantsCaptions: typeof wantsCaptions === "boolean" ? wantsCaptions : undefined,
      durationSec: Number(durationSec) || 0,
      referenceText: req(referenceText) ? referenceText : undefined,
      lyrics:
        answers.wantsMusic && answers.musicIncludeVocals && req(answers.musicLyrics)
          ? answers.musicLyrics
          : undefined,
      voiceId: req(normalizedVoiceId) ? normalizedVoiceId : undefined,
      characterGender: answers.characterGender, // <-- use persisted value
      title: req(title) ? title : undefined,
      characterName: req(characterName) ? characterName : undefined,
      userEmail: userEmail || undefined,
      userFirstName: userFirstName || undefined,
      userLastName: userLastName || undefined,
      // Advanced (grouped)
      advanced: {
        enabled: Boolean(answers.advancedEnabled),
        style: req(answers.stylePreset) ? answers.stylePreset : "Photorealistic",
        // export ffmpeg-scale volumes (0.1–1.0)
        musicVolume: Math.max(1, Math.min(10, answers.musicVolume10 ?? 1)) / 10,
        voiceVolume: Math.max(1, Math.min(10, answers.voiceVolume10 ?? 10)) / 10,
        includeVocals:
          answers.wantsMusic && typeof answers.musicIncludeVocals === "boolean"
            ? answers.musicIncludeVocals
            : undefined,
        seed: (function() {
          const raw = answers.musicSeed;
          const s = (raw === undefined || raw === null) ? "" : String(raw).trim();
          if (s) {
            const n = Number(s);
            return Number.isFinite(n) ? Math.trunc(n) : undefined;
          }
          // No seed provided → pick a random one so it shows up in the JSON output
          return Math.floor(Math.random() * 999_999_999) + 1;
        })(),
      },
    };
  }, [answers]);

  // --------------------------- Steps definition -------------------------

  const steps = [
    {
      key: "scene",
      label: "Tell me about the scene that you would like to create.",
      render: () => (
        <FieldRow label="Describe your scene" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="e.g., Barcelona harbor and old city at golden hour."
            value={answers.scene}
            onChange={(e) => setAnswers((s) => ({ ...s, scene: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => meetsMin(answers.scene, 40),
    },
    {
      key: "driver",
      label: "Who’s guiding the scene?",
      render: () => (
        <>
          <FieldRow label="Choose your star">
            <RadioGroup
              name="driver"
              value={answers.driver}
              onChange={(v) =>
                setAnswers((s) => ({
                  ...s,
                  driver: v, // reset dependent fields when switching
                  wantsCutaways: v === "character" ? s.wantsCutaways : undefined,
                  character: v === "character" ? s.character : "",
                }))
              }
              options={[
                { value: "character", label: "Character — An on-camera avatar who is part of the action." },
                { value: "narrator", label: "Narrator — An off-screen voice that tells the story." },
              ]}
              inline
            />
          </FieldRow>

          {/* New: character/narrator name on this step */}
          <FieldRow label="What is your star's name?">
            <input
              type="text"
              placeholder="e.g., Sarah"
              value={answers.characterName}
              onChange={(e) =>
                setAnswers((s) => ({ ...s, characterName: e.target.value }))
              }
            />
          </FieldRow>

          {answers.driver === "character" && (
            <>
              <FieldRow label="Do you want cutaway shots?" hint="Additional shots in the scene that don’t include an on-camera character.">
                <RadioGroup
                  name="cutaways"
                  value={
                    answers.wantsCutaways === true
                      ? "yes"
                      : answers.wantsCutaways === false
                      ? "no"
                      : ""
                  }
                  onChange={(v) =>
                    setAnswers((s) => ({ ...s, wantsCutaways: v === "yes" }))
                  }
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  inline
                />
              </FieldRow>

              <FieldRow
                label="Please describe your character"
                hint="The more detail you provide, the better your results will match your intentions."
              >
                <textarea
                  placeholder="e.g., Sarah, mid-30s, friendly travel host in casual linen, warm presence."
                  value={answers.character}
                  onChange={(e) =>
                    setAnswers((s) => ({ ...s, character: e.target.value }))
                  }
                />
              </FieldRow>
            </>
          )}
        </>
      ),
      valid: () =>
        req(answers.driver) &&
        req(answers.characterName) && (
          answers.driver !== "character" || (
            typeof answers.wantsCutaways === "boolean" && meetsMin(answers.character, 40)
          )
        ),
    },
    {
      key: "voiceId",
      label: "Pick your character or narrator’s voice.",
      render: () => (
        <VoiceStep
          value={answers.voiceId}
          labelValue={answers.voiceLabel}
          onChange={(a, b) => {
            if (a && typeof a === 'object') {
              const id = a.voiceId ?? a.voice_id ?? a.id ?? '';
              const label = a.voiceLabel ?? a.voice_name ?? a.name ?? b ?? '';
              setAnswers((s) => ({ ...s, voiceId: id, voiceLabel: label || s.voiceLabel }));
            } else {
              setAnswers((s) => ({ ...s, voiceId: a, voiceLabel: b ?? s.voiceLabel }));
            }
          }}
          onLabelChange={(label) =>
            setAnswers((s) => ({ ...s, voiceLabel: label }))
          }
          genderPreview={characterGender}
        />
      ),
      valid: () => req(answers.voiceId),
    },
    {
      key: "setting",
      label: "Describe the scene’s setting.",
      render: () => (
        <FieldRow label="Setting" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="e.g., Wide establishing shots of harbor, aerials over rooftops, bustling alleys in warm evening light."
            value={answers.setting}
            onChange={(e) => setAnswers((s) => ({ ...s, setting: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => meetsMin(answers.setting, 40),
    },
    {
      key: "action",
      label: "Describe what action is happening in the scene.",
      render: () => (
        <FieldRow label="Action" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="e.g., Cinematic montage only. Environmental B-roll: boats, rooftops, markets; no on-camera speaker."
            value={answers.action}
            onChange={(e) => setAnswers((s) => ({ ...s, action: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => meetsMin(answers.action, 30),
    },
    {
      key: "referenceText",
      label: "Improve scene accuracy by adding script guidance (context, quotes, or key points).",
      render: () => (
        <FieldRow label="Script guidance" hint="The more detail you provide, the better your results will match your intentions. Minimum 30 characters.">
          <textarea
            placeholder="E.g., product overview, key talking points, or an excerpt that sets tone and facts."
            value={answers.referenceText}
            onChange={(e) =>
              setAnswers((s) => ({ ...s, referenceText: e.target.value }))
            }
          />
        </FieldRow>
      ),
      valid: () => meetsMin(answers.referenceText, 30),
    },
    {
      key: "durationSec",
      label: "How long do you want your scene to be?",
      render: () => (
        <FieldRow label="Duration (seconds)" hint="Renders generally take 2–3 mins per 1 second of video.">
          <input
            type="number"
            min={3}
            step={1}
            value={answers.durationSec}
            onChange={(e) =>
              setAnswers((s) => ({ ...s, durationSec: Number(e.target.value) }))
            }
          />
        </FieldRow>
      ),
      valid: () => Number(answers.durationSec) > 0,
    },
    {
      key: "title",
      label: "What is the title of your scene?",
      render: () => (
        <FieldRow label="Title">
          <input
            type="text"
            placeholder="e.g., Barcelona Harbor &amp; City — B-Roll"
            value={answers.title}
            onChange={(e) => setAnswers((s) => ({ ...s, title: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => req(answers.title),
    },
    {
      key: "wantsMusic",
      label: "Do you want background music?",
      render: () => (
        <>
          <FieldRow label="Background music?">
            <RadioGroup
              name="wantsMusic"
              value={
                answers.wantsMusic === true
                  ? "yes"
                  : answers.wantsMusic === false
                  ? "no"
                  : ""
              }
              onChange={(v) =>
                setAnswers((s) => {
                  const enable = v === "yes";
                  const shouldInit = enable && !s.musicCategoryLabel && MUSIC_CATEGORIES.length > 0;
                  return {
                    ...s,
                    wantsMusic: enable,
                    musicIncludeVocals: enable ? (s.musicIncludeVocals ?? undefined) : undefined,
                    musicCategoryLabel: shouldInit ? MUSIC_CATEGORIES[0] : (enable ? s.musicCategoryLabel : ""),
                  };
                })
              }
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              inline
            />
          </FieldRow>

          {answers.wantsMusic && (
            <>
              <FieldRow label="Include vocals in music?">
                <RadioGroup
                  name="musicIncludeVocals"
                  value={
                    answers.musicIncludeVocals === true
                      ? "yes"
                      : answers.musicIncludeVocals === false
                      ? "no"
                      : ""
                  }
                  onChange={(v) =>
                    setAnswers((s) => ({
                      ...s,
                      musicIncludeVocals: v === "yes",
                    }))
                  }
                  options={[
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                  ]}
                  inline
                />
              </FieldRow>

              <FieldRow label="Choose a music style">
                <select
                  value={answers.musicCategoryLabel || ""}
                  onChange={(e) =>
                    setAnswers((s) => ({ ...s, musicCategoryLabel: e.target.value }))
                  }
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
                >
                  <option value="" disabled>— Select a preset —</option>
                  {MUSIC_CATEGORIES.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </FieldRow>
              {answers.musicIncludeVocals && (
                <FieldRow label="Lyrics (optional)" hint="Paste or type your lyrics. You can include [verse], [chorus], [bridge] markers if you like.">
                  <textarea
                    placeholder="[verse]\nWalking down the city lights at midnight...\n\n[chorus]\nYou and me, under neon skies..."
                    value={answers.musicLyrics}
                    onChange={(e) =>
                      setAnswers((s) => ({ ...s, musicLyrics: e.target.value }))
                    }
                  />
                </FieldRow>
              )}
            </>
          )}
        </>
      ),
      valid: () => typeof answers.wantsMusic === "boolean",
    },
    {
      key: "wantsCaptions",
      label: "Do you want captions?",
      render: () => (
        <FieldRow label="Captions?">
          <RadioGroup
            name="wantsCaptions"
            value={
              answers.wantsCaptions === true
                ? "yes"
                : answers.wantsCaptions === false
                ? "no"
                : ""
            }
            onChange={(v) =>
              setAnswers((s) => ({ ...s, wantsCaptions: v === "yes" }))
            }
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            inline
          />
        </FieldRow>
      ),
      valid: () => typeof answers.wantsCaptions === "boolean",
    },
    {
      key: "directorsNotes",
      label: "Do you have any director’s notes?",
      render: () => (
        <FieldRow label="Director’s notes (optional)" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="e.g., Prioritize variety and atmosphere. Avoid readable signage."
            value={answers.directorsNotes}
            onChange={(e) =>
              setAnswers((s) => ({ ...s, directorsNotes: e.target.value }))
            }
          />
        </FieldRow>
      ),
      valid: () => true,
    },
    {
      key: "advanced",
      label: "Advanced settings",
      render: () => (
        <AdvancedSettingsStep
          enabled={Boolean(answers.advancedEnabled)}
          onEnabledChange={(enabled) =>
            setAnswers((s) => ({ ...s, advancedEnabled: Boolean(enabled) }))
          }
          styleValue={answers.stylePreset || "Photorealistic"}
          onStyleChange={(style) =>
            setAnswers((s) => ({ ...s, stylePreset: String(style || "Photorealistic") }))
          }
          music10={answers.musicVolume10 ?? 1}
          onMusic10Change={(v) =>
            setAnswers((s) => ({
              ...s,
              musicVolume10: Math.max(1, Math.min(10, Number(v) || 1)),
            }))
          }
          voice10={answers.voiceVolume10 ?? 10}
          onVoice10Change={(v) =>
            setAnswers((s) => ({
              ...s,
              voiceVolume10: Math.max(1, Math.min(10, Number(v) || 10)),
            }))
          }
          musicSeed={answers.musicSeed ?? ""}
          onMusicSeedChange={(v) => setAnswers((s) => ({ ...s, musicSeed: v }))}
        />
      ),
      valid: () => true,
    },
    {
      key: "review",
      label: "Review your answers",
      render: () => (
        <ReviewStep
          ui={uiPayload}
          onEditStep={(target) => {
            let idx = -1;
            if (typeof target === 'number') {
              idx = target;
            } else if (typeof target === 'string') {
              idx = steps.findIndex((s) => s.key === target);
            } else if (target && typeof target === 'object') {
              const key = target.key ?? target.stepKey ?? target.targetKey ?? null;
              const i = target.index ?? target.stepIndex ?? null;
              if (Number.isInteger(i)) idx = i;
              else if (typeof key === 'string') idx = steps.findIndex((s) => s.key === key);
            }
            if (idx >= 0 && idx < steps.length) {
              setStepIndex(idx);
              try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
            }
          }}
        />
      ),
      valid: () => true,
    },
  ];

  useEffect(() => {
    // Hydrate from landing-page template and jump to Review
    try {
      const raw = localStorage.getItem(TEMPLATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const defaults = getDefaultAnswers();
        const ui = parsed?.ui || parsed; // support either {ui:{...}} or direct ui object
        const mapped = mapTemplateToAnswers(ui, defaults);
        if (mapped) {
          setAnswers(mapped);
          writeJSON(LS_KEY_ANS, mapped);
          const last = steps.length - 1;
          if (last >= 0) {
            setStepIndex(last);
            writeJSON(LS_KEY_STEP, last);
            try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
          }
        }
      }
    } catch {}
    // Clear the template so refreshes don't re-apply it
    try { localStorage.removeItem(TEMPLATE_KEY); } catch {}
  }, [steps.length]);

  const total = steps.length;
  const step = steps[stepIndex];

  // Submit state (for footer submit on Review step)
  const [submitting, setSubmitting] = useState(false);

  // Legacy-compatible submit handler (for Review step footer button)
  async function submitNowLegacy() {
    if (submitting) return;
    setSubmitting(true);

    // Signal submit immediately so ReviewStep can show the banner
    try { sessionStorage.setItem('just_submitted', '1'); } catch {}
    try { window.dispatchEvent(new Event('interview:submit')); } catch {}

    // Build the payload (wrap under { ui } for intake; adjust here if your n8n expects a different shape)
    const payload = { ui: uiPayload };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (N8N_AUTH_TOKEN) headers['Authorization'] = `Bearer ${N8N_AUTH_TOKEN}`;

      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'omit',
        mode: 'cors',
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        alert(`Submit failed (${res.status}): ${t}`);
        setSubmitting(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const returnedJobId = data.jobId || data.jobID || data.id || '';

      const statusUrl = data.statusUrl || undefined;

      // Persist jobId for the Review step auto-poller (existing code follows)
      try { localStorage.setItem('last_job_id', String(returnedJobId || '')); } catch {}
      try {
        const url = new URL(window.location.href);
        if (returnedJobId) url.searchParams.set('jobId', String(returnedJobId));
        window.history.replaceState({}, '', url);
      } catch {}

      // Notify listeners (ReviewStep) that a new job has been created
      try {
        window.dispatchEvent(new CustomEvent('interview:submitted', {
          detail: { jobId: String(returnedJobId || ''), statusUrl }
        }));
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('interview:newJobId', {
          detail: { jobId: String(returnedJobId || ''), statusUrl }
        }));
      } catch {}

      // Stay on Review step (we're already there); ensure top-of-page
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
    } catch (err) {
      console.error(err);
      alert('Network error while submitting.');
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------- navigation --------------------------------

  // Helper to copy JSON to clipboard
  function copyJson() {
    try {
      const jsonStr = JSON.stringify({ ui: uiPayload }, null, 2);
      navigator.clipboard.writeText(jsonStr).then(
        () => {
          alert("Copied JSON to clipboard");
        },
        () => {
          alert("Copy failed");
        }
      );
    } catch {
      alert("Copy failed");
    }
  }

  // Helper to download JSON as file
  function downloadJson() {
    try {
      const jsonStr = JSON.stringify({ ui: uiPayload }, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interview_payload.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    }
  }

  function handleNext() {
    if (!step.valid()) return;
    if (stepIndex < total - 1) {
      setStepIndex(stepIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrev() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function resetAll() {
    resetWizardFormGlobal();
  }


  // ------------------------------ render ---------------------------------

  return (
    <div className="page">
      <NavBar
        stepIndex={stepIndex}
        total={total}
        onReset={resetAll}
      />

      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>{step.label}</h2>
        {step.render()}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePrev} disabled={stepIndex === 0} className="btn btn-secondary">
            ← Back
          </button>

          {stepIndex === total - 1 ? (
            <button
              type="button"
              onClick={submitNowLegacy}
              disabled={submitting}
              className="btn btn-primary"
              title="Submit"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleNext}
                disabled={!step.valid()}
                className="btn btn-primary"
                title="Next step"
              >
                {stepIndex === total - 2 ? 'Review' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}