
import { generateCaptions } from './engine/assets/captions';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from repo root (one level up from backend) and backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runTest() {
    console.log("Starting Independent Captions Test...");
    console.log("Target Webhook: https://n8n.simplifies.click/webhook/render-captions");

    // Use a real video URL from a previous run to ensure n8n has something to process if it wants to
    const testInput = {
        video_url: "https://nyc3.digitaloceanspaces.com/media-catalog/renders/baby_zuck_part_4_1768365584045.mp4",
        requestId: "test-manual-" + Date.now(),
        doUpscale: true // Test that this flag is passed
    };

    try {
        const result = await generateCaptions(testInput);
        console.log("---------------------------------------------------");
        console.log("✅ TEST PASSED");
        console.log("Result received:", result);
        console.log("---------------------------------------------------");
    } catch (error) {
        console.error("---------------------------------------------------");
        console.error("❌ TEST FAILED");
        console.error(error);
        console.error("---------------------------------------------------");
    }
}

runTest();
