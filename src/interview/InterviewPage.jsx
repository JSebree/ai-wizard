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

// Attempt to read JSON safely
function readJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
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
    musicDesc: "",
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

/** Extract gender from the voice display label. */
function inferGenderFromVoiceName(label = "") {
  const s = String(label || "").toLowerCase().trim();

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

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

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

    const labelForGender = answers.voiceLabel || labelFromObject || String(answers.voiceId || "");
    const g = inferGenderFromVoiceName(labelForGender);

    setAnswers((s) => (s.characterGender === g ? s : { ...s, characterGender: g }));
  }, [answers.voiceId, answers.voiceLabel]);

  // Derived fields (kept for quick display if you want)
  const characterGender = useMemo(
    () => inferGenderFromVoiceName(answers.voiceLabel || answers.voiceId),
    [answers.voiceId, answers.voiceLabel]
  );

  // Build final UI payload (live preview)
  const uiPayload = useMemo(() => {
    const {
      scene, driver, wantsCutaways, character, setting, action, directorsNotes,
      wantsMusic, musicDesc, wantsCaptions, durationSec, referenceText,
      voiceId, characterName, title,
    } = answers;

    const normalizedVoiceId =
      typeof voiceId === "object"
        ? (voiceId.id || voiceId.voice_id || voiceId.tts_id || "")
        : voiceId;

    return {
      scene: req(scene) ? scene : undefined,
      driver: req(driver) ? driver : undefined,
      wantsCutaways: driver === "character" ? Boolean(wantsCutaways) : undefined,
      character: driver === "character" && req(character) ? character : null,
      setting: req(setting) ? setting : undefined,
      action: req(action) ? action : undefined,
      directorsNotes: req(directorsNotes) ? directorsNotes : undefined,
      wantsMusic: typeof wantsMusic === "boolean" ? wantsMusic : undefined,
      musicDesc: wantsMusic ? (req(musicDesc) ? musicDesc : undefined) : undefined,
      wantsCaptions: typeof wantsCaptions === "boolean" ? wantsCaptions : undefined,
      durationSec: Number(durationSec) || 0,
      referenceText: req(referenceText) ? referenceText : undefined,
      voiceId: req(normalizedVoiceId) ? normalizedVoiceId : undefined,
      characterGender: answers.characterGender, // <-- use persisted value
      title: req(title) ? title : undefined,
      characterName: req(characterName) ? characterName : undefined,
      // Advanced (grouped)
      advanced: {
        enabled: Boolean(answers.advancedEnabled),
        style: req(answers.stylePreset) ? answers.stylePreset : "Photorealistic",
        // keep 1–10 in payload; mapping to 0.1–1.0 is internal only
        musicVolume10: (answers.musicVolume10 ?? 1),
        voiceVolume10: (answers.voiceVolume10 ?? 10),
        includeVocals:
          answers.wantsMusic && typeof answers.musicIncludeVocals === "boolean"
            ? answers.musicIncludeVocals
            : undefined,
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
      valid: () => req(answers.scene),
    },
    {
      key: "driver",
      label: "Is your scene character or narrator driven?",
      render: () => (
        <>
          <FieldRow label="Choose a driver">
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
                { value: "character", label: "Character-driven" },
                { value: "narrator", label: "Narrator-driven" },
              ]}
              inline
            />
          </FieldRow>

          {answers.driver === "character" && (
            <>
              <FieldRow label="Do you want cut-away shots?">
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
        (answers.driver !== "character" ||
          typeof answers.wantsCutaways === "boolean"),
    },
    {
      key: "voiceId",
      label: "Pick your character or narrator’s voice.",
      render: () => (
        <VoiceStep
          value={answers.voiceId}
          labelValue={answers.voiceLabel}
          onChange={(id, label) =>
            setAnswers((s) => ({
              ...s,
              voiceId: id,
              voiceLabel: label ?? s.voiceLabel,
            }))
          }
          onLabelChange={(label) =>
            setAnswers((s) => ({ ...s, voiceLabel: label }))
          }
          genderPreview={characterGender}
        />
      ),
      valid: () => req(answers.voiceId),
    },
    {
      key: "characterName",
      label: "What is your character’s / narrator’s name?",
      render: () => (
        <FieldRow label="Name">
          <input
            type="text"
            placeholder="e.g., Sarah"
            value={answers.characterName}
            onChange={(e) =>
              setAnswers((s) => ({ ...s, characterName: e.target.value }))
            }
          />
        </FieldRow>
      ),
      valid: () => req(answers.characterName),
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
      valid: () => req(answers.setting),
    },
    {
      key: "action",
      label: "Describe the scene’s action.",
      render: () => (
        <FieldRow label="Action" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="e.g., Cinematic montage only. Environmental B-roll: boats, rooftops, markets; no on-camera speaker."
            value={answers.action}
            onChange={(e) => setAnswers((s) => ({ ...s, action: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => req(answers.action),
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
                setAnswers((s) => ({
                  ...s,
                  wantsMusic: v === "yes",
                  musicDesc: v === "yes" ? s.musicDesc : "",
                  // Reset/include vocals only relevant if user wants music
                  musicIncludeVocals: v === "yes" ? (s.musicIncludeVocals ?? undefined) : undefined,
                }))
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

              <FieldRow
                label="Describe the music you want"
                hint="The more detail you provide, the better your results will match your intentions."
              >
                <textarea
                  placeholder="e.g., Warm Mediterranean acoustic with subtle strings and percussion."
                  value={answers.musicDesc}
                  onChange={(e) =>
                    setAnswers((s) => ({ ...s, musicDesc: e.target.value }))
                  }
                />
              </FieldRow>
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
      key: "durationSec",
      label: "How long do you want your scene to be?",
      render: () => (
        <FieldRow label="Duration (seconds)">
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
            placeholder="e.g., Barcelona Harbor & City — B-Roll"
            value={answers.title}
            onChange={(e) => setAnswers((s) => ({ ...s, title: e.target.value }))}
          />
        </FieldRow>
      ),
      valid: () => req(answers.title),
    },
    {
      key: "referenceText",
      label: "For better script guidance, please enter reference text.",
      render: () => (
        <FieldRow label="Reference text (optional)" hint="The more detail you provide, the better your results will match your intentions.">
          <textarea
            placeholder="Paste any relevant text for style or guidance."
            value={answers.referenceText}
            onChange={(e) =>
              setAnswers((s) => ({ ...s, referenceText: e.target.value }))
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
          hideSubmit
          onSubmit={() => {
            if (onComplete) {
              onComplete({ ui: uiPayload });
            }
          }}
          onEditStep={(editStepKey) => {
            const editIdx = steps.findIndex((s) => s.key === editStepKey);
            if (editIdx >= 0) setStepIndex(editIdx);
          }}
        />
      ),
      valid: () => true,
    },
  ];

  const total = steps.length;
  const step = steps[stepIndex];

  function submitNow() {
    if (onComplete) {
      onComplete({ ui: uiPayload });
    }

    const payload = {
      ui: uiPayload,
      meta: {
        source: "interview-wizard",
        version: "v1",
        ts: new Date().toISOString(),
      },
    };

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (N8N_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${N8N_AUTH_TOKEN}`;
    }

    setSubmitting(true);
    setSubmitResult(null);

    fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      mode: n8nNoCors ? "no-cors" : "cors",
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (res) => {
        if (n8nNoCors) {
          alert("Submitted! Your request was handed to n8n (no-cors mode).");
          window.dispatchEvent(new CustomEvent("interview:goFirstStep"));
          return;
        }
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* plain text */ }

        if (!res.ok) {
          const message = (json && (json.error || json.message)) || text || "Request failed";
          throw new Error(message);
        }

        const jobId = json?.jobId || json?.id || json?.data?.id;
        if (jobId) {
          setLastJobId(jobId);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("jobId", String(jobId));
            window.history.replaceState({}, "", url);
          } catch {}
          alert(`Submitted! Job ID: ${jobId}`);
        } else {
          alert("Submitted! Your request was received.");
        }

        setSubmitResult(json || { ok: true });
        snapshotJobState({ submittedAt: Date.now(), jobId: jobId || null });
        window.dispatchEvent(new CustomEvent("interview:goFirstStep"));
      })
      .catch((err) => {
        console.error("Submit error:", err);
        alert(`Submission failed: ${err.message || String(err)}`);
      })
      .finally(() => setSubmitting(false));
  }

  // Legacy helpers for job state (parity with old app)
  function setLastJobId(id) {
    try { localStorage.setItem("last_job_id", String(id)); } catch {}
  }
  function snapshotJobState(obj) {
    try { localStorage.setItem("n8nJobState", JSON.stringify(obj || {})); } catch {}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={handlePrev} disabled={stepIndex === 0} className="btn btn-secondary">
            ← Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={stepIndex === total - 1 ? submitNow : handleNext}
              disabled={submitting || !step.valid()}
              className="btn btn-primary"
              title={stepIndex === total - 1 ? "Send to n8n" : "Next step"}
            >
              {stepIndex === total - 1 ? (submitting ? "Submitting…" : "Submit") : (stepIndex === total - 2 ? "Review" : "Next →")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}