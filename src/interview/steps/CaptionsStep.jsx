

import React, { useMemo, useState, useEffect, useCallback } from 'react';

/**
 * CaptionsStep
 *
 * - Prompts: "Do you want captions?"
 * - Radio Yes/No -> updates ui.wantsCaptions (boolean)
 * - Keyboard: Enter/⌘+Enter/Ctrl+Enter to continue, Esc to go back
 * - Works with flexible prop names:
 *    { ui, setUi, next, back }  OR  { data, setData, goNext, goBack }
 * - Minimal inline styles, no external dependencies.
 */
export default function CaptionsStep(props) {
  const {
    ui,
    setUi,
    next,
    back,
    // flexible aliases
    data,
    setData,
    goNext,
    goBack,
    className,
    style,
  } = props;

  // Resolve state bag and setter (ui or data)
  const state = useMemo(() => ui ?? data ?? {}, [ui, data]);
  const setState = useMemo(() => setUi ?? setData ?? (() => {}), [setUi, setData]);

  // Local controlled value with sensible default = false
  const initial = typeof state.wantsCaptions === 'boolean' ? state.wantsCaptions : false;
  const [wantsCaptions, setWantsCaptions] = useState(initial);

  // Keep local state in sync if parent updates
  useEffect(() => {
    if (typeof state.wantsCaptions === 'boolean' && state.wantsCaptions !== wantsCaptions) {
      setWantsCaptions(state.wantsCaptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.wantsCaptions]);

  // Commit changes up to parent
  const commit = useCallback(
    (nextVal) => {
      setWantsCaptions(nextVal);
      setState((prev) => {
        const base = typeof prev === 'object' && prev ? prev : {};
        return { ...base, wantsCaptions: nextVal };
      });
    },
    [setState]
  );

  const onNext = useCallback(() => {
    // ensure parent has latest
    setState((prev) => {
      const base = typeof prev === 'object' && prev ? prev : {};
      return { ...base, wantsCaptions };
    });
    (next ?? goNext ?? (() => {}))();
  }, [wantsCaptions, setState, next, goNext]);

  const onBack = useCallback(() => {
    (back ?? goBack ?? (() => {}))();
  }, [back, goBack]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      } else if (e.key === 'Enter') {
        // allow Cmd/Ctrl+Enter OR plain Enter (optional)
        if (e.metaKey || e.ctrlKey || !e.shiftKey) {
          e.preventDefault();
          onNext();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack]);

  return (
    <div className={`step step-captions ${className ?? ''}`} style={style}>
      <div style={styles.header}>
        <h2 style={styles.title}>Do you want captions?</h2>
        <p style={styles.hint}>
          Captions can improve accessibility and make your video easier to follow on mute.
        </p>
      </div>

      <div style={styles.group}>
        <label style={styles.radioRow}>
          <input
            type="radio"
            name="wantsCaptions"
            value="yes"
            checked={wantsCaptions === true}
            onChange={() => commit(true)}
          />
          <span style={styles.radioLabel}>Yes, include captions</span>
        </label>

        <label style={styles.radioRow}>
          <input
            type="radio"
            name="wantsCaptions"
            value="no"
            checked={wantsCaptions === false}
            onChange={() => commit(false)}
          />
          <span style={styles.radioLabel}>No, skip captions</span>
        </label>
      </div>

      <div style={styles.nav}>
        <button type="button" onClick={onBack} style={styles.secondaryBtn}>
          Back
        </button>
        <button type="button" onClick={onNext} style={styles.primaryBtn}>
          Continue
        </button>
      </div>
    </div>
  );
}

const styles = {
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 1.2,
    margin: 0,
  },
  hint: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 12,
    marginBottom: 24,
  },
  radioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    cursor: 'pointer',
    userSelect: 'none',
  },
  radioLabel: {
    fontSize: 14,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: '#111827',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: 'white',
    color: '#111827',
    fontWeight: 500,
    cursor: 'pointer',
  },
};