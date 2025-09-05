

import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * SceneStep — Step 1 of 12
 * Chat-style freeform input asking: "Tell me about the scene you would like to create."
 *
 * Props
 * - value: string | undefined    // current scene text
 * - onChange: (newValue: string) => void
 * - onNext: () => void            // advance to next step (only called when valid)
 * - onBack?: () => void          // optional back handler (hidden on first step by parent)
 * - autoFocus?: boolean
 */
export default function SceneStep({ value = '', onChange, onNext, onBack, autoFocus = true }) {
  const [local, setLocal] = useState(value);

  // Keep local state in sync if parent resets value
  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  const charCount = local.trim().length;
  const isValid = charCount >= 10; // require a little substance

  const helper = useMemo(
    () => (
      <ul className="iw-helper-list">
        <li>What's the vibe? (e.g., warm, gritty, whimsical)</li>
        <li>Time & lighting (e.g., golden hour on a rainy street)</li>
        <li>Primary subject(s) (place, character, object)</li>
        <li>Any must-have visual moments</li>
      </ul>
    ),
    []
  );

  const handleNext = useCallback(() => {
    if (!isValid) return; // guard
    onChange?.(local.trim());
    onNext?.();
  }, [isValid, local, onChange, onNext]);

  const onKeyDown = useCallback(
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    },
    [handleNext]
  );

  return (
    <div className="iw-step iw-scene-step">
      <header className="iw-step-header">
        <h2 className="iw-step-title">1. Tell me about the scene you’d like to create.</h2>
        <p className="iw-step-sub">Freeform works best — pretend you’re describing it to a director.</p>
      </header>

      <div className="iw-step-body">
        <label htmlFor="scene-text" className="iw-label">Describe your scene</label>
        <textarea
          id="scene-text"
          className="iw-textarea"
          placeholder="Example: Barcelona harbor and old city at golden hour. Wide shots of the marina, aerials over tiled rooftops, and lively alleys with warm evening light."
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={onKeyDown}
          rows={8}
          autoFocus={autoFocus}
        />

        <div className="iw-row iw-justify-between iw-items-center iw-gap-2">
          <div className="iw-hint">
            {helper}
          </div>
          <div className="iw-charcount" aria-live="polite">{charCount} chars</div>
        </div>
      </div>

      <footer className="iw-step-footer">
        {onBack && (
          <button type="button" className="iw-btn iw-btn-ghost" onClick={onBack}>Back</button>
        )}
        <button
          type="button"
          className="iw-btn iw-btn-primary"
          onClick={handleNext}
          disabled={!isValid}
          title={!isValid ? 'Add a bit more detail (min ~10 characters)' : 'Continue (⌘/Ctrl + Enter)'}
        >
          Next
        </button>
      </footer>
    </div>
  );
}