

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function VoiceCard({ voice, selected, onSelect }) {
  const audioRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handlePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    setLoading(true);
    el.currentTime = 0;
    el.play().finally(() => setLoading(false));
  };

  return (
    <button
      type="button"
      className={`voice-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(voice)}
      aria-pressed={selected}
    >
      <div className="voice-card__body">
        <div className="voice-card__name">{voice.name}</div>
        <div className="voice-card__meta">
          <span className="voice-card__gender">
            {extractGenderFromVoiceName(voice.name) || '—'}
          </span>
        </div>
      </div>
      {voice.previewUrl && (
        <div className="voice-card__actions" onClick={(e) => e.stopPropagation()}>
          <audio ref={audioRef} src={voice.previewUrl} preload="none" />
          <button type="button" className="btn btn-sm" onClick={handlePlay}>
            {loading ? 'Loading…' : 'Preview'}
          </button>
        </div>
      )}
    </button>
  );
}

VoiceCard.propTypes = {
  voice: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    previewUrl: PropTypes.string,
  }).isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

export default function VoiceStep({ voices, value, onChange, onBack, onNext }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(value || null);

  useEffect(() => {
    setSelectedId(value || null);
  }, [value]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return voices || [];
    return (voices || []).filter(v => normalize(v.name).includes(q));
  }, [voices, query]);

  const selectedVoice = useMemo(
    () => (voices || []).find(v => v.id === selectedId) || null,
    [voices, selectedId]
  );

  const canNext = Boolean(selectedVoice);

  const handleSelect = (voice) => {
    setSelectedId(voice.id);
    const gender = extractGenderFromVoiceName(voice.name);
    onChange?.({ voiceId: voice.id, characterGender: gender });
  };

  const handleNext = () => {
    if (!selectedVoice) return;
    onNext?.();
  };

  return (
    <div className="step">
      <h2 className="step-title">Pick your character or narrator’s voice</h2>

      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Search voices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search voices"
        />
      </div>

      <div className="voice-grid">
        {filtered.map((v) => (
          <VoiceCard
            key={v.id}
            voice={v}
            selected={v.id === selectedId}
            onSelect={handleSelect}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty">No voices match your search.</div>
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

VoiceStep.propTypes = {
  voices: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, previewUrl: PropTypes.string })
  ),
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBack: PropTypes.func,
  onNext: PropTypes.func,
};