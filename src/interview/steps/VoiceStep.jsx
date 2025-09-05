import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * VoiceStep
 * ------------------------------------------------------------
 * Step 3 of the interview: pick a voice for the character/narrator.
 *
 * Props
 *  - voices: Array<{ id: string, name: string, previewUrl?: string }>
 *  - value:  string | null (selected voiceId, label optional via onChange payload)
 *  - onChange: (next: { voiceId: string, characterGender?: string | null, voiceLabel?: string }) => void
 *  - onBack: () => void
 *  - onNext: () => void
 */

// --- Gender parsing helper ----------------------------------------------------
// The product guarantees gender is embedded in the voice *name* string.
// We parse it robustly without relying on first-letter heuristics.
// Example names we expect to work:
//   "Sophia [Female] — Warm conversational"
//   "Marcus [Male]"
//   "Avery [Nonbinary]"
//   "Jamie (female)"
//   "Kai - male"
//   "Noa · non-binary"
//   "Maya | FEMALE"
//   "Sam – masc" (maps to male)
//   "Riley – fem" (maps to female)
const normalize = (s) => (s || '').toLowerCase();
const GENDER_TOKENS = [
  { re: /\bnon[-\s]?binary\b|\bnb\b|\benby\b/gi, out: 'nonbinary' },
  { re: /\bfem(ale)?\b|\bfemme\b/gi, out: 'female' },
  { re: /\bmasc(uline)?\b|\bmale\b/gi, out: 'male' },
];

function extractGenderFromVoiceName(name) {
  if (!name) return null;
  // Try bracket/paren/pipe notations first
  const bracketMatch = name.match(/[\[(|\-·–—]\s*(male|female|non\s*binary|nonbinary|masc(?:uline)?|fem(?:ale)?|femme)\s*[\])|\-·–—]?/i);
  if (bracketMatch && bracketMatch[1]) {
    const raw = normalize(bracketMatch[1]).replace(/\s+/g, '');
    if (raw.startsWith('nonbinary') || raw === 'nonbinary' || raw === 'nonbinary') return 'nonbinary';
    if (raw.startsWith('non') && raw.includes('binary')) return 'nonbinary';
    if (raw.startsWith('fem')) return 'female';
    if (raw === 'femme') return 'female';
    if (raw.startsWith('masc') || raw === 'male') return 'male';
  }
  // Token scan fallback
  for (const { re, out } of GENDER_TOKENS) {
    if (re.test(name)) return out;
  }
  return null; // allow UI to proceed; downstream can validate
}

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [selectedId, setSelectedId] = useState(value || null);
  const [manualId, setManualId] = useState(value || '');
  const [voiceLabel, setVoiceLabel] = useState('');
  const [inferred, setInferred] = useState(null);

  useEffect(() => {
    setSelectedId(value || null);
    setManualId(value || '');
  }, [value]);

  const filtered = useMemo(() => voices || [], [voices]);

  const selectedVoice = useMemo(
    () => (voices || []).find(v => v.id === selectedId) || null,
    [voices, selectedId]
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

      <label className="label" htmlFor="voiceSelect">Voice (select or paste ID)</label>
      <select
        id="voiceSelect"
        className="input"
        value={selectedId || ''}
        onChange={(e) => {
          const id = e.target.value || '';
          setSelectedId(id || null);
          setManualId(id);
          const v = (voices || []).find(vv => vv.id === id) || null;
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
        <option value="" disabled>{voices && voices.length ? 'Choose a voice…' : 'No voices available'}</option>
        {(voices || []).map(v => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        className="input mt-2"
        placeholder="e.g., Ava (female) — fe3b2cea-969a-4b5d-bc90-fde8578f1dd5"
        value={manualId}
        onChange={(e) => {
          const id = e.target.value;
          setManualId(id);
          setSelectedId(id || null);
          // if it matches a known voice, adopt its label and gender
          const v = (voices || []).find(vv => vv.id === id) || null;
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