import React, { useMemo, useState, useEffect, useCallback } from "react";

/**
 * MusicStep
 * Q8. Do you want background music? (Yes/No)
 *  - If yes, collect a short freeform description.
 *
 * Persists to:
 *   ui.wantsMusic   -> boolean
 *   ui.musicDesc    -> string (optional; cleared when wantsMusic === false)
 *
 * Prop flexibility:
 *   Preferred: { ui, setUi, next, back }
 *   Also works with:
 *     - { data, setData, goNext, goBack }
 *     - { value, onChange, onNext, onBack }
 */
function useBridgedProps(props) {
  return useMemo(() => {
    const ui =
      props.ui ??
      props.data ??
      props.value ??
      {};

    const setUi =
      props.setUi ??
      props.setData ??
      props.onChange ??
      (() => {});

    const next =
      props.next ??
      props.goNext ??
      props.onNext ??
      (() => {});

    const back =
      props.back ??
      props.goBack ??
      props.onBack ??
      (() => {});

    return { ui, setUi, next, back };
  }, [props]);
}

export default function MusicStep(props) {
  const { ui, setUi, next, back } = useBridgedProps(props);

  // derive initial state from incoming ui
  const initialWants = typeof ui?.wantsMusic === "boolean" ? ui.wantsMusic : false;
  const initialDesc = typeof ui?.musicDesc === "string" ? ui.musicDesc : "";
  const [wantsMusic, setWantsMusic] = useState(initialWants);
  const [musicDesc, setMusicDesc] = useState(initialDesc);
  const [touched, setTouched] = useState(false);

  // NEW: include vocals (only relevant when wantsMusic === true)
  const initialVocals = typeof ui?.musicVocals === "boolean" ? ui.musicVocals : false;
  const [musicVocals, setMusicVocals] = useState(initialVocals);

  // keep parent state in sync as user changes local state
  useEffect(() => {
    setUi(prev => {
      const base = { ...(prev || {}) };
      base.wantsMusic = wantsMusic;
      // Clear desc if user selects "No"
      base.musicDesc = wantsMusic ? musicDesc : "";
      // Only persist vocals toggle when music is enabled
      base.musicVocals = wantsMusic ? Boolean(musicVocals) : null;
      return base;
    });
  }, [wantsMusic, musicDesc, musicVocals, setUi]);

  const onSelect = useCallback((val) => {
    setTouched(true);
    setWantsMusic(val);
    if (!val) {
      // Reset vocals when music disabled
      setMusicVocals(false);
    }
  }, []);

  const onNext = useCallback(() => {
    // description is optional; but trim super-long whitespace
    if (wantsMusic && typeof musicDesc === "string") {
      setUi(prev => ({ ...(prev || {}), musicDesc: musicDesc.trim() }));
    }
    next();
  }, [wantsMusic, musicDesc, setUi, next]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onNext();
    }
  };

  const descDisabled = !wantsMusic;
  const chars = (musicDesc || "").length;

  return (
    <div className="step music-step" onKeyDown={onKeyDown}>
      <header className="step-header">
        <h2 className="step-title">Do you want background music?</h2>
        <p className="step-subtitle">Select yes/no. If yes, optionally describe the vibe.</p>
      </header>

      <div className="field-group">
        <fieldset className="radio-group" aria-label="Background music">
          <label className="radio-option">
            <input
              type="radio"
              name="wantsMusic"
              value="yes"
              checked={wantsMusic === true}
              onChange={() => onSelect(true)}
            />
            <span>Yes, add background music</span>
          </label>

          <label className="radio-option">
            <input
              type="radio"
              name="wantsMusic"
              value="no"
              checked={wantsMusic === false}
              onChange={() => onSelect(false)}
            />
            <span>No music</span>
          </label>
        </fieldset>
      </div>

      <div className="field-group">
        <label htmlFor="musicDesc" className="field-label">
          If yes, describe the music you want <span className="muted">(optional)</span>
        </label>
        <textarea
          id="musicDesc"
          className="textarea"
          placeholder="e.g., Warm Mediterranean acoustic with subtle strings and light percussion; low-key, cinematic, supportive of narration."
          value={musicDesc}
          onChange={(e) => setMusicDesc(e.target.value)}
          disabled={descDisabled}
          rows={4}
        />
        <div className="field-hint">
          {descDisabled ? (
            <span className="muted">Enable music to add a description.</span>
          ) : (
            <span className="muted">{chars} characters</span>
          )}
        </div>
        <div style={{ color: "#667085", fontSize: "0.85rem", marginTop: "4px" }}>
          The more detail you provide, the better your results will match your intentions.
        </div>
      </div>

      {wantsMusic && (
        <div className="field-group">
          <fieldset className="radio-group" aria-label="Include vocals">
            <legend className="field-label">Include vocals?</legend>
            <label className="radio-option">
              <input
                type="radio"
                name="musicVocals"
                value="yes"
                checked={musicVocals === true}
                onChange={() => setMusicVocals(true)}
              />
              <span>Yes, allow vocals in the music</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="musicVocals"
                value="no"
                checked={musicVocals === false}
                onChange={() => setMusicVocals(false)}
              />
              <span>No vocals (instrumental only)</span>
            </label>
          </fieldset>
          <div className="field-hint">
            <span className="muted">Vocals can add energy; instrumental beds keep narration clear.</span>
          </div>
        </div>
      )}

      <footer className="step-actions">
        <button type="button" className="btn secondary" onClick={back}>
          Back
        </button>
        <button type="button" className="btn primary" onClick={onNext}>
          Continue
        </button>
      </footer>

      <style jsx>{`
        .step-header { margin-bottom: 1rem; }
        .step-title { margin: 0 0 0.25rem 0; font-size: 1.25rem; }
        .step-subtitle { margin: 0; color: var(--text-muted); }
        .field-group { margin: 1rem 0; }
        .radio-group { display: grid; gap: 0.5rem; }
        .radio-option { display: flex; gap: 0.5rem; align-items: center; }
        .field-label { display: block; margin-bottom: 0.25rem; }
        .textarea { width: 100%; resize: vertical; }
        .field-hint { margin-top: 0.25rem; color: var(--text-muted); }
        .muted { color: var(--text-muted); }
        .step-actions { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 1.25rem; }
        .btn { padding: 0.5rem 0.75rem; }
        .btn.primary { background: var(--btn-primary-bg); color: var(--btn-primary-fg); }
        .btn.secondary { background: var(--btn-secondary-bg); color: var(--btn-secondary-fg); }
      `}</style>
    </div>
  );
}