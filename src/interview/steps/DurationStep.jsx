// src/interview/steps/DurationStep.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * DurationStep
 * - Persists to ui.durationSec (or data.durationSec fallback)
 * - Up/down steppers in seconds
 * - Quick presets (15/30/45/60/90)
 * - Min/Max validation and inline help
 * - Keyboard: ←/→ = -/+1s, Shift+←/→ = -/+5s, Enter = Continue, Esc = Back
 */
export default function DurationStep({
  value,
  onChange,
  onNext,
  onBack,
  minSec = 5,
  maxSec = 300,
  presets = [15, 30, 45, 60, 90],
  title = 'How long do you want your scene to be?',
  help = 'Use the arrows or presets. You can fine-tune by seconds.',
}) {
  // Normalize inbound value from either { ui } or flat shape
  const initial = useMemo(() => {
    const v =
      (value?.ui?.durationSec ?? value?.durationSec ?? 45);
    return clampSec(Number.isFinite(+v) ? +v : 45, minSec, maxSec);
  }, [value, minSec, maxSec]);

  const [sec, setSec] = useState(initial);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Autofocus on mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Keep local state in bounds if min/max change dynamically
    setSec(s => clampSec(s, minSec, maxSec));
  }, [minSec, maxSec]);

  const mmss = toMMSS(sec);
  const invalid = sec < minSec || sec > maxSec;

  function commit(next) {
    const clamped = clampSec(next, minSec, maxSec);
    setSec(clamped);
    // Emit in both shapes for compatibility
    onChange?.({
      ...value,
      durationSec: clamped,
      ui: {
        ...(value?.ui || {}),
        durationSec: clamped,
      },
    });
  }

  function changeBy(delta) {
    setTouched(true);
    commit(sec + delta);
  }

  function handleDirectInput(e) {
    setTouched(true);
    const raw = e.target.value.replace(/[^\d]/g, '');
    // Interpret plain digits as seconds
    commit(raw === '' ? minSec : Number(raw));
  }

  function handleWheel(e) {
    if (!inputRef.current) return;
    if (document.activeElement !== inputRef.current) return;
    e.preventDefault();
    changeBy(e.deltaY > 0 ? -1 : +1);
  }

  function handleKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onBack?.();
      return;
    }
    if (e.key === 'Enter' || (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      if (!invalid) onNext?.();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      changeBy(e.key === 'ArrowLeft' ? -step : +step);
    }
  }

  const hint = invalid
    ? `Please pick between ${formatSec(minSec)} and ${formatSec(maxSec)}.`
    : `Selected: ${formatSec(sec)}${touched ? '' : ' (default)'}`;

  return (
    <div className="step step-duration" onKeyDown={handleKey}>
      <h2 className="step-title">{title}</h2>
      <p className="step-help">{help}</p>

      <div className="duration-card" onWheel={handleWheel}>
        <div className="duration-control" role="group" aria-label="Duration selector">
          <button
            className="btn steppers"
            type="button"
            onClick={() => changeBy(-5)}
            aria-label="Decrease five seconds"
          >
            −5s
          </button>
          <button
            className="btn steppers"
            type="button"
            onClick={() => changeBy(-1)}
            aria-label="Decrease one second"
          >
            −1s
          </button>

          <div className={`numeric ${invalid ? 'invalid' : ''}`}>
            <label className="numeric-label" htmlFor="durationSec">
              Seconds
            </label>
            <input
              id="durationSec"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="numeric-input"
              value={String(sec)}
              onChange={handleDirectInput}
              aria-invalid={invalid || undefined}
              aria-describedby="duration-hint"
            />
            <div className="mmss">{mmss}</div>
          </div>

          <button
            className="btn steppers"
            type="button"
            onClick={() => changeBy(+1)}
            aria-label="Increase one second"
          >
            +1s
          </button>
          <button
            className="btn steppers"
            type="button"
            onClick={() => changeBy(+5)}
            aria-label="Increase five seconds"
          >
            +5s
          </button>
        </div>

        {Array.isArray(presets) && presets.length > 0 && (
          <div className="preset-row" aria-label="Quick presets">
            {presets.map(p => (
              <button
                key={p}
                type="button"
                className={`chip ${sec === p ? 'active' : ''}`}
                onClick={() => commit(p)}
                aria-pressed={sec === p}
              >
                {formatSec(p)}
              </button>
            ))}
          </div>
        )}

        <p id="duration-hint" className={`hint ${invalid ? 'error' : ''}`}>
          {hint}
        </p>
      </div>

      <div className="step-actions">
        <button className="btn ghost" type="button" onClick={onBack}>
          Back
        </button>
        <button
          className="btn primary"
          type="button"
          onClick={() => onNext?.()}
          disabled={invalid}
        >
          Continue
        </button>
      </div>

      {/* Inline styles for quick drop-in; move to CSS module or Tailwind as desired */}
      <style jsx>{`
        .step-title { font-size: 1.25rem; margin: 0 0 0.25rem; }
        .step-help { color: #6b7280; margin: 0 0 1rem; }
        .duration-card {
          background: #0f172a;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 16px;
        }
        .duration-control {
          display: grid;
          grid-template-columns: auto auto 1fr auto auto;
          gap: 8px;
          align-items: center;
        }
        .btn {
          border: 1px solid #374151;
          background: #111827;
          color: #e5e7eb;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .btn:hover { background: #0b1220; }
        .btn.primary {
          background: #2563eb;
          border-color: #1552d0;
        }
        .btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.ghost {
          background: transparent;
          border-color: #334155;
        }
        .steppers { min-width: 64px; }
        .numeric {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          background: #0b1020;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 10px 12px;
        }
        .numeric.invalid { border-color: #ef4444; }
        .numeric-label {
          position: absolute;
          left: -9999px;
        }
        .numeric-input {
          background: transparent;
          border: none;
          color: #f3f4f6;
          font-size: 1.25rem;
          outline: none;
          width: 100%;
        }
        .mmss {
          font-variant-numeric: tabular-nums;
          color: #94a3b8;
          font-size: 0.95rem;
          padding-left: 8px;
          border-left: 1px solid #334155;
        }
        .preset-row {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          border: 1px solid #334155;
          background: #0b1220;
          color: #cbd5e1;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 0.9rem;
        }
        .chip.active {
          background: #1e293b;
          border-color: #475569;
          color: #e5e7eb;
        }
        .hint {
          margin-top: 10px;
          color: #93c5fd;
          font-size: 0.9rem;
        }
        .hint.error { color: #fca5a5; }
        .step-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 16px;
        }
        @media (max-width: 640px) {
          .duration-control {
            grid-template-columns: auto 1fr auto;
            grid-auto-rows: auto;
          }
          .steppers:nth-child(1),
          .steppers:nth-child(2),
          .steppers:nth-child(4),
          .steppers:nth-child(5) {
            min-width: 56px;
          }
        }
      `}</style>
    </div>
  );
}

// ————— helpers —————

function clampSec(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function toMMSS(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function formatSec(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}
