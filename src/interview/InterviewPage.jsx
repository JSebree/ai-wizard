import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import VoiceStep from "./steps/VoiceStep.jsx";
import ReviewStep from "./steps/ReviewStep.jsx";
import AdvancedSettingsStep from "./steps/AdvancedSettingsStep.jsx";
import VodCard from "./VodCard.jsx";
import ExpressVideoCard from "./components/ExpressVideoCard.jsx";
import ExpressAccordionView from "./components/ExpressAccordionView.jsx";

// Simple Error Boundary for Mobile Debugging
class DebugErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ExpressView Crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
          <pre className="text-xs text-left bg-gray-100 p-4 rounded overflow-auto text-red-800">
            {this.state.error && this.state.error.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-black text-white rounded"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  } catch { }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("jobId");
    window.history.replaceState({}, "", url);
  } catch { }
  window.location.reload();
}

const TEMPLATE_KEY = "interview_template_v1";

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
// const TEMPLATE_KEY = "interview_template_v1"; // Moved up


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
  } catch { }
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
    // Voice (robust import from various template shapes)
    voiceId:
      (ui.voiceId ?? ui.voice_id ?? (ui.voice?.id ?? ui.voice?.voice_id) ?? defaults.voiceId),
    voiceLabel:
      (ui.voiceLabel ?? ui.voice_name ?? ui.voice?.name ?? ui.voice?.voice_name ?? defaults.voiceLabel),
    characterGender:
      (ui.characterGender ?? ui.voiceGender ?? defaults.characterGender),
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
    research: typeof ui.research === "boolean" ? ui.research : defaults.research,
    // Advanced
    advancedEnabled:
      typeof adv.enabled === "boolean" ? adv.enabled : defaults.advancedEnabled,
    // Robust checks for style/resolution which might be top-level or in advanced
    stylePreset: (ui.stylePreset ?? adv.stylePreset ?? adv.style ?? defaults.stylePreset),
    resolution: (ui.resolution ?? adv.resolution ?? defaults.resolution),
    musicVolume10:
      (ui.musicVolume10 ?? adv.musicVolume10 ?? (adv.musicVolume !== undefined ? coerceVolume10(adv.musicVolume) : defaults.musicVolume10)),
    voiceVolume10:
      (ui.voiceVolume10 ?? adv.voiceVolume10 ?? (adv.voiceVolume !== undefined ? coerceVolume10(adv.voiceVolume) : defaults.voiceVolume10)),
    musicSeed:
      (ui.musicSeed ?? adv.seed ?? (adv.seed !== undefined && adv.seed !== null ? String(adv.seed) : defaults.musicSeed)),
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
    research: false,
    // Advanced settings
    advancedEnabled: true,
    stylePreset: "Photorealistic",
    resolution: "SD",
    musicVolume10: 1,
    voiceVolume10: 10,
    musicIncludeVocals: undefined,
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
      {/* Top row with Review (left) and Reset (right) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("interview:goReviewStep"))}
          className="btn"
          title="Review all answers"
          style={{ padding: "6px 10px" }}
        >
          Review
        </button>

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
            background: "#000",
            borderRadius: 999,
            transition: "width .25s ease",
          }}
        />
      </div>

      <style>{`
        .btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #fff; cursor: pointer; }
        .btn[disabled] { opacity: .5; cursor: not-allowed; }
        .btn-primary[disabled] { opacity: .6; }
        .btn-primary { background: #000; color: white; border-color: #000; }
        .btn-primary:hover { background: #111; border-color: #111; }
        .btn-secondary { background: #fff; color: #111827; }
        .btn-secondary:hover { background: #f5f5f5; }
        .btn:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
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
  const { user, session, isAdmin } = useAuth();
  const location = useLocation();

  // Handle navigation state requests (reset or rewind)
  useEffect(() => {
    if (location.state?.reset) {
      // Legacy "Hard Reset" (if ever needed again)
      console.log("Forcing full reset");
      try { localStorage.removeItem(LS_KEY_ANS); } catch { }
      try { localStorage.removeItem(LS_KEY_STEP); } catch { }
      setAnswers(getDefaultAnswers());
      setStepIndex(0);
      window.history.replaceState({}, "");
    } else if (location.state?.startAtBeginning) {
      // "Soft Reset" - keep answers, just go to step 0
      console.log("Rewinding to start (keeping data)");
      setStepIndex(0);
      try { localStorage.setItem(LS_KEY_STEP, "0"); } catch { }
      window.history.replaceState({}, "");
    }
  }, [location.state]);
  const [selectedVod, setSelectedVod] = useState(null);
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

  // VOD History State
  const [vods, setVods] = useState([]);
  const [vodToDelete, setVodToDelete] = useState(null); // For unified delete modal
  const [vodsLoading, setVodsLoading] = useState(true);

  // View Mode: 'wizard' (legacy step-by-step) or 'accordion' (new all-in-one)
  const [viewMode, setViewMode] = useState('accordion');

  // (Moved event-listener effects live below steps definition)
  // --------------------------- Steps definition -------------------------

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
    } catch { }
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
    } catch { }

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
    } catch { }

    // 3) EMERGENCY FALLBACK: Hardcoded voices so user is never stuck
    const EMERGENCY_VOICES = [
      { id: "fe3b2cea-969a-4b5d-bc90-fde8578f1dd5", name: "Emma female en-us" },
      { id: "07cddda1-6455-4541-a246-ea655f3bfd23", name: "Adam male en-us" }
    ];
    console.warn("Using emergency voice fallback");
    setVoices(EMERGENCY_VOICES);
    return EMERGENCY_VOICES;
  }

  // Persist on change (refresh-proof)
  useEffect(() => {
    writeJSON(LS_KEY_ANS, answers);
  }, [answers]);

  useEffect(() => {
    writeJSON(LS_KEY_STEP, stepIndex);
  }, [stepIndex]);

  // Load VOD History
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON || !user) {
      setVodsLoading(false);
      return;
    }

    async function loadVods() {
      try {
        const url = new URL("/rest/v1/express_vods", SUPABASE_URL);
        url.searchParams.set("select", "*");

        // If not admin, restrict to own videos OR global
        if (!isAdmin) {
          url.searchParams.set("or", `(user_id.eq.${user.id},is_global.eq.true)`);
        } else {
          // Admin sees all (no filter)
        }

        url.searchParams.set("order", "created_at.desc");

        // Use session token if available for RLS, otherwise fallback to Anon (likely fails RLS)
        const token = session?.access_token || SUPABASE_ANON;

        const res = await fetch(url.toString(), {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setVods(data);
        } else {
          // If 401/403, might be token expiry or RLS
          console.warn("[loadVods] fetch failed:", res.status, res.statusText);
        }
      } catch (err) {
        console.error("Failed to load VODs", err);
      } finally {
        setVodsLoading(false);
      }
    }

    loadVods();
  }, [user, session, SUPABASE_URL, SUPABASE_ANON, isAdmin]);

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

        // If user hasn’t picked a voice yet, gently set Emma (or first entry).
        // Guard with a *functional* set to avoid overwriting a voice that may have been
        // applied by a template after this effect captured stale `answers`.
        if (list) {
          const emma = list.find((v) => /emma/i.test(v.name)) || list[0];
          if (emma) {
            setAnswers((s) => {
              const currId = typeof s.voiceId === "object"
                ? (s.voiceId.id || s.voiceId.voice_id || s.voiceId.tts_id || "")
                : (s.voiceId || "");
              if (String(currId).trim()) return s; // already set (e.g., from template) → do not overwrite
              return {
                ...s,
                voiceId: emma.id,
                voiceLabel: s.voiceLabel || emma.name,
              };
            });
          }
        }
      } else {
        // Voices restored from cache; ensure default only if still empty (guarded)
        const emma = voices.find((v) => /emma/i.test(v.name)) || voices[0];
        if (emma) {
          setAnswers((s) => {
            const currId = typeof s.voiceId === "object"
              ? (s.voiceId.id || s.voiceId.voice_id || s.voiceId.tts_id || "")
              : (s.voiceId || "");
            if (String(currId).trim()) return s; // someone (e.g., template) already set it
            return {
              ...s,
              voiceId: emma.id,
              voiceLabel: s.voiceLabel || emma.name,
            };
          });
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

    const userEmail = user?.email || readEmail();
    const userFullName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
    const nameParts = userFullName.split(" ");
    const userFirstName = (userFullName ? nameParts[0] : readFirstName()) || "";
    const userLastName = (userFullName ? nameParts.slice(1).join(" ") : readLastName()) || "";

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
      research: Boolean(answers.research),
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
        resolution: answers.resolution || "SD",
        // export ffmpeg-scale volumes (0.1–1.0)
        musicVolume: Math.max(1, Math.min(10, answers.musicVolume10 ?? 1)) / 10,
        voiceVolume: Math.max(1, Math.min(10, answers.voiceVolume10 ?? 10)) / 10,
        includeVocals:
          answers.wantsMusic && typeof answers.musicIncludeVocals === "boolean"
            ? answers.musicIncludeVocals
            : undefined,
        seed: (function () {
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

  // --------------------------- Job Completion Handler -------------------
  async function handleJobComplete({ jobId, finalVideoUrl }) {
    if (!jobId || !finalVideoUrl) return;
    console.log("[handleJobComplete] Job completed:", jobId, finalVideoUrl);

    // 1. Update local state immediately
    setVods(prev => prev.map(v =>
      String(v.job_id) === String(jobId)
        ? { ...v, status: 'completed', video_url: finalVideoUrl }
        : v
    ));

    // 2. Update Supabase
    if (SUPABASE_URL && SUPABASE_ANON && user) {
      const token = session?.access_token || SUPABASE_ANON;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/express_vods?job_id=eq.${encodeURIComponent(jobId)}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            status: 'completed',
            video_url: finalVideoUrl
          })
        });
      } catch (err) {
        console.error("Failed to update VOD status to completed:", err);
      }
    }
  }

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
                  characterName: v === "character" ? (s.characterName || "") : "narrator",
                }))
              }
              options={[
                { value: "character", label: "Character — An on-camera avatar who is part of the action." },
                { value: "narrator", label: "Narrator — An off-screen voice that tells the story." },
              ]}
              inline
            />
          </FieldRow>

          {answers.driver === "character" && (
            <FieldRow label="What is your character's name?">
              <input
                type="text"
                placeholder="e.g., Sarah"
                value={answers.characterName}
                onChange={(e) =>
                  setAnswers((s) => ({ ...s, characterName: e.target.value }))
                }
              />
            </FieldRow>
          )}

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
        (answers.driver !== "character" || req(answers.characterName)) &&
        (answers.driver !== "character" || (
          typeof answers.wantsCutaways === "boolean" && meetsMin(answers.character, 40)
        )),
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
        <>
          <FieldRow
            label="Script guidance"
            hint="The more detail you provide, the better your results will match your intentions. Minimum 30 characters. (Max 400 characters)"
          >
            <textarea
              placeholder="E.g., product overview, key talking points, or an excerpt that sets tone and facts."
              value={answers.referenceText}
              maxLength={answers.research ? 400 : undefined}
              onChange={(e) =>
                setAnswers((s) => ({ ...s, referenceText: e.target.value }))
              }
            />
          </FieldRow>
          <FieldRow label="Gather research?" hint="If enabled, the workflow will automatically perform external research based on your scene context.">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(answers.research)}
                onChange={(e) => setAnswers((s) => ({ ...s, research: e.target.checked }))}
              />
              Enable research
            </label>
          </FieldRow>
        </>
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
          resolutionValue={answers.resolution}
          onResolutionChange={(v) =>
            setAnswers((s) => ({ ...s, resolution: v }))
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
          onJobComplete={handleJobComplete}
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
              try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
            }
          }}
        />
      ),
      valid: () => true,
    },
  ];

  // Jump to last (review) when 'interview:goReviewStep' fires
  useEffect(() => {
    function onGoReview() {
      const last = steps.length - 1;
      if (last >= 0) setStepIndex(last);
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { }
    }
    window.addEventListener("interview:goReviewStep", onGoReview);
    return () => window.removeEventListener("interview:goReviewStep", onGoReview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow external components (e.g., ReviewStep) to jump to a specific step by key
  useEffect(() => {
    // Rebind when the step list/keys change to avoid stale-closure bugs
    const keys = steps.map(s => s.key);

    // Normalize incoming targets to canonical step keys used in `steps`
    const alias = {
      scene: 'scene',
      driver: 'driver',
      character: 'driver',
      star: 'driver',
      voice: 'voiceId',
      voiceId: 'voiceId',
      setting: 'setting',
      action: 'action',
      output: 'referenceText',
      reference: 'referenceText',
      referenceText: 'referenceText',
      script: 'referenceText',
      guidance: 'referenceText',
      duration: 'durationSec',
      durationSec: 'durationSec',
      title: 'title',
      audio: 'wantsMusic',
      music: 'wantsMusic',
      wantsMusic: 'wantsMusic',
      captions: 'wantsCaptions',
      wantsCaptions: 'wantsCaptions',
      directorsNotes: 'directorsNotes',
      notes: 'directorsNotes',
      advanced: 'advanced',
      review: 'review',
    };

    function resolveKey(input) {
      if (!input) return null;
      if (typeof input === 'number') return steps[input]?.key ?? null;
      if (typeof input === 'string') {
        const k = alias[input] || input;
        return keys.includes(k) ? k : null;
      }
      if (typeof input === 'object') {
        const raw =
          input.key ?? input.stepKey ?? input.targetKey ??
          input.section ?? input.sectionKey ?? null;
        if (Number.isInteger(input.index)) return steps[input.index]?.key ?? null;
        if (typeof raw === 'string') {
          const k = alias[raw] || raw;
          return keys.includes(k) ? k : null;
        }
      }
      return null;
    }

    function onGoSpecificStep(e) {
      const target = e?.detail ?? null;
      const key = resolveKey(target);
      if (!key) return; // ignore unknown targets

      const idx = steps.findIndex(s => s.key === key);
      if (idx >= 0) {
        setStepIndex(idx);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
      }
    }

    window.addEventListener('interview:goStep', onGoSpecificStep);
    window.addEventListener('interview:editStep', onGoSpecificStep);

    return () => {
      window.removeEventListener('interview:goStep', onGoSpecificStep);
      window.removeEventListener('interview:editStep', onGoSpecificStep);
    };
    // Depend on the current *keys* so we rebind when order/keys change
  }, [steps.map(s => s.key).join('|')]);

  // Clamp stepIndex to a valid range whenever steps change (prevents white screens)
  useEffect(() => {
    if (!Array.isArray(steps) || steps.length === 0) return;
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= steps.length) {
      const idx = Math.max(0, Math.min(steps.length - 1, Number(stepIndex) || 0));
      setStepIndex(idx);
      try { writeJSON(LS_KEY_STEP, idx); } catch { }
    }
  }, [steps.length]);

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
            try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { }
          }
        }
      }
    } catch { }
    // Clear the template so refreshes don't re-apply it
    try { localStorage.removeItem(TEMPLATE_KEY); } catch { }
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
    try { sessionStorage.setItem('just_submitted', '1'); } catch { }
    try { window.dispatchEvent(new Event('interview:submit')); } catch { }

    // Build the payload (wrap under { ui } for intake; adjust here if your n8n expects a different shape)
    const payload = { ui: uiPayload, user_id: user?.id };

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
      try { localStorage.setItem('last_job_id', String(returnedJobId || '')); } catch { }
      try {
        const url = new URL(window.location.href);
        if (returnedJobId) url.searchParams.set('jobId', String(returnedJobId));
        window.history.replaceState({}, '', url);
      } catch { }

      // Notify listeners (ReviewStep) that a new job has been created
      try {
        window.dispatchEvent(new CustomEvent('interview:submitted', {
          detail: { jobId: String(returnedJobId || ''), statusUrl }
        }));
      } catch { }
      try {
        window.dispatchEvent(new CustomEvent('interview:newJobId', {
          detail: { jobId: String(returnedJobId || ''), statusUrl }
        }));
      } catch { }

      // --- PERSIST TO SUPABASE (Express VODs) ---
      if (SUPABASE_URL && SUPABASE_ANON && user) {
        try {
          const vodPayload = {
            user_id: user.id,
            status: 'pending',
            settings: payload, // Save full payload including 'ui' wrapper
            job_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(returnedJobId)) ? String(returnedJobId) : null,
            title: uiPayload.title || "Untitled Video",
            thumbnail_url: null, // Could add if you generate one immediately
            created_at: new Date().toISOString()
          };

          const token = session?.access_token || SUPABASE_ANON;

          const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/express_vods`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(vodPayload)
          });

          if (dbRes.ok) {
            const newRows = await dbRes.json();
            if (newRows && newRows.length > 0) {
              setVods(prev => [newRows[0], ...prev]);
            }
          }
        } catch (dbErr) {
          console.error("Failed to save VOD record:", dbErr);
        }
      }

      // Stay on Review step (we're already there); ensure top-of-page
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
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

  function handleUseTemplate(vod) {
    if (!vod || !vod.settings) return;

    // settings might be { ui: {...} } or just {...}
    const raw = typeof vod.settings === 'string' ? JSON.parse(vod.settings) : vod.settings;
    const uiData = raw.ui || raw;

    if (uiData) {
      console.log("[handleUseTemplate] Loading UI data:", uiData);
      try {
        const defaults = getDefaultAnswers();
        const mapped = mapTemplateToAnswers(uiData, defaults);

        if (mapped) {
          // Inject user details
          if (user) {
            const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email || "").trim();
            if (fullName) mapped.userName = fullName;
            if (user.email) mapped.userEmail = user.email;
            mapped.userId = user.id;
          }

          console.log("[handleUseTemplate] Setting answers:", mapped);
          setAnswers(mapped);

          // Force jump to review
          setTimeout(() => {
            setStepIndex(steps.length - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 10);

        } else {
          console.error("Map failed (returned null)");
          alert("Error: Template data is invalid.");
        }
      } catch (err) {
        console.error("Template load error:", err);
        alert(`Failed to load template: ${err.message}`);
      }
    }
  }

  // 1. Request Delete (opens modal)
  function requestDeleteVod(vod) {
    setVodToDelete(vod);
  }

  // 2. Confirm Delete (executes logic)
  async function handleConfirmDelete() {
    if (!vodToDelete) return;
    const vod = vodToDelete;
    // Close modal immediately
    setVodToDelete(null);

    const originalVods = [...vods];
    // Optimistic update
    setVods(prev => prev.filter(v => v.id !== vod.id));

    try {
      if (!SUPABASE_URL || !SUPABASE_ANON) return;

      const token = session?.access_token || SUPABASE_ANON;
      const url = new URL(`${SUPABASE_URL}/rest/v1/express_vods`);
      url.searchParams.set("id", `eq.${vod.id}`);

      const res = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${token}`,
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Status ${res.status}: ${errorText}`);
      }
    } catch (err) {
      console.error("Delete failed", err);
      // Revert optimistic update
      setVods(originalVods);
      alert(`Delete failed: ${err.message}`);
    }
  }

  // ------------------------------ render ---------------------------------

  return (
    <div className={`page mx-auto ease-in-out duration-300 w-full flex-grow ${viewMode === 'accordion' ? 'max-w-3xl px-4 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0' : 'max-w-2xl px-6'}`}>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -20, position: "relative", zIndex: 10 }}>
          {/* Toggle removed to enforce Express View default */}
        </div>
        <p style={{ marginTop: 0, color: "#475569", lineHeight: "1.6" }}>
          <span style={{ display: "block", fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Welcome to SceneMe Express.</span>
          <b>High-fidelity cinema on demand.</b> You define the <b>Cast</b>, <b>Setting</b>, and <b>Action</b>, and our pocket production studio brings it to life. Create one-click masterpieces from anywhere.
        </p>
      </header>

      {viewMode === "accordion" ? (
        <DebugErrorBoundary>
          <ExpressAccordionView
            answers={answers}
            setAnswers={setAnswers}
            voices={voices}
            onSubmit={submitNowLegacy}
            isSubmitting={submitting}
            characterGender={characterGender}
            onReset={resetAll}
          />
        </DebugErrorBoundary>
      ) : (
        <>
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
        </>
      )}
      {/* --- VOD History Section (Studio Style) --- */}
      {user && (
        <div style={{ marginTop: 48, borderTop: "1px solid #E5E7EB", paddingTop: 32 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1F2937", marginBottom: 16 }}>Saved Videos</h3>
          {vodsLoading ? (
            <div style={{ color: "#64748B", fontSize: 14 }}>Loading history...</div>
          ) : vods.length === 0 ? (
            <div style={{
              padding: "48px 24px",
              background: "#F8FAFC",
              border: "1px dashed #E2E8F0",
              borderRadius: 12,
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 14
            }}>
              No videos yet. Submit your first creation above!
            </div>
          ) : (
            <div style={{
              display: "flex",
              gap: 16,
              overflowX: "auto",
              paddingBottom: 16,
              // Hide scrollbar aesthetics but keep functionality
              scrollbarWidth: "thin",
            }}>
              {vods.map(vod => (
                <VodCard
                  key={vod.id}
                  vod={vod}
                  onUseTemplate={handleUseTemplate}
                  onDelete={(v) => requestDeleteVod(v)}
                  isOwner={user && (vod.user_id === user.id || isAdmin)}
                  onClick={() => setSelectedVod(vod)}
                />
              ))}
            </div>
          )}
        </div>
      )}


      {/* Detail Modal */}
      {
        selectedVod && (
          <ExpressVideoCard
            vod={selectedVod}
            onClose={() => setSelectedVod(null)}
            onDelete={(v) => requestDeleteVod(v)}
            onUseTemplate={(v) => handleUseTemplate(v)}
          />
        )
      }

      {/* Unified Delete Modal */}
      {
        vodToDelete && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center"
          }} onClick={() => setVodToDelete(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "white", padding: 24, borderRadius: 12, maxWidth: 400, width: "90%", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 700, color: "#1F2937" }}>Confirm Deletion</h3>
              <p style={{ color: "#4B5563", marginBottom: 24, lineHeight: 1.5 }}>
                Are you sure you want to delete <span style={{ fontWeight: 700 }}>"{vodToDelete.title || "Untitled"}"</span>? This action cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  onClick={() => setVodToDelete(null)}
                  style={{
                    padding: "8px 16px", borderRadius: 6,
                    border: "1px solid #D1D5DB", background: "white", color: "#374151",
                    fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  style={{
                    padding: "8px 16px", borderRadius: 6,
                    border: "none", background: "#EF4444", color: "white",
                    fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}