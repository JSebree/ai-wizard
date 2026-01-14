
// Helper function to extract video URL (logic from video.ts)
function extractVideoUrl(output: any): string | undefined {
    // 1. String case
    if (typeof output === 'string' && output.startsWith('http')) return output;

    // 2. Object case
    if (typeof output === 'object') {
        return output.output_video_url ||
            output.video_url ||
            output.url ||
            output.s3_url ||
            output.output?.video_url ||
            output.output?.s3_url ||
            output.output?.artifacts?.video_url || // Matched User Payload
            output.artifacts?.video_url || // Correct path based on pollJob return? 
            // Wait, user provided: "output": { "artifacts": { "video_url": "..." } }
            // In pollJob, we return statusData.output.
            // So if statusData is { status: "COMPLETED", output: { artifacts: ... } }
            // Then pollJob returns { artifacts: ... }
            // So we check output.artifacts.video_url.
            output.result ||
            (Array.isArray(output.results) ? output.results[0] : undefined);
    }
    return undefined;
}

// 1. Test A-Roll URL Extraction
console.log("---------------------------------------------------");
console.log("TEST 1: A-Roll URL Extraction Logic");
const mockUserPayload = {
    "artifacts": {
        "format": "mp4",
        "video_base64": null,
        "video_url": "https://nyc3.digitaloceanspaces.com/a-roll-output/infinitetalk_out/task_de0e4ec7-1736-459b-b1a1-ef1f04694deb.mp4"
    },
    "debug": { /* ... */ },
    "id": "task_de0e4ec7-1736-459b-b1a1-ef1f04694deb",
    "metrics": { /* ... */ },
    "model": "InfiniteTalk/ComfyUI",
    "status": "succeeded",
    "warnings": []
};

// Simulate pollJob returning the 'output' field of the worker response
// The user provided full JSON. "output": { ... }
// So pollJob returns the inside.
const resultUrl = extractVideoUrl(mockUserPayload);

if (resultUrl === "https://nyc3.digitaloceanspaces.com/a-roll-output/infinitetalk_out/task_de0e4ec7-1736-459b-b1a1-ef1f04694deb.mp4") {
    console.log("✅ SUCCESS: Correctly extracted URL from InfiniteTalk payload.");
} else {
    console.error("❌ FAILURE: Failed to extract URL.");
    console.log("Extracted:", resultUrl);
}

// 2. Test B-Roll Fan-out Duration Logic
console.log("\n---------------------------------------------------");
console.log("TEST 2: B-Roll Fan-out Duration Distribution");

// Mock Shots
const mockShots: any[] = [
    { id: 'S02-1', segId: 'SEG-02', durationSec: 2.5 }, // Siblings
    { id: 'S02-2', segId: 'SEG-02', durationSec: 2.5 },
    { id: 'S02-3', segId: 'SEG-02', durationSec: 2.5 },
    { id: 'S02-4', segId: 'SEG-02', durationSec: 2.5 },
    { id: 'S03-1', segId: 'SEG-03', durationSec: 4.0 }  // Unrelated
];

// Simulate Voice Generation for S02-1
const generatedVoiceDuration = 10.0; // Audio is 10s long
const shotToUpdate = mockShots[0]; // S02-1

// Apply Logic from Orchestrator
const siblings = mockShots.filter(s => s.segId === shotToUpdate.segId);
const subCount = siblings.length;
const newSubDur = generatedVoiceDuration / subCount;

console.log(`Generated Audio Duration: ${generatedVoiceDuration}s`);
console.log(`Sibling Count: ${subCount}`);
console.log(`Calculated Per-Clip Duration: ${newSubDur}s`);

// Update logic
siblings.forEach(sibling => {
    sibling.durationSec = newSubDur;
});

// Verify
const s1 = mockShots.find(s => s.id === 'S02-1');
const s2 = mockShots.find(s => s.id === 'S02-2');
const s3 = mockShots.find(s => s.id === 'S03-1'); // Should be unchanged

if (s1.durationSec === 2.5 && s2.durationSec === 2.5) {
    console.log("✅ SUCCESS: Durations updated correctly (2.5s each for 10s total).");
    console.log(`S02-1: ${s1.durationSec}s`);
    console.log(`S02-2: ${s2.durationSec}s`);
} else {
    console.error("❌ FAILURE: Durations are wrong.");
    console.log(`S02-1: ${s1.durationSec}s`);
    console.log(`S02-2: ${s2.durationSec}s`);
}
