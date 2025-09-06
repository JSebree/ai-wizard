import React from "react";

/**
 * ReviewStep
 * - Presents a read-only summary of the user's selections
 * - Lets them jump back to any section to edit
 * - Calls `onSubmit(ui)` when they're happy
 *
 * Props:
 *   ui:         the assembled UI payload (same shape you show in the preview)
 *   onSubmit:   () => void
 *   onEditStep: (stepIndex: number) => void   // optional quick-jump
 */
export default function ReviewStep({ ui, onSubmit, onEditStep, hideSubmit = true, extraActions = null, stepIndexMap = {} }) {
  const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : "—");
  const safe = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));

  // JSON helpers for copy/download
  const jsonString = React.useMemo(() => JSON.stringify({ ui }, null, 2), [ui]);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interview.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  // Map of step indices for quick Edit links (allows parent to override)
  const idx = {
    scene: stepIndexMap.scene ?? 0,
    voice: stepIndexMap.voice ?? 2,
    settingAction: stepIndexMap.settingAction ?? 4,
    audio: stepIndexMap.audio ?? 7,
    output: stepIndexMap.output ?? 9, // duration/title/reference
    advanced: stepIndexMap.advanced ?? 12, // adjust based on your actual steps
  };

  // helper for quick “Edit” links (optional)
  const EditLink = ({ to, label = "Edit" }) =>
    typeof onEditStep === "function" ? (
      <button
        type="button"
        onClick={() => onEditStep(to)}
        style={{ fontSize: 12, color: "#3B82F6", background: "transparent", border: "none", cursor: "pointer" }}
      >
        {label}
      </button>
    ) : null;

  return (
    <div>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Please review your selections. If everything looks good, click <b>Submit</b>.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <Section title="Scene" action={<EditLink to={idx.scene} />}>
          <Field label="Scene description" value={safe(ui.scene)} />
          <Field label="Driver" value={safe(ui.driver)} />
          {ui.driver === "character" && (
            <>
              <Field label="Wants cutaways" value={yesNo(ui.wantsCutaways)} />
              <Field label="Character description" value={safe(ui.character)} />
            </>
          )}
        </Section>

        <Section title="Voice" action={<EditLink to={idx.voice} />}>
          <Field label="Voice ID" value={safe(ui.voiceId)} mono />
          <Field label="Character gender (inferred)" value={safe(ui.characterGender)} />
          <Field label="Character / narrator name" value={safe(ui.characterName)} />
        </Section>

        <Section title="Setting & Action" action={<EditLink to={idx.settingAction} />}>
          <Field label="Setting" value={safe(ui.setting)} />
          <Field label="Action" value={safe(ui.action)} />
          <Field label="Director’s notes" value={safe(ui.directorsNotes)} />
        </Section>

        <Section title="Audio" action={<EditLink to={idx.audio} />}>
          <Field label="Wants music" value={yesNo(ui.wantsMusic)} />
          {ui.wantsMusic && <Field label="Music description" value={safe(ui.musicDesc)} />}
          {ui.wantsMusic && (
            <Field label="Include vocals" value={yesNo(ui.musicIncludeVocals)} />
          )}
          <Field label="Wants captions" value={yesNo(ui.wantsCaptions)} />
        </Section>

        <Section title="Output" action={<EditLink to={idx.output} />}>
          <Field label="Duration (seconds)" value={safe(ui.durationSec)} />
          <Field label="Title" value={safe(ui.title)} />
          <Field label="Reference text" value={safe(ui.referenceText)} />
        </Section>

        <Section title="Advanced settings" action={<EditLink to={idx.advanced} />}>
          <Field label="Enabled" value={yesNo(ui?.advanced?.enabled)} />
          {ui?.advanced?.enabled ? (
            <>
              <Field label="Visual style" value={safe(ui?.advanced?.style)} />
              <Field label="Music volume (1–10)" value={safe(ui?.advanced?.musicVolume)} />
              <Field label="Voice volume (1–10)" value={safe(ui?.advanced?.voiceVolume)} />
            </>
          ) : null}
        </Section>
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn" onClick={handleCopyJson}>
          Copy JSON
        </button>
        <button type="button" className="btn" onClick={handleDownloadJson}>
          Download JSON
        </button>
        {extraActions}
        {!hideSubmit && (
          <button type="button" className="btn btn-primary" onClick={() => onSubmit?.(ui)}>
            Submit
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {action}
      </div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748B" }}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap", fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}
// Note: The .btn class is already defined elsewhere for consistent button styling.