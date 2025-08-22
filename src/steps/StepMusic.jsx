// src/steps/StepMusic.jsx
import React from "react";

// Local presets
const AMBIENCE_PRESETS = ["studio","street","crowd","birds","silence"];

// Tiny local helpers so this file is self-contained
function Slider({ label, value, onChange, min=0, max=1, step=0.01, hint }) {
  return (
    <div>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e)=>onChange(Number(e.target.value))} className="w-full" />
      {hint && <div className="text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

function FileListInput({ label, accept, multiple=true, value=[], onChange }) {
  const onFiles = (files) => {
    const list = Array.from(files || []).map(f => ({ name: f.name, type: f.type, size: f.size }));
    onChange([...(value||[]), ...list]);
  };
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input type="file" accept={accept} multiple={multiple}
             className="mt-1 block w-full" onChange={(e)=>onFiles(e.target.files)} />
      {!!(value && value.length) && (
        <ul className="mt-1 text-xs list-disc pl-5 text-slate-600">
          {value.map((f,i)=> <li key={i}>{f.name} <span className="opacity-60">({f.type}, {f.size}B)</span></li>)}
        </ul>
      )}
    </div>
  );
}

export default function StepMusic({ value, onChange }) {
  const v = value || {};
  const set = (k, val) => onChange({ ...(value||{}), [k]: val });

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-5">
        <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

        {/* Mood + Tempo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Mood<span className="text-red-600">*</span></label>
            <input className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300"
                   value={v.mood || "light underscore"}
                   onChange={(e)=>set("mood", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tempo</label>
            <Slider value={v.tempoVal ?? 100} min={60} max={180} step={1}
                    onChange={(val)=>set("tempoVal", val)} hint={`${v.tempoVal ?? 100} bpm`} />
          </div>
        </div>

        {/* Toggles + Music upload */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex items-end gap-2">
            <input id="vocals" type="checkbox" checked={!!v.vocals}
                   onChange={(e)=>set("vocals", e.target.checked)} />
            <label htmlFor="vocals" className="text-sm">Allow vocals</label>
          </div>
          <div className="flex items-end gap-2">
            <input id="ducking" type="checkbox" checked={!!v.ducking}
                   onChange={(e)=>set("ducking", e.target.checked)} />
            <label htmlFor="ducking" className="text-sm">Ducking under VO</label>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Upload music</label>
            <input type="file" accept="audio/*" className="mt-1 block w-full"
                   onChange={(e)=> set("musicUpload", e.target.files?.[0]
                     ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type }
                     : null)} />
          </div>
        </div>

        {/* Ambience + FX */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Ambience</label>
            <select className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300"
                    value={v.ambience || "studio"}
                    onChange={(e)=>set("ambience", e.target.value)}>
              {AMBIENCE_PRESETS.map(a=> <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <FileListInput label="Sound effects" accept="audio/*"
                         value={v.fxUploads || []}
                         onChange={(list)=>set("fxUploads", list)} />
        </div>

        {/* Mix levels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Slider label="VO volume" value={v.voVol ?? 0.9} min={0} max={1} step={0.01}
                  onChange={(val)=>set("voVol", val)} />
          <Slider label="Music volume" value={v.musicVol ?? 0.5} min={0} max={1} step={0.01}
                  onChange={(val)=>set("musicVol", val)} />
          <Slider label="FX volume" value={v.fxVol ?? 0.5} min={0} max={1} step={0.01}
                  onChange={(val)=>set("fxVol", val)} />
        </div>
      </div>
    </form>
  );
}