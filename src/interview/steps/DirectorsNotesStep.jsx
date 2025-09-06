import React, { useMemo } from 'react';

/**
 * DirectorsNotesStep
 *
 * Collects optional director's notes and writes them to ui.directorsNotes.
 *
 * Prop compatibility:
 * - Preferred:
 *    { ui, setUi, next, back }
 * - Also supported:
 *    { data, setData, goNext, goBack }
 *    { value, onChange, onNext, onBack }
 */
export default function DirectorsNotesStep(props) {
  // read value from any of the supported shapes
  const ui = props.ui ?? props.data ?? {};
  const value =
    (ui.ui?.directorsNotes) ?? // if wrapped (ui.ui)
    ui.directorsNotes ??
    props.value ??
    '';

  const updateDirectorsNotes = (v) => {
    // Preferred shape: { ui, setUi }
    if (typeof props.setUi === 'function') {
      props.setUi((prev) => {
        const base = typeof prev === 'function' ? prev() : prev;
        const next = { ...(base || {}), directorsNotes: v };
        return next;
      });
      return;
    }
    // Alternate: { data, setData }
    if (typeof props.setData === 'function') {
      props.setData((prev) => {
        const base = typeof prev === 'function' ? prev() : prev;
        const next = { ...(base || {}), directorsNotes: v };
        return next;
      });
      return;
    }
    // Fallback: { value, onChange }
    if (typeof props.onChange === 'function') {
      props.onChange(v);
    }
  };

  const handleNext = () => {
    if (typeof props.next === 'function') return props.next();
    if (typeof props.goNext === 'function') return props.goNext();
    if (typeof props.onNext === 'function') return props.onNext();
  };

  const handleBack = () => {
    if (typeof props.back === 'function') return props.back();
    if (typeof props.goBack === 'function') return props.goBack();
    if (typeof props.onBack === 'function') return props.onBack();
  };

  const count = (value || '').length;
  const helper = useMemo(() => {
    if (count === 0) return "Optional — shot list ideas, pacing, transitions, restrictions, or anything the model should prioritize or avoid.";
    if (count < 200) return "Looking good. You can be as detailed as you like.";
    if (count < 600) return "Great detail! Keep going if you need to be specific about shots or transitions.";
    return "That's a lot of direction — totally fine. Consider trimming if anything is redundant.";
  }, [count, value]);

  return (
    <div className="step step--directors-notes" style={{ display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0 }}>Do you have any director’s notes?</h2>
        <p style={{ margin: 0, color: 'var(--muted-foreground, #666)' }}>
          {helper}
        </p>
      </header>

      <label htmlFor="directors-notes" style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontWeight: 500 }}>Director’s notes</span>
        <textarea
          id="directors-notes"
          value={value}
          onChange={(e) => updateDirectorsNotes(e.target.value)}
          placeholder="e.g., B‑roll only; prioritize cinematic variety and atmosphere: tracking shots, slow tilts, environmental motion. Avoid readable signage. Keep pacing energetic early, calmer at the end."
          rows={8}
          style={{
            width: '100%',
            resize: 'vertical',
            lineHeight: 1.45,
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid var(--input, #ddd)',
            background: 'var(--background, #fff)',
            color: 'var(--foreground, #111)',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
          <div style={{ color: 'var(--muted-foreground, #666)', fontSize: 12 }}>
            The more detail you provide, the better your results will match your intentions.
          </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted-foreground, #666)', fontSize: 12 }}>
          <span>Optional</span>
          <span>{count} characters</span>
        </div>
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleBack}
          className="btn btn-secondary"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--input, #ddd)',
            background: 'var(--muted, #f6f6f6)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="btn btn-primary"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--primary, #111)',
            background: 'var(--primary, #111)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
