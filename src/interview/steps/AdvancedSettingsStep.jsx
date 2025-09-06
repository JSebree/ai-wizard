import React from "react";

/**
 * AdvancedSettingsStep
 *
 * Collapsible, *controlled* advanced options.
 * - If `enabled` is provided, the component is controlled by the parent.
 *   Otherwise it will manage its own local `enabled` state (default false).
 * - All outward changes are guarded so we never call an undefined callback.
 *
 * Props:
 *  - enabled?: boolean
 *  - onEnabledChange?: (enabled: boolean) => void
 *  - styleValue?: string
 *  - onStyleChange?: (style: string) => void
 *  - music10?: number (1..10)  [default 1]
 *  - onMusic10Change?: (n: number) => void
 *  - voice10?: number (1..10)  [default 10]
 *  - onVoice10Change?: (n: number) => void
 */
export default function AdvancedSettingsStep({
  enabled,
  onEnabledChange,
  styleValue = "Photorealistic",
  onStyleChange,
  music10,
  onMusic10Change,
  voice10,
  onVoice10Change,
}) {
  // Fallback local state if parent doesn't control `enabled`
  const isControlled = typeof enabled === "boolean";
  const [localEnabled, setLocalEnabled] = React.useState(false);
  const show = isControlled ? !!enabled : localEnabled;

  // Helpers
  const clamp10 = (n, fallback) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.max(1, Math.min(10, Math.round(x)));
  };
  const musicVal = clamp10(music10, 1);
  const voiceVal = clamp10(voice10, 10);

  // Safe invokers
  const emitEnabled = (b) => {
    if (typeof onEnabledChange === "function") onEnabledChange(!!b);
    if (!isControlled) setLocalEnabled(!!b);
  };
  const emitStyle = (v) => {
    if (typeof onStyleChange === "function") onStyleChange(String(v));
  };
  const emitMusic = (n) => {
    const clamped = clamp10(n, 1);
    if (typeof onMusic10Change === "function") onMusic10Change(clamped);
  };
  const emitVoice = (n) => {
    const clamped = clamp10(n, 10);
    if (typeof onVoice10Change === "function") onVoice10Change(clamped);
  };

  const STYLE_OPTS = [
    "Photorealistic",
    "Cinematic",
    "Documentary",
    "Anime",
    "Pixar-style",
    "Watercolor",
    "Comic-book",
    "Noir",
  ];

  return (
    <div>
      {/* Toggle */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Advanced settings</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Use advanced settings?</div>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="adv-toggle"
              value="yes"
              checked={show}
              onChange={() => emitEnabled(true)}
            />
            Yes
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="adv-toggle"
              value="no"
              checked={!show}
              onChange={() => emitEnabled(false)}
            />
            No
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
              onChange={(e) => emitStyle(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #CBD5E1" }}
            >
              {STYLE_OPTS.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              onChange={(e) => emitMusic(e.target.value)}
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
              onChange={(e) => emitVoice(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
