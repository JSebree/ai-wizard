

import React, { useEffect, useMemo, useState } from "react";
import StepShell from "../components/StepShell";
import { useInterview } from "../InterviewContext";

/**
 * ActionStep
 * Collects the description of on-screen action / beats.
 * Persists to ui.action
 */
export default function ActionStep() {
  const { ui, setUi, goNext, goBack, registerValidator } = useInterview();

  const [value, setValue] = useState(ui?.action ?? "");
  const [touched, setTouched] = useState(false);

  const error = useMemo(() => {
    if (!touched) return null;
    return value.trim().length === 0 ? "Please describe the scene’s action." : null;
  }, [touched, value]);

  useEffect(() => {
    // Expose validator for global "Continue" keybinds, etc.
    return registerValidator("action", () =>
      value.trim().length === 0 ? "Please describe the scene’s action." : null
    );
  }, [registerValidator, value]);

  const handleNext = () => {
    setTouched(true);
    if (value.trim().length === 0) return;
    setUi((prev) => ({ ...prev, action: value.trim() }));
    goNext();
  };

  const handleBack = () => {
    // Persist partial input when going back
    setUi((prev) => ({ ...prev, action: value.trim() }));
    goBack();
  };

  const maxChars = 1500;
  const remaining = Math.max(0, maxChars - value.length);

  return (
    <StepShell
      stepKey="action"
      title="Describe the scene’s action"
      subtitle="What happens on screen? Mention shot ideas, beats, and any key moments you want covered."
      onNext={handleNext}
      onBack={handleBack}
      canNext={value.trim().length > 0}
      error={error}
    >
      <div className="iw-field">
        <label htmlFor="action" className="iw-label">
          Action / Beats
        </label>
        <textarea
          id="action"
          className={`iw-textarea ${error ? "iw-textarea--error" : ""}`}
          rows={10}
          placeholder="e.g., Start with a drone push-in over the harbor. Cut to slow pan across rooftops. Glidecam down a narrow alley as locals pass by; hold on street musician for 3–4 seconds. Finish with sunset boats leaving the marina."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={maxChars}
        />
        <div className="iw-hint-row">
          <span className="iw-hint">You can add shot suggestions and pacing notes.</span>
          <span className="iw-count">{remaining} characters left</span>
        </div>
        {error && <p className="iw-error">{error}</p>}
      </div>
    </StepShell>
  );
}