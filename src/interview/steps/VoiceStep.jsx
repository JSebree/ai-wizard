import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * VoiceStep
 * ------------------------------------------------------------
 * Step 3 of the interview: pick a voice for the character/narrator.
 *
 * Props
 *  - voices: Array<{ id: string, name: string, previewUrl?: string }>
 *  - value:  string | null (selected voiceId)
 *  - onChange: (next: { voiceId: string, characterGender?: string | null }) => void
 *  - onBack: () => void
 *  - onNext: () => void
 */

// --- Gender parsing helper ----------------------------------------------------
// The product guarantees gender is embedded in the voice *name* string.
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
    if (raw.includes('non') && raw.includes('binary')) return 'nonbinary';
    if (raw.startsWith('fem') || raw === 'femme') return 'female';
    if (raw.startsWith('masc') || raw === 'male') return 'male';
  }
  for (const { re, out } of GENDER_TOKENS) {
    if (re.test(name)) return out;
  }
  return null;
}

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [selectedId, setSelectedId] = useState(value || '');
  const [manualId, setManualId] = useState('');

  // keep state in sync if parent updates value (e.g., resume)
  useEffect(() => {
    setSelectedId(value || '');
  }, [value]);

  const list = useMemo(() => Array.isArray(voices) ? voices : [], [voices]);
  const selectedVoice = useMemo(
    () => list.find(v => v.id === (manualId || selectedId)) || null,
    [list, selectedId, manualId]
  );

  const effectiveId = manualId || selectedId;
  const canNext = Boolean(effectiveId);

  const commitChange = (id) => {
    const v = list.find(vv => vv.id === id) || null;
    const gender = v ? extractGenderFromVoiceName(v.name) : null;
    onChange?.({ voiceId: id || '', characterGender: gender });
  };

  return (
    <div className="step">
      <h2 className="step-title">Pick your character or narrator’s voice</h2>

      <label className="label" htmlFor="voiceSelect">Voice (select from your voices)</label>
      <select
        id="voiceSelect"
        className="input"
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          setSelectedId(id);
          setManualId(''); // selecting from list clears manual override
          commitChange(id);
        }}
        aria-label="Select a voice from list"
      >
        <option value="" disabled>{list.length ? 'Choose a voice…' : 'No voices available'}</option>
        {list.map(v => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <div className="hint" style={{ marginTop: 8 }}>Or paste a specific voice ID (overrides the selection):</div>
      <input
        className="input"
        placeholder="e.g., fe3b2cea-969a-4b5d-bc90-fde8578f1dd5"
        value={manualId}
        onChange={(e) => {
          const id = e.target.value.trim();
          setManualId(id);
          commitChange(id);
        }}
      />

      {selectedVoice?.previewUrl && (
        <div className="voice-preview" style={{ marginTop: 10 }}>
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canNext}
        >
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