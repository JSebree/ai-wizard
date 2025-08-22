// src/components/WizardStepper.jsx
export default function WizardStepper({ steps, current, onJump }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => {
        const isActive = i === current;
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={[
                "px-3 py-1.5 rounded-lg text-sm border",
                isActive ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50"
              ].join(" ")}
            >
              {i + 1}. {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}