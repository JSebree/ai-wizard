
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { processVideoJob } from './director';
import { ProjectPayload } from './types';
import { Job } from 'bullmq';

// Mock BullMQ Job
const mockJob = {
    id: "test-job-" + Date.now(),
    data: {
        userId: "test-user",
        title: "Test Viral Video",
        driver: "narrator", // simpler for first run
        sceneDescription: "A futuristic city with flying cars",
        durationSec: 10, // short for test
        aspectRatio: "9:16",
        wantsMusic: true
    } as ProjectPayload,
    updateProgress: async (p: number) => console.log(`[Progress]: ${p}%`),
    updateData: async (d: any) => console.log(`[Data Update]:`, d.status?.message)
} as unknown as Job<ProjectPayload>;

async function run() {
    console.log("Starting Test Job...");
    try {
        const result = await processVideoJob(mockJob);
        console.log("Job Complete!", result);
        console.log("Check output folder for video.");
    } catch (e) {
        console.error("Job Failed", e);
    }
}

run();
