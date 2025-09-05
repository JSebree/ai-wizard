import React, { useContext } from 'react';
import { InterviewContext } from '../../InterviewContext';

function SettingStep({ onNext, onBack }) {
  const { state, setState } = useContext(InterviewContext);
  const setting = state.setting || '';

  const handleChange = (e) => {
    setState({ ...state, setting: e.target.value });
  };

  return (
    <div className="step setting-step">
      <h2>Describe the scene’s setting</h2>
      <textarea
        value={setting}
        onChange={handleChange}
        placeholder="Enter the setting description here..."
      />
      <div className="navigation-buttons">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button type="button" onClick={onNext} disabled={setting.trim() === ''}>
          Next
        </button>
      </div>
    </div>
  );
}

export default SettingStep;
