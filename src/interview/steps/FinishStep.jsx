import React, { useMemo, useState } from "react";
// FinishStep.jsx
// Shows a final review of answers, constructs the payload in the required shape,
// and provides Copy / Download / Submit actions.

// NOTE: This component expects your interview state hook to be exported from
// `../interviewState`. If your hook is named differently, update the import below.
import { useInterviewState } from "../interviewState";

/**
 * Parse gender from a voice display name robustly.
 * We search for full-word gender tokens to avoid false matches like
 * "Mia (female)" vs. names starting with "m".
 */
function parseGenderFromVoiceName(voiceName) {
  if (!voiceName) return null;
  const s = String(voiceName).toLowerCase();

  // Full-word tokens; keep short to avoid accidental matches in names.
  const femaleTokens = [" female", "(female", "[female", " she ", " her ", "feminine"];
  const maleTokens = [" male", "(male", "[male", " he ", " him ", "masculine"];
  const nonbinaryTokens = [" nonbinary", " non-binary", " nb ", " they ", " them "];

  const hasToken = (tokens) => tokens.some((t) => s.includes(t));

  if (hasToken(nonbinaryTokens)) return "nonbinary";
  if (hasToken(femaleTokens)) return "female";
  if (hasToken(maleTokens)) return "male";

  // Also check trailing gender markers like " - Female", " • Male"
  const trailing = s.match(/-\s*(female|male|nonbinary)|•\s*(female|male|nonbinary)|\b(female|male|nonbinary)\b/);
  if (trailing) {
    const g = trailing[1] || trailing[2] || trailing[3];
    if (g) return g.toLowerCase();
  }

  return null; // unknown/unspecified
}

/**
 * Build the final payload in the target shape.
 * The state field names here assume the earlier steps wrote:
 * - scene, driver, wantsCutaways, characterDesc, setting, action, directorsNotes
 * - wantsMusic, musicDesc, wantsCaptions, durationSec, referenceText
 * - voiceId, voiceName, characterName, title
 * Adjust the mapping if your state keys differ.
 */
function makePayload(state) {
  const {
    scene,
    driver,
    wantsCutaways,
    characterDesc,
    setting,
    action,
    directorsNotes,
    wantsMusic,
    musicDesc,
    wantsCaptions,
    durationSec,
    referenceText,
    voiceId,
    voiceName,
    title,
    characterName,
  } = state || {};

  const characterGender = parseGenderFromVoiceName(voiceName);

  return {
    ui: {
      scene: scene ?? "",
      driver: driver ?? "character",
      wantsCutaways: Boolean(driver === "character" ? wantsCutaways : false),
      character: driver === "character" ? (characterDesc ?? null) : null,
      setting: setting ?? "",
      action: action ?? "",
      directorsNotes: directorsNotes ?? "",
      wantsMusic: Boolean(wantsMusic),
      musicDesc: Boolean(wantsMusic) ? (musicDesc ?? "") : "",
      wantsCaptions: Boolean(wantsCaptions),
      durationSec: Number(durationSec ?? 0) || 0,
      referenceText: referenceText ?? "",
      voiceId: voiceId ?? null,
      characterGender: characterGender, // "female" | "male" | "nonbinary" | null
      title: title ?? "",
      characterName: characterName ?? "",
    },
  };
}

export default function FinishStep({
  onBack,
  onSubmit,
  submitUrl, // optional: if provided, we'll POST the payload here
}) {
  const { state } = useInterviewState();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedOk, setSubmittedOk] = useState(false);

  const payload = useMemo(() => makePayload(state), [state]);
  const pretty = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      alert("Payload copied to clipboard.");
    } catch (e) {
      console.error(e);
      alert("Copy failed. Check browser permissions.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([pretty], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview_payload.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmittedOk(false);

    // Call parent callback if provided
    if (typeof onSubmit === "function") {
      try {
        await onSubmit(payload);
        setSubmittedOk(true);
      } catch (e) {
        setSubmitError(String(e?.message || e));
      }
    }

    // Optionally POST to submitUrl if present
    if (submitUrl) {
      setSubmitting(true);
      try {
        const res = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Submit failed (${res.status}): ${text || res.statusText}`);
        }
        setSubmittedOk(true);
      } catch (e) {
        console.error(e);
        setSubmitError(String(e?.message || e));
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Basic validation – highlight any critical missing fields.
  const problems = [];
  if (!payload.ui.scene) problems.push("Scene description");
  if (!payload.ui.driver) problems.push("Driver (character or narrator)");
  if (!payload.ui.setting) problems.push("Setting");
  if (!payload.ui.action) problems.push("Action");
  if (!payload.ui.title) problems.push("Title");
  if (!payload.ui.durationSec || payload.ui.durationSec <= 0) problems.push("Duration (seconds)");
  if (!payload.ui.voiceId) problems.push("Voice / narrator selection");

  const canSubmit = problems.length === 0 && !submitting;

  return (
    <div className="step finish-step" style={{ display: "grid", gap: 16 }}>
      <header>
        <h2>Review &amp; Finish</h2>
        <p>Here’s the payload we’ll send to create your scene. You can copy or download it for your records.</p>
      </header>

      {problems.length > 0 && (
        <div style={{ padding: 12, border: "1px solid #f39c12", borderRadius: 8, background: "#fff7e6" }}>
          <strong>Missing required info:</strong>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>Final Payload (JSON)</label>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#0b1021",
            color: "#e0e6ff",
            padding: 16,
            borderRadius: 8,
            maxHeight: 420,
            overflow: "auto",
            border: "1px solid #1f2a52",
          }}
        >
{pretty}
        </pre>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={handleCopy}>Copy JSON</button>
        <button type="button" onClick={handleDownload}>Download JSON</button>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <button type="button" onClick={onBack} style={{ marginLeft: "auto" }}>
          Back
        </button>
      </div>

      {submittedOk && (
        <div style={{ padding: 10, borderRadius: 8, background: "#e8fff1", border: "1px solid #2ecc71" }}>
          ✅ Submitted successfully.
        </div>
      )}
      {submitError && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ffecec", border: "1px solid #e74c3c" }}>
          ❌ {submitError}
        </div>
      )}
    </div>
  );
}
