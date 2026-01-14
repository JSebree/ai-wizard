
interface Shot {
    id: string;
    segId: string;
    type: 'aroll' | 'broll';
    imageUrl?: string;
    videoUrl?: string;
    voiceUrl?: string;
    voiceDurationSec?: number;
    durationSec: number;
}

interface Clip {
    id: string;
    src: string;
    type?: 'video' | 'image' | 'audio';
    in: number;
    out: number;
    timelineStart: number;
    timelineEnd: number;
    segId?: string;
}

function buildEDL(shots: Shot[]) {
    const videoClips: Clip[] = [];
    const audioClips: Clip[] = [];

    let timelineCursor = 0;

    shots.forEach(shot => {
        const dur = shot.durationSec;

        // Video Track
        videoClips.push({
            id: shot.id,
            src: shot.videoUrl || shot.imageUrl || "",
            in: 0,
            out: dur,
            timelineStart: timelineCursor,
            timelineEnd: timelineCursor + dur,
            type: shot.videoUrl ? 'video' : 'image',
            segId: shot.segId
        });

        // Audio Track - COPIED LOGIC
        const isARollFallback = shot.type === 'aroll' && !shot.videoUrl;

        // Debugging the condition
        const isBRoll = shot.type === 'broll';
        const hasVoice = !!shot.voiceUrl;
        const hasVoiceDur = !!shot.voiceDurationSec;

        if ((shot.type === 'broll' || isARollFallback) && shot.voiceUrl && shot.voiceDurationSec) {
            audioClips.push({
                id: `${shot.id}_audio`,
                src: shot.voiceUrl,
                in: 0,
                out: shot.voiceDurationSec,
                timelineStart: timelineCursor,
                timelineEnd: timelineCursor + shot.voiceDurationSec,
                type: 'audio',
                segId: shot.segId
            });
        }

        timelineCursor += dur;
    });

    return {
        tracks: {
            video: { clips: videoClips },
            audio: [{ name: 'voiceover', clips: audioClips }]
        }
    };
}

// MOCK DATA (Scenario: Fan-out B-Roll)
const mockShots: Shot[] = [
    // S02-1: Owns the audio (10s), but video is 2.5s
    {
        id: 'S02-1', segId: 'SEG-02', type: 'broll',
        imageUrl: 'http://img1', videoUrl: 'http://vid1',
        voiceUrl: 'http://voice.mp3', voiceDurationSec: 10.0,
        durationSec: 2.5
    },
    // S02-2: Silent sibling
    {
        id: 'S02-2', segId: 'SEG-02', type: 'broll',
        imageUrl: 'http://img2', videoUrl: 'http://vid2',
        // No voice properties
        durationSec: 2.5
    },
    // S02-3: Silent sibling
    {
        id: 'S02-3', segId: 'SEG-02', type: 'broll',
        imageUrl: 'http://img3', videoUrl: 'http://vid3',
        // No voice properties
        durationSec: 2.5
    }
];

const result = buildEDL(mockShots);
const audioTrack = result.tracks.audio[0];

console.log("Audio Clips Found:", audioTrack.clips.length);
if (audioTrack.clips.length > 0) {
    console.log("Clip 1:", JSON.stringify(audioTrack.clips[0], null, 2));
    if (audioTrack.clips[0].id === 'S02-1_audio') {
        console.log("✅ SUCCESS: B-Roll Audio Clip created!");
    } else {
        console.log("❌ FAILURE: Wrong clip created.");
    }
} else {
    console.log("❌ FAILURE: No Audio Clips created.");
}
