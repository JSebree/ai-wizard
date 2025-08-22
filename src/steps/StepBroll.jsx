// src/steps/StepBroll.jsx
export default function StepBroll({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <form className="grid gap-4">
      <div>
        <label className="block text-sm font-medium">General B-roll Guidance</label>
        <textarea rows={3} className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={value.guidance} onChange={e => set("guidance", e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium">Shot Ideas (one per line)</label>
        <textarea rows={5} className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder={"overhead mixing bowl\nmacro butter sizzle\nslow push-in plated dish"}
                  value={value.shotIdeas} onChange={e => set("shotIdeas", e.target.value)} />
      </div>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox"
               checked={value.allowSynth}
               onChange={e => set("allowSynth", e.target.checked)} />
        <span className="text-sm">Allow synthesized keyframes if missing</span>
      </label>
    </form>
  );
}