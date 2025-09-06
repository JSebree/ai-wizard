import React from "react";

/* ================= N8N STATUS CLIENT (legacy-style) ================= */
function startAutoPoll({ statusUrl, onUpdate, onDone, onError }) {
  let delay = 2000;
  const maxDelay = 8000;
  let alive = true;

  async function tick() {
    if (!alive) return;
    try {
      const res = await fetch(statusUrl, { method: 'GET' });
      const j = await res.json();
      if (j && j.ok === false) {
        onError?.(j.error || 'Unknown status error');
        alive = false;
        return;
      }
      onUpdate?.(j);
      const s = String(j?.status || '').toUpperCase();
      if (s === 'DONE') {
        onDone?.(j);
        alive = false;
        return;
      }
      if (s === 'FAILED' || s === 'ERROR') {
        onError?.('Render failed');
        alive = false;
        return;
      }
      delay = Math.min(maxDelay, Math.round(delay * 1.25));
      setTimeout(tick, delay);
    } catch {
      // transient errors -> keep polling
      setTimeout(tick, delay);
    }
  }

  tick();
  return () => { alive = false; };
}

// Defaults match current prod test endpoints; can be overridden at runtime via window.N8N_WEBHOOK_URL
const N8N_BASE = 'https://n8n.simplifies.click';
const WEBHOOK_INTAKE_DEFAULT = `${N8N_BASE}/webhook/sceneme`;
const STATUS_GET = `${N8N_BASE}/webhook/status`;

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

  // Safe JSON utilities (fallbacks if parent didn't pass handlers)
  function handleCopyJson() {
    try {
      const text = JSON.stringify({ ui }, null, 2);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
    } catch (e) { console.error('Copy JSON failed:', e); }
  }
  function handleDownloadJson() {
    try {
      const blob = new Blob([JSON.stringify({ ui }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ui-payload.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    } catch (e) { console.error('Download JSON failed:', e); }
  }

  // Submission + status UI (legacy-style inline feedback)
  const [busy, setBusy] = React.useState(false);
  const [jobId, setJobId] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [finalUrl, setFinalUrl] = React.useState('');
  const [showBanner, setShowBanner] = React.useState(false);
  // Show success banner only after a fresh submit signal and when we have a jobId/status
  React.useEffect(() => {
    try {
      const just = sessionStorage.getItem('just_submitted') === '1';
      if (just && (jobId || status)) {
        setShowBanner(true);
        sessionStorage.removeItem('just_submitted');
      }
    } catch {}
  }, [jobId, status]);

  // Listen for footer-driven submits and begin polling immediately
  React.useEffect(() => {
    function onNewJobId(e) {
      const jid = e?.detail?.jobId;
      const providedStatusUrl = e?.detail?.statusUrl;
      if (!jid) return;
      setJobId(jid);
      setStatus('QUEUED / PROCESSING');
      setShowBanner(true);
      try {
        if (sessionStorage.getItem('just_submitted') === '1') {
          setShowBanner(true);
          sessionStorage.removeItem('just_submitted');
        }
      } catch {}
      if (stopRef.current) { stopRef.current(); stopRef.current = null; }
      const statusUrl = providedStatusUrl || `${STATUS_GET}?jobId=${encodeURIComponent(jid)}`;
      stopRef.current = startAutoPoll({
        statusUrl,
        onUpdate: (rec) => { if (rec?.status) setStatus(String(rec.status).toUpperCase()); },
        onDone: (rec) => {
          setStatus('DONE');
          if (rec?.finalVideoUrl) setFinalUrl(rec.finalVideoUrl);
          setBusy(false);
          stopRef.current = null;
        },
        onError: (msg) => {
          setStatus('ERROR');
          console.error(msg);
          setBusy(false);
          stopRef.current = null;
        },
      });
    }
    window.addEventListener('interview:newJobId', onNewJobId);
    return () => window.removeEventListener('interview:newJobId', onNewJobId);
  }, []);
  const stopRef = React.useRef(null);

  React.useEffect(() => {
    // cleanup on unmount
    return () => { if (stopRef.current) stopRef.current(); };
  }, []);

  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const jid = url.searchParams.get('jobId') || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_job_id') : '');
      if (jid && !jobId) {
        setJobId(jid);
        setStatus('QUEUED / PROCESSING');
        try {
          if (sessionStorage.getItem('just_submitted') === '1') {
            setShowBanner(true);
            sessionStorage.removeItem('just_submitted');
          }
        } catch {}
        const statusUrl = `${STATUS_GET}?jobId=${encodeURIComponent(jid)}`;
        if (stopRef.current) { stopRef.current(); stopRef.current = null; }
        stopRef.current = startAutoPoll({
          statusUrl,
          onUpdate: (rec) => { if (rec?.status) setStatus(String(rec.status).toUpperCase()); },
          onDone: (rec) => {
            setStatus('DONE');
            if (rec?.finalVideoUrl) setFinalUrl(rec.finalVideoUrl);
            setBusy(false);
            stopRef.current = null;
          },
          onError: (msg) => {
            setStatus('ERROR');
            console.error(msg);
            setBusy(false);
            stopRef.current = null;
          },
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect jobId changes after submit (footer writes to URL/localStorage)
  React.useEffect(() => {
    let tries = 0;
    let timer = null;
    function check() {
      if (jobId) return; // already set
      try {
        const url = new URL(window.location.href);
        const jid = url.searchParams.get('jobId') || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_job_id') : '');
        if (jid) {
          setJobId(jid);
          setStatus('QUEUED / PROCESSING');
          try {
            if (sessionStorage.getItem('just_submitted') === '1') {
              setShowBanner(true);
              sessionStorage.removeItem('just_submitted');
            }
          } catch {}
          const statusUrl = `${STATUS_GET}?jobId=${encodeURIComponent(jid)}`;
          if (stopRef.current) { stopRef.current(); stopRef.current = null; }
          stopRef.current = startAutoPoll({
            statusUrl,
            onUpdate: (rec) => { if (rec?.status) setStatus(String(rec.status).toUpperCase()); },
            onDone: (rec) => {
              setStatus('DONE');
              if (rec?.finalVideoUrl) setFinalUrl(rec.finalVideoUrl);
              setBusy(false);
              stopRef.current = null;
            },
            onError: (msg) => {
              setStatus('ERROR');
              console.error(msg);
              setBusy(false);
              stopRef.current = null;
            },
          });
          return; // stop checking
        }
      } catch {}
      if (++tries < 15) timer = setTimeout(check, 800);
    }
    // Start short polling only if we have nothing yet
    if (!jobId && !status) check();
    return () => { if (timer) clearTimeout(timer); };
  }, [jobId, status]);

  async function handleSendToN8N() {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setBusy(true);
    setStatus('');
    setFinalUrl('');

    const n8nNoCors = (() => { try { return localStorage.getItem('n8nNoCors') === '1'; } catch { return false; } })();
    const intakeUrl = (typeof window !== 'undefined' && window.N8N_WEBHOOK_URL) || WEBHOOK_INTAKE_DEFAULT;

    const payload = {
      ui,
      meta: { source: 'interview-wizard', version: 'v1', ts: new Date().toISOString() },
    };

    try {
      const res = await fetch(intakeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(payload),
        mode: n8nNoCors ? 'no-cors' : 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });

      if (n8nNoCors) {
        setStatus('SUBMITTED');
        setBusy(false);
        return;
      }

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        alert(`Intake failed (${res.status}): ${t}`);
        setBusy(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const returnedJobId = data?.jobId || data?.jobID || data?.id || '';
      const statusUrl = data?.statusUrl || `${STATUS_GET}?jobId=${encodeURIComponent(returnedJobId)}`;

      if (returnedJobId) {
        try { localStorage.setItem('last_job_id', String(returnedJobId)); } catch {}
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('jobId', String(returnedJobId));
          window.history.replaceState({}, '', url);
        } catch {}
        try { sessionStorage.setItem('just_submitted', '1'); } catch {}
        try {
          window.dispatchEvent(new CustomEvent('interview:newJobId', {
            detail: {
              jobId: returnedJobId,
              statusUrl: typeof statusUrl !== 'undefined' ? statusUrl : undefined,
            }
          }));
        } catch {}
      }

      setJobId(returnedJobId);
      setStatus('QUEUED / PROCESSING');

      stopRef.current = startAutoPoll({
        statusUrl,
        onUpdate: (rec) => { if (rec?.status) setStatus(String(rec.status).toUpperCase()); },
        onDone: (rec) => {
          setStatus('DONE');
          if (rec?.finalVideoUrl) setFinalUrl(rec.finalVideoUrl);
          setBusy(false);
          stopRef.current = null;
        },
        onError: (msg) => {
          setStatus('ERROR');
          alert(msg);
          setBusy(false);
          stopRef.current = null;
        },
      });
    } catch (e) {
      console.error('Submit error:', e);
      alert('Failed to process submission.');
      setBusy(false);
    }
  }

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

      {/* Inline submission/status controls (legacy-style) */}
      <div style={{ marginBottom: 12, padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
        {showBanner && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            borderRadius: 8,
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 600 }}>Submission received.</span>
            <span style={{ opacity: 0.9 }}>We’re processing your video now.</span>
          </div>
        )}

        {finalUrl && (
          <div className="mt-2" style={{ marginTop: 10 }}>
            <a className="text-indigo-700 underline" href={finalUrl} target="_blank" rel="noreferrer">
              Open final video
            </a>
            <div style={{ marginTop: 8 }}>
              <video src={finalUrl} controls className="w-full" style={{ maxWidth: 720, borderRadius: 8, border: '1px solid #E5E7EB' }} />
            </div>
          </div>
        )}
      </div>

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
              <Field label="Music volume (0.1–1.0)" value={safe(ui?.advanced?.musicVolume)} />
              <Field label="Voice volume (0.1–1.0)" value={safe(ui?.advanced?.voiceVolume)} />
            </>
          ) : null}
        </Section>
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div className="text-sm" style={{ fontSize: 12 }}>
            <strong>Job:</strong> {jobId || '—'} &nbsp; | &nbsp;
            <strong>Status:</strong> {status || '—'}
          </div>
          <div style={{ fontSize: 12, color: '#7c3aed' }}>
            Heads up: renders can take a few minutes. You can leave this tab open.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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