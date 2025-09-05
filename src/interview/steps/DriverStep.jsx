import React from 'react';

export default function DriverStep({ value, onChange, onNext, onBack }) {
  const { driver, cutAwayShots, characterDescription } = value || {};

  const isCharacter = driver === 'Character';
  const canProceed =
    driver &&
    (!isCharacter || (characterDescription && characterDescription.trim().length >= 5));

  return (
    <div className="iw-step">
      <h2 className="iw-step-title">Select Driver</h2>

      <div className="iw-radio-group">
        <label className="iw-radio-label">
          <input
            type="radio"
            name="driver"
            value="Character"
            checked={driver === 'Character'}
            onChange={() => onChange({ ...value, driver: 'Character' })}
            className="iw-radio-input"
          />
          Character
        </label>

        <label className="iw-radio-label">
          <input
            type="radio"
            name="driver"
            value="Narrator"
            checked={driver === 'Narrator'}
            onChange={() => onChange({ ...value, driver: 'Narrator' })}
            className="iw-radio-input"
          />
          Narrator
        </label>
      </div>

      {isCharacter && (
        <div className="iw-character-options">
          <label className="iw-toggle-label">
            <input
              type="checkbox"
              checked={!!cutAwayShots}
              onChange={() => onChange({ ...value, cutAwayShots: !cutAwayShots })}
              className="iw-toggle-input"
            />
            Do you want cut-away shots?
          </label>

          <label className="iw-textarea-label">
            Please describe your character:
            <textarea
              value={characterDescription || ''}
              onChange={(e) =>
                onChange({ ...value, characterDescription: e.target.value })
              }
              className="iw-textarea"
            />
          </label>
        </div>
      )}

      <div className="iw-buttons">
        <button type="button" onClick={onBack} className="iw-button iw-button-back">
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="iw-button iw-button-next"
        >
          Next
        </button>
      </div>
    </div>
  );
}
