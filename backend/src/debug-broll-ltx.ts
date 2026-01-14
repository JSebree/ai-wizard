
import { processVideoJob } from './director';
import { ProjectPayload } from './types';
import dotenv from 'dotenv';
import path from 'path';

// Load envs
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const payload: ProjectPayload = {
    userId: 'test-user',
    title: 'Debug LTX2 Handoff',
    sceneDescription: "A cyberpunk city at night with neon lights.",
    driver: 'narrator', // Triggers B-Roll
    route: 'broll',     // Explicitly set
    durationSec: 10,
    wantsMusic: false,
    wantsCaptions: false,
    doMusic: false,
    doCaptions: false,
    doUpscale: false,
    research: false, // Ensure no research
    vodId: '00000000-0000-0000-0000-000000000000' // Fake ID
};

console.log("Starting Debug Job...");

// Mock Job object
const mockJob: any = {
    data: payload,
    id: 'debug-job-1'
};

processVideoJob(mockJob)
    .then(res => console.log("Job Success:", res))
    .catch(err => console.error("Job Failed:", err));
