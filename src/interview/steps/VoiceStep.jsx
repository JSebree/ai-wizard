import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

// --- Supabase (public, read-only) — used to populate the voice list from "speakers"
const SUPABASE_URL = "https://ldgujihabgikdkoxztnk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3VqaWhhYmdpa2Rrb3h6dG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMzUwNTcsImV4cCI6MjA2NDgxMTA1N30.uifx8GrUtE4kgg3xahJtesb-OxLgsi4BNsApd1KgulE";

// --- Gender parsing helper ----------------------------------------------------
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

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [selectedId, setSelectedId] = useState(value || null);
  const [manualId, setManualId] = useState(value || '');
  const [voiceLabel, setVoiceLabel] = useState('');
  const [inferred, setInferred] = useState(null);

  const [fallbackVoices, setFallbackVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState(null);

  useEffect(() => {
    setSelectedId(value || null);
    setManualId(value || '');
  }, [value]);

  useEffect(() => {
    if (Array.isArray(voices) && voices.length > 0) return;

    const accept = (list) => {
      if (Array.isArray(list) && list.length > 0) {
        // Normalize possible shapes:
        const normalized = list.map(v => ({
          id: v.id,
          name: v.name || v.label || v.displayName || '',
          previewUrl: v.previewUrl || v.audio_url || v.preview_url || null,
        })).filter(v => v.id && v.name);
        if (normalized.length > 0) {
          setFallbackVoices(normalized);
          try { localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify(normalized)); } catch {}
          return true;
        }
      }
      return false;
    };

    const tryStaticVoices = async () => {
      try {
        const res = await fetch('/voices.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (accept(data)) return true;
        }
      } catch {}
      return false;
    };

    const tryApiVoices = async () => {
      try {
        const res = await fetch('/api/voices', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (accept(data)) return true;
        }
      } catch {}
      return false;
    };

    const trySupabaseSpeakers = async () => {
      const url = SUPABASE_URL;
      const key = SUPABASE_ANON_KEY;
      if (!url || !key) return false;
      const endpoint = `${url.replace(/\/+$/,'')}/rest/v1/speakers?select=id,name,audio_url&order=name.asc`;
      try {
        const res = await fetch(endpoint, {
          headers: {
            apikey: key,
            authorization: `Bearer ${key}`,
            accept: 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (accept(data)) return true;
        }
      } catch {}
      return false;
    };

    (async () => {
      setLoadingVoices(true);
      setVoicesError(null);

      const okFromSb = await trySupabaseSpeakers();
      if (okFromSb) { setLoadingVoices(false); return; }

      const okFromStatic = await tryStaticVoices();
      if (okFromStatic) { setLoadingVoices(false); return; }

      const okFromApi = await tryApiVoices();
      if (okFromApi) { setLoadingVoices(false); return; }

      setVoicesError('No voices available. Paste an ID or configure Supabase /api/voices.');
      setLoadingVoices(false);
    })();
  }, [voices]);

  const availableVoices = useMemo(() => {
    if (Array.isArray(voices) && voices.length > 0) return voices;
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

  const canNext = Boolean(selectedVoice);

  const handleNext = () => {
    if (!selectedVoice) return;
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
            {!Array.isArray(voices) || voices.length === 0 ? (
              <button
                type="button"
                className="btn btn-xs ml-2"
                onClick={async () => {
                  setLoadingVoices(true);
                  setVoicesError(null);
                  try {
                    const accept = (list) => {
                      if (Array.isArray(list) && list.length > 0) {
                        const normalized = list.map(v => ({
                          id: v.id,
                          name: v.name || v.label || v.displayName || '',
                          previewUrl: v.previewUrl || v.audio_url || v.preview_url || null,
                        })).filter(v => v.id && v.name);
                        if (normalized.length > 0) {
                          setFallbackVoices(normalized);
                          try { localStorage.setItem(VOICES_CACHE_KEY, JSON.stringify(normalized)); } catch {}
                          return true;
                        }
                      }
                      return false;
                    };

                    let ok = false;

                    // Supabase first
                    try {
                      const url = SUPABASE_URL;
                      const key = SUPABASE_ANON_KEY;
                      if (url && key) {
                        const endpoint = `${url.replace(/\/+$/,'')}/rest/v1/speakers?select=id,name,audio_url&order=name.asc`;
                        const resSb = await fetch(endpoint, { headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' } });
                        if (resSb.ok) ok = accept(await resSb.json());
                      }
                    } catch {}

                    // Static JSON
                    if (!ok) {
                      try {
                        const resStatic = await fetch('/voices.json', { cache: 'no-store' });
                        if (resStatic.ok) ok = accept(await resStatic.json());
                      } catch {}
                    }

                    // API proxy
                    if (!ok) {
                      try {
                        const res = await fetch('/api/voices');
                        if (res.ok) ok = accept(await res.json());
                      } catch {}
                    }

                    if (!ok) setVoicesError('Still no voices. Ensure Supabase or /public/voices.json is configured.');
                  } catch {
                    setVoicesError('Failed to load voices');
                  } finally {
                    setLoadingVoices(false);
                  }
                }}
              >
                Reload
              </button>
            ) : null}
          </>
        )}
      </div>

      <label className="label" htmlFor="voiceSelect">Voice (pick from list)</label>
      <select
        id="voiceSelect"
        className="input"
        style={{ WebkitAppearance: 'menulist', appearance: 'menulist' }}
        value={selectedId || ''}
        disabled={!availableVoices || availableVoices.length === 0}
        onChange={(e) => {
          const id = e.target.value || '';
          setSelectedId(id || null);
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
            setSelectedId(id || null);
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

VoiceStep.propTypes = {
  voices: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, previewUrl: PropTypes.string })
  ),
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBack: PropTypes.func,
  onNext: PropTypes.func,
};