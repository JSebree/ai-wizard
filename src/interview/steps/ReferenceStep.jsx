import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ReferenceStep
 * Q12: "For better script guidance, please enter reference text (chat-style)"
 *
 * Persists to `ui.referenceText` (or `data.referenceText`).
 * Works with either prop shape:
 *   1) { ui, setUi, next, back }
 *   2) { data, setData, goNext, goBack }
 */
export default function ReferenceStep(props) {
  const state = props.ui ?? props.data ?? {};
  const setState = props.setUi ?? props.setData ?? (() => {});
  const onNext = props.next ?? props.goNext ?? (() => {});
  const onBack = props.back ?? props.goBack ?? (() => {});

  const initial = typeof state.referenceText === "string" ? state.referenceText : "";
  const [text, setText] = useState(initial);
  const [touched, setTouched] = useState(false);
  const taRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [text]);

  // Derived helpers
  const chars = text.length;
  const minHelpful = 0; // allow empty (optional). Change to 40 if you want to encourage more context.
  const tooShort = chars < minHelpful;

  // Persist on advance
  const handleNext = () => {
    setState((prev) => ({
      ...(typeof prev === "object" ? prev : {}),
      ui: prev?.ui
        ? { ...prev.ui, referenceText: text }
        : undefined,
      referenceText: text,
    }));
    onNext();
  };

  const handleBack = () => onBack();

  // Keyboard shortcuts: Enter/Cmd+Enter to continue, Esc to go back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBack();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text]);

  const helper = useMemo(() => {
    if (tooShort) return "Optional — paste any reference script or notes to steer the output.";
    return "Looks good. Paste as much as you like — we’ll use it for guidance, not verbatim.";
  }, [tooShort]);

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Reference text (optional)</h2>
      <p style={styles.subtitle}>
        For better script guidance, paste a paragraph, outline, or bullets. You can also drop a rough
        script — we’ll adapt tone and timing.
      </p>

      <div style={styles.fieldBox}>
        <label htmlFor="referenceText" style={styles.label}>
          Add any reference text
        </label>
        <textarea
          id="referenceText"
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Paste or type guidance here…"
          rows={6}
          style={styles.textarea}
        />
        <div style={styles.metaRow}>
          <span style={{ color: "#6b7280" }}>{helper}</span>
          <span style={{ color: "#9ca3af" }}>{chars} chars</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button type="button" onClick={handleBack} style={styles.secondaryBtn}>
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          style={styles.primaryBtn}
          aria-disabled={false}
        >
          Continue
        </button>
      </div>

      <div style={styles.hintRow}>
        <kbd style={styles.kbd}>Esc</kbd> back · <kbd style={styles.kbd}>⌘/Ctrl</kbd> + <kbd style={styles.kbd}>Enter</kbd> continue
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "32px 20px",
  },
  title: {
    fontSize: 24,
    margin: "0 0 8px",
  },
  subtitle: {
    margin: "0 0 20px",
    color: "#6b7280",
  },
  fieldBox: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    minHeight: 120,
    maxHeight: 280,
    padding: 12,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 15,
    lineHeight: 1.5,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    fontSize: 12,
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  primaryBtn: {
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 15,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "transparent",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 15,
    cursor: "pointer",
  },
  hintRow: {
    marginTop: 10,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
  },
  kbd: {
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "1px 5px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
};
