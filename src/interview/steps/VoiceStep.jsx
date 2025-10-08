// src/interview/steps/VoiceStep.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * VoiceStep — controlled & prop-synchronized
 *
 * Props:
 *  - value:        currently selected voice id (string) OR a voice object (id/name...)
 *  - labelValue:   currently selected voice label/name (string, optional)
 *  - onChange:     function(nextId, nextLabel)  // also supports legacy: onChange(voiceObj)
 *  - onLabelChange:function(nextLabel)          // optional
 *  - genderPreview:string | undefined           // optional helper display
 *  - className:    string
 *
 * Behavior:
 *  - Loads voices from /voices.json (no-store) and caches in localStorage for 24h.
 *  - Keeps internal selectedId/selectedLabel fully synchronized with props.
 *  - Uses a controlled <select value={selectedId}> (no defaultValue).
 *  - If only id is provided, it backfills label from loaded voices.
 *  - Emits onChange(id, label) on user selection (and supports legacy object shape).
 *  - Provides a Preview button when a preview URL exists.
 */

const VOICES_CACHE_KEY = "voices_cache_v2"; // bump cache to invalidate any stale entries
const VOICES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// If the page returns to the foreground or regains network after this window,
// we revalidate the cache (mobile-friendly).
const VOICES_CACHE_MIN_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

function normalizeVoice(v) {
  return {
    id:
      v?.id ??
      v?.voice_id ??
      v?.tts_id ??
      v?.name ??
      "",
    name:
      v?.voice_name ??
      v?.name ??
      v?.label ??
      v?.displayName ??
      "Untitled",
    // Prefer your Supabase/DigitalOcean field
    previewUrl:
      v?.audio_url ||
      v?.preview_url ||
      v?.previewUrl ||
      v?.sample ||
      v?.demo ||
      v?.url ||
      v?.audio ||
      null,
    _raw: v,
  };
}

function readCachedVoices() {
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const list = parsed?.data;
    const ts = parsed?.ts;
    if (!Array.isArray(list) || !ts) return null;
    if (Date.now() - ts > VOICES_CACHE_TTL_MS) return null;
    // Treat caches with no previewUrl as stale so we refetch
    if (list.length && !list.some(v => v?.previewUrl)) return null;
    return list;
  } catch {
    return null;
  }
}

function writeCachedVoices(list) {
  try {
    localStorage.setItem(
      VOICES_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: Array.isArray(list) ? list : [] })
    );
  } catch {}
}

function readCachedTs() {
  try {
    const raw = localStorage.getItem(VOICES_CACHE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number(parsed?.ts || 0) || 0;
  } catch {
    return 0;
  }
}

function clearCachedVoices() {
  try {
    localStorage.removeItem(VOICES_CACHE_KEY);
  } catch {}
}

async function loadVoicesFromStatic(force = false) {
  try {
    // Add a cache-busting query param when force-refreshing (helps iOS/Safari)
    const bust = force ? `?_=${Date.now()}` : "";
    const res = await fetch(`/voices.json${bust}`, { cache: "no-store" });
    if (!res.ok) return [];
    const arr = await res.json();
    const normalized = (Array.isArray(arr) ? arr : arr?.voices || []).map(normalizeVoice);
    // de-dupe by id
    const seen = new Set();
    const deduped = [];
    for (const v of normalized) {
      if (!v.id) continue;
      if (!seen.has(v.id)) {
        seen.add(v.id);
        deduped.push(v);
      }
    }
    deduped.sort((a, b) => a.name.localeCompare(b.name));
    return deduped;
  } catch {
    return [];
  }
}

export default function VoiceStep({
  value,
  labelValue,
  onChange,
  onLabelChange,
  genderPreview,
  className = "",
}) {
  // Load/cache voices
  const [voices, setVoices] = useState(() => readCachedVoices());
  const [loading, setLoading] = useState(!Array.isArray(voices));
  const [error, setError] = useState(null);

  // Reusable loader that can optionally force-refresh the cache
  const refreshVoices = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    if (force) clearCachedVoices();
    const list = await loadVoicesFromStatic(force);
    setVoices(list);
    writeCachedVoices(list);
    setLoading(false);
  }, []);

  // Internal selection mirrors props; always strings
  const [selectedId, setSelectedId] = useState(() => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      return (
        value.id ||
        value.voice_id ||
        value.tts_id ||
        value.voiceId ||
        value.name ||
        ""
      );
    }
    // last resort: legacy cache
    try {
      return localStorage.getItem("wizard.voiceId") || "";
    } catch {
      return "";
    }
  });
  const [selectedLabel, setSelectedLabel] = useState(
    typeof labelValue === "string" ? labelValue : ""
  );

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // --- Sync FROM props whenever parent updates them (e.g., template import) ---
  useEffect(() => {
    // value can be id string or object
    let nextId = "";
    if (typeof value === "string") nextId = value;
    else if (value && typeof value === "object") {
      nextId =
        value.id ||
        value.voice_id ||
        value.tts_id ||
        value.voiceId ||
        value.name ||
        "";
    }
    if (typeof nextId === "number") nextId = String(nextId);
    if ((nextId || "") !== (selectedId || "")) {
      setSelectedId(nextId || "");
    }
  }, [value, selectedId]);

  useEffect(() => {
    if ((labelValue || "") !== (selectedLabel || "")) {
      setSelectedLabel(labelValue || "");
    }
  }, [labelValue, selectedLabel]);

  // Load voices (once), then cache
  useEffect(() => {
    let cancelled = false;
    async function ensure() {
      if (!Array.isArray(voices)) {
        await refreshVoices(false);
        if (cancelled) return;
      }
    }
    ensure();
    return () => {
      cancelled = true;
    };
  }, [refreshVoices]); // mount

  // Lightweight revalidation effect for mobile (visibility/online)
  useEffect(() => {
    function maybeRefresh() {
      const ts = readCachedTs();
      const stale = !ts || (Date.now() - ts > VOICES_CACHE_MIN_REFRESH_MS);
      const missingPreviews = Array.isArray(voices) && voices.length > 0 && !voices.some(v => v?.previewUrl);
      if (stale || missingPreviews) {
        refreshVoices(true);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", maybeRefresh);
    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", maybeRefresh);
    };
  }, [voices, refreshVoices]);

  // If we have only id, backfill label from voices
  useEffect(() => {
    if (!Array.isArray(voices)) return;
    if (!selectedId) return;
    if (selectedLabel) return;
    const hit = voices.find((v) => v.id === selectedId);
    if (hit?.name) {
      setSelectedLabel(hit.name);
      onLabelChange?.(hit.name);
    }
  }, [voices, selectedId, selectedLabel, onLabelChange]);

  // Persist selected id for legacy flows
  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem("wizard.voiceId", selectedId);
    } catch {}
  }, [selectedId]);

  // Helper: notify parent on selection changes (new id + label)
  const emitChange = useCallback(
    (id, label) => {
      // Primary contract: onChange(id, label)
      if (onChange) {
        try {
          onChange(id, label);
        } catch {
          // If the parent expects legacy object shape, fall back:
          try {
            onChange({
              voiceId: id,
              voice_id: id,
              voice_name: label,
              voiceLabel: label,
            });
          } catch {}
        }
      }
      onLabelChange?.(label);
    },
    [onChange, onLabelChange]
  );

  // If selectedId changes (from props or user), backfill label for local display only.
  // Do NOT emit onChange here to avoid feedback loops with parent state updates.
  useEffect(() => {
    if (!selectedId) return;
    const hit = Array.isArray(voices) ? voices.find((v) => v.id === selectedId) : null;
    const label = hit?.name || selectedLabel || "";
    if (label && label !== selectedLabel) {
      setSelectedLabel(label);
      onLabelChange?.(label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, voices]);

  const options = useMemo(() => (Array.isArray(voices) ? voices : []), [voices]);
  const selectedVoice = useMemo(
    () => options.find((v) => v.id === selectedId) || null,
    [options, selectedId]
  );

  // UI handlers
  function handleChange(e) {
    const id = e.target.value;
    setSelectedId(id);
    const hit = options.find((v) => v.id === id);
    const name = hit?.name || "";
    setSelectedLabel(name);
    emitChange(id, name);
    stopPreview();
  }

  async function playPreview() {
    const url = selectedVoice?.previewUrl;
    if (!url || !audioRef.current) return;
    try {
      audioRef.current.src = url;
      audioRef.current.currentTime = 0;
      // Ensure a fresh load before play (helps iOS Safari)
      audioRef.current.load();
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.warn("Preview failed:", err);
    }
  }

  function stopPreview() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Status row */}
      <div className="mb-2 h-4">
        {loading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : error ? (
          <span className="text-xs text-rose-400">{String(error)}</span>
        ) : null}
      </div>

      {/* Selector + Preview */}
      <div className="flex items-center gap-2">
        <select
          value={selectedId || ""}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">{loading ? "Loading voices…" : "Select a voice…"}</option>
          {options.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={isPlaying ? stopPreview : playPreview}
          disabled={!selectedVoice?.previewUrl}
          title={selectedVoice?.previewUrl ? "Preview voice" : "No preview"}
          className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium ${
            selectedVoice?.previewUrl
              ? isPlaying
                ? "bg-rose-600 text-white hover:bg-rose-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
              : "bg-slate-700 text-slate-400 cursor-not-allowed"
          }`}
        >
          {isPlaying ? "Stop" : "Preview"}
        </button>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="none" playsInline onEnded={() => setIsPlaying(false)} />

      {/* Hint when no preview is available */}
      {!selectedVoice?.previewUrl && selectedId ? (
        <p className="mt-2 text-xs text-slate-400">This voice doesn’t have a preview URL.</p>
      ) : null}
    </div>
  );
}