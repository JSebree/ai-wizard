

import React, { useEffect, useMemo, useState } from "react";
import { useInterview } from "../InterviewContext";

/**
 * CharacterStep
 *
 * Q2 (branch for character-driven):
 *  - Do you want cut-away shots? (yes/no)
 *  - Please describe your character (chat-style textarea)
 *
 * Behavior:
 *  - If driver !== "character", this step auto-skips (calls onNext).
 *  - Persists to interview answers as:
 *      answers.wantsCutaways: boolean
 *      answers.character: string | null
 */
export default function CharacterStep({ onNext, onBack }) {
  const { answers, setAnswers, goNext, goBack } = useInterview();
  const driver = useMemo(() => (answers?.driver || "").toLowerCase(), [answers?.driver]);

  // Initialize from saved answers if present
  const [wantsCutaways, setWantsCutaways] = useState(
    typeof answers?.wantsCutaways === "boolean" ? answers.wantsCutaways : null
  );
  const [characterDesc, setCharacterDesc] = useState(answers?.character ?? "");

  // If the flow is narrator-driven, skip this step automatically
  useEffect(() => {
    if (driver && driver !== "character") {
      // Ensure we null out character-specific answers when narrator-driven
      setAnswers((prev) => ({
        ...prev,
        wantsCutaways: false,
        character: null,
      }));
      const next = onNext || goNext;
      if (typeof next === "function") next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  const handleNext = () => {
    setAnswers((prev) => ({
      ...prev,
      wantsCutaways: Boolean(wantsCutaways),
      character: characterDesc?.trim() || "",
    }));
    const next = onNext || goNext;
    if (typeof next === "function") next();
  };

  const handleBack = () => {
    const back = onBack || goBack;
    if (typeof back === "function") back();
  };

  const disabledNext =
    driver === "character" &&
    (
      wantsCutaways === null ||
      wantsCutaways === undefined ||
      characterDesc.trim().length < 40
    );

  if (driver && driver !== "character") {
    // Render a minimal placeholder while auto-skipping to avoid layout jump
    return (
      <div className="iw-step iw-step--character">
        <div className="iw-step__header">
          <h2>Character (skipped)</h2>
          <p className="iw-step__hint">This project is narrator-driven.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="iw-step iw-step--character">
      <div className="iw-step__header">
        <h2>Tell us about your character</h2>
        <p className="iw-step__hint">
          We’ll use this to keep your A‑roll consistent and guide cutaways.
        </p>
      </div>

      <div className="iw-field">
        <label className="iw-label">Do you want cut‑away shots?</label>
        <div className="iw-radio-group">
          <label className="iw-radio">
            <input
              type="radio"
              name="wantsCutaways"
              checked={wantsCutaways === true}
              onChange={() => setWantsCutaways(true)}
            />
            <span>Yes</span>
          </label>
          <label className="iw-radio">
            <input
              type="radio"
              name="wantsCutaways"
              checked={wantsCutaways === false}
              onChange={() => setWantsCutaways(false)}
            />
            <span>No</span>
          </label>
        </div>
        <p className="iw-help">
          Cutaways are B‑roll inserts that complement your on‑camera performance.
        </p>
      </div>

      <div className="iw-field">
        <label htmlFor="characterDesc" className="iw-label">
          Please describe your character
        </label>
        <textarea
          id="characterDesc"
          className="iw-textarea"
          rows={6}
          placeholder="Examples: ‘30‑something travel vlogger, upbeat and curious, casual streetwear. Short brown hair, glasses. Confident but friendly energy.’"
          value={characterDesc}
          onChange={(e) => setCharacterDesc(e.target.value)}
        />
        <p className="iw-help">
          The more detail you provide, the better your results will match your intentions.
        </p>
      </div>

      <div className="iw-actions">
        <button className="iw-btn iw-btn--ghost" onClick={handleBack}>
          Back
        </button>
        <button
          className="iw-btn iw-btn--primary"
          onClick={handleNext}
          disabled={disabledNext}
          aria-disabled={disabledNext}
          title={disabledNext ? "Select whether you want cutaways" : "Next"}
        >
          Next
        </button>
      </div>
    </div>
  );
}