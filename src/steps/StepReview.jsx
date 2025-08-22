// src/steps/StepReview.jsx
import React from 'react';
import { STYLE_LIBRARY } from "./styleLibraryMap";

/* ================= N8N STATUS CLIENT ================= */
function startAutoPoll({ statusUrl, onUpdate, onDone, onError }) {
  let delay = 2000;
  const maxDelay = 8000;
  let alive = true;

  async function tick() {
    if (!alive) return;
    try {
      const res = await fetch(statusUrl, { method: 'GET' });
      const j = await res.json();
      if (j.ok === false) {
        onError?.(j.error || 'Unknown status error');
        alive = false;
        return;
      }
      onUpdate?.(j);

      const s = String(j.status || '').toUpperCase();
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
  return () => {
    alive = false;
  };
}

/* ================= CONSTANTS ================= */
const N8N_BASE = 'https://n8n.simplifies.click';
const WEBHOOK_INTAKE = `${N8N_BASE}/webhook/sceneme`;
const STATUS_GET     = `${N8N_BASE}/webhook/status`;

/* Build the payload orchestrator expects */
function buildPayloadFromState(state) {
  const mi = state.minimalInput || state.minimal || {};
  const characters = Array.isArray(mi.characters)
    ? mi.characters
    : state.character
    ? [{
        id: 'char1',
        name: state.character.name || 'Host',
        voiceSelectionName: state.character.voiceSelectionName || '',
        voiceId: state.character.voiceId || '',
      }]
    : [];

  const mergedFromForm = {
    title: mi.title || state?.title || '',
    subject: mi.subject || '',
    videoType: mi.videoType || mi.route || 'aroll',
    durationSec: mi.durationSec ?? state?.durationSec ?? 30,
    resolution: mi.resolution || null,
    fps: mi.fps ?? state?.flags?.fps ?? 30,
    includeCaptions: Boolean(state?.flags?.captions ?? true),
    includeMusic: Boolean(state?.flags?.music ?? true),
    characters,
    personaMeta: {
      name: state?.character?.name || characters?.[0]?.name || 'Host',
      alias: mi.title || '',
      packId: state?.character?.personaPack || null,
      kind: state?.character?.personaKind || 'human',
    },
    referenceText: mi.referenceText || state?.minimalInput?.referenceText || '',
    packs: {
      stylePack:  state?.setting?.stylePack  || null,
      lookPack:   state?.character?.lookPack || null,
      accentPack: null,
      motionPack: state?.setting?.motionPack || null,
      musicPack:  state?.music?.musicPack    || null,
      personaPack:state?.character?.personaPack || null,
      propsPack:  state?.setting?.propsPack  || null,
      mouthPack:  state?.setting?.mouthPack  || null,
      basePack:   state?.setting?.base       || null,
    },
    packIds: undefined,
    style: mi.style || state?.minimalInput?.style || '',
    tone:  mi.tone  || state?.minimalInput?.tone  || '',
    template: state?.template || 'Studio Podcast',
    submittedAt: new Date().toISOString(),
    formMode: 'wizard',
  };

  return {
    packsLibraryVersion: 1,
    mergedFromForm,
    flags:   state.flags   || {},
    setting: state.setting || {},
    music:   state.music   || {},
    rawState:{ ...state },
  };
}

/* ================= REVIEW STEP ================= */
function ReviewComponent({ state }) {
  const [busy, setBusy]     = React.useState(false);
  const [jobId, setJobId]   = React.useState('');
  const [status, setStatus] = React.useState('');
  const [finalUrl, setFinalUrl] = React.useState('');
  const stopRef = React.useRef(null);

  React.useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);

  async function handleSend() {
    setBusy(true);
    setJobId('');
    setStatus('');
    setFinalUrl('');
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }

    const payload = buildPayloadFromState(state);

    let res;
    try {
      res = await fetch(WEBHOOK_INTAKE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      alert('Failed to processes submission.');
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
    const returnedJobId = data.jobId || data.jobID || data.id || '';
    const statusUrl = data.statusUrl || `${STATUS_GET}?jobId=${encodeURIComponent(returnedJobId)}`;

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
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={busy}
          className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send to n8n'}
        </button>
        <div className="text-sm">
          <strong>Job:</strong> {jobId || '—'} &nbsp; | &nbsp;
          <strong>Status:</strong> {status || '—'}
        </div>
      </div>

      {finalUrl && (
        <div className="mt-2">
          <a className="text-indigo-700 underline" href={finalUrl} target="_blank" rel="noreferrer">
            Open final video
          </a>
          <div className="mt-2">
            <video src={finalUrl} controls className="w-full max-w-xl rounded border" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewComponent;
export { ReviewComponent as StepReview, startAutoPoll };