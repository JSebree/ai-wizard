
import { processVideoJob } from './director';
import { ProjectPayload } from './types';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function runTest() {
    console.log("Starting End-to-End Test...");

    const payload: ProjectPayload = {
        userId: "test-user-123",
        vodId: uuidv4(),
        driver: "narrator", // B-Roll route for simplicity/speed or "character" for A-Roll
        // Let's test "Combo" implicitly by asking for character + b-roll logic?
        // Actually, let's test B-Roll Route first as it initiates the complex remote render with narration
        route: 'broll',

        title: "Test: Future of AI",
        sceneDescription: "A futuristic city with flying cars and neon lights.",
        settingDescription: "Cyberpunk City",
        characterDescription: "None", // Narrator only

        durationSec: 20, // 20s as requested
        aspectRatio: "9:16",

        // Enable NEW features
        research: true,  // Test Agentic Research
        doMusic: true,   // Test Music
        musicPrompt: "Cyberpunk synthwave, energetic",
        doCaptions: true, // Test Captions
        doUpscale: false, // Skip Upscale for this quick test (it takes long) to fail-fast
        // doUpscale: true, // Uncomment to test upscale later

        webhookUrl: "https://httpbin.org/post" // Dummy webhook
    };

    console.log("Payload:", JSON.stringify(payload, null, 2));

    try {
        const jobMock: any = {
            id: `job-${Date.now()}`,
            data: payload,
            updateProgress: (p: number) => console.log(`[Job Progress] ${p}%`)
        };

        const result = await processVideoJob(jobMock);
        console.log("Test Complete!");
        console.log("Result:", result);
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

runTest();
