// src/steps/StepSetting.jsx
export default function StepSetting({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <form className="grid gap-4">
        <div className="space-y-5">
            <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

            {/* Environment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Environment preset</label>
                <select className={cls("envPreset")} value={v.envPreset || "studio"} onChange={(e)=>set("envPreset", e.target.value)}>
                {ENV_PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Environment (freeform){mark("environment")}</label>
                <input className={cls("environment")} value={v.environment || "env_auto"} onChange={(e)=>set("environment", e.target.value)} />
                {err("environment") && <p className="text-xs text-red-600 mt-1">{err("environment")}</p>}
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Location</label>
                <input className={cls("location")} value={v.location || ""} onChange={(e)=>set("location", e.target.value)} placeholder="e.g., Tokyo, street" />
            </div>
            </div>

            {/* Background assets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FileListInput label="Background image(s)" accept="image/*" value={v.bgImages || []} onChange={(list)=>set("bgImages", list)} />
            <FileListInput label="Background video loop(s)" accept="video/*" value={v.bgVideos || []} onChange={(list)=>set("bgVideos", list)} />
            </div>

            {/* Camera grammar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Shot type</label>
                <select className={cls("shotType")} value={v.shotType || "selfie"} onChange={(e)=>set("shotType", e.target.value)}>
                {SHOT_TYPES.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Camera movement</label>
                <Slider value={v.cameraMovement ?? 0.5} onChange={(val)=>set("cameraMovement", val)} hint="static ↔ fluid" />
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Motion template</label>
                <select className={cls("motionTemplate")} value={v.motionTemplate || "handheld vlog"} onChange={(e)=>set("motionTemplate", e.target.value)}>
                {MOTION_TEMPLATES.map(m=> <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            </div>

            {/* Lighting & Atmosphere */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Lighting preset</label>
                <select className={cls("lightingPreset")} value={v.lightingPreset || "day"} onChange={(e)=>set("lightingPreset", e.target.value)}>
                {LIGHT_PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div>
                <Slider label="Brightness" value={v.brightness ?? 0} min={-1} max={1} step={0.01} onChange={(val)=>set("brightness", val)} />
            </div>
            <div>
                <Slider label="Contrast" value={v.contrast ?? 0} min={-1} max={1} step={0.01} onChange={(val)=>set("contrast", val)} />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Weather</label>
                <select className={cls("weather")} value={v.weather || "clear"} onChange={(e)=>set("weather", e.target.value)}>
                {WEATHER_PRESETS.map(w=> <option key={w} value={w}>{w}</option>)}
                </select>
            </div>
            <div className="flex items-end gap-2">
                <input id="safeZones" type="checkbox" checked={!!v.safeZones} onChange={(e)=>set("safeZones", e.target.checked)} />
                <label htmlFor="safeZones" className="text-sm">Show caption safe zones</label>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Subject position</label>
                <select className={cls("subjectPos")} value={v.subjectPos || "center"} onChange={(e)=>set("subjectPos", e.target.value)}>
                {["center","rule_of_thirds","side"].map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            </div>

            {/* Keyframes / anchors */}
            <div>
            <label className="text-sm font-medium text-slate-700">Keyframe Cue</label>
            <input className={cls("keyframeCue")} value={v.keyframeCue || ""} onChange={(e)=>set("keyframeCue", e.target.value)}
                    placeholder="Describe a screenshot to anchor visuals" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FileListInput label="Keyframe still(s)" accept="image/*" value={v.keyframeStills || []} onChange={(list)=>set("keyframeStills", list)} />
            <FileListInput label="Anchor clip(s)" accept="video/*" value={v.anchorClips || []} onChange={(list)=>set("anchorClips", list)} />
            </div>
            <div>
            <label className="text-sm font-medium text-slate-700">Per-shot B-roll descriptions (one per line)</label>
            <textarea rows={3} className={cls("perShotBroll")} value={v.perShotBroll || ""} onChange={(e)=>set("perShotBroll", e.target.value)} />
            </div>

            {/* Continuity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex items-end gap-2">
                <input id="matchPrev" type="checkbox" checked={!!v.matchPrev} onChange={(e)=>set("matchPrev", e.target.checked)} />
                <label htmlFor="matchPrev" className="text-sm">Match previous scene</label>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Transition</label>
                <select className={cls("transition")} value={v.transition || "cut"} onChange={(e)=>set("transition", e.target.value)}>
                {["cut","dissolve","swipe","glitch"].map(t=> <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            </div>

            {/* Prompt tails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Positive Prompt Tail</label>
                <textarea rows={3} className={cls("positivePromptTail")} value={v.positivePromptTail || ""} onChange={(e)=>set("positivePromptTail", e.target.value)} />
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Negative Prompt Tail</label>
                <textarea rows={3} className={cls("negativePromptTail")} value={v.negativePromptTail || ""} onChange={(e)=>set("negativePromptTail", e.target.value)} />
            </div>
            </div>
        </div>
    </form>
  );
}