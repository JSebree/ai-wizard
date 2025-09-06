import React, { useEffect, useMemo, useState } from 'react';

// VoiceStep — loads voices from /public/voices.json and renders a dropdown.
// No external libs (removed PropTypes). Keeps a hidden manual ID input (collapsed).

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
    previewUrl: v?.previewUrl || v?.audio_url || v?.preview_url || null,
  };
}

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [selectedId, setSelectedId] = useState(value || '');
  const [manualId, setManualId] = useState(value || '');
  const [voiceLabel, setVoiceLabel] = useState('');
  const [inferred, setInferred] = useState(null);

  const [fallbackVoices, setFallbackVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState(null);

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

  const selectedVoice = useMemo(
    () => (availableVoices || []).find(v => v.id === selectedId) || null,
    [availableVoices, selectedId]
  );

  useEffect(() => {
    if (selectedVoice) {
      setVoiceLabel(selectedVoice.name || '');
      setInferred(extractGenderFromVoiceName(selectedVoice.name));
    }
  }, [selectedVoice]);

  const canNext = Boolean(selectedVoice || manualId);

  const handleNext = () => {
    const id = selectedId || manualId || '';
    if (!id) return;
    onNext?.();
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
                  // force reload bypassing cache
                  try { localStorage.removeItem(VOICES_CACHE_KEY); } catch {}
                  window.location.reload();
                }}
              >Reload</button>
            )}
          </>
        )}
      </div>

      <label className="label" htmlFor="voiceSelect">Voice (pick from list)</label>
      <select
        id="voiceSelect"
        className="input"
        style={{ WebkitAppearance: 'menulist', appearance: 'menulist' }}
        value={selectedId}
        disabled={!availableVoices || availableVoices.length === 0}
        onChange={(e) => {
          const id = e.target.value;
          setSelectedId(id);
          setManualId(id);
          const v = (availableVoices || []).find(vv => vv.id === id) || null;
          if (v) {
            const gender = extractGenderFromVoiceName(v.name);
            setVoiceLabel(v.name || '');
            setInferred(gender);
            onChange?.({ voiceId: v.id, characterGender: gender, voiceLabel: v.name });
          } else {
            onChange?.({ voiceId: id || null, characterGender: null });
          }
        }}
        aria-label="Select a voice from list"
      >
        <option value="" disabled={Boolean(availableVoices && availableVoices.length)}>
          {availableVoices && availableVoices.length ? 'Choose a voice…' : 'No voices loaded — click Reload above'}
        </option>
        {(availableVoices || []).map(v => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      {/* Hidden manual ID field (collapsed) */}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm muted">Can’t find your voice in the list? Paste an ID</summary>
        <input
          type="text"
          className="input mt-2"
          placeholder="e.g., fe3b2cea-969a-4b5d-bc90-fde8578f1dd5"
          value={manualId}
          onChange={(e) => {
            const id = e.target.value;
            setManualId(id);
            setSelectedId(id);
            const v = (availableVoices || []).find(vv => vv.id === id) || null;
            if (v) {
              const gender = extractGenderFromVoiceName(v.name);
              setVoiceLabel(v.name || '');
              setInferred(gender);
              onChange?.({ voiceId: v.id, characterGender: gender, voiceLabel: v.name });
            } else {
              onChange?.({ voiceId: id || null, characterGender: extractGenderFromVoiceName(voiceLabel) });
            }
          }}
          aria-label="Paste a specific voice ID"
        />
      </details>

      <label className="label mt-3" htmlFor="voiceLabel">Voice label (optional, used for gender inference)</label>
      <input
        id="voiceLabel"
        type="text"
        className="input"
        placeholder="e.g., Ava (female)"
        value={voiceLabel}
        onChange={(e) => {
          const lbl = e.target.value;
          setVoiceLabel(lbl);
          const g = extractGenderFromVoiceName(lbl);
          setInferred(g);
          onChange?.({ voiceId: selectedId || manualId || null, characterGender: g, voiceLabel: lbl });
        }}
      />

      <div className="muted mt-1">Inference preview: {inferred ?? '—'}</div>

      {selectedVoice?.previewUrl && (
        <div className="voice-preview">
          <audio id="voicePreviewAudio" src={selectedVoice.previewUrl} preload="none" />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const el = document.getElementById('voicePreviewAudio');
              if (el) {
                el.currentTime = 0;
                el.play();
              }
            }}
          >
            Preview
          </button>
        </div>
      )}

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