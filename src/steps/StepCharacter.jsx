// src/steps/StepCharacter.jsx
export default function StepCharacter({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <form className="grid gap-4">
        <div className="space-y-5">
            <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Display Name{mark("name")}</label>
                <input className={cls("name")} value={v.name || ""} onChange={(e)=>set("name", e.target.value)} placeholder="e.g., Baby Zuck" />
                {err("name") && <p className="text-xs text-red-600 mt-1">{err("name")}</p>}
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Visual Name{mark("visualName")}</label>
                <input className={cls("visualName")} value={v.visualName || ""} onChange={(e)=>set("visualName", e.target.value)} placeholder="e.g., Baby Mark Zuckerberg" />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Persona Kind{mark("personaKind")}</label>
                <select className={cls("personaKind")} value={v.personaKind || "human"} onChange={(e)=>set("personaKind", e.target.value)}>
                {PERSONA_KINDS.map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Look Pack{mark("lookPack")}</label>
                <input className={cls("lookPack")} value={v.lookPack || "pack_look_clean_host"} onChange={(e)=>set("lookPack", e.target.value)} />
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Persona Pack{mark("personaPack")}</label>
                <input className={cls("personaPack")} value={v.personaPack || "pack_persona_human_adult"} onChange={(e)=>set("personaPack", e.target.value)} />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Accent</label>
                <input className={cls("accent")} value={v.accent || ""} onChange={(e)=>set("accent", e.target.value)} placeholder="e.g., american, british" />
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Style Tags (comma separated)</label>
                <input className={cls("styleTags")} value={v.styleTags || ""} onChange={(e)=>set("styleTags", e.target.value)} placeholder="realistic, pixar-like" />
            </div>
            <div className="flex items-end gap-2">
                <input id="pinLook" type="checkbox" checked={!!v.pinLook} onChange={(e)=>set("pinLook", e.target.checked)} />
                <label htmlFor="pinLook" className="text-sm">Pin look (prevent overrides)</label>
            </div>
            </div>

            {/* Voice */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
            <p className="font-medium text-sm">Voice</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                <label className="text-sm font-medium text-slate-700">Voice ID{mark("voiceId")}</label>
                <input className={cls("voiceId")} value={v.voiceId || ""} onChange={(e)=>set("voiceId", e.target.value)} placeholder="TTS/voice identifier" />
                {err("voiceId") && <p className="text-xs text-red-600 mt-1">{err("voiceId")}</p>}
                </div>
                <div>
                <label className="text-sm font-medium text-slate-700">Preset voice</label>
                <select className={cls("voicePreset")} value={v.voicePreset || ""} onChange={(e)=>set("voicePreset", e.target.value)}>
                    <option value="">— Select —</option>
                    {VOICE_PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
                </select>
                </div>
                <div>
                <label className="text-sm font-medium text-slate-700">Upload voice (WAV/MP3)</label>
                <input type="file" accept="audio/*" className="mt-1 block w-full"
                        onChange={(e)=> set("uploadVoiceMeta", e.target.files?.[0]
                        ? { name: e.target.files[0].name, size: e.target.files[0].size, type: e.target.files[0].type }
                        : null)} />
                </div>
            </div>
            <MicRecorder value={v.recordingUrl || null} onChange={(u)=>set("recordingUrl", u)} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <Slider label="Pitch (semitones)" value={v.pitchSemitones ?? 0} min={-12} max={12} step={1}
                        onChange={(val)=>set("pitchSemitones", val)} hint="-12 low ↔ +12 high" />
                <Slider label="Speed" value={v.speed ?? 1.0} min={0.5} max={1.5} step={0.01}
                        onChange={(val)=>set("speed", val)} hint="0.5x ↔ 1.5x" />
                <div>
                <label className="text-sm font-medium text-slate-700">Emotion</label>
                <input className={cls("emotion")} value={v.emotion || "neutral"}
                        onChange={(e)=>set("emotion", e.target.value)} placeholder="neutral, happy, sad" />
                </div>
                <div>
                <label className="text-sm font-medium text-slate-700">Accent override</label>
                <input className={cls("voiceAccent")} value={v.voiceAccent || "auto"}
                        onChange={(e)=>set("voiceAccent", e.target.value)} placeholder="auto" />
                </div>
            </div>
            </div>

            {/* Acting */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
            <p className="font-medium text-sm">Motion / Acting</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Slider label="Gesture" value={v.gesture ?? 0.5} onChange={(val)=>set("gesture", val)} hint="subtle ↔ exaggerated" />
                <Slider label="Energy" value={v.energy ?? 0.5} onChange={(val)=>set("energy", val)} hint="calm ↔ intense" />
                <div className="flex items-end gap-2">
                <input id="eyeContact" type="checkbox" checked={!!v.eyeContact} onChange={(e)=>set("eyeContact", e.target.checked)} />
                <label htmlFor="eyeContact" className="text-sm">Eye contact (to camera)</label>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <input id="lipStrict" type="checkbox" checked={!!v.lipSyncStrict} onChange={(e)=>set("lipSyncStrict", e.target.checked)} />
                <label htmlFor="lipStrict" className="text-sm">Lip-sync strictness (exact)</label>
            </div>
            </div>

            {/* Consistency */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
            <p className="font-medium text-sm">Consistency</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex items-end gap-2">
                <input id="lockChar" type="checkbox" checked={!!v.lockCharacter} onChange={(e)=>set("lockCharacter", e.target.checked)} />
                <label htmlFor="lockChar" className="text-sm">Lock to this character</label>
                </div>
                <div className="flex items-end gap-2">
                <input id="seedLock" type="checkbox" checked={!!v.seedLock} onChange={(e)=>set("seedLock", e.target.checked)} />
                <label htmlFor="seedLock" className="text-sm">Seed lock</label>
                </div>
                <div>
                <label className="text-sm font-medium text-slate-700">Seed</label>
                <input type="number" className={cls("seed")} value={v.seed ?? ""} placeholder="optional"
                        onChange={(e)=>set("seed", e.target.value === '' ? null : Number(e.target.value))} />
                </div>
            </div>
            </div>

            {/* References */}
            <div className="rounded border border-slate-200 p-3 space-y-3">
            <p className="font-medium text-sm">References</p>
            <FileListInput label="Reference image(s)" accept="image/*"
                            value={v.refImages || []} onChange={(list)=>set("refImages", list)} />
            <FileListInput label="Reference video(s)" accept="video/*"
                            value={v.refVideos || []} onChange={(list)=>set("refVideos", list)} />
            <div>
                <label className="text-sm font-medium text-slate-700">Freeform description</label>
                <textarea rows={3} className={cls("refNotes")} value={v.refNotes || ""}
                        onChange={(e)=>set("refNotes", e.target.value)} />
            </div>
            </div>
        </div>
    </form>
  );
}