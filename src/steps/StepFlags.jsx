// src/steps/StepFlags.jsx
export default function StepFlags({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <form className="grid gap-4">
        <div className="space-y-5">
            <div className="text-xs text-slate-600">Fields marked <span className="text-red-600">*</span> are required.</div>

            {/* Feature flags */}
            <div className="flex items-center gap-2">
            <input id="captions" type="checkbox" checked={!!v.captions} onChange={(e)=>set("captions", e.target.checked)} />
            <label htmlFor="captions" className="text-sm">Captions</label>
            </div>
            <div className="flex items-center gap-2">
            <input id="music" type="checkbox" checked={!!v.music} onChange={(e)=>set("music", e.target.checked)} />
            <label htmlFor="music" className="text-sm">Music enabled</label>
            </div>
            <div className="flex items-center gap-2">
            <input id="podcastStill" type="checkbox" checked={!!v.podcastStill} onChange={(e)=>set("podcastStill", e.target.checked)} />
            <label htmlFor="podcastStill" className="text-sm">Podcast still</label>
            </div>

            {/* Words/sec */}
            <div>
            <label className="text-sm font-medium text-slate-700">Words per second</label>
            <input type="number" min={1} max={5}
                className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={v.wordsPerSecond ?? 2} onChange={(e)=>set("wordsPerSecond", Number(e.target.value||0))} />
            </div>

            {/* Video specs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Resolution preset</label>
                <select className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={v.resPreset || "1080p"} onChange={(e)=>set("resPreset", e.target.value)}>
                {Object.keys(RES_PRESETS).map(k=> <option key={k} value={k}>{k}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">Aspect ratio</label>
                <select className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={v.aspect || "9:16"} onChange={(e)=>set("aspect", e.target.value)}>
                {ASPECTS.map(a=> <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
            <div>
                <label className="text-sm font-medium text-slate-700">FPS</label>
                <select className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={v.fps || 24} onChange={(e)=>set("fps", Number(e.target.value))}>
                {FPS_PRESETS.map(f=> <option key={f} value={f}>{f}</option>)}
                </select>
            </div>
            </div>

            {/* Determinism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex items-end gap-2">
                <input id="seedLockFlag" type="checkbox" checked={!!v.seedLock} onChange={(e)=>set("seedLock", e.target.checked)} />
                <label htmlFor="seedLockFlag" className="text-sm">Seed lock</label>
            </div>
            <Slider label="Strictness" value={v.strictness ?? 0.6} min={0} max={1} step={0.01}
                    onChange={(val)=>set("strictness", val)} hint="Strict ↔ Creative" />
            <div className="flex items-end gap-2">
                <input id="respectKeyframes" type="checkbox" checked={!!v.respectKeyframes} onChange={(e)=>set("respectKeyframes", e.target.checked)} />
                <label htmlFor="respectKeyframes" className="text-sm">Respect my keyframes</label>
            </div>
            </div>

            {/* Accessibility */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
                <label className="text-sm font-medium text-slate-700">Subtitle language</label>
                <input className="mt-1 block w-full rounded-md border px-3 py-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={v.subtitleLang || 'en'} onChange={(e)=>set('subtitleLang', e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
                <input id="autoTranslate" type="checkbox" checked={!!v.autoTranslate} onChange={(e)=>set("autoTranslate", e.target.checked)} />
                <label htmlFor="autoTranslate" className="text-sm">Auto-translate captions</label>
            </div>
            <div className="flex items-end gap-2">
                <input id="altText" type="checkbox" checked={!!v.altTextExport} onChange={(e)=>set("altTextExport", e.target.checked)} />
                <label htmlFor="altText" className="text-sm">Export alt-text/transcript</label>
            </div>
            </div>
        </div>
    </form>
  );
}