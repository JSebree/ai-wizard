


import React from "react";

const TitleStep = ({ ui, setUi }) => (
  <div>
    <h2>What is the title of your scene?</h2>
    <input
      type="text"
      value={ui.title || ""}
      onChange={e => setUi({ ...ui, title: e.target.value })}
    />
  </div>
);

export default TitleStep;