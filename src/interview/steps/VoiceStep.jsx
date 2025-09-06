import React, { useEffect, useMemo, useRef, useState } from 'react';

// VoiceStep — loads voices from /public/voices.json and renders a polished dropdown
// with search, optional manual ID fallback, and a working audio preview.
// No external libs.

const VOICES_CACHE_KEY = 'voices_cache_v1';
const VOICE_SRC_URL = '/voices.json'; // served from public/voices.json

// --- helpers ---------------------------------------------------------------
const normalize = (s) => (s || '').toLowerCase();
const GENDER_TOKENS = [
  { re: /\bnon[-\s]?binary\b|\bnb\b|\benby\b/gi, out: 'nonbinary' },
  { re: /\bfem(ale)?\b|\bfemme\b/gi, out: 'female' },
  { re: /\bmasc(uline)?\b|\bmale\b/gi, out: 'male' },
];

function extractGenderFromVoiceName(name) {
  if (!name) return null;
  const bracketMatch = name.match(/[\[(|\-·–—]\s*(male|female|non\s*binary|nonbinary|masc(?:uline)?|fem(?:ale)?|femme)\s*[\])|\-·–—]?/i);
  if (bracketMatch && bracketMatch[1]) {
    const raw = normalize(bracketMatch[1]).replace(/\s+/g, '');
    if (raw.startsWith('non') && raw.includes('binary')) return 'nonbinary';
    if (raw.startsWith('fem') || raw === 'femme') return 'female';
    if (raw.startsWith('masc') || raw === 'male') return 'male';
  }
  for (const { re, out } of GENDER_TOKENS) {
    if (re.test(name)) return out;
  }
  return null;
}

function normalizeVoice(v) {
  return {
    id: v?.id || v?.tts_id || v?.name || '',
    name: v?.name || v?.label || v?.displayName || v?.tts_id || 'Untitled',
    // accept several common preview keys
    previewUrl:
      v?.previewUrl ||
      v?.audio_url ||
      v?.preview_url ||
      v?.preview ||
      v?.sample ||
      v?.demo ||
      v?.url ||
      v?.audio ||
      null,
  };
}

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [selectedId, setSelectedId] = useState(value || '');
  const [manualId, setManualId] = useState(value || '');
  const [inferred, setInferred] = useState(null);

  const [fallbackVoices, setFallbackVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState(null);

  const [query, setQuery] = useState('');
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSelectedId(value || '');
    setManualId(value || '');
  }, [value]);

  // Load voices from cache, then fetch /voices.json, then cache
  useEffect(() => {
    let cancelled = false;

    const safeGetCache = () => {
      try { return localStorage.getItem(VOICES_CACHE_KEY); } catch { return null; }
    };
    const safeSetCache = (list) => {
      try { localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify(list)); } catch {}
    };

    const accept = (list) => {
      if (Array.isArray(list) && list.length > 0) {
        const normalized = list.map(normalizeVoice).filter(v => v.id && v.name);
        if (normalized.length > 0) {
          setFallbackVoices(normalized);
          safeSetCache(normalized);
          return true;
        }
      }
      return false;
    };

    const load = async () => {
      try {
        setVoicesError(null);
        setLoadingVoices(true);

        // 1) cached
        const cached = safeGetCache();
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (!cancelled) accept(parsed);
          } catch {}
        }
        // 2) fetch fresh
        const res = await fetch(VOICE_SRC_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Failed to fetch voices.json (${res.status})`);
        const data = await res.json();
        if (!cancelled) accept(data);
      } catch (e) {
        if (!cancelled) setVoicesError(e?.message || 'Failed to load voices.');
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    };

    // If parent passed voices, prefer those; else load
    if (!Array.isArray(voices) || voices.length === 0) load();
    else setFallbackVoices([]);

    return () => { cancelled = true; };
  }, [voices]);

  const availableVoices = useMemo(() => {
    if (Array.isArray(voices) && voices.length > 0) return voices.map(normalizeVoice);
    return fallbackVoices;
  }, [voices, fallbackVoices]);

  const filteredVoices = useMemo(() => {
    const q = normalize(query);
    if (!q) return availableVoices;
    return (availableVoices || []).filter(v => normalize(v.name).includes(q));
  }, [availableVoices, query]);

  const selectedVoice = useMemo(
    () => (availableVoices || []).find(v => v.id === selectedId) || null,
    [availableVoices, selectedId]
  );

  // Update inferred gender when selection changes
  useEffect(() => {
    if (selectedVoice) {
      setInferred(extractGenderFromVoiceName(selectedVoice.name));
      // reset preview state
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        try { audioRef.current.currentTime = 0; } catch {}
        setIsPlaying(false);
      }
    }
  }, [selectedVoice]);

  const canNext = Boolean(selectedId || manualId);

  const handleNext = () => {
    const id = selectedId || manualId || '';
    if (!id) return;
    onNext?.();
  };

  const applySelection = (id) => {
    setSelectedId(id);
    setManualId(id);
    const v = (availableVoices || []).find(vv => vv.id === id) || null;
    if (v) {
      const gender = extractGenderFromVoiceName(v.name);
      setInferred(gender);
      onChange?.({ voiceId: v.id, characterGender: gender, voiceLabel: v.name });
    } else {
      onChange?.({ voiceId: id || null, characterGender: null });
    }
  };

  return (
    <div className="step">
      <h2 className="step-title">Pick your character or narrator’s voice.</h2>

      <div className="muted mb-2">
        {loadingVoices ? 'Loading voices…' : (
          <>
            Voices available: {Array.isArray(availableVoices) ? availableVoices.length : 0}
            {voicesError ? <span className="text-error"> – {voicesError}</span> : null}
            {(!availableVoices || availableVoices.length === 0) && (
              <button
                type="button"
                className="btn btn-xs ml-2"
                onClick={() => {
                  try { localStorage.removeItem(VOICES_CACHE_KEY); } catch {}
                  window.location.reload();
                }}
              >Reload</button>
            )}
          </>
        )}
      </div>

      {/* Search + Select */}
      <label htmlFor="voiceSelect" className="block text-sm font-medium mb-1">
        Pick your character or narrator’s voice.
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          className="input flex-1"
          placeholder="Search voices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search voices"
        />
        <select
          id="voiceSelect"
          className="input w-full sm:w-1/2 rounded-md border border-slate-300 bg-white"
          style={{ WebkitAppearance: 'menulist', appearance: 'menulist' }}
          value={selectedId}
          disabled={!filteredVoices || filteredVoices.length === 0}
          onChange={(e) => applySelection(e.target.value)}
          aria-label="Select a voice from list"
        >
          <option value="" disabled>
            {filteredVoices && filteredVoices.length ? `Choose a voice… (${filteredVoices.length})` : 'No voices match filter'}
          </option>
          {(filteredVoices || []).map(v => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm muted">
          Can’t find the voice in the list? Paste a specific ID
        </summary>
        <input
          type="text"
          className="input mt-2"
          placeholder="e.g., fe3b2cea-969a-4b5d-bc90-fde8578f1dd5"
          value={manualId}
          onChange={(e) => applySelection(e.target.value)}
          aria-label="Paste a specific voice ID"
        />
      </details>

      {inferred ? (
        <div className="muted mt-2">Inference preview: {inferred}</div>
      ) : null}

      {/* Preview Controls */}
      <div className="voice-preview mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {selectedVoice?.previewUrl ? (
          <>
            <audio
              ref={audioRef}
              src={selectedVoice.previewUrl ? `${selectedVoice.previewUrl}${selectedVoice.previewUrl.includes('?') ? '&' : '?'}t=${Date.now()}` : ''}
              preload="metadata"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const el = audioRef.current;
                if (!el) return;
                if (isPlaying) el.pause();
                else {
                  try { el.currentTime = 0; } catch {}
                  el.play();
                }
              }}
            >
              {isPlaying ? 'Pause preview' : 'Preview'}
            </button>
            <span className="muted text-xs">Preview: {selectedVoice.name}</span>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-sm" disabled>Preview</button>
            <span className="muted text-xs">No preview available</span>
          </>
        )}
      </div>

      <div className="nav-row">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={handleNext} disabled={!canNext}>
          Next
        </button>
      </div>
    </div>
  );
}