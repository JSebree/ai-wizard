import React from "react";

/**
 * AdvancedSettingsStep
 *
 * A lightweight, collapsible panel of optional settings.
 * The parent may pass current values; we apply safe defaults so the UI
 * never shows NaN when a value is initially undefined.
 *
 * Props:
 * - styleValue: string
 * - onStyleChange: (style: string) => void
 * - music10: number (1..10)
 * - onMusic10Change: (n: number) => void
 * - voice10: number (1..10)
 * - onVoice10Change: (n: number) => void
 * - genderValue: string | ""   (expects "female" | "male"; we’ll coerce)
 * - onGenderChange: (g: string) => void
 * - inferredGender: string | undefined  (from prior voice selection)
 */
export default function AdvancedSettingsStep({
  styleValue,
  onStyleChange,
  music10,
  onMusic10Change,
  voice10,
  onVoice10Change,
  genderValue,
  onGenderChange,
  inferredGender,
}) {
  // Should the advanced section be shown? Defaults to "No".
  const [show, setShow] = React.useState(false);

  // Safe slider values with defaults: music=1, voice=10
  const clamp10 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 1;
    return Math.max(1, Math.min(10, Math.round(x)));
  };
  const musicVal = clamp10(music10 ?? 1);
  const voiceVal = clamp10(voice10 ?? 10);

  // Map any inferred value to "female" | "male" (fallback "female")
  const inferredSimple = React.useMemo(() => {
    const s = String(inferredGender || "").toLowerCase();
    if (s.includes("male") && !s.includes("fe")) return "male";
    return "female";
  }, [inferredGender]);

  const effGender = (genderValue === "male" || genderValue === "female")
    ? genderValue
    : inferredSimple;

  const styles = [
    { value: "photorealistic", label: "Photorealistic" },
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "pixar-style", label: "Pixar‑style" },
    { value: "digital-illustration", label: "Digital Illustration" },
    { value: "watercolor", label: "Watercolor" },
  ];

  return (
    <div>
      {/* Toggle */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Use advanced settings?</div>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="adv-toggle"
              value="no"
              checked={!show}
              onChange={() => setShow(false)}
            />
            No
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="adv-toggle"
              value="yes"
              checked={show}
              onChange={() => setShow(true)}
            />
            Yes
          </label>
        </div>
      </div>

      {/* Collapsible content */}
      {show && (
        <div>
          {/* Visual style */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Visual style</div>
            <select
              value={styleValue}
              onChange={(e) => onStyleChange(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
            >
              {styles.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Music volume */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Music volume</div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={musicVal}
              onChange={(e) => onMusic10Change(clamp10(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Voice volume */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Voice volume</div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={voiceVal}
              onChange={(e) => onVoice10Change(clamp10(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Character gender */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Character gender</div>
            <select
              value={effGender}
              onChange={(e) => onGenderChange(e.target.value === "male" ? "male" : "female")}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
