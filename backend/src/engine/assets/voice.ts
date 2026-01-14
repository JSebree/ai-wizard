
import { CONFIG } from '../../config';

// RunPod endpoint for Character Voice (Higgs/XTTS likely)
const ENDPOINT_TTS = "https://api.runpod.ai/v2/vms8w05ymko04a/run";
const ENDPOINT_STATUS = "https://api.runpod.ai/v2/vms8w05ymko04a/status";

export interface VoiceInput {
    text: string;
    speaker?: string; // e.g. "Narrator"
    voiceId?: string; // "en_us_001", "recording" or specific UUID
    voice_ref_url?: string; // For cloning/ref
}

export interface VoiceOutput {
    audio_url: string;
    duration_sec: number;
    jobId: string;
}

export async function generateVoice(input: VoiceInput): Promise<VoiceOutput> {
    console.log(`[Voice] Generating TTS: "${input.text.substring(0, 30)}..."`);

    // 1. Prepare Turn
    // Logic from Character Voice Builder.json:
    // ref > local ref > recording > voiceId

    const turn: any = {
        text: input.text,
        speaker: input.speaker || "Narrator",
        pause_duration: 0.2
    };

    if (input.voice_ref_url) {
        turn.ref_audio_urls = [input.voice_ref_url];
    } else {
        const defaultVoice = "fe3b2cea-969a-4b5d-bc90-fde8578f1dd5"; // Emma
        let vId = input.voiceId;
        if (!vId || vId === "en_us_001") vId = defaultVoice;
        turn.voice_id = vId;
    }

    // 2. Construct Payload (Multi Mode, Single Turn)
    // Modeled after "Character Voice Builder" n8n workflow
    const payload = {
        input: {
            mode: "multi",
            dialogue: [turn],
            sample_rate: 24000,
            max_new_tokens: 1200,
            temperature: 0.3
        }
    };

    // 3. Retry Loop
    let lastError: Error | null = null;
    const maxRetries = 5; // Increased to 5 (User Request)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Voice] Glitch Check Attempt ${attempt}/${maxRetries}...`);
            const jobOut = await executeVoiceJob(ENDPOINT_TTS, payload);

            // 4. Glitch Detection (Tighter threshold: 2x)
            const wordCount = input.text.split(/\s+/).length;
            const expectedDur = Math.max(1, wordCount / 2.5); // ~150 wpm
            const threshold = expectedDur * 2.0; // Strict 2x limit to catch glitches early

            if (jobOut.duration_sec > threshold) {
                console.warn(`[Voice] Glitch Detected! Duration ${jobOut.duration_sec.toFixed(1)}s exceeds limit ${threshold.toFixed(1)}s (text: ${wordCount} words). Retrying...`);
                if (attempt === maxRetries) {
                    throw new Error(`Voice Glitch: Duration ${jobOut.duration_sec}s > ${threshold}s limit. Aborting to save GPU cost.`);
                }
                continue; // Retry
            }

            return jobOut;
        } catch (err: any) {
            console.error(`[Voice] Attempt ${attempt} failed: ${err.message}`);
            lastError = err;
            if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000));
        }
    }

    throw lastError || new Error("Voice Gen Failed after retries");
}

async function executeVoiceJob(endpoint: string, payload: any): Promise<VoiceOutput> {
    const startRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!startRes.ok) throw new Error(`Voice Start Failed: ${startRes.statusText}`);
    const startData: any = await startRes.json();
    const jobId = startData.id;
    console.log(`[Voice] Job started: ${jobId}`);

    // Poll
    let attempts = 0;
    while (attempts < 60) {
        await new Promise(r => setTimeout(r, 1500));
        attempts++;

        const statusRes = await fetch(`${ENDPOINT_STATUS}/${jobId}`, {
            headers: { 'Authorization': `Bearer ${CONFIG.RUNPOD_API_KEY}` }
        });
        if (!statusRes.ok) continue;
        const statusData: any = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
            const output = statusData.output;
            let audioUrl = output.audio_url || output.url || output.output?.audio_url;

            let dur = 0;
            if (output.duration_sec) dur = output.duration_sec;
            else if (output.duration_samples && output.sampling_rate) dur = output.duration_samples / output.sampling_rate;
            // Handle array output logic...
            if (Array.isArray(output) && output[0]?.url) {
                audioUrl = output[0].url;
                dur = output[0].duration || 0;
            }

            if (audioUrl) {
                return { audio_url: audioUrl, duration_sec: dur, jobId };
            }
        } else if (statusData.status === 'FAILED') {
            throw new Error(`Voice Failed: ${JSON.stringify(statusData.error)}`);
        }
    }
    throw new Error("Voice Gen Timeout");
}
