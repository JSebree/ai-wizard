import { chatCompletion } from '../../llm';
import { ScriptInput, ScriptOutput, ScriptSegment } from '../common/types';
import * as Prompts from './script-prompts';

// Utilities
const base36 = (len = 6) => Array.from({ length: len }, () => Math.floor(Math.random() * 36).toString(36)).join('');
const cleanJson = (text: string) => {
    try {
        const jsonMatch = text.match(/```json([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '') : text;
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
};

// Dialogue Validation for all routes (A-Roll, B-Roll, Combo)
// All video types are audio-driven and MUST have spoken dialogue
function validateDialogue(script: ScriptOutput, route: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const seg of script.segments) {
        const dialogue = seg.dialogue || '';
        const trimmedDialogue = dialogue.trim();

        // Check if dialogue exists
        if (!trimmedDialogue || trimmedDialogue.length < 10) {
            errors.push(`[${route}] Segment ${seg.segId} is missing spoken dialogue. All videos require voiceover/spoken text.`);
            continue;
        }

        // Check dialogue length (150 wpm = 2.5 words/sec)
        const actualWords = trimmedDialogue.split(/\s+/).length;
        const expectedWords = (seg.duration || 10) * 2.5;

        // Warn if dialogue is too short (less than 50% of expected)
        if (actualWords < expectedWords * 0.5) {
            errors.push(`[${route}] Segment ${seg.segId} dialogue may be too short (${actualWords} words for ${seg.duration}s). Expected ~${Math.round(expectedWords)} words.`);
        }
    }

    // Log validation result
    if (errors.length > 0) {
        console.warn(`[ScriptGen] Dialogue validation warnings:`, errors);
    } else {
        console.log(`[ScriptGen] Dialogue validation passed for ${route} (${script.segments.length} segments)`);
    }

    return { valid: errors.length === 0, errors };
}

// --- A-Roll Pipeline ---

async function generateARollVisuals(context: {
    scene: string,
    character: string,
    script: string,
    duration: number,
    rails: string[],
    meta: any
}): Promise<{ character: string, setting: string, direction: string }> {

    // 1. Character Specialist
    const charSystem = Prompts.CHARACTER_SYSTEM_PROMPT;
    const charUser = `SCENE: ${context.scene}
DURATION TARGET: ~${context.duration}s
CONTEXT (script tone sample):
${context.script.slice(0, 300)}

--- CHARACTER TASK ---
${context.character}
`;
    // Note: In n8n, there was a scrubbing step. We'll rely on the prompt for now, or add scrubbing if needed.
    const charRes = await chatCompletion([
        { role: 'system', content: charSystem },
        { role: 'user', content: charUser }
    ]);
    const characterDesc = charRes.trim();

    // 2. Setting Specialist
    const settingSystem = Prompts.SETTING_SYSTEM_PROMPT;
    const settingUser = `SCENE: ${context.scene}

--- SETTING TASK ---
${context.meta.settingPrompt || context.scene} 
`;
    // Wait, setting prompt input usually comes from "Test Cases" logic in n8n. 
    // In our simplified input, we have 'setting' field.
    const settingRes = await chatCompletion([
        { role: 'system', content: settingSystem },
        { role: 'user', content: `SCENE: ${context.scene}\n\n--- SETTING TASK ---\n${context.meta.setting || 'Neutral studio background'}` }
    ]);
    const settingDesc = settingRes.trim();

    // 3. Direction Specialist
    const dirSystem = Prompts.DIRECTION_SYSTEM_PROMPT;
    const dirUser = `SCENE: ${context.scene}
DURATION TARGET: ~${context.duration}s

--- CHARACTER ---
${characterDesc}

--- SETTING ---
${settingDesc}

--- DIRECTION TASK ---
Role: Stitch character + setting; describe on-screen look/feel for both a keyframe and natural continuous motion.
`;
    const dirRes = await chatCompletion([
        { role: 'system', content: dirSystem },
        { role: 'user', content: dirUser }
    ]);
    const directionDesc = dirRes.trim();

    return { character: characterDesc, setting: settingDesc, direction: directionDesc };
}

async function generateARollScript(input: ScriptInput): Promise<ScriptOutput> {
    const duration = input.duration || 30;

    // 1. Script Writer
    // Prepare prompt fields from input
    // We assume input has all necessary fields mapped from frontend

    // If we already have a script (e.g. from Combo Composer), skip generation? 
    // The Input interface doesn't strictly have a 'providedScript' field but we might need one.
    // For now, assume we generate from scratch if this function is called.

    const systemPrompt = Prompts.AROLL_SYSTEM_PROMPT;
    const userPrompt = `TASK: Write a concise ${duration}s A-roll-only spoken script.

SCENE: ${input.topic}
SETTING: ${input.setting}
ON-CAMERA CHARACTER: ${input.characterOrNarrator}
ACTION CONTEXT: ${input.action}
STYLE NOTES: ${input.style}

EDIT PLAN: A-roll only; no cutaways or inserts.
OUTPUT: Return ONLY the spoken lines, one per line.
`;

    const rawScript = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ]);

    // Clean script
    const scriptLines = rawScript.split('\n').filter((l: string) => l.trim().length > 0 && !l.startsWith('(') && !l.startsWith('*') && !l.startsWith('['));
    const fullScript = scriptLines.join('\n');

    // 2. Visuals
    const visuals = await generateARollVisuals({
        scene: input.topic,
        character: input.characterOrNarrator,
        script: fullScript,
        duration: duration,
        rails: [],
        meta: { setting: input.setting }
    });

    // 3. Assemble Output
    return {
        title: input.topic.slice(0, 50),
        estimatedDuration: duration,
        segments: [{
            segId: 'SEG-01',
            dialogue: fullScript,
            character: visuals.character, // Visual description
            visual: visuals.setting, // Setting description 
            action: visuals.direction, // Motion/Framing
            duration: duration
        }]
    };
}


// --- Combo Pipeline ---

// --- Validation Logic ---
function validateComboBlueprint(blueprint: any, totalDuration: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const segments = blueprint.blueprint || [];

    if (!segments.length) {
        return { valid: false, errors: ["No segments generated"] };
    }

    let aRollDur = 0;
    let bRollDur = 0;
    let bRollCount = 0;

    // B-Roll count rule from n8n: <6s→0, 6-45s→1, >45-90s→2, >90-135s→3, +1 per 45s
    const allowedBRoll = totalDuration < 6 ? 0 :
        totalDuration <= 45 ? 1 :
            totalDuration <= 90 ? 2 :
                totalDuration <= 135 ? 3 :
                    Math.floor(totalDuration / 45) + 1;

    // Max B-Roll per segment (proportional): 25% of total / allowed count
    const maxBRollPerSeg = allowedBRoll > 0 ? (totalDuration * 0.25) / allowedBRoll : 0;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const dur = seg.durationSec || 0;

        // 1. Duration Check (relaxed to 20s max for flexibility)
        if (dur > 20) {
            errors.push(`Segment ${seg.segId} is ${dur}s (Max 20s). Split it.`);
        }

        // 2. Alternating Pattern Check
        if (i > 0) {
            const prev = segments[i - 1];
            if (prev.track === seg.track) {
                errors.push(`Segments ${prev.segId} and ${seg.segId} are both '${seg.track}'. They MUST alternate (A->B->A).`);
            }
        }

        if (seg.track === 'aroll') {
            aRollDur += dur;
        } else {
            bRollDur += dur;
            bRollCount++;
            // 3. B-Roll per-segment max check
            if (dur > maxBRollPerSeg * 1.1) { // 10% tolerance
                errors.push(`B-Roll ${seg.segId} is ${dur}s (Max ~${Math.round(maxBRollPerSeg)}s per segment for ${totalDuration}s video).`);
            }
        }

        // Dialogue Check
        const beats = blueprint.composition?.beats || [];
        const beat = beats.find((b: any) => b.segId === seg.segId);

        // Enforce dialogue for ALL segments (A-Roll = Lip Sync, B-Roll = Voiceover)
        if (!beat || !beat.text || beat.text.trim().length < 5) {
            errors.push(`Segment ${seg.segId} (${seg.track}) is missing spoken dialogue. You MUST write the script in 'composition.beats'.`);
        } else {
            // Dialogue LENGTH Check (150 wpm = 2.5 words/sec)
            const actualWords = beat.text.split(/\s+/).length;
            const expectedWords = (seg.durationSec || 10) * 2.5;
            if (actualWords < expectedWords * 0.7) {
                errors.push(`Segment ${seg.segId} dialogue is too short (${actualWords} words). Expected ~${Math.round(expectedWords)} words for a ${seg.durationSec}s segment. Write more dialogue.`);
            }
        }
    }

    // 4. Ratio Check (Target: 72-78% A-Roll, ≤25% B-Roll)
    const totalGenDuration = aRollDur + bRollDur;
    const aRollRatio = aRollDur / totalGenDuration;
    const bRollRatio = bRollDur / totalGenDuration;

    // Relaxed tolerance: 68-82% A-Roll (was 72-80%)
    if (aRollRatio < 0.68 || aRollRatio > 0.82) {
        errors.push(`A-Roll Ratio is ${(aRollRatio * 100).toFixed(0)}%. Target is 70-80%. Adjust segment durations.`);
    }
    // Relaxed B-Roll cap to 32% (was 27%)
    if (bRollRatio > 0.32) {
        errors.push(`B-Roll exceeds 30% cap: ${(bRollRatio * 100).toFixed(0)}%. Reduce B-Roll duration.`);
    }

    // 5. Total Duration Check (must be at least 80% of requested)
    if (totalGenDuration < totalDuration * 0.8) {
        errors.push(`Total generated duration is only ${totalGenDuration}s. Requested ~${totalDuration}s. You MUST add more content.`);
    }

    // 6. B-Roll Count Check (strict n8n buckets)
    if (bRollCount > allowedBRoll) {
        errors.push(`Too many B-Roll segments: ${bRollCount}. Max ${allowedBRoll} for ${totalDuration}s video.`);
    }
    if (bRollCount < 1 && totalDuration >= 6) {
        errors.push(`Video needs at least 1 B-Roll segment for ${totalDuration}s.`);
    }

    // 7. Segment Count Check (odd number to ensure A-Roll bookends)
    const expectedMaxSegments = (allowedBRoll * 2) + 1; // A-B-A pattern
    if (segments.length > expectedMaxSegments + 1) {
        errors.push(`Too many segments: ${segments.length}. Max ${expectedMaxSegments + 1} for ${totalDuration}s (A-B-A pattern).`);
    }

    // 8. A-Roll Bookend Check (MUST start and end on A-Roll)
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    if (firstSeg?.track !== 'aroll') {
        errors.push(`Video MUST start with A-Roll, but first segment is '${firstSeg?.track}'.`);
    }
    if (lastSeg?.track !== 'aroll') {
        errors.push(`Video MUST end with A-Roll, but last segment is '${lastSeg?.track}'.`);
    }

    return { valid: errors.length === 0, errors };
}

async function generateComboScript(input: ScriptInput): Promise<ScriptOutput> {
    const duration = input.duration || 45;

    // 1. Orchestrator
    const orchSystem = Prompts.COMBO_ORCHESTRATOR_SYSTEM_PROMPT;

    // Construct Envelope for Orchestrator
    const envelope = {
        meta: {
            topic: input.topic, // Fixed structure
            videoType: 'combo',
            durationSec: duration,
            wantsCutaways: true,
            wantsMusic: true
            // Removed duplicate videoType
        },
        context: {
            userSetting: input.setting,
            userCharacter: input.characterOrNarrator,
            userAction: input.action
        },
        source: {
            // Character name for dialogue self-reference (e.g., "Baby Zuck" not "Mark Zuckerberg")
            characterName: input.characterName || "the host",
            scene: input.topic
        }
    };

    let attempt = 0;
    let maxRetries = 3;
    let lastBlueprint: any = null;
    let feedback = "";

    while (attempt < maxRetries) {
        const userPrompt = `REQUEST: Generate a script blueprint.
ENVELOPE: ${JSON.stringify(envelope, null, 2)}
${feedback ? `\n\nCRITICAL FEEDBACK FROM PREVIOUS FAILED ATTEMPT:\n${feedback}\nFIX THESE ISSUES IMMEDIATELY.` : ""}
`;

        console.log(`[ScriptGen] Combo Attempt ${attempt + 1}/${maxRetries}...`);

        try {
            const raw = await chatCompletion([
                { role: 'system', content: orchSystem }, // Corrected variable name
                { role: 'user', content: userPrompt }
            ]);

            const blueprint = cleanJson(raw);
            lastBlueprint = blueprint;

            if (blueprint && blueprint.blueprint) {
                const validation = validateComboBlueprint(blueprint, duration);
                if (validation.valid) {
                    console.log(`[ScriptGen] Validation Passed on attempt ${attempt + 1}.`);
                    break; // Success
                } else {
                    console.warn(`[ScriptGen] Validation Failed: ${validation.errors.join("; ")}`);
                    feedback = validation.errors.join("\n- ");
                    attempt++;
                }
            } else {
                feedback = "Invalid JSON format returned.";
                attempt++;
            }
        } catch (e) {
            console.error("LLM Error", e);
            attempt++;
        }
    }

    // Use lastBlueprint (even if failed validation, best effort)
    const blueprint = lastBlueprint || { blueprint: [], composition: { beats: [] }, fanout: {} };
    const composition = blueprint.composition || { beats: [] };

    // 3. Explode / Fanout Visuals
    // We iterate through blueprint segments, match them with composition beats (text),
    // and generate visuals.

    // Reconstruct segment mapping logic
    const segments: ScriptSegment[] = [];
    const beatsMap = new Map();
    composition.beats.forEach((b: any) => beatsMap.set(b.segId, b));

    const validSegments = blueprint.blueprint || [];

    const promises = validSegments.map(async (seg: any) => {
        const beat = beatsMap.get(seg.segId);
        const text = beat ? beat.text : "";
        const track = seg.track;

        let visualDesc = "";
        let characterDesc = "";
        let actionDesc = "";
        let visualsArray: string[] | undefined = undefined;

        if (track === 'aroll') {
            // A-Roll Fanout Logic (Existing)
            const testCase = blueprint.fanout?.aroll?.testCases?.find((tc: any) => tc.segId === seg.segId)
                || blueprint.fanout?.aroll?.testCases?.[0];

            if (testCase) {
                const viz = await generateARollVisuals({
                    scene: testCase.scene,
                    character: testCase.character,
                    script: text,
                    duration: seg.durationSec,
                    rails: [],
                    meta: { setting: testCase.setting }
                });
                characterDesc = viz.character;
                visualDesc = viz.setting;
                actionDesc = viz.direction;
            }
        } else {
            // B-Roll Visuals
            // Check if blueprint provided multiple visuals (if implemented in prompt return)
            // The prompt might define `visuals` in the blueprint array directly? 
            // Current prompt schema says `blueprint` array has: { segId, track, durationSec, visual, visuals? }

            if (seg.visuals && Array.isArray(seg.visuals) && seg.visuals.length > 0) {
                // LLM provided them directly!
                visualsArray = seg.visuals;
                visualDesc = seg.visual || (visualsArray ? visualsArray[0] : "B-roll Visual");
            } else if (seg.visual) {
                visualDesc = seg.visual;
            } else {
                // Fallback: Generate on fly (Legacy)
                const brollSystem = Prompts.BROLL_VISUAL_SYSTEM_PROMPT;
                const brollUser = `SCRIPT_SEGMENT: "${text}"\nCONTEXT: ${input.topic}\nDescribe visuals.`;
                const res = await chatCompletion([{ role: 'system', content: brollSystem }, { role: 'user', content: brollUser }]);
                visualDesc = res.trim();
            }
        }

        return {
            segId: seg.segId,
            dialogue: text,
            visual: visualDesc,
            visuals: visualsArray, // Pass array if present
            character: characterDesc,
            action: actionDesc,
            duration: seg.durationSec,
            track: track
        };
    });

    const results = await Promise.all(promises);
    return {
        title: input.topic.slice(0, 50),
        estimatedDuration: duration,
        segments: results
    };
}


async function generateBRollScript(input: ScriptInput): Promise<ScriptOutput> {
    const duration = input.duration || 30;

    // 1. Script Writer (Narrator)
    const systemPrompt = Prompts.BROLL_SYSTEM_PROMPT;
    const userPrompt = `TASK: Write a concise ${duration}s Voiceover script.
topic: ${input.topic}
Context: ${input.action}
Style: ${input.style}

OUTPUT: Return ONLY the spoken lines, one per line.`;

    const rawScript = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ]);

    const scriptLines = rawScript.split('\n').filter((l: string) => l.trim().length > 0 && !l.startsWith('(') && !l.startsWith('*') && !l.startsWith('['));
    const fullScript = scriptLines.join('\n');

    // 2. Visuals (B-Roll Fanout Logic)
    // We break the script into implied segments or just treat it as one block for now?
    // n8n B-Roll Builder usually just makes one generic visual or splits by sentence.
    // Let's generate ONE key visual for the "Setting" and maybe 1-2 variations if needed.
    // For simplicity V1: One visual description for the whole clip (like A-roll).

    // We reuse the B-Roll Visual logic we put in Combo:
    const brollSystem = Prompts.BROLL_VISUAL_SYSTEM_PROMPT;
    const brollUser = `SCRIPT: "${fullScript}"
CONTEXT (TOPIC): ${input.topic}
DURATION: ${duration}s

Describe the main visual theme/action for this video.`;

    const visualRes = await chatCompletion([
        { role: 'system', content: brollSystem },
        { role: 'user', content: brollUser }
    ]);
    const visualDesc = visualRes.trim();

    return {
        title: input.topic.slice(0, 50),
        estimatedDuration: duration,
        segments: [{
            segId: 'SEG-01',
            dialogue: fullScript,
            character: "n/a",
            visual: visualDesc,
            action: "Cinematic camera movement",
            duration: duration
        }]
    };
}

export async function generateScript(input: ScriptInput): Promise<ScriptOutput> {
    console.log(`[ScriptGen] Generating script for route: ${input.route}`);

    const route = input.route || 'aroll';
    const maxRetries = 3;

    // Helper to generate script based on route
    const generateForRoute = async (): Promise<ScriptOutput> => {
        if (route === 'combo') {
            return await generateComboScript(input);
        } else if (route === 'broll') {
            return await generateBRollScript(input);
        } else {
            // Default to A-Roll
            return await generateARollScript(input);
        }
    };

    let script: ScriptOutput;
    let lastValidation: { valid: boolean; errors: string[] } = { valid: false, errors: [] };

    // Retry loop: regenerate script if dialogue validation fails
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[ScriptGen] Attempt ${attempt}/${maxRetries} for route: ${route}`);

        script = await generateForRoute();

        // Validate dialogue for all routes (all videos are audio-driven)
        lastValidation = validateDialogue(script, route);

        if (lastValidation.valid) {
            console.log(`[ScriptGen] Dialogue validation passed on attempt ${attempt}`);
            return script;
        }

        // Log validation failure and retry if attempts remain
        console.warn(`[ScriptGen] Attempt ${attempt} failed validation:`, lastValidation.errors);

        if (attempt < maxRetries) {
            console.log(`[ScriptGen] Retrying script generation...`);
        }
    }

    // All retries exhausted - log final warning but return the script anyway
    console.warn(`[ScriptGen] All ${maxRetries} attempts failed dialogue validation. Proceeding with best effort.`, lastValidation.errors);
    return script!;
}
