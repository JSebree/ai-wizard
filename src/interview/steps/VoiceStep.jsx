// src/interview/steps/VoiceStep.jsx
import React from "react";

// Normalize a voice record from voices.json (or any shape)
function normalizeVoice(v) {
  return {
    id: v?.id || v?.name || "",
    name: v?.name || v?.label || v?.displayName || v?.tts_id || "Untitled",
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

export default function VoiceStep({ value, onChange, className = "" }) {
  const [voices, setVoices] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Selected voice id
  const [selectedId, setSelectedId] = React.useState(() => {
    // Seed from props or localStorage, default to Emma
    return (
      value?.voiceId ||
      value?.voice_id ||
      value?.voice?.id ||
      window.localStorage.getItem("wizard.voiceId") ||
      "Emma"
    );
  });

  // Track initial emission so the parent gets a valid default selection
  const hasEmittedInitial = React.useRef(false);

  const audioRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);

  // Load voices from /voices.json (no-store to avoid stale cache)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/voices.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load voices.json (${res.status})`);
        const arr = await res.json();

        // Normalize → de-dupe by id → sort by name
        const normalized = (Array.isArray(arr) ? arr : []).map(normalizeVoice);
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

        if (alive) setVoices(deduped);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load voices.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ensure we have a concrete selection once voices are loaded.
  // Prefer "Emma"; if not found, fall back to the first voice.
  React.useEffect(() => {
    if (!voices.length) return;

    // If current selectedId is missing or not in the loaded list, choose a default.
    let id = selectedId;
    const hasSelected = id && voices.some(v => v.id === id);

    if (!hasSelected) {
      const emma =
        voices.find(v => String(v.id).toLowerCase() === "emma") ||
        voices.find(v => String(v.name).toLowerCase().startsWith("emma"));
      id = emma ? emma.id : voices[0]?.id;
      if (id && id !== selectedId) {
        setSelectedId(id);
      }
    }

    // Emit once on first load (or when voices first appear)
    if (!hasEmittedInitial.current && id) {
      const voice = voices.find(v => v.id === id) || null;
      emitChange(voice);
      // Persist immediately so validation passes without further interaction
      window.localStorage.setItem("wizard.voiceId", id);
      hasEmittedInitial.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices]);

  // Keep selectedId in sync with external value changes
  React.useEffect(() => {
    if (!value) return;
    const incoming =
      value.voiceId || value.voice_id || value.voice?.id || selectedId;
    if (incoming && incoming !== selectedId) {
      setSelectedId(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.voiceId, value?.voice_id, value?.voice?.id]);

  // Emit on selectedId changes as well (covers programmatic updates)
  React.useEffect(() => {
    if (!voices.length || !selectedId) return;
    const voice = voices.find(v => v.id === selectedId) || null;
    if (voice) {
      emitChange(voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedVoice = React.useMemo(
    () => voices.find((v) => v.id === selectedId) || null,
    [voices, selectedId]
  );

  // Persist selection
  React.useEffect(() => {
    if (selectedId) {
      window.localStorage.setItem("wizard.voiceId", selectedId);
    }
  }, [selectedId]);

  // Notify parent when selection changes
  const emitChange = React.useCallback(
    (voice) => {
      if (!onChange) return;
      try {
        onChange({
          voiceId: voice?.id || "",
          voice_id: voice?.id || "",
          voice_name: voice?.name || "",
          voiceLabel: voice?.name || "",
          voice: voice?._raw || voice || null,
        });
      } catch {
        // no-op
      }
    },
    [onChange]
  );

  const handleSelect = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const voice = voices.find((v) => v.id === id) || null;
    emitChange(voice);
    // Stop any ongoing preview when switching
    stopPreview();
  };

  const playPreview = async () => {
    const url = selectedVoice?.previewUrl;
    if (!url || !audioRef.current) return;
    try {
      audioRef.current.src = url;
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Preview failed:", err);
    }
  };

  const stopPreview = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Title row */}
      <div className="mb-2 flex items-center justify-between">
        {loading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : error ? (
          <span className="text-xs text-rose-400">{error}</span>
        ) : null}
      </div>

      {/* Dropdown */}
      <div className="flex items-center gap-2">
        <select
          value={selectedId}
          onChange={handleSelect}
          className="w-full rounded-md border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">Select a voice…</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {/* Preview button */}
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
      <audio ref={audioRef} preload="none" onEnded={() => setIsPlaying(false)} />

      {/* Optional tiny helper row */}
      {!selectedVoice?.previewUrl && selectedId ? (
        <p className="mt-2 text-xs text-slate-400">
          This voice doesn’t have a preview URL.
        </p>
      ) : null}
    </div>
  );
}