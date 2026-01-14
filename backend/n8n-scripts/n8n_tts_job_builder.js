// TTS Job Builder → RunPod/Higgs API mapper
// INPUT: items[0].json.tts = { segments, voices, wps, route, title, voice_ref_url, piggybank:{voice:{id,displayName}} }
// OUTPUT: One item PER segment (mode: "single")

const root = items[0]?.json || {};
const tts = root.tts || {};

const segments = Array.isArray(tts.segments) ? tts.segments : [];
const voices = Array.isArray(tts.voices) ? tts.voices : [];
const globalRef = String(tts.voice_ref_url || '');
const piggyVoice = tts.piggybank?.voice || {};

// ---- HELPER: Text Sanitization ----
function sanitizeText(s) {
    let t = (s == null ? '' : String(s));
    t = t
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201F]/g, '"')
        .replace(/\u2026/g, '...');
    t = t
        .replace(/[\u0000-\u001F\u2028\u2029]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return t;
}

// ---- HELPER: Voice Resolution ----
const voiceMap = new Map(
    voices
        .filter(v => v?.voiceId)
        .map(v => [String(v.voiceId), { ...v, voiceId: String(v.voiceId) }])
);

function pickVoiceFor(seg) {
    const segVid = seg.voiceId ? String(seg.voiceId) : '';
    if (segVid && voiceMap.has(segVid)) return voiceMap.get(segVid);
    if (piggyVoice?.id) {
        return {
            voiceId: String(piggyVoice.id),
            name: String(piggyVoice.displayName || ''),
        };
    }
    return { voiceId: segVid, name: '' };
}

// ---------------------------------------------------------
// BUILD INDIVIDUAL JOBS
// ---------------------------------------------------------
const jobs = segments.map(seg => {
    const txt = sanitizeText(seg.text || '');
    if (!txt) return null;

    const v = pickVoiceFor(seg);

    // 1. Identify potential sources
    const vid = v.voiceId;
    const localRef = String(seg.voice_ref_url || seg.speaker_reference_url || '');

    // 2. Logic: Priority to Refs (Global > Local > Recording)
    let finalRef = null;
    let finalVid = null;

    if (globalRef) {
        finalRef = globalRef;
    } else if (localRef) {
        finalRef = localRef;
    } else if (vid === "recording" && localRef) { // Explicit "recording" + url
        finalRef = localRef;
    } else if (vid && vid !== "None" && vid !== "recording") {
        finalVid = vid;
    }

    // 3. Construct Turn
    const turn = {
        text: txt,
        speaker: v.name || "Narrator",
        pause_duration: 0.2
    };

    if (finalRef) {
        turn.ref_audio_urls = [finalRef]; // Clone path
    } else {
        turn.voice_id = finalVid || "en_us_001"; // Standard path
    }

    // 4. Construct Payload (MULTI Mode - Single Turn)
    // User Requirement: Keep mode "multi" but send one turn at a time
    const payload = {
        mode: "multi",
        dialogue: [turn], // Array of 1
        sample_rate: 24000,
        max_new_tokens: 1200,
        temperature: 0.3
    };

    // 5. Construct IDs
    // beatId -> input or "B01"
    // shotId -> input or "S03"
    // segId  -> input segId or id
    const segId = String(seg.segId || seg.id || '');
    const beatId = String(seg.beatId || 'B01');
    const shotId = String(seg.shotId || 'S01');

    // shotKey -> input or SEG-BEAT-SHOT
    let shotKey = String(seg.shotKey || '');
    if (!shotKey && segId) {
        shotKey = `${segId}-${beatId}-${shotId}`;
    }

    // 6. Return Item Wrapper
    return {
        json: {
            input: payload, // Wrapped in input for standard API structure

            // Metadata for downstream mapping (per job)
            _expect: {
                id: String(seg.id || seg.shotId || ''),
                text: txt,
                targetSec: seg.targetSec,
                shotKey: shotKey,
                segId: segId,
                beatId: beatId,
                shotId: shotId,
                type: seg.type || null
            }
        }
    };
}).filter(Boolean); // Remove nulls (empty text)

return jobs;
