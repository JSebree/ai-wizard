/**
 * EDL (Edit Decision List) Generator Utility
 * Generates CMX 3600 format EDL files for professional video editing software
 */

/**
 * Convert seconds to SMPTE timecode format (HH:MM:SS:FF)
 * @param {number} seconds - Time in seconds
 * @param {number} fps - Frames per second (default 24)
 * @returns {string} Timecode string
 */
export function secondsToTimecode(seconds, fps = 24) {
    const totalFrames = Math.round(seconds * fps);
    const frames = totalFrames % fps;
    const totalSeconds = Math.floor(totalFrames / fps);
    const secs = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const mins = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return [
        String(hours).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0'),
        String(frames).padStart(2, '0')
    ].join(':');
}

/**
 * Generate a CMX 3600 format EDL from a timeline
 * @param {Array} timeline - Array of clip objects
 * @param {string} projectName - Name of the project/scene
 * @param {Object} options - Optional configuration
 * @param {number} options.fps - Frame rate (default 24)
 * @param {boolean} options.includeAudio - Include audio track (default true)
 * @returns {string} EDL content as string
 */
export function generateEDL(timeline, projectName = "Untitled", options = {}) {
    const fps = options.fps || 24;
    const includeAudio = options.includeAudio !== false;

    const lines = [];

    // Header
    lines.push(`TITLE: ${projectName}`);
    lines.push(`FCM: NON-DROP FRAME`);
    lines.push(``);

    let recordIn = 0; // Running timecode position in the final sequence

    timeline.forEach((clip, index) => {
        const eventNum = String(index + 1).padStart(3, '0');
        const reelName = `CLIP${eventNum}`;
        const duration = parseFloat(clip.duration) || 4; // Default 4s if missing

        // Source timecodes (always start from 00:00:00:00 for each clip)
        const srcIn = secondsToTimecode(0, fps);
        const srcOut = secondsToTimecode(duration, fps);

        // Record timecodes (position in the final sequence)
        const recIn = secondsToTimecode(recordIn, fps);
        const recOut = secondsToTimecode(recordIn + duration, fps);

        // Determine edit type based on transition
        let editType = 'C'; // Cut (default)
        let transitionInfo = null;

        if (clip.transition && clip.transition !== 'cut' && index > 0) {
            if (clip.transition === 'crossfade' || clip.transition === 'dissolve') {
                editType = 'D'; // Dissolve
                transitionInfo = '024'; // 24 frame dissolve (1 second at 24fps)
            }
        }

        // Video track line
        const trackIndicator = includeAudio ? 'AA/V' : 'V';
        const editInfo = editType === 'D' ? `${editType}    ${transitionInfo}` : `${editType}       `;
        lines.push(`${eventNum}  ${reelName}  ${trackIndicator}  ${editInfo} ${srcIn} ${srcOut} ${recIn} ${recOut}`);

        // Comments with metadata
        if (clip.name) {
            lines.push(`* FROM CLIP NAME: ${clip.name}`);
        }

        // Source file reference (use raw URL, not proxied)
        const sourceUrl = clip.video_url || clip.videoUrl;
        if (sourceUrl) {
            // Convert proxied URLs back to raw DO Spaces URLs
            let rawUrl = sourceUrl;
            if (sourceUrl.includes('/media-proxy/')) {
                rawUrl = sourceUrl.replace('/media-proxy/', 'https://media-catalog.nyc3.digitaloceanspaces.com/');
            } else if (sourceUrl.includes('/generations-proxy/')) {
                rawUrl = sourceUrl.replace('/generations-proxy/', 'https://video-generations.nyc3.digitaloceanspaces.com/');
            }
            lines.push(`* SOURCE FILE: ${rawUrl}`);
        }

        lines.push(``);

        // Advance record position
        recordIn += duration;
    });

    return lines.join('\n');
}

/**
 * Trigger download of EDL file
 * @param {string} edlContent - The EDL content string
 * @param {string} filename - Filename without extension
 */
export function downloadEDL(edlContent, filename = "scene") {
    const blob = new Blob([edlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.edl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
