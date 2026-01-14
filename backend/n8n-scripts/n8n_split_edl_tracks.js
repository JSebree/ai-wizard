// Split EDL Tracks (lip-sync A-roll → validated, audio-enabled; B-roll passthrough)

const input = $json || {};
const a = input.aroll_edl ?? null;
const b = input.broll_edl ?? null;

function getVideoTrack(edl) {
    const tracks = edl?.tracks?.video;
    if (!Array.isArray(tracks) || tracks.length === 0) return null;
    return tracks[0]; // upstream builds a single video track per EDL
}

// --- validation helpers (sceneId is OPTIONAL for lip-sync output) ---
function requireIds(clip) {
    const need = ["segId", "beatId", "shotId", "shotKey", "src"];
    const missing = need.filter(k => clip[k] == null || clip[k] === "");
    if (missing.length) {
        throw new Error(`Clip ${clip.id ?? "(no-id)"} missing required fields: ${missing.join(", ")}`);
    }
}

const toNum = (x, d = 0) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
};
const to3 = (x) => (toNum(x) || 0).toFixed(3);

// --- A-ROLL (lip-sync) ---
let arollOut = null;
const aTrack = getVideoTrack(a);

if (aTrack) {
    // keep only type:'aroll' (defensive)
    const rawAroll = (aTrack.clips || []).filter(
        c => String(c?.type || "").toLowerCase() === "aroll"
    );

    // validate and normalize each clip
    const arollClips = rawAroll.map((c) => {
        // --- [PATCH START] Infer beatId if missing ---
        if ((!c.beatId || c.beatId === "") && c.shotKey) {
            // Expected format: "SEG-01-B01-SEG-01" or similar
            // We look for a pattern "-Bxx-" where xx are digits
            const match = c.shotKey.match(/-([B]\d+)(?:-|$)/);
            if (match && match[1]) {
                c.beatId = match[1];
            } else {
                // Fallback: simple check if shotKey IS the beatId or similar logic?
                // For now, rely on regex. If check fails, requireIds will throw below.
            }
        }
        // --- [PATCH END] ---

        requireIds(c);

        // prefer lip-sync aligned duration if available
        const meta = c._meta || {};
        const aligned = toNum(meta.aligned_out_sec);
        const lipsyncOut = toNum(meta.lipsync_out_sec);
        const voiceDur = toNum(meta.voice_duration_sec);

        const inn = toNum(c.in, 0);
        // choose 'out' in priority order: explicit out → aligned_out_sec → lipsync_out_sec → in + voice_duration
        let out = (Number.isFinite(toNum(c.out)) && toNum(c.out) >= inn)
            ? toNum(c.out)
            : (aligned > 0 ? aligned
                : (lipsyncOut > 0 ? lipsyncOut
                    : (voiceDur > 0 ? inn + voiceDur : inn)));

        // Ensure out >= in
        if (out < inn) out = inn;

        // mark that embedded audio is present/safe to use downstream
        const withAudioFlags = {
            hasAudio: true,
            audio: true,
            _meta: { ...(c._meta || {}), hasAudio: true }
        };

        // keep lip-sync video src exactly (DO NOT swap to base_video_url)
        const normalized = {
            ...c,
            in: inn,
            out,
            type: "aroll",
            ...withAudioFlags
        };

        // best-effort poster fallback
        if (!normalized.poster && meta.poster) normalized.poster = meta.poster;

        return normalized;
    });

    if (arollClips.length === 0) {
        throw new Error("A-roll track present but contains no type:'aroll' clips.");
    }

    // recompute total length from in/out (non-negative)
    const totalLen = arollClips.reduce((s, c) => {
        const d = Math.max(0, toNum(c.out) - toNum(c.in, 0));
        return s + d;
    }, 0);

    // write back filtered + normalized A-roll
    const arollEDL = {
        ...a,
        tracks: {
            ...a?.tracks,
            video: [
                { ...aTrack, name: "aroll", clips: arollClips }
            ]
        },
        fps: a?.fps ?? aTrack?._meta?.fps ?? 30,
        length_sec: Number(totalLen.toFixed(3)),
    };

    arollOut = { json: { track: "aroll", source: "combo", edl: arollEDL } };
}

// --- B-ROLL (pass-through if present; you can filter to type:'broll' if desired) ---
let brollOut = null;
const bTrack = getVideoTrack(b);

if (bTrack) {
    // Optionally: const brollClips = (bTrack.clips||[]).filter(c => String(c.type).toLowerCase()==="broll");
    brollOut = { json: { track: "broll", source: "broll-subflow", edl: b } };
}

// Hard-require A-roll for this workflow
if (!arollOut) {
    throw new Error("No A-roll EDL present (track missing or empty).");
}

return brollOut ? [arollOut, brollOut] : [arollOut];
