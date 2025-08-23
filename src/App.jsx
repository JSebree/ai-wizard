// src/steps/StepConcept.jsx

import React from "react";
import { createClient } from "@supabase/supabase-js";
import { STYLE_LIBRARY, DEFAULT_STYLE_KEY, template_to_stylekey } from "./styleLibraryMap";

// Runtime safety: catch render errors to avoid a blank screen
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    // See details in the browser console too
    console.error("App render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold">Something went wrong.</h1>
          <p className="text-slate-600 text-sm mt-1">
            An error occurred while rendering. Open the browser console for details.
          </p>
          <pre className="mt-3 text-xs whitespace-pre-wrap bg-slate-100 p-3 rounded">
            {String(this.state.error && (this.state.error.stack || this.state.error))}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- Global Reset Helper (used by header + StepReview) ----
export function resetWizardFormGlobal() {
  try {
    localStorage.removeItem("ai-wizard-ui");         // <details> open states
    localStorage.removeItem("n8nJobState");          // job polling snapshot
    localStorage.removeItem("ai-wizard-activeStep"); // last active step
    localStorage.removeItem("ai-wizard-state");      // full wizard state (if present)
    localStorage.removeItem("n8nNoCors");            // CORS toggle
  } catch {}

  // Drop any ?jobId=… so the resumed state doesn't immediately poll
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("jobId");
    window.history.replaceState({}, "", url);
  } catch {}

  // Hard refresh to reinitialize in-memory React state
  window.location.reload();
}
// Back-compat alias: some JSX still calls `resetWizardForm`.
// Keep it pointing at the new global reset to avoid ReferenceErrors.
const resetWizardForm = resetWizardFormGlobal;

// Resolve a styleKey from the current wizard state
function resolveStyleKeyFromState(state) {
  try {
    const t = state?.minimalInput?.templates?.[0] || "";
    const key = template_to_stylekey(t) || "generic-video";
    return key;
  } catch {
    return "generic-video";
  }
}

// Merge top‑down defaults from STYLE_LIBRARY, but let lower‑level user fields win.
// This returns a normalized "effective" view that buildN8nPayload can use.
function computeEffectiveState(state) {
  const styleKey = resolveStyleKeyFromState(state);
  const profile = STYLE_LIBRARY[styleKey] || STYLE_LIBRARY["generic-video"];

  // Flags: apply profile.flagDefaults only where user left it undefined
  const flags = {
    ...state?.flags,
    captions:
      state?.flags?.captions ?? !!profile?.flagDefaults?.captions ?? true,
    music:
      state?.flags?.music ?? !!profile?.flagDefaults?.music ?? true,
    podcastStill:
      state?.flags?.podcastStill ?? !!profile?.flagDefaults?.podcastStill ?? false,
  };

  // Packs: user selection wins; otherwise fall back to profile
  const packs = {
    stylePack:   state?.setting?.stylePack   || profile?.style   || null,
    lookPack:    state?.character?.lookPack  || profile?.look    || null,
    motionPack:  state?.setting?.motionPack  || profile?.motion  || null,
    propsPack:   state?.setting?.propsPack   || profile?.props   || null,
    mouthPack:   state?.setting?.mouthPack   || profile?.mouth   || null,
    basePack:    state?.setting?.base        || profile?.base    || null,
    personaPack: state?.character?.personaPack || null,
    musicPack:   state?.music?.musicPack     || null,
    accentPack:  null, // freeform in UI for now
  };

  // Music defaults: use profile unless user specified
  const music = {
    ...state?.music,
    mood: state?.music?.mood || profile?.music?.mood || "light underscore",
    tempo: state?.music?.tempo || profile?.music?.tempo || "95-110bpm",
    tempoVal:
      typeof state?.music?.tempoVal === "number"
        ? state.music.tempoVal
        : (profile?.music?.tempoVal || 100),
  };

  return { styleKey, profile, flags, packs, music };
}


function resolveStyleKeyFromTemplateLabel(label) {
  return template_to_stylekey(label) || "generic-video";
}

// Apply profile defaults into the live wizard state, OVERWRITING user fields (template-first).
// `setWizard` is the App-level setter for your aggregated state object.
function hydrateDefaultsFromProfile(current, styleKey) {
  const profile = STYLE_LIBRARY[styleKey] || STYLE_LIBRARY["generic-video"];
  if (!profile) return current;

  // clone branches we touch
  const next = { ...current };
  next.setting   = { ...(current.setting   || {}) };
  next.character = { ...(current.character || {}) };
  next.flags     = { ...(current.flags     || {}) };
  next.music     = { ...(current.music     || {}) };

  // --- HARD APPLY: always overwrite with profile defaults ---
  // Environment / base scene
  next.setting.environment = profile.environment || "env_auto";
  next.setting.base        = profile.base || null;

  // Packs
  next.setting.stylePack   = profile.style || null;
  next.character.lookPack  = profile.look  || null;
  next.setting.motionPack  = profile.motion || null;
  next.setting.propsPack   = profile.props || null;
  next.setting.mouthPack   = profile.mouth || null;

  // Persona
  if (profile.personaKind) next.character.personaKind = profile.personaKind;

  // Flags
  if (profile.flagDefaults) {
    next.flags.captions     = profile.flagDefaults.captions ?? next.flags.captions ?? true;
    next.flags.music        = profile.flagDefaults.music ?? next.flags.music ?? true;
    next.flags.podcastStill = profile.flagDefaults.podcastStill ?? next.flags.podcastStill ?? false;
  } else {
    // reasonable fallbacks
    next.flags.captions = next.flags.captions ?? true;
    next.flags.music    = next.flags.music ?? true;
  }

  // Music defaults
  next.music.mood     = (profile.music && profile.music.mood)  || "light underscore";
  next.music.tempo    = (profile.music && profile.music.tempo) || "95-110bpm";
  if (typeof profile.music?.tempoVal === "number") {
    next.music.tempoVal = profile.music.tempoVal;
  } else if (typeof next.music.tempoVal !== "number") {
    next.music.tempoVal = 100;
  }

  return next;
}

// --- Supabase (public, read-only) ---
// We will read the public "speakers" table to populate the voice list.
// Paste your anon key below (safe for client use with read-only RLS).
const SUPABASE_URL = "https://ldgujihabgikdkoxztnk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3VqaWhhYmdpa2Rrb3h6dG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMzUwNTcsImV4cCI6MjA2NDgxMTA1N30.uifx8GrUtE4kgg3xahJtesb-OxLgsi4BNsApd1KgulE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- UI preference (persisted <details> open state) ---
const UIPREF_KEY = "ai-wizard-ui";
function getUiPref(path, fallback = false) {
  try {
    const obj = JSON.parse(localStorage.getItem(UIPREF_KEY) || "{}");
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}
function setUiPref(path, val) {
  try {
    const obj = JSON.parse(localStorage.getItem(UIPREF_KEY) || "{}");
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = cur[keys[i]] || {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = val;
    localStorage.setItem(UIPREF_KEY, JSON.stringify(obj));
  } catch {}
}

// --- UI helpers & enums ---
const ASPECTS = ["16:9", "9:16", "1:1", "4:5"];
const RES_PRESETS = {
  "720p": { width: 1024, height: 576 },    // 16:9 under 1024
  "1080p": { width: 1024, height: 576 },   // same as 720p, capped
  // "4K": { width: 3840, height: 2160 },   // removed, exceeds cap
  "Square": { width: 1024, height: 1024 }, // max square
};
const FPS_PRESETS = [24, 30, 60];
const ENV_PRESETS = ["studio", "city street", "kitchen", "forest", "classroom"];
const LIGHT_PRESETS = ["day", "night", "sunset", "moody", "neon"];
const WEATHER_PRESETS = ["clear", "rain", "snow", "fog"];
const SHOT_TYPES = ["selfie", "wide", "medium wide", "medium", "medium close-up", "close-up", "extreme close-up", "long shot", "over-shoulder", "two-shot", "overhead", "dolly", "drone"];
const MOTION_TEMPLATES = ["handheld vlog", "cinematic pan", "locked interview"];
const PERSONA_KINDS = ["human", "baby", "robot", "cartoon", "animal"];
const VOICE_PRESETS = ["neutral_narrator", "warm_host", "energetic_youth", "deep_radio", "soft_whisper"];
const AMBIENCE_PRESETS = ["studio", "street", "crowd", "birds", "silence"];
const TEMPLATE_PRESETS = ["Studio Podcast", "Cooking Show", "Explainer", "Vlog", "Cinematic Short"];

// --- n8n pack libraries (IDs) -> used for dropdowns ---
const PACK_OPTIONS = {
  base: [
    "base_podcast_studio_video",
    "base_newsroom_desk",
    "base_gaming_desk",
    "base_creator_green_corner",
    "base_cinematic_interview",
    "base_lecture_hall",
    "base_white_cyclorama",
    "base_street_vlog",
    "base_vlog_handheld",
    "base_creator_video"
  ],
  look: [
    "pack_look_studio_warm",
    "pack_look_studio_moody",
    "pack_look_newsroom_clean",
    "pack_look_clean_host",
    "pack_look_glow_ui",
    "pack_look_daylight_casual",
    "pack_look_filmic_soft",
    "pack_look_concert_dark"
  ],
  style: [
    "pack_style_podcast_pro",
    "pack_style_podcast_casual",
    "pack_style_podcast_moody",
    "pack_style_tech_explainer",
    "pack_style_founder_fireside",
    "pack_style_vlog_daily",
    "pack_style_product_show",
    "pack_style_musicvideo",
    "pack_style_broll_montage",
    "pack_style_presenter"
  ],
  persona: [
    "pack_persona_human_adult",
    "pack_persona_human_baby",
    "pack_persona_animal_cat",
    "pack_persona_animal_dog",
    "pack_persona_animal_gorilla",
    "pack_persona_mascot_plush",
    "pack_persona_anime_avatar",
    "pack_persona_robot_synth"
  ],
  motion: [
    "pack_motion_headtalk",
    "pack_motion_confident",
    "pack_motion_minimal",
    "pack_motion_vlog",
    "pack_motion_kinetic"
  ],
  props: [
    "pack_props_podcast_headset_mic",
    "pack_props_desk_mic_boom",
    "pack_props_cozy_backdrop",
    "pack_props_jungle_backdrop",
    "pack_props_studio_backdrop"
  ],
  mouth: [
    "pack_mouth_subtle",
    "pack_mouth_exaggerated"
  ],
  music: [
    "pack_music_lofi_warm",
    "pack_music_light_underscore",
    "pack_music_future_pop",
    "pack_music_indie_chill",
    "pack_music_beat_driven",
    "pack_music_moody_ambient"
  ],
  accent: [
    "pack_accent_neutral",
    "pack_accent_soft_american",
    "pack_accent_casual",
    "pack_accent_announcer",
    "pack_accent_intimate",
    "pack_accent_none"
  ]
};

function Slider({ label, value, onChange, min=0, max=1, step=0.01, required=false, hint }) {
  return (
    <div>
      {label && <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-1 text-red-600">*</span>}
      </label>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e)=>onChange(Number(e.target.value))}
        className="w-full" />
      {hint && <div className="text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

function FileListInput({ label, accept, multiple=true, value=[], onChange }) {
  const onFiles = (files) => {
    const list = Array.from(files || []).map(f => ({ name: f.name, type: f.type, size: f.size }));
    onChange([...(value||[]), ...list]);
  };
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input type="file" accept={accept} multiple={multiple}
        className="mt-1 block w-full" onChange={(e)=>onFiles(e.target.files)} />
      {!!(value && value.length) && (
        <ul className="mt-1 text-xs list-disc pl-5 text-slate-600">
          {value.map((f,i)=> <li key={i}>{f.name} <span className="opacity-60">({f.type}, {f.size}B)</span></li>)}
        </ul>
      )}
    </div>
  );
}

// Small header button to reset the entire form from the app header
function HeaderResetButton() {
  return (
    <button
      type="button"
      onClick={resetWizardFormGlobal}
      className="ml-auto inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
      title="Reset all inputs to defaults"
    >
      Reset form
    </button>
  );
}
// ---- APP HEADER PATCH (insert global Reset button) ----

// To add the Reset button to the header, insert this block before </header>:
//
// <div className="ml-auto flex items-center">
//   <HeaderResetButton />
// </div>

// Simple mic recorder using MediaRecorder; stores blob URL in state
function MicRecorder({ value, onChange }) {
  const [rec, setRec] = React.useState(null);
  const [recording, setRecording] = React.useState(false);
  const [url, setUrl] = React.useState(value || null);

  React.useEffect(()=>{ onChange && onChange(url); }, [url]); // eslint-disable-line

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks = [];
    mr.ondataavailable = (e)=> chunks.push(e.data);
    mr.onstop = ()=> {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const u = URL.createObjectURL(blob);
      setUrl(u);
      stream.getTracks().forEach(t=>t.stop());
    };
    mr.start();
    setRec(mr);
    setRecording(true);
  };
  const stop = () => { rec?.stop(); setRecording(false); };

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-slate-700">Record voice (browser mic)</div>
      <div className="flex gap-2">
        <button type="button" onClick={start} disabled={recording}
          className="rounded bg-emerald-600 px-2 py-1 text-white disabled:opacity-50">Start</button>
        <button type="button" onClick={stop} disabled={!recording}
          className="rounded bg-rose-600 px-2 py-1 text-white disabled:opacity-50">Stop</button>
        {url && <audio src={url} controls className="ml-2" />}
      </div>
      {url && <div className="text-xs text-slate-600">Recorded clip saved locally for preview (blob URL).</div>}
    </div>
  );
}

function StepConcept({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (
    <span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>
  );
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${
    err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"
  }`;
  const set = (k, val) => onChange({ ...v, [k]: val });

  return (
    <div className="space-y-5">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      <div>
        <label className="text-sm font-medium text-slate-700">
          Title{mark("title")}
        </label>
        <input className={cls("title")} value={v.title || ""} onChange={(e)=>set("title", e.target.value)} placeholder="e.g., Tiny Tech Execs" />
        {err("title") && <p className="text-xs text-red-600 mt-1">{err("title")}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Subject{mark("subject")}</label>
          <input className={cls("subject")} value={v.subject || ""} onChange={(e)=>set("subject", e.target.value)} placeholder="What is this about?" />
          {err("subject") && <p className="text-xs text-red-600 mt-1">{err("subject")}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Duration (sec){mark("durationSec")}</label>
          <input type="number" min={6} max={300} className={cls("durationSec")} value={v.durationSec ?? 60} onChange={(e)=>set("durationSec", Number(e.target.value||0))} />
          {err("durationSec") && <p className="text-xs text-red-600 mt-1">{err("durationSec")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Video Type{mark("route")}</label>
          <select className={cls("route")} value={v.route || "aroll"} onChange={(e)=>set("route", e.target.value)}>
            <option value="aroll">Avatar (talking head)</option>
            <option value="broll">B–roll (action shot)</option>
            <option value="combo">Combo</option>
            <option value="podcast">Podcast Only</option>
          </select>
          {err("route") && <p className="text-xs text-red-600 mt-1">{err("route")}</p>}
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Style{mark("style")}</label>
            <input className={cls("style")} value={v.style || "default"} onChange={(e)=>set("style", e.target.value)} placeholder="e.g., default" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tone{mark("tone")}</label>
            <input className={cls("tone")} value={v.tone || "neutral"} onChange={(e)=>set("tone", e.target.value)} placeholder="e.g., neutral" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Reference Text{mark("referenceText")}</label>
        <textarea rows={4} className={cls("referenceText")} value={v.referenceText || ""} onChange={(e)=>set("referenceText", e.target.value)} placeholder="Any guidance or script notes" />
      </div>

      {/* Reference upload */}
      <div>
        <label className="text-sm font-medium text-slate-700">Audience</label>
        <select className={cls("audience")} value={v.audience ?? ""} onChange={(e)=>set("audience", e.target.value)}>
          <option value="">— Select —</option>
          {['general','kids','professionals','casual'].map(a=> <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Templates */}
      <div>
        <label className="text-sm font-medium text-slate-700">Templates (select any)</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {TEMPLATE_PRESETS.map(t => {
            const checked = (v.templates || []).includes(t);
            return (
              <label key={t} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const cur = new Set(v.templates || []);
                    if (e.target.checked) cur.add(t); else cur.delete(t);
                    const nextTemplates = Array.from(cur);
                    set('templates', nextTemplates);

                    // Notify App that the top template changed so it can hydrate defaults
                    try {
                      const top = nextTemplates[0] || '';
                      window.dispatchEvent(new CustomEvent('wizard:templateChanged', { detail: { topTemplate: top } }));
                    } catch {}
                  }}
                />
                <span>{t}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Tags{mark("tags")}</label>
        <input className={cls("tags")} value={v.tags || ""} onChange={(e)=>set("tags", e.target.value)} placeholder="comma,separated,tags" />
      </div>

      {/* Advanced */}
      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("concept.advancedOpen", false));
          React.useEffect(() => setUiPref("concept.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3">
            <summary className="cursor-pointer font-medium">Advanced settings</summary>
            <p className="text-xs text-slate-600 mt-1">Optional settings most creators can ignore.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!v.matchPriorEpisode} onChange={(e)=>set("matchPriorEpisode", e.target.checked)} />
                <span>Match prior episode</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!v.seriesMode} onChange={(e)=>set("seriesMode", e.target.checked)} />
                <span>Series mode (reuse look & feel)</span>
              </label>
            </div>
            {/* Upload reference (doc / PDF / text) moved here */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Upload reference (doc / PDF / text)</label>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mt-1 block w-full"
                  onChange={(e)=> set("referenceUploadMeta", e.target.files?.[0]
                    ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type }
                    : null)}
                />
                {v.referenceUploadMeta && (
                  <div className="text-xs text-slate-600 mt-1">{v.referenceUploadMeta.name} <span className="opacity-60">({v.referenceUploadMeta.type}, {v.referenceUploadMeta.size}B)</span></div>
                )}
              </div>
            </div>
          </details>
        );
      })()}
    </div>
  );
}

// src/steps/StepCharacter.jsx

function StepCharacter({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (<span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>);
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"}`;
  const set = (k, val) => onChange({ ...v, [k]: val });

  // Speakers from Supabase (public "speakers" table)
  const [voices, setVoices] = React.useState([]);
  const [voicesLoading, setVoicesLoading] = React.useState(false);
  const [voicesErr, setVoicesErr] = React.useState(null);

  const loadSpeakers = React.useCallback(async () => {
    setVoicesErr(null);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PASTE_")) {
      setVoicesErr("Supabase is not configured. Add your anon key in App.jsx.");
      return;
    }
    setVoicesLoading(true);
    try {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name, audio_url")
        .order("name", { ascending: true });
      if (error) throw error;
      setVoices(Array.isArray(data) ? data : []);
    } catch (e) {
      setVoicesErr(e?.message || "Failed to load speakers.");
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  React.useEffect(() => { loadSpeakers(); }, [loadSpeakers]);

  // Backfill personaKind default on mount if missing/empty
  React.useEffect(() => {
    if (v && (v.personaKind == null || v.personaKind === "")) {
      onChange({ ...v, personaKind: "human" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Character Name{mark("name")}</label>
          <input className={cls("name")} value={v.name || ""} onChange={(e)=>set("name", e.target.value)} placeholder="e.g., Baby Zuck" />
          {err("name") && <p className="text-xs text-red-600 mt-1">{err("name")}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Character Persona{mark("visualName")}</label>
          <input className={cls("visualName")} value={v.visualName || ""} onChange={(e)=>set("visualName", e.target.value)} placeholder="e.g., Mark Zuckerberg" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Persona Kind{mark("personaKind")}</label>
          <select className={cls("personaKind")} value={v.personaKind || "human"} onChange={(e)=>set("personaKind", e.target.value)}>
            <option value="">— Select —</option>
            {PERSONA_KINDS.map(k=> <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Look Presets{mark("lookPack")}</label>
          <select className={cls("lookPack")} value={v.lookPack ?? ""} onChange={(e)=>set("lookPack", e.target.value)}>
            <option value="">— Select —</option>
            {PACK_OPTIONS.look.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Persona Presets{mark("personaPack")}</label>
          <select className={cls("personaPack")} value={v.personaPack ?? ""} onChange={(e)=>set("personaPack", e.target.value)}>
            <option value="">— Select —</option>
            {PACK_OPTIONS.persona.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Style Tags</label>
          <input className={cls("styleTags")} value={v.styleTags || ""} onChange={(e)=>set("styleTags", e.target.value)} placeholder="realistic, pixar-like" />
        </div>
        <div className="flex items-end gap-2">
          <input id="pinLook" type="checkbox" checked={!!v.pinLook} onChange={(e)=>set("pinLook", e.target.checked)} />
          <label htmlFor="pinLook" className="text-sm">Pin look</label>
        </div>
      </div>

      {/* Voice (basic) */}
      <div className="rounded border border-slate-200 p-3 space-y-3">
        <p className="font-medium text-sm">Voice</p>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Preset voice / Custom ID</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <select
                className={cls("voicePreset")}
                value={v.voicePreset || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange({ ...v, voicePreset: val });
                }}
              >
                <option value="">— Select —</option>
                {(voices && voices.length
                  ? voices.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name || sp.id}
                      </option>
                    ))
                  : VOICE_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    )))}
              </select>
            </div>
            <div>
              <input
                className={cls("voiceId")}
                value={v.voiceId || ""}
                onChange={(e) => set("voiceId", e.target.value)}
                placeholder="Custom Voice ID (optional)"
              />
            </div>
          </div>

          {/* Inline preview if a library preset is selected */}
          {!!(v.voicePreset && voices && voices.length) && (() => {
            const pv = voices.find((s) => s.id === v.voicePreset);
            return pv ? (
              <div className="mt-2">
                <audio src={pv.audio_url} controls className="w-full" />
                <div className="text-[11px] text-slate-500 break-all mt-1">{pv.audio_url}</div>
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("character.advancedOpen", false));
          React.useEffect(() => setUiPref("character.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3 space-y-4">
            <summary className="cursor-pointer font-medium">Advanced settings</summary>
            <p className="text-xs text-slate-600">Recording, voice traits, acting, consistency and references.</p>

            {/* Voice (advanced) */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Upload voice (WAV/MP3)</label>
                  <input type="file" accept="audio/*" className="mt-1 block w-full"
                    onChange={(e)=> set("uploadVoiceMeta", e.target.files?.[0]
                      ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type }
                      : null)} />
                </div>
              </div>
              <MicRecorder value={v.recordingUrl || null} onChange={(u)=>set("recordingUrl", u)} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Pitch (semitones)</label>
                  <input type="range" min={-12} max={12} step={1} value={v.pitchSemitones ?? 0} onChange={(e)=>set("pitchSemitones", Number(e.target.value))} className="w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Emotion</label>
                  <input className={cls("emotion")} value={v.emotion || "neutral"} onChange={(e)=>set("emotion", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Motion / Acting */}
            <div className="space-y-3">
              <p className="font-medium text-sm">Motion / Acting</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Gesture</label>
                  <input type="range" min={0} max={1} step={0.01} value={v.gesture ?? 0.5} onChange={(e)=>set("gesture", Number(e.target.value))} className="w-full" />
                </div>
                <div className="flex items-end gap-2">
                  <input id="eyeContact" type="checkbox" checked={!!v.eyeContact} onChange={(e)=>set("eyeContact", e.target.checked)} />
                  <label htmlFor="eyeContact" className="text-sm">Eye contact (to camera)</label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="lipStrict" type="checkbox" checked={!!v.lipSyncStrict} onChange={(e)=>set("lipSyncStrict", e.target.checked)} />
                <label htmlFor="lipStrict" className="text-sm">Lip-sync strictness (exact)</label>
              </div>
            </div>

            {/* Consistency */}
            <div className="space-y-2">
              <p className="font-medium text-sm">Consistency</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex items-end gap-2">
                  <input id="lockChar" type="checkbox" checked={!!v.lockCharacter} onChange={(e)=>set("lockCharacter", e.target.checked)} />
                  <label htmlFor="lockChar" className="text-sm">Lock to this character</label>
                </div>
                <div className="flex items-end gap-2">
                  <input id="seedLock" type="checkbox" checked={!!v.seedLock} onChange={(e)=>set("seedLock", e.target.checked)} />
                  <label htmlFor="seedLock" className="text-sm">Seed lock</label>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Seed</label>
                  <input type="number" className={cls("seed")} value={v.seed ?? ""} onChange={(e)=>set("seed", e.target.value === '' ? null : Number(e.target.value))} placeholder="optional" />
                </div>
              </div>
            </div>

            {/* References */}
            <div className="space-y-3">
              <p className="font-medium text-sm">References</p>
              <FileListInput label="Reference image(s)" accept="image/*" value={v.refImages || []} onChange={(list)=>set("refImages", list)} />
              <FileListInput label="Reference video(s)" accept="video/*" value={v.refVideos || []} onChange={(list)=>set("refVideos", list)} />
              <div>
                <label className="text-sm font-medium text-slate-700">Freeform description</label>
                <textarea rows={3} className={cls("refNotes")} value={v.refNotes || ""} onChange={(e)=>set("refNotes", e.target.value)} />
              </div>
            </div>
          </details>
        );
      })()}
    </div>
  );
}

// src/steps/StepSetting.jsx

function StepSetting({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (<span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>);
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"}`;
  const set = (k, val) => onChange({ ...v, [k]: val });

  const onList = (key) => (files) => set(key, [ ...(v[key]||[]), ...Array.from(files||[]).map(f=>({name:f.name,type:f.type,size:f.size})) ]);

  // Backfill shotType default on mount if missing/empty
  React.useEffect(() => {
    if (v && (v.shotType == null || v.shotType === "")) {
      onChange({ ...v, shotType: "medium close-up" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      {/* Environment */}
      <div className="rounded border border-slate-200 p-3 space-y-4">
        <p className="font-medium text-sm">Environment</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Environment preset</label>
            <select className={cls("envPreset")} value={v.envPreset ?? ""} onChange={(e)=>set("envPreset", e.target.value)}>
              <option value="">— Select —</option>
              {ENV_PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Environment (freeform){mark("environment")}</label>
            <input className={cls("environment")} value={v.environment || "env_auto"} onChange={(e)=>set("environment", e.target.value)} />
            {err("environment") && <p className="text-xs text-red-600 mt-1">{err("environment")}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Location</label>
            <input className={cls("location")} value={v.location || ""} onChange={(e)=>set("location", e.target.value)} placeholder="e.g., Tokyo, street" />
          </div>
        </div>
      </div>

      {/* Packs (from libraries) */}
      <div className="rounded border border-slate-200 p-3 space-y-4">
        <p className="font-medium text-sm">Presets</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Base</label>
            <select className={cls("base")} value={v.base ?? ""} onChange={(e)=>set("base", e.target.value)}>
              <option value="">— Select —</option>
              {PACK_OPTIONS.base.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Style Presets</label>
            <select className={cls("stylePack")} value={v.stylePack ?? ""} onChange={(e)=>set("stylePack", e.target.value)}>
              <option value="">— Select —</option>
              {PACK_OPTIONS.style.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Motion Presets</label>
            <select className={cls("motionPack")} value={v.motionPack ?? ""} onChange={(e)=>set("motionPack", e.target.value)}>
              <option value="">— Select —</option>
              {PACK_OPTIONS.motion.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Props Presets</label>
            <select className={cls("propsPack")} value={v.propsPack ?? ""} onChange={(e)=>set("propsPack", e.target.value)}>
              <option value="">— Select —</option>
              {PACK_OPTIONS.props.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Mouth Presets</label>
            <select className={cls("mouthPack")} value={v.mouthPack ?? ""} onChange={(e)=>set("mouthPack", e.target.value)}>
              <option value="">— Select —</option>
              {PACK_OPTIONS.mouth.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Camera, Atmosphere & Framing */}
      <div className="rounded border border-slate-200 p-3 space-y-4">
        <p className="font-medium text-sm">Camera, Atmosphere & Framing</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Camera grammar */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Camera</p>
            <div>
              <label className="text-sm font-medium text-slate-700">Shot type</label>
              <select className={cls("shotType")} value={v.shotType || "medium close-up"} onChange={(e)=>set("shotType", e.target.value)}>
                <option value="">— Select —</option>
                {SHOT_TYPES.map(s=> <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Motion template</label>
              <select className={cls("motionTemplate")} value={v.motionTemplate ?? "locked interview"} onChange={(e)=>set("motionTemplate", e.target.value)}>
                <option value="">— Select —</option>
                {MOTION_TEMPLATES.map(m=> <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Atmosphere */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Atmosphere</p>
            <div>
              <label className="text-sm font-medium text-slate-700">Lighting preset</label>
              <select className={cls("lightingPreset")} value={v.lightingPreset ?? ""} onChange={(e)=>set("lightingPreset", e.target.value)}>
                <option value="">— Select —</option>
                {LIGHT_PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Weather</label>
              <select className={cls("weather")} value={v.weather ?? ""} onChange={(e)=>set("weather", e.target.value)}>
                <option value="">— Select —</option>
                {WEATHER_PRESETS.map(w=> <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          {/* Framing */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Framing</p>
            <div>
              <label className="text-sm font-medium text-slate-700">Subject position</label>
              <select className={cls("subjectPos")} value={v.subjectPos ?? ""} onChange={(e)=>set("subjectPos", e.target.value)}>
                <option value="">— Select —</option>
                {["center","rule_of_thirds","side"].map(p=> <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframes & Continuity */}
      <div className="rounded border border-slate-200 p-3 space-y-4">
        <p className="font-medium text-sm">Keyframes & Continuity</p>
        <div>
          <label className="text-sm font-medium text-slate-700">Keyframe Cue</label>
          <input className={cls("keyframeCue")} value={v.keyframeCue || ""} onChange={(e)=>set("keyframeCue", e.target.value)} placeholder="Describe a screenshot to anchor visuals" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div></div>
          <div>
            <label className="text-sm font-medium text-slate-700">Transition</label>
            <select className={cls("transition")} value={v.transition ?? ""} onChange={(e)=>set("transition", e.target.value)}>
              <option value="">— Select —</option>
              {['cut','dissolve','swipe','glitch'].map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("setting.advancedOpen", false));
          React.useEffect(() => setUiPref("setting.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <>
            <hr className="my-4 border-slate-200" />
            <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3 space-y-4">
              <summary className="cursor-pointer font-medium">Advanced settings <span className="text-xs font-normal text-slate-600 ml-2">Optional uploads & fine‑tuning</span></summary>

            {/* Background assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FileListInput label="Background image(s)" accept="image/*" value={v.bgImages || []} onChange={(list)=>set("bgImages", list)} />
              </div>
              <div>
                <FileListInput label="Background video loop(s)" accept="video/*" value={v.bgVideos || []} onChange={(list)=>set("bgVideos", list)} />
              </div>
            </div>

            {/* Camera movement + Lighting fine‑tune */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-sm font-medium text-slate-700">Camera movement</label>
                <input type="range" min={0} max={1} step={0.01} value={v.cameraMovement ?? 0.5} onChange={(e)=>set("cameraMovement", Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Brightness</label>
                <input type="range" min={-1} max={1} step={0.01} value={v.brightness ?? 0} onChange={(e)=>set("brightness", Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Contrast</label>
                <input type="range" min={-1} max={1} step={0.01} value={v.contrast ?? 0} onChange={(e)=>set("contrast", Number(e.target.value))} className="w-full" />
              </div>
            </div>

            {/* Misc toggles */}
            <div className="flex items-end gap-2">
              <input id="safeZones" type="checkbox" checked={!!v.safeZones} onChange={(e)=>set("safeZones", e.target.checked)} />
              <label htmlFor="safeZones" className="text-sm">Show caption safe zones</label>
            </div>
            <div className="flex items-end gap-2">
              <input id="matchPrev" type="checkbox" checked={!!v.matchPrev} onChange={(e)=>set("matchPrev", e.target.checked)} />
              <label htmlFor="matchPrev" className="text-sm">Match previous scene</label>
            </div>

            {/* Keyframe assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <FileListInput label="Keyframe still(s)" accept="image/*" value={v.keyframeStills || []} onChange={(list)=>set("keyframeStills", list)} />
              </div>
              <div>
                <FileListInput label="Anchor clip(s)" accept="video/*" value={v.anchorClips || []} onChange={(list)=>set("anchorClips", list)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Per‑shot B‑roll descriptions (one per line)</label>
              <textarea rows={3} className={cls("perShotBroll")} value={v.perShotBroll || ""} onChange={(e)=>set("perShotBroll", e.target.value)} />
            </div>

            {/* Prompt tails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-medium text-slate-700">Positive Prompt Tail</label>
                <textarea rows={3} className={cls("positivePromptTail")} value={v.positivePromptTail || ""} onChange={(e)=>set("positivePromptTail", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Negative Prompt Tail</label>
                <textarea rows={3} className={cls("negativePromptTail")} value={v.negativePromptTail || ""} onChange={(e)=>set("negativePromptTail", e.target.value)} />
              </div>
            </div>
            </details>
            </>
        );
      })()}
    </div>
  );
}

// src/steps/StepBroll.jsx

function StepBroll({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (<span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>);
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"}`;
  const set = (k, val) => onChange({ ...v, [k]: val });
  const onList = (key) => (files) => set(key, [ ...(v[key]||[]), ...Array.from(files||[]).map(f=>({name:f.name,type:f.type,size:f.size})) ]);

  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      {/* Guidance */}
      <div>
        <label className="text-sm font-medium text-slate-700">General Guidance{mark("guidance")}</label>
        <textarea rows={4} className={cls("guidance")} value={v.guidance || ""} onChange={(e)=>set("guidance", e.target.value)} placeholder="Camera behavior, textures, energy, etc." />
        {err("guidance") && <p className="text-xs text-red-600 mt-1">{err("guidance")}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Shot Ideas (one per line){mark("shotIdeas")}</label>
        <textarea rows={5} className={cls("shotIdeas")} value={v.shotIdeas || ""} onChange={(e)=>set("shotIdeas", e.target.value)} placeholder={`Pouring syrup on pancakes\nClose-up whisking batter`} />
        {err("shotIdeas") && <p className="text-xs text-red-600 mt-1">{err("shotIdeas")}</p>}
      </div>

      {/* Basic: Allow synthesized assets */}
      <div className="flex items-end gap-2">
        <input id="allowSynth" type="checkbox" checked={!!v.allowSynth} onChange={(e)=>set("allowSynth", e.target.checked)} />
        <label htmlFor="allowSynth" className="text-sm">Allow synthesized assets{mark("allowSynth")}</label>
      </div>

      {/* Advanced: All asset uploads and anchors in persisted <details> */}
      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("broll.advancedOpen", false));
          React.useEffect(() => setUiPref("broll.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3">
            <summary className="cursor-pointer font-medium">Advanced settings</summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
              <div>
                <FileListInput label="Upload image(s)" accept="image/*" value={v.images || []} onChange={(list)=>set("images", list)} />
              </div>
              <div>
                <FileListInput label="Upload video(s)" accept="video/*" value={v.videos || []} onChange={(list)=>set("videos", list)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
              <div>
                <FileListInput label="Upload audio FX" accept="audio/*" value={v.audio || []} onChange={(list)=>set("audio", list)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
              <div>
                <FileListInput label="Keyframe still(s)" accept="image/*" value={v.keyframeStills || []} onChange={(list)=>set("keyframeStills", list)} />
              </div>
              <div>
                <FileListInput label="Anchor clip(s)" accept="video/*" value={v.anchorClips || []} onChange={(list)=>set("anchorClips", list)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium text-slate-700">Per‑shot b‑roll descriptions</label>
              <textarea rows={3} className={cls("perShotBroll")} value={v.perShotBroll || ""} onChange={(e)=>set("perShotBroll", e.target.value)} placeholder={`Shot 0: close‑up pancakes\nShot 1: aerial city street`} />
            </div>
          </details>
        );
      })()}
    </div>
  );
}

// src/steps/StepMusic.jsx

function StepMusic({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (<span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>);
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"}`;
  const set = (k, val) => onChange({ ...v, [k]: val });

  // Backfill musicVol default on mount if missing
  React.useEffect(() => {
    if (v && typeof v.musicVol !== "number") {
      onChange({ ...v, musicVol: 0.15 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFXFiles = (files) => {
    const list = Array.from(files || []).map(f => ({ name: f.name, type: f.type, size: f.size }));
    set("fxUploads", [ ...(v.fxUploads || []), ...list ]);
  };

  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      {/* Mood + Tempo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Mood{mark("mood")}</label>
          <input className={cls("mood")} value={v.mood || "light underscore"} onChange={(e)=>set("mood", e.target.value)} />
          {err("mood") && <p className="text-xs text-red-600 mt-1">{err("mood")}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Tempo</label>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 items-center">
            <input type="range" min={60} max={180} step={1} value={v.tempoVal ?? 100} onChange={(e)=>set("tempoVal", Number(e.target.value))} />
            <div className="text-xs text-slate-600 w-16 text-right">{v.tempoVal ?? 100} bpm</div>
          </div>
        </div>
      </div>

      {/* Music pack (library) */}
      <div>
        <label className="text-sm font-medium text-slate-700">Music Presets</label>
        <select className={cls("musicPack")} value={v.musicPack ?? ""} onChange={(e)=>set("musicPack", e.target.value)}>
          <option value="">— Select —</option>
          {PACK_OPTIONS.music.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      {/* Vocal options (basic) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="flex items-end gap-2">
          <input id="vocals" type="checkbox" checked={!!v.vocals} onChange={(e)=>set("vocals", e.target.checked)} />
          <span className="text-sm">Allow vocals</span>
        </label>
        <label className="flex items-end gap-2">
          <input id="ducking" type="checkbox" checked={!!v.ducking} onChange={(e)=>set("ducking", e.target.checked)} />
          <span className="text-sm">Ducking under VO</span>
        </label>
      </div>

      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("music.advancedOpen", false));
          React.useEffect(() => setUiPref("music.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3 space-y-4">
            <summary className="cursor-pointer font-medium">Advanced settings</summary>

            {/* Music upload */}
            <div>
              <label className="text-sm font-medium text-slate-700">Upload music</label>
              <input type="file" accept="audio/*" className="mt-1 block w-full" onChange={(e)=> set("musicUpload", e.target.files?.[0] ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type } : null)} />
            </div>

            {/* Ambience + FX */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-sm font-medium text-slate-700">Ambience</label>
                <select className={cls("ambience")} value={v.ambience ?? ""} onChange={(e)=>set("ambience", e.target.value)}>
                  <option value="">— Select —</option>
                  {AMBIENCE_PRESETS.map(a=> <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Sound effects</label>
                <input type="file" accept="audio/*" multiple className="mt-1 block w-full" onChange={(e)=>onFXFiles(e.target.files)} />
                {!!(v.fxUploads && v.fxUploads.length) && (
                  <ul className="mt-1 text-xs list-disc pl-5 text-slate-600">
                    {v.fxUploads.map((f,i)=> <li key={i}>{f.name} <span className="opacity-60">({f.type}, {f.size}B)</span></li>)}
                  </ul>
                )}
              </div>
            </div>

            {/* Mix levels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-sm font-medium text-slate-700">VO volume</label>
                <input type="range" min={0} max={1} step={0.01} value={v.voVol ?? 0.9} onChange={(e)=>set("voVol", Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Music volume</label>
                <input type="range" min={0} max={1} step={0.01} value={v.musicVol ?? 0.15} onChange={(e)=>set("musicVol", Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">FX volume</label>
                <input type="range" min={0} max={1} step={0.01} value={v.fxVol ?? 0.5} onChange={(e)=>set("fxVol", Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </details>
        );
      })()}
    </div>
  );
}

// src/steps/StepFlags.jsx

function StepFlags({ value, onChange, errors = {}, required = [] }) {
  const v = value || {};
  const req = new Set(required || []);
  const err = (k) => errors?.[k];
  const mark = (k) => (<span className="ml-1 text-red-600" aria-hidden>{req.has(k) ? "*" : ""}</span>);
  const cls = (k) => `mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${err(k) ? "border-red-400 ring-red-300" : "border-gray-300 ring-indigo-200"}`;
  const set = (k, val) => onChange({ ...v, [k]: val });

  const LANGS = ["en","es","fr","de","pt","it","hi","zh","ja","ko","ar"]; // small, editable set

  return (
    <div className="space-y-6">
      <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

      {/* Flags */}
      <div className="rounded border border-slate-200 p-3 space-y-2">
        <p className="font-medium text-sm">Flags</p>
        <div className="flex items-center gap-2">
          <input id="captions" type="checkbox" checked={!!v.captions} onChange={(e)=>set("captions", e.target.checked)} />
          <label htmlFor="captions" className="text-sm">Captions{mark("captions")}</label>
        </div>
        <div className="flex items-center gap-2">
          <input id="music" type="checkbox" checked={!!v.music} onChange={(e)=>set("music", e.target.checked)} />
          <label htmlFor="music" className="text-sm">Music{mark("music")}</label>
        </div>
        <div className="flex items-center gap-2">
          <input id="podcastStill" type="checkbox" checked={!!v.podcastStill} onChange={(e)=>set("podcastStill", e.target.checked)} />
          <label htmlFor="podcastStill" className="text-sm">Podcast still{mark("podcastStill")}</label>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Words per second{mark("wordsPerSecond")}</label>
          <input type="number" min={1} max={5} step={0.1} className={cls("wordsPerSecond")} value={v.wordsPerSecond ?? 2.5} onChange={(e)=>set("wordsPerSecond", Number(e.target.value||0))} />
        </div>
      </div>

      {/* Video specs */}
      <div className="rounded border border-slate-200 p-3 space-y-3">
        <p className="font-medium text-sm">Video Specs</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Resolution preset</label>
            <select className={cls("resPreset")} value={v.resPreset ?? ""} onChange={(e)=>set("resPreset", e.target.value)}>
              <option value="">— Select —</option>
              {Object.keys(RES_PRESETS).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Aspect ratio</label>
            <select className={cls("aspect")} value={v.aspect ?? ""} onChange={(e)=>set("aspect", e.target.value)}>
              <option value="">— Select —</option>
              {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">FPS</label>
            <select className={cls("fps")} value={v.fps ?? ""} onChange={(e)=>set("fps", Number(e.target.value))}>
              <option value="">— Select —</option>
              {FPS_PRESETS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {(() => {
        const [open, setOpen] = (function useOpen() {
          const [o, so] = React.useState(getUiPref("flags.advancedOpen", false));
          React.useEffect(() => setUiPref("flags.advancedOpen", o), [o]);
          return [o, so];
        })();
        return (
          <details open={open} onToggle={(e)=>setOpen(e.currentTarget.open)} className="rounded border border-slate-200 p-3 space-y-4">
            <summary className="cursor-pointer font-medium">Advanced settings</summary>
            <p className="text-xs text-slate-600">Technical controls most users can ignore.</p>

            {/* Determinism */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
              <p className="font-medium text-sm">Determinism</p>
              <div className="flex items-center gap-2">
                <input id="seedLock" type="checkbox" checked={!!v.seedLock} onChange={(e)=>set("seedLock", e.target.checked)} />
                <label htmlFor="seedLock" className="text-sm">Seed lock</label>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Strictness</label>
                <input type="range" min={0} max={1} step={0.01} value={v.strictness ?? 0.6} onChange={(e)=>set("strictness", Number(e.target.value))} className="w-full" />
                <div className="text-xs text-slate-600">0 = allow AI freedom · 1 = follow inputs strictly</div>
              </div>
              <div className="flex items-center gap-2">
                <input id="respectKeyframes" type="checkbox" checked={!!v.respectKeyframes} onChange={(e)=>set("respectKeyframes", e.target.checked)} />
                <label htmlFor="respectKeyframes" className="text-sm">Respect my keyframes</label>
              </div>
            </div>

            {/* Accessibility */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
              <p className="font-medium text-sm">Accessibility</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Subtitle language</label>
                  <select className={cls("subtitleLang")} value={v.subtitleLang || "en"} onChange={(e)=>set("subtitleLang", e.target.value)}>
                    <option value="">— Select —</option>
                    {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <input id="autoTranslate" type="checkbox" checked={!!v.autoTranslate} onChange={(e)=>set("autoTranslate", e.target.checked)} />
                  <label htmlFor="autoTranslate" className="text-sm">Auto‑translate captions</label>
                </div>
                <div className="flex items-end gap-2">
                  <input id="altTextExport" type="checkbox" checked={!!v.altTextExport} onChange={(e)=>set("altTextExport", e.target.checked)} />
                  <label htmlFor="altTextExport" className="text-sm">Include alt‑text / transcript export</label>
                </div>
              </div>
            </div>
          </details>
        );
      })()}
    </div>
  );
}

// src/steps/StepReview.jsx
// ---- HEADER PATCH START ----
// Find the top-level <header>…</header> and insert the following block before </header>

// Example:
// <header ...>
//   ...header content...
//   <div className="ml-auto flex items-center">
//     <HeaderResetButton />
//   </div>
// </header>

// ---- HEADER PATCH END ----
const StepReview = React.forwardRef(function StepReview({ fullState, errors = {} }, ref) {
  const ready = Object.values(errors).every((e) => !e || Object.keys(e).length === 0);

  // API endpoints
  const SUBMIT_WEBHOOK  = "/api/submit";
  const STATUS_WEBHOOK  = new URL("/api/status", window.location.origin).toString(); // absolute

  // UI state
  const [sending, setSending]   = React.useState(false);
  const [sendMsg, setSendMsg]   = React.useState(null);

  // Job tracking
  const [jobId, setJobId]           = React.useState(null);
  const [jobStatus, setJobStatus]   = React.useState(null);   // QUEUED/PROCESSING/DONE/ERROR
  const [jobResult, setJobResult]   = React.useState(null);   // { url, meta }

  // Polling controller
  const pollRef = React.useRef({ running:false, timer:null, tries:0, grace:0 });
  const POLL_MS = 4000;
  const GRACE_TICKS_AFTER_DONE = 5; // keep polling briefly after DONE until URL shows

  // Keep latest result to avoid stale closure reads
  const jobResultRef = React.useRef(jobResult);
  React.useEffect(() => { jobResultRef.current = jobResult; }, [jobResult]);

  // Persist job so refresh resumes
  const JOB_LS_KEY = "n8nJobState"; // keep the old key for compatibility

  // ---- URL helpers (allow resume across devices) ----
  function getJobIdFromUrl() {
    try { return new URLSearchParams(window.location.search).get("jobId"); } catch { return null; }
  }
  function setJobIdInUrl(id) {
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("jobId", id);
      else url.searchParams.delete("jobId");
      window.history.replaceState({}, "", url);
    } catch {}
  }

  // Save a consistent snapshot
  function saveJobSnapshot(next) {
    try {
      const snap = {
        id:     next?.id     ?? jobId ?? null,
        status: next?.status ?? jobStatus ?? null,
        result: next?.result ?? jobResult ?? null,
        ts: Date.now(),
      };
      localStorage.setItem(JOB_LS_KEY, JSON.stringify(snap));
    } catch {}
  }

  // Restore previous job (URL takes precedence)
  React.useEffect(() => {
    try {
      const urlJob = getJobIdFromUrl();
      if (urlJob) {
        setJobId(urlJob);
        setJobStatus("PROCESSING");
        startPolling(urlJob);
        return;
      }
      const raw = localStorage.getItem(JOB_LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.id) return;

      setJobId(saved.id);
      setJobStatus(saved.status || "PROCESSING");
      setJobResult(saved.result || null);

      if (!saved?.result?.url) startPolling(saved.id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep snapshot fresh
  React.useEffect(() => { saveJobSnapshot(); /* eslint-disable-next-line */ }, [jobId, jobStatus, jobResult]);

  // Cleanup on unmount
  React.useEffect(() => () => stopPoll(), []);

  // ---- Polling core --------------------------------------------------------

  function stopPoll() {
    if (pollRef.current.timer) {
      clearTimeout(pollRef.current.timer);
    }
    pollRef.current = { running:false, timer:null, tries:0, grace:0 };
  }

  function extractStatus(data) {
    const s = data?.status ?? data?.state ?? data?.job?.status ?? data?.data?.status ?? null;
    return typeof s === "string" ? s.toUpperCase() : s;
  }

  function extractFinalUrl(data) {
    return (
      data?.finalVideoUrl ||
      data?.url ||
      data?.videoUrl ||
      data?.data?.finalVideoUrl ||
      data?.data?.url ||
      data?.meta?.finalVideoUrl ||
      data?.meta?.urls?.music ||
      data?.meta?.urls?.captions ||
      data?.meta?.urls?.original ||
      data?.response?.[0]?.file_url ||
      null
    );
  }

  function normalizePayload(raw) {
    if (raw && typeof raw === "object" && "data" in raw && typeof raw.data === "object") return raw.data;
    const keys = raw && typeof raw === "object" ? Object.keys(raw) : [];
    if (keys.length === 1 && keys[0].toLowerCase().includes("object")) {
      const only = raw[keys[0]];
      if (only && typeof only === "object") return only;
    }
    return raw;
  }

  async function pollOnce(id) {
    if (!id) return;

    try {
      const u = new URL(STATUS_WEBHOOK);
      u.searchParams.set("jobId", String(id));
      u.searchParams.set("_", String(Date.now())); // cache buster

      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 10000);

      console.log("[poll] GET", u.toString());
      const res = await fetch(u.toString(), {
        method: "GET",
        signal: ctrl.signal,
        mode: "cors",
        cache: "no-store",
        headers: { "Accept": "application/json" },
      });
      clearTimeout(kill);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let data;
      try { data = await res.json(); }
      catch {
        const text = await res.text();
        data = JSON.parse(text);
      }
      data = normalizePayload(data);

      const nextStatus = extractStatus(data) || "PROCESSING";
      const finalUrl   = extractFinalUrl(data);

      setJobStatus(nextStatus);
      saveJobSnapshot({ id, status: nextStatus });

      if (finalUrl) {
        const result = { url: finalUrl, meta: data.meta || null };
        setJobResult(result);
        saveJobSnapshot({ id, status: "DONE", result });
        console.log("[poll] final URL received, stopping");
        stopPoll();
        return;
      }

      if (nextStatus === "ERROR" || nextStatus === "FAILED") {
        console.warn("[poll] terminal error status");
        stopPoll();
        saveJobSnapshot({ id, status: "ERROR" });
        return;
      }

      // If backend says DONE but URL not yet propagated, keep polling briefly.
      if (nextStatus === "DONE" && !jobResultRef.current?.url) {
        pollRef.current.grace = Math.min(
          pollRef.current.grace + 1,
          GRACE_TICKS_AFTER_DONE
        );
      } else {
        pollRef.current.grace = 0;
      }
    } catch (e) {
      // Network hiccup: keep trying, but don’t spam the console.
      console.warn("[poll] error:", e?.message || e);
    }
  }

  function loop(id) {
    if (!pollRef.current.running) return;
    pollRef.current.timer = setTimeout(async () => {
      await pollOnce(id);

      // If we’ve exceeded grace window and still no URL with DONE, stop.
      if (
        pollRef.current.grace >= GRACE_TICKS_AFTER_DONE &&
        jobStatus === "DONE" &&
        !jobResultRef.current?.url
      ) {
        console.warn("[poll] DONE without URL after grace window, stopping");
        stopPoll();
        return;
      }

      loop(id); // schedule next tick
    }, POLL_MS);
  }

  function startPolling(id) {
    if (!id) return;
    if (pollRef.current.running) {
      // already polling this or another id; restart cleanly
      stopPoll();
    }
    setJobStatus("PROCESSING");
    saveJobSnapshot({ id, status: "PROCESSING" });

    pollRef.current.running = true;
    pollRef.current.tries = 0;
    pollRef.current.grace = 0;

    console.log("[poll] start", id);
    // fire immediately, then schedule the loop
    pollOnce(id).finally(() => loop(id));
  }

  // ---- Payload builder (state -> API) --------------------------------------

  function buildPayload(state) {
    const { minimalInput, character, setting } = state || {};
    const eff = computeEffectiveState(state);

    const videoType =
      minimalInput?.route === "aroll" ? "A-Roll" :
      minimalInput?.route === "broll" ? "B-Roll" :
      minimalInput?.route === "combo" ? "Combo" :
      minimalInput?.route === "podcast" ? "Podcast" :
      minimalInput?.route || "A-Roll";

    const resPreset = state?.flags?.resPreset || "1080p";
    const aspect = state?.flags?.aspect || "16:9";
    const fps = state?.flags?.fps ?? 30;

    const characters = [{
      id: "char1",
      name: character?.name || "Host",
      voiceSelectionName: character?.voicePreset || character?.voiceId || "",
    }];

    const personaMeta = {
      name: character?.name || "",
      alias: minimalInput?.title || "",
      packId: character?.personaPack || "pack_persona_human_adult",
      kind: character?.personaKind || "human",
    };

    const packs = {
      stylePack:   eff.packs.stylePack,
      lookPack:    eff.packs.lookPack,
      accentPack:  eff.packs.accentPack,
      motionPack:  eff.packs.motionPack,
      musicPack:   eff.packs.musicPack,
      personaPack: eff.packs.personaPack,
      propsPack:   eff.packs.propsPack,
      mouthPack:   eff.packs.mouthPack,
      basePack:    eff.packs.basePack,
    };

    const resolution = (() => {
      const aspectMap = {
        "16:9": { width: 1024, height: 576 },
        "9:16": { width: 576,  height: 1024 },
        "1:1":  { width: 1024, height: 1024 },
        "4:5":  { width: 819,  height: 1024 },
      };
      return aspectMap[aspect] || aspectMap["16:9"];
    })();

    const includeCaptions = !!eff.flags.captions;
    const includeMusic    = !!eff.flags.music;

    return {
      packsLibraryVersion: 1,
      mergedFromForm: {
        title: minimalInput?.title || "Untitled",
        subject: minimalInput?.subject || "",
        videoType,
        durationSec: minimalInput?.durationSec ?? 60,
        resolution,
        fps,
        includeCaptions,
        includeMusic,
        characters,
        personaMeta,
        referenceText: minimalInput?.referenceText || "",
        packs: { ...packs },
        packIds: { ...packs },
        style: minimalInput?.style || "",
        tone: minimalInput?.tone || "",
        template: (minimalInput?.templates && minimalInput.templates[0]) || "",
        styleKey: eff.styleKey,
        submittedAt: new Date().toISOString(),
        formMode: "wizard",
      },
      flags: {
        aspect,
        resPreset,
        fps,
        wordsPerSecond: state?.flags?.wordsPerSecond ?? 2.5,
        podcastStill: !!eff.flags.podcastStill,
        strictness: state?.flags?.strictness ?? 0.6,
        respectKeyframes: !!state?.flags?.respectKeyframes,
        seedLock: !!state?.flags?.seedLock,
      },
      setting: {
        envPreset: setting?.envPreset,
        environment: setting?.environment || eff.profile?.environment || "env_auto",
        location: setting?.location,
        base: packs.basePack,
        lightingPreset: setting?.lightingPreset,
        weather: setting?.weather,
        shotType: setting?.shotType || "medium",
        subjectPos: setting?.subjectPos,
        keyframeCue: setting?.keyframeCue,
        transition: setting?.transition,
      },
      music: {
        mood: eff.music.mood,
        tempo: eff.music.tempo,
        tempoVal: eff.music.tempoVal,
        vocals: !!state?.music?.vocals,
        ducking: !!state?.music?.ducking,
        ambience: state?.music?.ambience,
        voVol: typeof state?.music?.voVol === "number" ? state.music.voVol : 0.9,
        musicVol: typeof state?.music?.musicVol === "number" ? state.music.musicVol : 0.15,
        fxVol: typeof state?.music?.fxVol === "number" ? state.music.fxVol : 0.5,
      },
      rawState: state,
    };
  }

  // ---- Utilities -----------------------------------------------------------

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(fullState, null, 2));
      alert("Copied JSON to clipboard");
    } catch (err) {
      console.error("Copy failed:", err);
      alert("Sorry, your browser blocked clipboard access.");
    }
  };

  const downloadJson = () => {
    try {
      const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wizard-payload.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Could not download JSON.");
    }
  };

  function safeHeaders() {
    const h = { "Content-Type": "application/json" };
    const t = import.meta?.env?.VITE_APP_TOKEN;
    if (t) h["x-app-token"] = t;
    return h;
  }

  // ---- Submit --------------------------------------------------------------

  async function sendToApi() {
    setSendMsg(null);
    const payload = buildPayload(fullState);
    setSending(true);
    try {
      const res = await fetch(SUBMIT_WEBHOOK, {
        method: "POST",
        headers: safeHeaders(),
        body: JSON.stringify(payload),
        mode: "cors",
        keepalive: true,
      });
      const dataText = await res.text();
      if (!res.ok) throw new Error(dataText || `HTTP ${res.status}`);

      let data; try { data = JSON.parse(dataText); } catch { data = {}; }
      const returnedJobId = data?.jobId || data?.id || null;

      setSendMsg({
        kind: "ok",
        text: "Submitting will auto-poll for status until the final video is ready. This could take up to an hour",
      });

      if (returnedJobId) {
        setJobId(returnedJobId);
        setJobIdInUrl(returnedJobId);
        startPolling(returnedJobId);
      } else {
        console.warn("No jobId returned from API.");
      }
    } catch (e) {
      setSendMsg({
        kind: "error",
        text: "Send failed.",
        detail: (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e)
      });
    } finally {
      setSending(false);
    }
  }

  // ---- pretty review helpers (unchanged) -----------------------------------

  function PrettyValue({ value }) {
    if (value == null) return <span className="text-slate-500">—</span>;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return <span>{String(value)}</span>;
    if (Array.isArray(value)) {
      if (!value.length) return <span className="text-slate-500">—</span>;
      return (
        <ul className="list-disc pl-5 space-y-1">
          {value.map((v, i) => (<li key={i}><PrettyValue value={v} /></li>))}
        </ul>
      );
    }
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-4">
            <div className="text-slate-500">{k}</div>
            <div className="break-words"><PrettyValue value={v} /></div>
          </div>
        ))}
      </div>
    );
  }

  function SectionBlock({ title, obj }) {
    if (!obj || (typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length === 0)) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <div className="rounded border border-slate-200 p-3">
          <PrettyValue value={obj} />
        </div>
      </div>
    );
  }

  // Expose sender to parent
  React.useImperativeHandle(ref, () => ({ send: sendToApi }));

  // ---- render --------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="mb-1 font-medium">Validation</p>
        {ready ? (
          <p className="text-green-700">All required fields look good. 🎉</p>
        ) : (
          <p className="text-red-600">
            Some steps still have issues — missing required fields are highlighted in their forms.
          </p>
        )}
      </div>

      <h3 className="text-base font-semibold">Review Summary</h3>
      <div className="rounded border border-slate-200 p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {/* left column */}
          <div className="space-y-2">
            <div><span className="text-slate-500">Title:</span> <span className="font-medium">{fullState?.minimalInput?.title || "—"}</span></div>
            <div><span className="text-slate-500">Subject:</span> <span>{fullState?.minimalInput?.subject || "—"}</span></div>
            <div><span className="text-slate-500">Duration:</span> <span>{fullState?.minimalInput?.durationSec ?? "—"} sec</span></div>
            <div><span className="text-slate-500">Route:</span> <span>{fullState?.minimalInput?.route || "—"}</span></div>
            <div><span className="text-slate-500">Style:</span> <span>{fullState?.minimalInput?.style || "—"}</span></div>
            <div><span className="text-slate-500">Tone:</span> <span>{fullState?.minimalInput?.tone || "—"}</span></div>
          </div>
          {/* right column */}
          <div className="space-y-2">
            <div>
              <span className="text-slate-500">Character:</span> <span>{fullState?.character?.name || "—"}</span>
              {fullState?.character?.visualName ? <span className="text-slate-500"> ({fullState.character.visualName})</span> : null}
            </div>
            <div>
              <span className="text-slate-500">Packs:</span>{" "}
              <span className="block">
                {[
                  fullState?.setting?.base && `base: ${fullState.setting.base}`,
                  fullState?.setting?.stylePack && `style: ${fullState.setting.stylePack}`,
                  fullState?.character?.lookPack && `look: ${fullState.character.lookPack}`,
                  fullState?.setting?.motionPack && `motion: ${fullState.setting.motionPack}`,
                  fullState?.setting?.propsPack && `props: ${fullState.setting.propsPack}`,
                  fullState?.setting?.mouthPack && `mouth: ${fullState.setting.mouthPack}`,
                  fullState?.character?.personaPack && `persona: ${fullState.character.personaPack}`,
                  fullState?.music?.musicPack && `music: ${fullState.music.musicPack}`,
                ].filter(Boolean).join(" · ") || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Music:</span>{" "}
              <span>
                {fullState?.flags?.music
                  ? `on (${fullState?.music?.mood || "mood"}, ${fullState?.music?.tempoVal ?? "?"} bpm${fullState?.music?.vocals ? ", vocals" : ", no vocals"})`
                  : "off"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Captions:</span> <span>{fullState?.flags?.captions ? "on" : "off"}</span>
            </div>
            <div>
              <span className="text-slate-500">Video Spec:</span>{" "}
              <span>{fullState?.flags?.aspect || "—"} · {fullState?.flags?.fps ?? "—"} fps · {fullState?.flags?.resPreset || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Review details (all inputs, pretty formatted) */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Review details</h3>
        <div className="text-sm space-y-4">
          <SectionBlock title="Concept" obj={fullState?.minimalInput} />
          <SectionBlock title="Character" obj={fullState?.character} />
          <SectionBlock title="Setting &amp; Keyframes" obj={fullState?.setting} />
          <SectionBlock title="Video Prompts" obj={fullState?.broll} />
          <SectionBlock title="Music" obj={fullState?.music} />
          <SectionBlock title="Settings" obj={fullState?.flags} />
          {/* Any unexpected top-level fields */}
          {Object.entries(fullState || {})
            .filter(([k]) => !['minimalInput','character','setting','broll','music','flags'].includes(k))
            .map(([k,v]) => <SectionBlock key={k} title={k} obj={v} />)}
        </div>
      </div>

      {/* Submit + status */}
      <div className="rounded border border-slate-200 p-3 space-y-3">
        <p className="font-medium text-sm">Review and submit</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={sendToApi} disabled={sending} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            {sending ? "Sending…" : "Submit"}
          </button>
          <button onClick={copyJson} className="rounded bg-slate-200 px-3 py-1 text-sm">Copy JSON</button>
          <button onClick={downloadJson} className="rounded bg-slate-200 px-3 py-1 text-sm">Download JSON</button>
        </div>

        {/* Job state */}
        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
          <div><span className="font-semibold">Job:</span> {jobId || "—"}</div>
          <div>
            <span className="font-semibold">Status:</span>{" "}
            {jobStatus || (jobId && !jobResult?.url ? "PROCESSING" : (pollRef.current.running ? "queued/processing" : "—"))}
          </div>
          {jobResult?.url && <span className="text-green-700 font-medium">Ready</span>}
          {jobId && (
            <button
              type="button"
              onClick={() => {
                stopPoll();
                setJobId(null);
                setJobStatus(null);
                setJobResult(null);
                try { localStorage.removeItem(JOB_LS_KEY); } catch {}
                setJobIdInUrl(null);
              }}
              className="ml-2 rounded bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px] hover:bg-rose-200"
              title="Clear current job and stop polling"
            >
              Clear
            </button>
          )}
        </div>

        {/* Final video preview */}
        {jobResult?.url && (
          <div className="mt-3">
            <video src={jobResult.url} controls className="w-full max-h-96 rounded border border-slate-200" />
            <div className="text-xs text-slate-600 mt-1 break-all">{jobResult.url}</div>
          </div>
        )}

        {sendMsg && (
          <div className={`text-sm ${sendMsg.kind === "ok" ? "text-green-700" : "text-red-700"}`}>
            {sendMsg.text}
            {sendMsg.detail && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{sendMsg.detail}</pre>}
          </div>
        )}
      </div>
    </div>
  );
});

// ---------------- App wrapper with stepper ----------------

const REQUIRED = {
  Concept: ["title", "subject", "durationSec", "route"],
  // others are optional for now; expand as you wish
};

// map step keys to the branch name in state
const STEP_TO_STATE_KEY = {
  Concept: "minimalInput",
  character: "character",
  setting: "setting",
  broll: "broll",
  music: "music",
  flags: "flags",
};

// tiny validator: returns an object of field->message for missing required
function validateFields(obj, required = []) {
  const out = {};
  (required || []).forEach((k) => {
    const v = obj?.[k];
    if (v == null || v === "" || (typeof v === "number" && Number.isNaN(v))) {
      out[k] = "This field is required";
    }
  });
  return out;
}

// step list
const STEPS = [
  { key: "Concept", label: "Concept", component: StepConcept, required: REQUIRED.Concept },
  { key: "character", label: "Character", component: StepCharacter },
  { key: "setting", label: "Setting & Keyframes", component: StepSetting },
  { key: "broll", label: "Video Prompts", component: StepBroll },
  { key: "music", label: "Music", component: StepMusic },
  { key: "flags", label: "Settings", component: StepFlags },
  { key: "review", label: "Review", component: StepReview },
];

const DEFAULT_STATE = {
  minimalInput: {
    title: "",
    subject: "",
    durationSec: 60,
    route: "aroll",
    style: "",
    tone: "",
    referenceText: "",
    referenceUploadMeta: null,
    templates: [],
    audience: "",
    tags: "",
    location: "",
    matchPriorEpisode: false,
    seriesMode: false,
  },
  character: {
    name: "",
    visualName: "",
    personaKind: "human",
    lookPack: "pack_look_clean_host",
    personaPack: "pack_persona_human_adult",
    accent: "",
    styleTags: "",
    pinLook: false,
    voiceId: "",
    voicePreset: "",
    uploadVoiceMeta: null,
    recordingUrl: null,
    pitchSemitones: 0,
    speed: 1.0,
    emotion: "",
    gesture: 0.5,
    eyeContact: true,
    lipSyncStrict: false,
    lockCharacter: false,
    seedLock: false,
    seed: null,
    refImages: [],
    refVideos: [],
    refNotes: ""
  },
  setting: {
    envPreset: "studio",
    environment: "env_auto",
    location: "",
    base: "base_creator_video",
    stylePack: "pack_style_presenter",
    motionPack: "pack_motion_confident",
    propsPack: "pack_props_studio_backdrop",
    mouthPack: "pack_mouth_subtle",
    bgImages: [],
    bgVideos: [],
    shotType: "selfie",
    cameraMovement: 0.5,
    motionTemplate: "locked interview",
    lightingPreset: "day",
    brightness: 0,
    contrast: 0,
    weather: "clear",
    safeZones: false,
    subjectPos: "center",
    keyframeCue: "",
    keyframeStills: [],
    anchorClips: [],
    perShotBroll: "",
    positivePromptTail: "",
    negativePromptTail: "",
    matchPrev: false,
    transition: "cut",
  },
  broll: {
    guidance: "",
    shotIdeas: "",
    allowSynth: true,
    images: [],
    videos: [],
    audio: [],
    keyframeStills: [],
    anchorClips: [],
    perShotBroll: "",
  },
  music: {
    mood: "",
    tempo: "",
    tempoVal: 100,
    vocals: false,
    ducking: true,
    musicUpload: null,
    musicPack: "pack_music_light_underscore",
    ambience: "studio",
    fxUploads: [],
    voVol: 0.9,
    musicVol: 0.5,
    fxVol: 0.5,
  },
  flags: {
    captions: true,
    music: true,
    podcastStill: false,
    wordsPerSecond: 2.5,
    resPreset: "1080p",
    aspect: "16:9",
    fps: 30,
    seedLock: false,
    strictness: 0.6,
    respectKeyframes: true,
    subtitleLang: "en",
    autoTranslate: false,
    altTextExport: false,
  },
};

function App() {
  const [state, setState] = React.useState(() => {
    try {
      const raw = localStorage.getItem("ai-wizard-state");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Deep-merge per branch so new default leaf fields are preserved
        return {
          ...DEFAULT_STATE,
          minimalInput: { ...DEFAULT_STATE.minimalInput, ...(parsed.minimalInput || {}) },
          character:    { ...DEFAULT_STATE.character,    ...(parsed.character    || {}) },
          setting:      { ...DEFAULT_STATE.setting,      ...(parsed.setting      || {}) },
          broll:        { ...DEFAULT_STATE.broll,        ...(parsed.broll        || {}) },
          music:        { ...DEFAULT_STATE.music,        ...(parsed.music        || {}) },
          flags:        { ...DEFAULT_STATE.flags,        ...(parsed.flags        || {}) },
        };
      }
    } catch (e) {
      console.warn("State load failed:", e);
    }
    return { ...DEFAULT_STATE };
  });
  // Track the last template styleKey we applied to avoid hydration loops
  const lastHydratedKeyRef = React.useRef(null);

  // When the top template selection changes, OVERWRITE form fields with the template profile
  React.useEffect(() => {
    const topLabel = state?.minimalInput?.templates?.[0] || null;
    const styleKey = resolveStyleKeyFromTemplateLabel(topLabel); // falls back to "generic-video"
    if (!styleKey) return;
    if (lastHydratedKeyRef.current === styleKey) return; // already applied -> no-op
    setState(prev => hydrateDefaultsFromProfile(prev, styleKey));
    lastHydratedKeyRef.current = styleKey;
  }, [state?.minimalInput?.templates?.[0]]);

  // Also respond to the custom event the Templates checkboxes fire
  React.useEffect(() => {
    const onTpl = (e) => {
      const label = e?.detail?.topTemplate || null;
      const key = resolveStyleKeyFromTemplateLabel(label);
      if (!key) return;
      if (lastHydratedKeyRef.current === key) return;
      setState(prev => hydrateDefaultsFromProfile(prev, key));
      lastHydratedKeyRef.current = key;
    };
    window.addEventListener('wizard:templateChanged', onTpl);
    return () => window.removeEventListener('wizard:templateChanged', onTpl);
  }, []);


  // On initial mount, hydrate once from the current (or default) template
  React.useEffect(() => {
    const key = resolveStyleKeyFromTemplateLabel(
      state?.minimalInput?.templates?.[0] || DEFAULT_STYLE_KEY || "generic-video"
    );
    if (key && key !== lastHydratedKeyRef.current) {
      setState((cur) => hydrateDefaultsFromProfile(cur, key));
      lastHydratedKeyRef.current = key;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the first selected template changes, re-hydrate soft defaults
  React.useEffect(() => {
    const key = resolveStyleKeyFromTemplateLabel(
      state?.minimalInput?.templates?.[0] || DEFAULT_STYLE_KEY || "generic-video"
    );
    if (key && key !== lastHydratedKeyRef.current) {
      setState((cur) => hydrateDefaultsFromProfile(cur, key));
      lastHydratedKeyRef.current = key;
    }
  }, [state?.minimalInput?.templates?.[0]]);
  
  // When the top template changes (StepConcept dispatches 'wizard:templateChanged'),
  // hydrate defaults from the selected style profile into empty fields only.
  React.useEffect(() => {
    function onTemplateChanged(ev) {
      const top = ev?.detail?.topTemplate || "";
      const styleKey = resolveStyleKeyFromTemplateLabel(top);
      setState((cur) => hydrateDefaultsFromProfile(cur, styleKey));
    }
    window.addEventListener("wizard:templateChanged", onTemplateChanged);
    return () => window.removeEventListener("wizard:templateChanged", onTemplateChanged);
  }, []);

  // Persist wizard state so refreshes keep progress
  React.useEffect(() => {
    try {
      localStorage.setItem("ai-wizard-state", JSON.stringify(state));
    } catch (e) {
      // ignore write errors (private mode, etc.)
    }
  }, [state]);

  // --- Tabs (below header) ---
  const [activeStep, setActiveStep] = React.useState(() => {
    try {
      return localStorage.getItem("ai-wizard-activeStep") || STEPS[0].key;
    } catch {
      return STEPS[0].key;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("ai-wizard-activeStep", activeStep);
    } catch {}
  }, [activeStep]);

  // Render helpers for the active step
  function renderActiveStep() {
    const active = STEPS.find((s) => s.key === activeStep) || STEPS[0];
    const StepComp = active.component;

  if (active.key === "review") {
    // Review step expects the whole state and an error map
    return (
      <section className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-base font-semibold">{active.label}</h2>
        <div className="mt-4">
          <StepComp
            fullState={state}
            errors={{
              Concept: validateFields(state.minimalInput, REQUIRED.Concept),
            }}
          />
        </div>
      </section>
    );
  }

  const stateKey = STEP_TO_STATE_KEY[active.key] || active.key;
  const required = active.required || [];
  const errors = validateFields(state[stateKey], required);
  const onChange = (nv) => setState((s) => ({ ...s, [stateKey]: nv }));

  return (
    <section className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-base font-semibold">{active.label}</h2>
      <div className="mt-4">
        <StepComp
          value={state[stateKey]}
          onChange={onChange}
          required={required}
          errors={errors}
        />
      </div>
    </section>
  );
}

return (
  <AppErrorBoundary>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">SceneMe</h1>
          {/* Right-justified global reset */}
          <HeaderResetButton />
        </div>

        {/* Tabs directly under header */}
        <nav className="mx-auto max-w-5xl px-2 pb-2 overflow-x-auto">
          <ul className="flex gap-1">
            {STEPS.map((s) => {
              const isActive = s.key === activeStep;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(s.key)}
                    className={[
                      "px-3 py-2 rounded-t-md text-sm",
                      isActive
                        ? "bg-slate-100 border border-b-white border-slate-200 font-medium"
                        : "text-slate-600 hover:text-slate-900"
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {renderActiveStep()}
      </main>

    </div>
  </AppErrorBoundary>
);

}

export default App;