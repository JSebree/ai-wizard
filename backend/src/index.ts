import Fastify from 'fastify';
import cors from '@fastify/cors';
import { CONFIG } from './config';
import { supabase } from './db';
import { setupWorker, videoQueue } from './queue';

const server = Fastify({ logger: true });

// Register CORS
server.register(cors, {
    origin: '*', // Allow all for dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Health Check
server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date(), env: process.env.NODE_ENV };
});

// Test Connection Endpoint
server.get('/api/test-db', async () => {
    const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { message: 'Supabase connected', count: data };
});

// Test Queue Endpoint
server.post('/api/test-queue', async (req, reply) => {
    const job = await videoQueue.add('test-job', { foo: 'bar', timestamp: Date.now() });
    return { message: 'Job added', jobId: job.id };
});

// Real Generation Endpoint
server.post('/api/generate', async (req: any, reply) => {
    const payload = req.body;
    // Basic Validation
    if (!payload.userId) return reply.status(400).send({ error: "Missing userId" });

    const job = await videoQueue.add('express-video', payload);
    return { message: 'Generation started', jobId: job.id };
});

// Keyframe Generation Endpoint (Direct, synchronous-ish)
server.post('/api/generate-keyframe', async (req: any, reply) => {
    const payload = req.body;
    console.log("[Keyframe] Received request:", payload.asset_type, payload.prompt?.substring(0, 30));

    // Collect images (filter out null/empty)
    const images: string[] = [
        payload.input_image,
        payload.setting_image_url,
        payload.character_image_url,
        payload.prop_image_url
    ].filter((url): url is string => !!url && url.length > 0);

    // Map to KeyframeInput
    const input = {
        prompt: payload.prompt,
        image_urls: images,
        strength: payload.parameters?.edit_strength, // For modification
        width: 1024, // Default to 16:9 cinematic
        height: 576
    };

    try {
        // Dynamic import to avoid circular dep issues if any, or just convenience
        const { generateKeyframe } = await import('./engine/assets/images');
        const result = await generateKeyframe(input);
        return result; // { image_url: "...", jobId: "..." }
    } catch (err: any) {
        console.error("[Keyframe] Error:", err);
        return reply.status(500).send({ error: err.message || "Keyframe generation failed" });
    }
});

// B-Roll Video Generation
server.post('/api/generate-video', async (req: any, reply) => {
    const payload = req.body;
    console.log("[Video] B-Roll Request:", payload.prompt?.substring(0, 30));

    // Map payload to BRollInput
    // Aligning frame rates: Frontend sends frames assuming 30fps. LTX uses 24fps.
    // To preserve frame count: duration = num_frames / 24.
    let duration = 4.0;
    if (payload.num_frames) {
        duration = payload.num_frames / 24.0;
    } else if (payload.duration) {
        duration = payload.duration;
    }

    const input = {
        image_url: payload.image_url,
        prompt: payload.prompt,
        duration_sec: duration
    };

    try {
        const { generateBRollVideo } = await import('./engine/assets/video');
        const result = await generateBRollVideo(input);

        // [Persistence] Update Supabase if ID provided
        const clipId = payload.id || payload.clip_id;
        if (clipId) {
            console.log(`[Video] Updating Supabase for Clip ${clipId}...`);
            await supabase.from('clips').update({
                video_url: result.video_url,
                last_frame_url: result.last_frame_url,
                // We don't verify status here to avoid racing with frontend SFX logic, 
                // but ensuring the URL is saved is critical for "Resume" functionality.
            }).eq('id', clipId);
        }

        return result;
    } catch (err: any) {
        console.error("[Video] B-Roll Error:", err);
        return reply.status(500).send({ error: err.message });
    }
});

// A-Roll (LipSync) Generation
server.post('/api/generate-lipsync', async (req: any, reply) => {
    const payload = req.body;
    console.log("[Video] A-Roll Request:", payload.audio_url);

    // generateARollVideo uses 30fps.
    let duration = 3.0;
    if (payload.num_frames) {
        duration = payload.num_frames / 30.0;
    } else if (payload.duration) {
        duration = payload.duration;
    }

    const input = {
        image_url: payload.image_url,
        audio_url: payload.audio_url,
        duration_sec: duration
    };

    try {
        const { generateARollVideo } = await import('./engine/assets/video');
        const result = await generateARollVideo(input);

        // [Persistence] Update Supabase if ID provided
        const clipId = payload.id || payload.clip_id;
        if (clipId) {
            console.log(`[Video] Updating Supabase for Clip ${clipId}...`);
            await supabase.from('clips').update({
                video_url: result.video_url,
                last_frame_url: result.last_frame_url,
            }).eq('id', clipId);
        }

        return result;
    } catch (err: any) {
        console.error("[Video] A-Roll Error:", err);
        return reply.status(500).send({ error: err.message });
    }
});

// Voice Generation
server.post('/api/generate-voice', async (req: any, reply) => {
    const payload = req.body;
    // Payload: { dialogue: [{ text, speaker, voice_id, ... }] }
    const turn = payload.dialogue?.[0];
    if (!turn) return reply.status(400).send({ error: "Missing dialogue" });

    console.log("[Voice] Request:", turn.text?.substring(0, 30));

    const input = {
        text: turn.text,
        speaker: turn.speaker,
        voiceId: turn.voice_id,
        voice_ref_url: turn.ref_audio_urls?.[0]
    };

    try {
        const { generateVoice } = await import('./engine/assets/voice');
        const result = await generateVoice(input);
        return result;
    } catch (err: any) {
        console.error("[Voice] Error:", err);
        return reply.status(500).send({ error: err.message });
    }
});

server.get('/api/status/:id', async (req: any, reply) => {
    const jobId = req.params.id;
    const job = await videoQueue.getJob(jobId);
    if (!job) return reply.status(404).send({ error: 'Job not found' });

    const state = await job.getState();
    const progress = await job.progress; // bullmq v5 getter usually, but safe to await if needed

    return {
        id: job.id,
        state,
        progress,
        data: job.data, // Contains our custom 'status' object if we update it
        returnvalue: job.returnvalue,
        failedReason: job.failedReason
    };
});

const start = async () => {
    try {
        setupWorker(); // Start the background worker
        await server.listen({ port: Number(CONFIG.PORT), host: '0.0.0.0' });
        console.log(`Server listening on port ${CONFIG.PORT}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
