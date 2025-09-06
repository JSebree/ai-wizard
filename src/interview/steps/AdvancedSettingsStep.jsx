import React from "react";

/**
 * AdvancedSettingsStep
 *
 * Props:
 * - styleValue: string
 * - onStyleChange: (style: string) => void
 * - music10: number (1..10)
 * - onMusic10Change: (n: number) => void
 * - voice10: number (1..10)
 * - onVoice10Change: (n: number) => void
 * - genderValue: string | ""  (one of: "male","female","nonbinary","neutral","" for "use inferred")
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
  inferredGender
}) {
  const styles = [
    { value: "photorealistic", label: "Photorealistic" },
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "pixar-style", label: "Pixar-style" },
    { value: "digital-illustration", label: "Digital Illustration" },
    { value: "watercolor", label: "Watercolor" },
  ];

  const genders = [
    { value: "", label: inferredGender ? `Use inferred (${inferredGender})` : "Use inferred" },
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "nonbinary", label: "Non-binary" },
    { value: "neutral", label: "Neutral" },
  ];

  const clamp10 = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 1;
    return Math.max(1, Math.min(10, Math.round(x)));
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Visual style</div>
        <select
          value={styleValue}
          onChange={(e) => onStyleChange(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
        >
          {styles.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <div style={{ color: "#667085", fontSize: 12, marginTop: 6 }}>
          Choose a rendering style. Photorealistic is a good default for SDXL.
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Music volume</div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={music10}
          onChange={(e) => onMusic10Change(clamp10(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#667085", marginTop: 4 }}>
          <span>1 (quiet)</span>
          <span>Selected: {music10} → {(music10 / 10).toFixed(1)}</span>
          <span>10 (loud)</span>
        </div>
        <div style={{ color: "#667085", fontSize: 12, marginTop: 6 }}>
          Maps 1–10 to FFmpeg scale 0.1–1.0.
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Voice volume</div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={voice10}
          onChange={(e) => onVoice10Change(clamp10(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#667085", marginTop: 4 }}>
          <span>1 (quiet)</span>
          <span>Selected: {voice10} → {(voice10 / 10).toFixed(1)}</span>
          <span>10 (loud)</span>
        </div>
        <div style={{ color: "#667085", fontSize: 12, marginTop: 6 }}>
          Maps 1–10 to FFmpeg scale 0.1–1.0.
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Character gender</div>
        <select
          value={genderValue}
          onChange={(e) => onGenderChange(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
        >
          {genders.map((g) => (
            <option key={g.value || "inferred"} value={g.value}>{g.label}</option>
          ))}
        </select>
        <div style={{ color: "#667085", fontSize: 12, marginTop: 6 }}>
          Defaults to the gender inferred from your selected voice. You can override it here.
        </div>
      </div>
    </div>
  );
}
