import React, { useState, useEffect, useMemo } from "react";
import CharacterCard from "./components/CharacterCard.jsx";
import SettingCard from "./components/SettingCard.jsx";
import KeyframeCard from "./components/KeyframeCard.jsx";
import { supabase } from "../libs/supabaseClient";
import { API_CONFIG } from "../config/api";

// Re-use storage keys from other studios to sync data
// Re-use storage keys from other studios to sync data
const CHARACTER_STORAGE_KEY = "sceneme.characters";
const SETTING_STORAGE_KEY = "sceneme.settings";
const SCENE_STORAGE_KEY = "sceneme.keyframes";


const API_ENDPOINT = API_CONFIG.GENERATE_SCENE_PREVIEW;

// Rich Color Grade Options
const COLOR_GRADES = [
    {
        id: "none",
        label: "Standard (None)",
        prompt: "No special color grading, natural lighting.",
        filter: "none"
    },
    {
        id: "desert-chrome",
        label: "Desert Chrome",
        prompt: "Desert Chrome – shadows deep cyan, midtones vivid amber, highlights golden white, skin tones sun-baked and warm, saturation bold, contrast high and crunchy, atmosphere blistering desert heat",
        filter: "sepia(0.4) saturate(1.4) contrast(1.2) hue-rotate(-10deg)"
    },
    {
        id: "iron-city",
        label: "Iron City",
        prompt: "Iron City – shadows cool steel, midtones neutral grey, highlights icy white, skin tones muted natural, contrast high and precise, metallic reflections, atmosphere tense and industrial",
        filter: "grayscale(0.6) contrast(1.1) brightness(1.05) hue-rotate(180deg) sepia(0.1)"
    },
    {
        id: "verde-bloom",
        label: "Verde Bloom",
        prompt: "Verde Bloom – shadows soft green, midtones peach, highlights white, skin tones glowing and healthy, contrast low, natural diffusion and vibrance, atmosphere calm and romantic",
        filter: "sepia(0.2) hue-rotate(50deg) saturate(1.1) brightness(1.05) contrast(0.9)"
    },
    {
        id: "nordic-still",
        label: "Nordic Still",
        prompt: "Nordic Still – shadows cold slate, midtones misty teal, highlights pale cream, skin tones subdued neutral, contrast gentle and cinematic, atmosphere overcast northern quiet",
        filter: "grayscale(0.2) sepia(0.2) hue-rotate(170deg) contrast(0.95)"
    },
    {
        id: "solflare-90",
        label: "Solflare 90",
        prompt: "Solflare 90 – shadows warm umber, midtones fiery orange, highlights golden haze, skin tones luminous and rich, saturation medium-high, contrast deep and nostalgic, atmosphere cinematic heat",
        filter: "sepia(0.5) saturate(1.5) contrast(1.1)"
    },
    {
        id: "overcast-fade",
        label: "Overcast Fade",
        prompt: "Overcast Fade – shadows soft charcoal, midtones muted blue-grey, highlights diffused white, skin tones natural and cool, contrast minimal, subtle vignetting, atmosphere calm and introspective",
        filter: "grayscale(0.3) brightness(0.95) contrast(0.9)"
    },
    {
        id: "golden-ember",
        label: "Golden Ember",
        prompt: "Golden Ember – shadows bronze brown, midtones honey gold, highlights soft ivory, skin tones radiant and candlelit, contrast warm and enveloping, atmosphere nostalgic evening glow",
        filter: "sepia(0.7) hue-rotate(-5deg) opacity(0.9)"
    },
    {
        id: "nightfall-indigo",
        label: "Nightfall Indigo",
        prompt: "Nightfall Indigo – shadows deep navy, midtones cool violet, highlights pale silver, skin tones moonlit neutral, contrast strong, saturation restrained, atmosphere mysterious and cinematic",
        filter: "hue-rotate(220deg) sepia(0.4) saturate(0.8) contrast(1.2)"
    },
    {
        id: "rustic-film",
        label: "Rustic Film",
        prompt: "Rustic Film – shadows dark olive, midtones burnt sienna, highlights pale beige, skin tones earthy and soft, contrast moderate with film grain texture, atmosphere nostalgic countryside",
        filter: "sepia(0.4) contrast(1.05)"
    },
    {
        id: "pacific-mist",
        label: "Pacific Mist",
        prompt: "Pacific Mist – shadows teal blue, midtones soft sand, highlights pearly white, skin tones cool balanced, contrast light and airy, subtle bloom, atmosphere coastal and serene",
        filter: "sepia(0.2) hue-rotate(180deg) brightness(1.1)"
    },
    {
        id: "arctic-clarity",
        label: "Arctic Clarity",
        prompt: "Arctic Clarity – shadows cool neutral grey, midtones pale cyan, highlights crisp white, skin tones slightly desaturated and clinical, contrast high and razor-sharp, texture smooth and sterile, atmosphere modern and pristine",
        filter: "grayscale(0.3) brightness(1.1) contrast(1.2)"
    },
    {
        id: "sterile-spectrum",
        label: "Sterile Spectrum",
        prompt: "Sterile Spectrum – shadows faint steel blue, midtones pure neutral white, highlights cold white-blue, skin tones pale and even, contrast clean and digital, no bloom or haze, atmosphere ultra-modern, minimalistic, and surgical",
        filter: "grayscale(0.8) hue-rotate(200deg) brightness(1.1)"
    },
    {
        id: "neon-glass",
        label: "Neon Glass",
        prompt: "Neon Glass – shadows cool graphite, midtones icy teal, highlights polished white, skin tones porcelain-like, contrast sharp with reflective sheen, surfaces appear reflective and glassy, atmosphere futuristic and hyper-clean",
        filter: "contrast(1.3) hue-rotate(190deg) saturate(1.2)"
    },
    {
        id: "chrome-habitat",
        label: "Chrome Habitat",
        prompt: "Chrome Habitat – shadows metallic grey, midtones silver-blue, highlights bright chrome, skin tones subdued and balanced, contrast high, saturation minimal, atmosphere sleek, industrial, and ultra-contemporary",
        filter: "grayscale(0.9) contrast(1.3)"
    },
    {
        id: "clinical-whiteout",
        label: "Clinical Whiteout",
        prompt: "Clinical Whiteout – shadows faint grey-blue, midtones pure sterile white, highlights bright fluorescent white, skin tones cool and desaturated, contrast medium-high, no warmth or diffusion, atmosphere medical, sterile, and precise",
        filter: "grayscale(1) brightness(1.2) contrast(1.1)"
    },
    {
        id: "gloom-gilt",
        label: "Gloom & Gilt",
        mood: "Gothic Fairytale Realism",
        prompt: "Gloom & Gilt – shadows deep teal and soft charcoal, midtones muted sepia, highlights pale gold, skin tones cool and desaturated, contrast high but diffused, texture filmic and ornate, atmosphere whimsical melancholy with gothic overtones",
        filter: "sepia(0.3) hue-rotate(160deg) contrast(1.1)"
    },
    {
        id: "pastel-paradox",
        label: "Pastel Paradox",
        mood: "Retro Storybook Whimsy",
        prompt: "Pastel Paradox – shadows soft navy, midtones dusty mint and mustard, highlights cream, skin tones balanced and natural, contrast mild, color saturation nostalgic with subtle bloom, atmosphere gentle, curious, and hyper-designed",
        filter: "sepia(0.2) saturate(1.3) brightness(1.05)"
    },
    {
        id: "nordic-daydream",
        label: "Nordic Daydream",
        mood: "Natural Romanticism",
        prompt: "Nordic Daydream – shadows cool slate, midtones earthy amber and teal, highlights clean white, skin tones warm and natural, contrast medium-high, vibrance organic and cinematic, atmosphere adventurous, introspective, and life-affirming",
        filter: "sepia(0.1) hue-rotate(190deg) contrast(1.05) saturate(1.1)"
    },
    {
        id: "sand-inferno",
        label: "Sand Inferno",
        mood: "Apocalyptic Chromatic Extremism",
        prompt: "Sand Inferno – shadows burnt orange, midtones desert amber, highlights blinding white, skin tones tanned and harsh, saturation extreme, contrast brutal and crisp, atmosphere scorching, high-energy, and hyperreal",
        filter: "sepia(0.8) saturate(2.5) contrast(1.3)"
    },
    {
        id: "rusted-sakura",
        label: "Rusted Sakura",
        mood: "Muted Dystopian Stop-Motion",
        prompt: "Rusted Sakura – shadows earthy umber, midtones muted red-orange and dusty beige, highlights pale bone, skin tones stylized clay hues, contrast balanced, color matte and tactile, atmosphere handmade, melancholic, and quirky",
        filter: "sepia(0.5) hue-rotate(320deg) contrast(0.9)"
    },
    {
        id: "amber-burrow",
        label: "Amber Burrow",
        mood: "Autumn Storybook Warmth",
        prompt: "Amber Burrow – shadows deep rust, midtones burnt orange and honey, highlights soft cream, skin tones golden and cozy, contrast medium with filmic roll-off, saturation warm and nostalgic, atmosphere handmade, tactile, and mischievous",
        filter: "sepia(0.7) hue-rotate(-10deg) saturate(1.2)"
    },
    {
        id: "neon-dystopia",
        label: "Neon Dystopia",
        mood: "Neon Decay / Noir",
        prompt: "Neon Dystopia – shadows deep teal and plum, midtones toxic orange and magenta, highlights smoggy white, skin tones pale and synthetic, contrast strong and cinematic, saturation selective with neon pops, atmosphere moody, futuristic, and oppressive",
        filter: "contrast(1.2) hue-rotate(280deg) saturate(1.4)"
    },
    {
        id: "pandora-glow",
        label: "Pandora Glow",
        mood: "Bioluminescent Nature Epic",
        prompt: "Pandora Glow – shadows indigo and cyan, midtones lush teal and emerald, highlights radiant aqua, skin tones cool with violet undertones, contrast soft but radiant, saturation vibrant, atmosphere organic, spiritual, and otherworldly",
        filter: "hue-rotate(100deg) saturate(1.5) brightness(1.1)"
    },
    {
        id: "code-green",
        label: "Code Green",
        mood: "Digital Dystopia",
        prompt: "Code Green – shadows deep black-green, midtones olive and tungsten, highlights pale green-grey, skin tones cold and desaturated, contrast high and harsh, saturation minimal, atmosphere claustrophobic, artificial, and coded",
        filter: "hue-rotate(90deg) grayscale(0.2) contrast(1.2)"
    },
    {
        id: "gridlight",
        label: "Gridlight",
        mood: "Electric Minimalism",
        prompt: "Gridlight – shadows pure black, midtones cool cyan, highlights bright electric blue and white, skin tones porcelain, contrast extreme and glossy, saturation focused on neon hues, atmosphere futuristic, sterile, and high-energy",
        filter: "grayscale(0.5) contrast(1.5) brightness(1.1) drop-shadow(0 0 5px cyan)"
    },
    {
        id: "titan-neutral",
        label: "Titan Neutral",
        mood: "Blockbuster Hero Naturalism",
        prompt: "Titan Neutral – shadows neutral black, midtones balanced warm-cool mix, highlights bright but natural, skin tones cinematic neutral with healthy warmth, contrast moderate with HDR pop, saturation polished and broad-spectrum, atmosphere clean, heroic, and universally appealing",
        filter: "contrast(1.05) saturate(1.1)"
    },
];

// Enhanced Visual Styles with Descriptions
const VISUAL_STYLES = [
    { id: "photorealistic", label: "Photorealistic", description: "Ultra-realistic 8k photograph, highly detailed textures, sharp focus" },
    { id: "cinematic", label: "Cinematic", description: "Cinematic film still, anamorphic lens, high production value, shallow depth of field" },
    { id: "documentary", label: "Documentary", description: "Raw documentary photography, 35mm film grain, natural imperfections, authentic look" },
    { id: "anime", label: "Anime", description: "Anime art style, cel-shaded, vibrant colors, detailed line work" },
    { id: "pixar", label: "Pixar-style", description: "3D animation style, Pixar-inspired, smooth rendering, expressive features, soft lighting" },
    { id: "watercolor", label: "Watercolor", description: "Watercolor painting, soft edges, artistic brushstrokes, paper texture" },
    { id: "comic", label: "Comic-book", description: "Comic book art style, bold black outlines, halftone patterns, dynamic shading" },
    { id: "noir", label: "Noir", description: "Film noir style, high contrast black and white, dramatic shadows, moody atmosphere" },
    { id: "claymation", label: "Stop Motion (Claymation)", description: "Stop motion claymation, clay texture, handmade feel, miniature photography effects" }
];

const CAMERA_ANGLES = [
    { id: "standard", label: "Standard", description: "Eye-level shot" },
    { id: "heroic", label: "Heroic", description: "Low-angle shot from below, emphasizing stature" },
    { id: "vulnerable", label: "Vulnerable", description: "High-angle shot from above" },
    { id: "wide", label: "Wide / Establishing", description: "Wide-angle environmental shot, full body visibility" },
    { id: "close", label: "Close & Intimate", description: "Extreme close-up shot, shallow depth of field" },
    { id: "chaos", label: "Chaos / Action", description: "Dutch angle, dynamic tilted frame, motion blur" },
    { id: "shoulder", label: "Over-the-Shoulder", description: "Over-the-shoulder shot, depth of field focus on subject" }
];

// Helper to get angle label
const getSettingAngleLabel = (key) => {
    const map = {
        base_image_url: "Main Reference",
        scene_n: "North",
        scene_ne: "North-East",
        scene_e: "East",
        scene_se: "South-East",
        scene_s: "South",
        scene_sw: "South-West",
        scene_w: "West",
        scene_nw: "North-West",
        establishing_overhead: "Overhead",
    };
    return map[key] || key;
};

const getCharacterAngleLabel = (key) => {
    const map = {
        referenceImageUrl: "Main Reference",
        base_hero: "Hero Shot",
        fullbody_centered: "Full Body (Center)",
        fullbody_side: "Full Body (Side)",
        torso_front: "Torso (Front)",
        headshot_front: "Headshot (Front)",
        headshot_right: "Headshot (Right)",
        headshot_left: "Headshot (Left)",
    };
    return map[key] || key;
};


export default function KeyframeStudioDemo() {
    const [characters, setCharacters] = useState([]);
    const [settings, setSettings] = useState([]);
    const [keyframes, setKeyframes] = useState([]);
    const [name, setName] = useState(""); // Keyframe Name
    const [activeScene, setActiveScene] = useState(null);
    const [keyframeToDelete, setKeyframeToDelete] = useState(null); // Added for custom delete confirmation

    // Selection State
    const [selectedSettingId, setSelectedSettingId] = useState("");
    const [selectedSettingAngle, setSelectedSettingAngle] = useState("base_image_url");

    const [selectedCharId, setSelectedCharId] = useState("");
    const [selectedCharAngle, setSelectedCharAngle] = useState("referenceImageUrl");

    const [selectedGradeId, setSelectedGradeId] = useState("none");
    const [visualStyle, setVisualStyle] = useState(VISUAL_STYLES[0]); // Default: Photorealistic

    // API Generation State
    const [prompt, setPrompt] = useState("");
    // Generation State
    const [generationMode, setGenerationMode] = useState("create"); // "create" | "modify"
    // const [editStrength, setEditStrength] = useState(0.6); // Removed in favor of auto-tuning
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSceneUrl, setGeneratedSceneUrl] = useState("");
    const [error, setError] = useState("");
    const [customBgUrl, setCustomBgUrl] = useState(null); // For Modify/Remix mode
    const [cameraAngle, setCameraAngle] = useState(CAMERA_ANGLES[0].id);
    const [visualStyleId, setVisualStyleId] = useState(VISUAL_STYLES[0].id);

    // Props State
    const [props, setProps] = useState([]);
    const [selectedPropId, setSelectedPropId] = useState("");
    const [isUploadingProp, setIsUploadingProp] = useState(false);
    const [renamingPropId, setRenamingPropId] = useState(null); // Track which prop is being renamed
    const [sourceSceneName, setSourceSceneName] = useState(null); // Track name of scene being modified
    const [sourceSceneId, setSourceSceneId] = useState(null); // Track ID for Overwrite logic

    // Derived State Helpers
    const activeStyle = useMemo(() => VISUAL_STYLES.find(s => s.id === visualStyleId) || VISUAL_STYLES[0], [visualStyleId]);
    const activeProp = useMemo(() => props.find(p => p.id === selectedPropId), [props, selectedPropId]);

    // Load Data
    useEffect(() => {
        // 1. Storage / Cache Load
        const loadLocal = () => {
            try {
                const rawChar = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
                if (rawChar) setCharacters(JSON.parse(rawChar));

                const rawSet = window.localStorage.getItem(SETTING_STORAGE_KEY);
                if (rawSet) setSettings(JSON.parse(rawSet));
            } catch (e) { console.warn("Local load failed", e); }
        };

        const loadSupabaseData = async () => {
            if (!supabase) return;

            // Load Props
            const { data: propsData, error: propsError } = await supabase
                .from("props")
                .select("*")
                .order("created_at", { ascending: false });

            if (propsData) {
                const mappedProps = propsData.map(p => ({
                    id: p.id,
                    name: p.name,
                    imageUrl: p.image_url,
                    createdAt: p.created_at
                }));
                setProps(mappedProps);
            }

            // Load Keyframes
            const { data: scenesData, error: scenesError } = await supabase
                .from("keyframes")
                .select("*")
                .order("created_at", { ascending: false });

            if (scenesData) {
                const mappedScenes = scenesData.map(s => ({
                    id: s.id,
                    name: s.name,
                    imageUrl: s.image_url,
                    prompt: s.prompt,
                    settingId: s.setting_id,
                    characterId: s.character_id,
                    prop_id: s.prop_id,
                    gradeId: s.color_grade,
                    setting_name: s.setting_name,
                    character_name: s.character_name,
                    prop_name: s.prop_name,
                    visual_style: s.visual_style,
                    camera_angle: s.camera_angle,
                    color_grade: s.color_grade,
                    createdAt: s.created_at,
                    // FIX: Infer pending status if URL matches placeholder or is literally "PENDING"
                    status: (s.image_url === "https://r2.sceneme.ai/assets/pending_placeholder.png" || s.image_url === "PENDING") ? 'pending' : 'complete'
                }));

                setKeyframes(mappedScenes);
            }
        };

        // 2. Supabase Load
        const loadSupabase = async () => {
            if (!supabase) return;
            try {
                const [charRes, setRes] = await Promise.all([
                    supabase.from("characters").select("*").order("created_at", { ascending: false }),
                    supabase.from("setting").select("*").order("created_at", { ascending: false })
                ]);

                if (charRes.data) {
                    const mappedChars = charRes.data.map(row => ({
                        id: row.id,
                        name: row.name,
                        referenceImageUrl: row.base_image_url || row.base_hero,

                        // Angles
                        base_hero: row.base_hero,
                        fullbody_centered: row.fullbody_centered,
                        fullbody_side: row.fullbody_side,
                        torso_front: row.torso_front,
                        headshot_front: row.headshot_front,
                        headshot_right: row.headshot_right,
                        headshot_left: row.headshot_left,
                    }));
                    setCharacters(mappedChars);
                }

                if (setRes.data) {
                    const mappedSettings = setRes.data.map(row => ({
                        id: row.id,
                        name: row.name,
                        base_image_url: row.base_image_url,

                        // Angles
                        scene_n: row.scene_n,
                        scene_ne: row.scene_ne,
                        scene_e: row.scene_e,
                        scene_se: row.scene_se,
                        scene_s: row.scene_s,
                        scene_sw: row.scene_sw,
                        scene_w: row.scene_w,
                        scene_nw: row.scene_nw,
                        establishing_overhead: row.establishing_overhead,
                    }));
                    setSettings(mappedSettings);
                }

            } catch (err) {
                console.error("Supabase load failed", err);
            }
        };

        loadLocal();
        loadSupabase();
        loadSupabaseData();
    }, []);

    // Set default selected setting if available
    useEffect(() => {
        const validSettings = settings.filter(s => s.base_image_url);
        if (validSettings.length > 0 && !selectedSettingId) {
            setSelectedSettingId(validSettings[0].id);
        }
    }, [settings, selectedSettingId]);

    // Derived state
    const activeSetting = useMemo(() => settings.find(s => s.id === selectedSettingId), [settings, selectedSettingId]);
    const activeCharacter = useMemo(() => characters.find(c => c.id === selectedCharId), [characters, selectedCharId]);
    const activeGrade = useMemo(() => COLOR_GRADES.find(g => g.id === selectedGradeId) || COLOR_GRADES[0], [selectedGradeId]);

    const activeBgUrl = useMemo(() => {
        if (customBgUrl) return customBgUrl;
        if (!activeSetting) return "";
        return activeSetting[selectedSettingAngle] || "";
    }, [activeSetting, selectedSettingAngle, customBgUrl]);

    const activeCharUrl = useMemo(() => activeCharacter ? (activeCharacter[selectedCharAngle] || activeCharacter.referenceImageUrl) : null, [activeCharacter, selectedCharAngle]);

    const handleSaveKeyframe = async (overrideUrl = null, shouldReset = true) => {
        // Use override URL if provided (for auto-save), otherwise state
        const urlToSave = overrideUrl || generatedSceneUrl;

        if (!name.trim()) {
            setError("Please give your keyframe a name before saving.");
            return;
        }
        if (!urlToSave) {
            setError("Generate a keyframe first to save it.");
            return;
        }

        const newScenePayload = {
            name: name.trim(),
            image_url: urlToSave,
            prompt: prompt,

            // Foreign Keys
            setting_id: selectedSettingId,
            character_id: selectedCharId,
            prop_id: activeProp?.id,

            // Metadata
            setting_name: activeSetting?.name || settings.find(s => s.id === selectedSettingId)?.name,
            character_name: activeCharacter?.name || characters.find(c => c.id === selectedCharId)?.name,
            prop_name: activeProp?.name,

            visual_style: activeStyle.label,
            camera_angle: CAMERA_ANGLES.find(a => a.id === cameraAngle)?.label,
            color_grade: activeGrade?.label
        };

        // DETERMINISTIC SAVE LOGIC
        // If in Modify Mode AND Name matches the Original Name -> UPDATE (Overwrite)
        // Otherwise -> INSERT (Save As New)
        const isOverwrite = generationMode === 'modify' && sourceSceneId && name.trim() === sourceSceneName;

        if (isOverwrite) {
            // --- UPDATE PATH ---
            console.log("Overwriting existing keyframe:", sourceSceneId);

            // Optimistic Update
            setKeyframes(prev => prev.map(s =>
                s.id === sourceSceneId
                    ? { ...s, ...newScenePayload, imageUrl: urlToSave }
                    : s
            ));

            if (supabase) {
                const { error } = await supabase
                    .from("keyframes")
                    .update(newScenePayload)
                    .eq("id", sourceSceneId);

                if (error) {
                    console.error("Supabase UPDATE Error:", error);
                    setError("Failed to overwrite keyframe.");
                    // Revert optimistic update? (Hard without complex logic, simpler to alert)
                }
            }

        } else {
            // --- INSERT PATH (New Record) ---
            console.log("Creating new keyframe record.");

            const tempId = `temp_${Date.now()}`;
            const optimisticScene = {
                ...newScenePayload,
                id: tempId,
                imageUrl: urlToSave,
                createdAt: new Date().toISOString()
            };
            setKeyframes([optimisticScene, ...keyframes]);

            if (supabase) {
                const { data, error } = await supabase
                    .from("keyframes")
                    .insert([newScenePayload])
                    .select();

                if (data && data[0]) {
                    setKeyframes(prev => [
                        {
                            id: data[0].id,
                            name: data[0].name,
                            imageUrl: data[0].image_url,
                            prompt: data[0].prompt,
                            settingId: data[0].setting_id,
                            characterId: data[0].character_id,
                            prop_id: data[0].prop_id,
                            setting_name: data[0].setting_name,
                            character_name: data[0].character_name,
                            prop_name: data[0].prop_name,
                            visual_style: data[0].visual_style,
                            camera_angle: data[0].camera_angle,
                            color_grade: data[0].color_grade,
                            createdAt: data[0].created_at
                        },
                        ...prev.filter(s => s.id !== tempId)
                    ]);
                } else if (error) {
                    console.error("Error saving scene to Supabase:", error);
                    setError("Failed to save scene.");
                    setKeyframes(prev => prev.filter(s => s.id !== tempId));
                }
            }
        }

        if (shouldReset) {
            // Reset Form
            setName("");
            setGeneratedSceneUrl("");
            setSourceSceneId(null); // Clear context
            setSourceSceneName(null);
            setGenerationMode("create"); // Reset to create mode
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // DELETE HANDLER
    // DELETE HANDLER
    // DELETE HANDLER
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteScene = (scene) => {
        setKeyframeToDelete(scene);
    };

    const handleConfirmDelete = async () => {
        const id = keyframeToDelete ? keyframeToDelete.id : null; // keyframeToDelete is object in JSX usage, but here definition suggests ID?
        if (!id) return;

        setIsDeleting(true);
        console.log("Confirm delete for ID:", id);

        try {
            const { error } = await supabase
                .from('keyframes')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Supabase DELETE Error:", error);
                throw error;
            }

            // Remove from local state
            setKeyframes(prev => prev.filter(s => s.id !== id));

            // Close details modal if open
            if (activeScene && activeScene.id === id) setActiveScene(null);

        } catch (err) {
            console.error("Error deleting keyframe:", err);
            alert("Failed to delete keyframe. Check console for details.");
        } finally {
            setIsDeleting(false);
            setKeyframeToDelete(null); // Close confirmation modal always
        }
    };

    const handleModifyScene = (scene) => {
        setCustomBgUrl(scene.imageUrl);
        setSourceSceneName(scene.name);
        setSourceSceneId(scene.id);
        setName(`${scene.name} (Remix)`);
        setPrompt(scene.prompt);
        setPrompt(scene.prompt);
        // [v54] Preserve Character and Prop on Modify (User Request)
        if (scene.characterId) setSelectedCharId(scene.characterId);
        if (scene.settingId) setSelectedSettingId(scene.settingId); // Optional: keep context
        if (scene.prop_id) setSelectedPropId(scene.prop_id);
        if (scene.gradeId) setSelectedGradeId(scene.gradeId);

        // Auto-switch to Modify Mode
        setGenerationMode("modify");

        // Restore Visual Style (Label Match)
        if (scene.visual_style) {
            const foundStyle = VISUAL_STYLES.find(s => s.label === scene.visual_style);
            if (foundStyle) setVisualStyleId(foundStyle.id);
        }

        // Restore Camera Angle (Label Match)
        if (scene.camera_angle) {
            const found = CAMERA_ANGLES.find(a => a.label === scene.camera_angle);
            if (found) setCameraAngle(found.id);
        }

        setActiveScene(null); // Close modal

        // Scroll to top to show it's ready
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Persistence Helper (Mirrors Clip Studio saveToBin) ---
    const saveKeyframeToDb = async (keyframe, shouldUpdateState = true) => {
        console.log("Saving Keyframe to DB:", keyframe);

        let finalKeyframe = { ...keyframe }; // Local state version

        try {
            // Optimistic State Update
            if (shouldUpdateState) {
                setKeyframes(prev => {
                    const exists = prev.find(k => k.id === keyframe.id);
                    if (exists) return prev.map(k => k.id === keyframe.id ? keyframe : k);
                    return [keyframe, ...prev];
                });
            }

            if (supabase) {
                // DATA CLEANUP: Remove fields not in DB schema
                const dbPayload = {
                    id: keyframe.id,
                    name: keyframe.name,
                    prompt: keyframe.prompt,
                    image_url: keyframe.imageUrl || keyframe.image_url,

                    // Foreign Keys
                    setting_id: keyframe.setting_id || keyframe.settingId,
                    character_id: keyframe.character_id || keyframe.characterId,
                    prop_id: keyframe.prop_id,

                    // Metadata (Denormalized)
                    setting_name: keyframe.setting_name,
                    character_name: keyframe.character_name,
                    prop_name: keyframe.prop_name,
                    visual_style: keyframe.visual_style,
                    camera_angle: keyframe.camera_angle,
                    color_grade: keyframe.color_grade,

                    created_at: keyframe.createdAt || keyframe.created_at || new Date().toISOString()
                };

                // Remove strictly local fields that DB rejects
                // We assume 'status' column MIGHT NOT exist or is optional. 
                // If it doesn't exist, this line would cause the error. 
                // Clip Studio deleted extra fields. We will omit 'status' from DB payload just in case.
                // If we really want to persist status, we need to know if column exists.
                // For now, let's rely on the Placeholder URL to infer pending status on reload.

                // Ensure ID is valid UUID if new (managed by caller usually)

                console.log("DB Payload:", dbPayload);

                // Upsert Logic
                const { data, error } = await supabase
                    .from("keyframes")
                    .upsert(dbPayload)
                    .select()
                    .single();

                if (error) {
                    throw error;
                }

                if (data) {
                    console.log("DB Save Success:", data);
                    // Merge DB result back to local item (canonical source)
                    finalKeyframe = {
                        ...finalKeyframe,
                        ...data,
                        imageUrl: data.image_url, // map back to UI prop
                        status: keyframe.status
                    };

                    // Aggressive State Sync: Update BOTH list and active item
                    if (shouldUpdateState) {
                        setKeyframes(prev => prev.map(k => k.id === finalKeyframe.id ? finalKeyframe : k));

                        // If this is the currently active scene (e.g. in modal), update it too!
                        setActiveScene(prev => (prev && prev.id === finalKeyframe.id) ? finalKeyframe : prev);
                    }
                }
            }
        } catch (err) {
            console.error("Save to DB Failed:", err);
            // We don't revert optimistic update here to prevent UI flicker, but we log loud error.
        }

        return finalKeyframe;
    };


    // Handle Generation
    const handleGenerateScene = async () => {
        console.log("handleGenerateScene CALLED. Validation Check:", {
            hasActiveBgUrl: !!activeBgUrl,
            promptLength: prompt?.length,
            nameLength: name?.length
        });

        if (!activeBgUrl) {
            setError("Please select a Setting.");
            return;
        }
        if (!prompt.trim()) {
            setError("Please enter a scene description.");
            return;
        }
        if (!name.trim()) {
            setError("Please name your keyframe before generating.");
            return;
        }

        setIsGenerating(true);
        setError("");
        setGeneratedSceneUrl("");

        // 1. PRE-CALCULATE PAYLOAD
        const metadata = {
            name: name.trim(),
            prompt: prompt,
            setting_id: selectedSettingId,
            character_id: selectedCharId,
            prop_id: activeProp?.id,
            setting_name: activeSetting?.name || settings.find(s => s.id === selectedSettingId)?.name,
            character_name: activeCharacter?.name || characters.find(c => c.id === selectedCharId)?.name,
            prop_name: activeProp?.name,
            visual_style: activeStyle.label,
            camera_angle: CAMERA_ANGLES.find(a => a.id === cameraAngle)?.label,
            color_grade: activeGrade?.label
        };

        const isOverwrite = generationMode === 'modify' && sourceSceneId && name.trim() === sourceSceneName;
        const targetId = isOverwrite ? sourceSceneId : crypto.randomUUID();

        // 2. OPTIMISTIC SAVE (PENDING STATE)
        const pendingRecord = {
            id: targetId,
            ...metadata,
            // Use Placeholder URL for persistence so reload sees it as pending
            imageUrl: "https://r2.sceneme.ai/assets/pending_placeholder.png",
            // Local status flag
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Call Helper (Optimistic UI + DB Insert)
        await saveKeyframeToDb(pendingRecord, true);

        // 3. FREEZE API PAYLOAD & START BACKGROUND WORKER (Before UI Reset)
        const endpoint = API_ENDPOINT;
        let apiPayload = {};

        if (generationMode === "create") {
            apiPayload = {
                asset_type: "scene_creation",
                prompt: metadata.prompt,
                name: metadata.name,

                // Images
                setting_image_url: activeBgUrl,
                character_image_url: activeCharUrl || "",
                prop_image_url: activeProp?.imageUrl || "",

                // Explicit Metadata for Backend (LLM Context)
                character_name: metadata.character_name || "",
                setting_name: metadata.setting_name || "",
                prop_name: metadata.prop_name || "", // Requested specifically as prop_name

                // Styles (sending full description/prompt for better generation context)
                visual_style: activeStyle.description || activeStyle.label,
                camera_angle: CAMERA_ANGLES.find(a => a.id === cameraAngle)?.description || metadata.camera_angle,
                color_grade: activeGrade.prompt || activeGrade.label,
            };
        } else {
            // Modify
            const inputImage = generatedSceneUrl || activeBgUrl;
            apiPayload = {
                asset_type: "scene_modification",
                input_image: inputImage,
                prompt: metadata.prompt,
                name: metadata.name,
                edit_instructions: [metadata.prompt],
                parameters: { edit_strength: 0.65, preserve_size: true },

                // PASS IMAGES FOR REFERENCE (Critical for backend node logic)
                setting_image_url: activeBgUrl,
                character_image_url: activeCharUrl || "",
                prop_image_url: activeProp?.imageUrl || "",

                // Pass metadata to modify too, just in case
                character_name: metadata.character_name || "",
                setting_name: metadata.setting_name || "",
                prop_name: metadata.prop_name || "",
                visual_style: activeStyle.description || activeStyle.label,
                camera_angle: CAMERA_ANGLES.find(a => a.id === cameraAngle)?.description || metadata.camera_angle,
                color_grade: activeGrade.prompt || activeGrade.label,
            };
        }

        console.log("=== GENERATION DEBUG ===");
        console.log("Active BG URL:", activeBgUrl);
        console.log("Full Payload:", JSON.stringify(apiPayload, null, 2));

        // Define Worker (now cleaner, just consumes payload)
        const runBackgroundGeneration = async (payload) => {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error(`Generation failed: ${res.status}`);
                const data = await res.json();
                console.log("Background Gen Response Data:", JSON.stringify(data, null, 2));

                // ROBUST URL EXTRACTION
                // prioritized check based on observed backend responses
                let url = data.output?.url ||
                    data.output?.image_url ||
                    data.image_url ||
                    data.url ||
                    "";

                // Handle nested url objects if any
                if (typeof url === 'object') url = url.url || url.image_url || JSON.stringify(url);

                console.log("Extracted URL:", url);

                if (!url || !url.toString().startsWith('http')) {
                    console.error("Invalid URL extracted:", url);
                    throw new Error("Invalid API response (No URL found in output.url, output.image_url, image_url, or url)");
                }

                console.log("Background Gen Success. Final URL:", url);

                // 2. UPDATE RECORD WITH SUCCESS (Final URL)
                const completedRecord = {
                    ...pendingRecord,
                    imageUrl: url,
                    status: 'complete'
                };

                // Explicitly log the object we are about to save
                console.log("Calling saveKeyframeToDb with:", completedRecord);

                await saveKeyframeToDb(completedRecord, true); // Update UI and DB

            } catch (err) {
                console.error("Background Scene generation error", err);
                // 3. HANDLE FAILURE
                setKeyframes(prev => prev.filter(k => k.id !== targetId));
                if (supabase) {
                    await supabase.from("keyframes").delete().eq("id", targetId);
                }
            }
        };

        // Fire and Forget!
        runBackgroundGeneration(apiPayload);


        // 4. RESET UI FOR NEXT GENERATION (Simulated Page Refresh)
        // Now safe to reset because payload is already sent/frozen
        setName("");
        setPrompt("");
        setGeneratedSceneUrl("");
        setIsGenerating(false);

        // Reset Context & Selections (Hard Reset)
        setGenerationMode("create");
        setSourceSceneId(null);
        setActiveScene(null);

        // Clear Selections
        setSelectedCharId("");
        setSelectedCharAngle("referenceImageUrl");
        setSelectedSettingId("");
        setSelectedSettingAngle("base_image_url");
        setSelectedPropId(""); // Reset Prop ID, not Memo

        // Reset Styles to Defaults
        setVisualStyleId(VISUAL_STYLES[0].id); // Reset Style ID
        setCameraAngle(CAMERA_ANGLES[0].id);
        setSelectedGradeId(COLOR_GRADES[0].id || "none"); // Reset Grade ID
    };

    const handlePropUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Default name to filename without extension
        const defaultName = file.name.replace(/\.[^/.]+$/, "") || "Untitled Prop";

        setIsUploadingProp(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", defaultName); // Pass name to webhook if supported, or just use for local reference
            formData.append("kind", "prop");

            // Reusing the reference image upload endpoint
            const uploadEndpoint = API_CONFIG.UPLOAD_REFERENCE_IMAGE;

            const res = await fetch(uploadEndpoint, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            const url = data.publicUrl || data.url || data.image_url;

            if (!url) throw new Error("No URL returned from upload");

            const newPropPayload = {
                name: defaultName,
                image_url: url
            };

            // Optimistic Update
            const tempId = `temp_prop_${Date.now()}`;
            const optimisticProp = {
                id: tempId,
                name: defaultName,
                imageUrl: url,
                createdAt: new Date().toISOString()
            };

            setProps([optimisticProp, ...props]);
            setSelectedPropId(tempId);

            if (supabase) {
                const { data, error } = await supabase
                    .from("props")
                    .insert([newPropPayload])
                    .select();

                if (data && data[0]) {
                    // Replace temp with real
                    const realProp = {
                        id: data[0].id,
                        name: data[0].name,
                        imageUrl: data[0].image_url,
                        createdAt: data[0].created_at
                    };
                    setProps(prev => [realProp, ...prev.filter(p => p.id !== tempId)]);
                    setSelectedPropId(realProp.id);
                } else if (error) {
                    console.error("Error saving prop to Supabase:", error);
                    setError("Failed to save prop.");
                    // Revert optimistic update on error
                    setProps(prev => prev.filter(p => p.id !== tempId));
                }
            }

        } catch (err) {
            console.error(err);
            setError("Failed to upload prop. Please try again.");
        } finally {
            setIsUploadingProp(false);
        }
    };

    const handleRenameSubmit = async (id, newName) => {
        if (!newName || !newName.trim()) {
            setRenamingPropId(null);
            return;
        }

        // Optimistic
        setProps(props.map(p =>
            p.id === id ? { ...p, name: newName.trim() } : p
        ));
        setRenamingPropId(null);

        if (supabase) {
            const { error } = await supabase
                .from("props")
                .update({ name: newName.trim() })
                .match({ id });
            if (error) {
                console.error("Error renaming prop in Supabase:", error);
                setError("Failed to rename prop.");
            }
        }
    };

    // Manual Clear Handler (User Request)
    const handleClearForm = () => {
        if (window.confirm("Start fresh? This will clear your current prompt and selections.")) {
            // UI Reset
            setName("");
            setPrompt("");
            setGeneratedSceneUrl("");
            setIsGenerating(false);
            setGenerationMode("create");
            setSourceSceneId(null);
            setActiveScene(null);

            // Clear Selections
            setSelectedCharId("");
            setSelectedCharAngle("referenceImageUrl");
            setSelectedSettingId("");
            setSelectedSettingAngle("base_image_url");
            setSelectedPropId("");

            // Reset Styles
            setVisualStyleId(VISUAL_STYLES[0].id);
            setCameraAngle(CAMERA_ANGLES[0].id);
            setSelectedGradeId(COLOR_GRADES[0].id || "none");

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div style={{ paddingBottom: 60 }}>
            {/* Introduction / Header */}


            {/* Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold mb-2">Keyframe Studio</h2>
                <p className="text-gray-500 text-sm">Compose keyframes by combining your Settings, Characters, and uploading Props.</p>
            </div>

            {/* Keyframe Name Input */}
            <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Keyframe Name *
                </label>
                <input
                    type="text"
                    placeholder="e.g. The Standoff at Noon"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #CBD5E1",
                        fontSize: 14
                    }}
                />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

                {/* 1. Setting Selector */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>1. Setting *</h3>
                        {customBgUrl && (
                            <button
                                onClick={() => {
                                    setCustomBgUrl(null);
                                    setSourceSceneName(null);
                                }}
                                style={{
                                    fontSize: 12,
                                    padding: "4px 10px",
                                    borderRadius: 999,
                                    background: "#FEE2E2",
                                    color: "#EF4444",
                                    border: "none",
                                    cursor: "pointer",
                                    fontWeight: 600
                                }}
                            >
                                Clear Keyframe
                            </button>
                        )}
                    </div>
                    {customBgUrl ? (
                        <div style={{
                            background: "#EFF6FF",
                            border: "1px dashed #3B82F6",
                            borderRadius: 8,
                            padding: 16,
                            display: "flex",
                            alignItems: "center",
                            gap: 12
                        }}>
                            <div style={{ width: 60, height: 40, background: "#000", borderRadius: 4, overflow: "hidden" }}>
                                <img src={customBgUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Custom Ref" />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E40AF" }}>Modifying {sourceSceneName || "Keyframe"}</div>
                                <div style={{ fontSize: 11, color: "#60A5FA" }}>The Setting selection below is overridden.</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                            {settings.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedSettingId(s.id)}
                                    style={{
                                        position: "relative",
                                        flexShrink: 0,
                                        width: 160, // Fixed width for horizontal scroll
                                        aspectRatio: "4/3",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        border: activeSetting?.id === s.id ? "2px solid #000" : "1px solid #E2E8F0",
                                        cursor: "pointer",
                                        opacity: activeSetting?.id === s.id ? 1 : 0.8
                                    }}
                                >
                                    {s.base_image_url ? (
                                        <img src={s.base_image_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <div style={{ width: "100%", height: "100%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#94A3B8" }}>No Image</div>
                                    )}
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 11, padding: "4px 8px", fontWeight: 600 }}>
                                        {s.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!customBgUrl && activeSetting && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }}>Camera Angle</label>
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                                {["base_image_url", "establishing_overhead", "scene_n", "scene_ne", "scene_e", "scene_se", "scene_s", "scene_sw", "scene_w", "scene_nw"].map(key => {
                                    const url = activeSetting[key];
                                    if (!url) return null;
                                    const label = getSettingAngleLabel(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedSettingAngle(key)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 999,
                                                border: selectedSettingAngle === key ? "1px solid #000" : "1px solid #E2E8F0",
                                                background: selectedSettingAngle === key ? "#F3F4F6" : "#F8FAFC",
                                                color: selectedSettingAngle === key ? "#000" : "#64748B",
                                                fontSize: 12,
                                                fontWeight: 500,
                                                whiteSpace: "nowrap",
                                                cursor: "pointer"
                                            }}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </section>

                {/* 2. Character Selector */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>2. Character</h3>
                        {characters.length === 0 && (
                            <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 500 }}>
                                No characters found
                            </span>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                        {/* None Option */}
                        <div
                            onClick={() => setSelectedCharId("")}
                            style={{
                                flexShrink: 0,
                                width: 100,
                                cursor: "pointer",
                                opacity: !selectedCharId ? 1 : 0.7
                            }}
                        >
                            <div style={{
                                width: 80, height: 80, borderRadius: "50%", overflow: "hidden", margin: "0 auto 8px",
                                border: !selectedCharId ? "3px solid #000" : "1px solid #E2E8F0",
                                background: "#F1F5F9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                color: "#94A3B8"
                            }}>
                                None
                            </div>
                            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#334155" }}>No Character</div>
                        </div>

                        {characters.map(c => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCharId(c.id)}
                                style={{
                                    flexShrink: 0,
                                    width: 100,
                                    cursor: "pointer",
                                    opacity: activeCharacter?.id === c.id ? 1 : 0.7
                                }}
                            >
                                <div style={{
                                    width: 80, height: 80, borderRadius: "50%", overflow: "hidden", margin: "0 auto 8px",
                                    border: activeCharacter?.id === c.id ? "3px solid #000" : "1px solid #E2E8F0"
                                }}>
                                    {c.referenceImageUrl ? (
                                        <img src={c.referenceImageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <div style={{ width: "100%", height: "100%", background: "#F1F5F9" }} />
                                    )}
                                </div>
                                <div style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            </div>
                        ))}
                    </div>

                    {activeCharacter && (
                        <div style={{ marginTop: 16 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }}>Pose / Shot</label>
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                                {["referenceImageUrl", "fullbody_centered", "fullbody_side", "torso_front", "headshot_front", "headshot_left", "headshot_right"].map(key => {
                                    const url = activeCharacter[key];
                                    if (!url) return null;
                                    const label = getCharacterAngleLabel(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedCharAngle(key)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 999,
                                                border: selectedCharAngle === key ? "1px solid #000" : "1px solid #E2E8F0",
                                                background: selectedCharAngle === key ? "#F3F4F6" : "#F8FAFC",
                                                color: selectedCharAngle === key ? "#000" : "#64748B",
                                                fontSize: 12,
                                                fontWeight: 500,
                                                whiteSpace: "nowrap",
                                                cursor: "pointer"
                                            }}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </section>

                {/* 3. Action Description */}
                {/* 3. Keyframe Description */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>3. Describe the Keyframe</h3>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                            Keyframe Description *
                        </label>
                        <textarea
                            rows={3}
                            placeholder="e.g. The character is sitting on the bench reading a book, soft sunlight hitting their face..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            style={{
                                width: "100%",
                                padding: 12,
                                borderRadius: 8,
                                border: "1px solid #E5E7EB",
                                fontSize: 14,
                                fontFamily: "inherit",
                                resize: "none",
                                marginBottom: 12
                            }}
                        />

                        {/* Refine Options (Only show in Modify Mode) */}
                        {/* Refine Options Removed */}
                    </div>
                </section>

                {/* 4. Prop (Optional) */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>4. Prop <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>(Optional)</span></h3>

                        <label style={{
                            fontSize: 12,
                            padding: "6px 12px",
                            background: "#F3F4F6",
                            color: "#000",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                        }}>
                            {isUploadingProp ? "Uploading..." : "+ Upload Prop"}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handlePropUpload}
                                style={{ display: "none" }}
                                disabled={isUploadingProp}
                            />
                        </label>
                    </div>

                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                        {/* None Option */}
                        <div
                            onClick={() => setSelectedPropId("")}
                            style={{
                                flexShrink: 0,
                                width: 100,
                                cursor: "pointer",
                                opacity: !selectedPropId ? 1 : 0.6
                            }}
                        >
                            <div style={{
                                border: !selectedPropId ? "3px solid #000" : "1px solid #E2E8F0",
                                borderRadius: 8,
                                aspectRatio: "1/1",
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#F1F5F9",
                                color: "#64748B",
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                None
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", textAlign: "center" }}>No Prop</div>
                        </div>

                        {props.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPropId(p.id)}
                                style={{
                                    flexShrink: 0,
                                    width: 100,
                                    cursor: "pointer",
                                    opacity: selectedPropId === p.id ? 1 : 0.6
                                }}
                            >
                                <div style={{
                                    border: selectedPropId === p.id ? "3px solid #000" : "1px solid #E2E8F0",
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    aspectRatio: "1/1",
                                    marginBottom: 8
                                }}>
                                    <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: 20,
                                    width: "100%",
                                    padding: "0 4px"
                                }}>
                                    {renamingPropId === p.id ? (
                                        <input
                                            autoFocus
                                            defaultValue={p.name}
                                            onBlur={(e) => handleRenameSubmit(p.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRenameSubmit(p.id, e.currentTarget.value);
                                                if (e.key === "Escape") setRenamingPropId(null);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                width: "100%",
                                                fontSize: 11,
                                                padding: "2px 4px",
                                                border: "1px solid #000",
                                                borderRadius: 4,
                                                outline: "none",
                                                textAlign: "center"
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: "#334155",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                maxWidth: selectedPropId === p.id ? "calc(100% - 20px)" : "100%"
                                            }}>
                                                {p.name}
                                            </span>
                                            {selectedPropId === p.id && (
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenamingPropId(p.id);
                                                    }}
                                                    style={{ marginLeft: 4, cursor: "pointer", opacity: 0.6, fontSize: 10, flexShrink: 0 }}
                                                    title="Rename Prop"
                                                >
                                                    ✏️
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 5. Visual Style & Color Grade */}
                <section style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    padding: 16,
                    background: "#FFFFFF",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 16
                }}>
                    {/* Visual Style */}
                    <div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#334155" }}>5. Style</h3>
                        <div style={{ position: "relative" }}>
                            <select
                                value={visualStyleId}
                                onChange={e => setVisualStyleId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #D1D5DB",
                                    background: "#F9FAFB",
                                    fontSize: 13,
                                    appearance: "none",
                                    cursor: "pointer"
                                }}
                            >
                                {VISUAL_STYLES.map(style => (
                                    <option key={style.id} value={style.id}>{style.label}</option>
                                ))}
                            </select>
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10 }}>▼</div>
                        </div>
                    </div>

                    {/* Camera Angle */}
                    <div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#334155" }}>6. Camera</h3>
                        <div style={{ position: "relative" }}>
                            <select
                                value={cameraAngle}
                                onChange={e => setCameraAngle(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #D1D5DB",
                                    background: "#F9FAFB",
                                    fontSize: 13,
                                    appearance: "none",
                                    cursor: "pointer"
                                }}
                            >
                                {CAMERA_ANGLES.map(angle => (
                                    <option key={angle.id} value={angle.id}>{angle.label}</option>
                                ))}
                            </select>
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10 }}>▼</div>
                        </div>
                    </div>

                    {/* Color Grade */}
                    <div>
                        <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", color: "#334155" }}>6. Grade</h3>
                        <div style={{ position: "relative" }}>
                            <select
                                value={selectedGradeId}
                                onChange={e => setSelectedGradeId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #D1D5DB",
                                    background: "#F9FAFB",
                                    fontSize: 13,
                                    appearance: "none",
                                    cursor: "pointer"
                                }}
                            >
                                {COLOR_GRADES.map(grade => (
                                    <option key={grade.id} value={grade.id}>{grade.label}</option>
                                ))}
                            </select>
                            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 10 }}>▼</div>
                        </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#64748B", marginTop: 0, background: "#F8FAFC", padding: 12, borderRadius: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {activeStyle && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <strong style={{ color: "#334155", minWidth: 60 }}>Style:</strong>
                                <span>{activeStyle.description}</span>
                            </div>
                        )}
                        {CAMERA_ANGLES.find(a => a.id === cameraAngle) && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <strong style={{ color: "#334155", minWidth: 60 }}>Camera:</strong>
                                <span>{CAMERA_ANGLES.find(a => a.id === cameraAngle).description}</span>
                            </div>
                        )}
                        {activeGrade && activeGrade.id !== "none" && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <strong style={{ color: "#334155", minWidth: 60 }}>Grade:</strong>
                                <span>{activeGrade.prompt || activeGrade.label}</span>
                            </div>
                        )}
                    </div>
                </section>


                {/* 5. Preview & Generate */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", margin: 0 }}>
                            {generationMode === "create" ? "✨ New Keyframe" : "✏️ Modify Keyframe"}
                        </h3>

                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={handleClearForm}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    border: "1px solid #E2E8F0",
                                    background: "white",
                                    color: "#64748B",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleGenerateScene}
                                disabled={isGenerating || !activeSetting || !prompt.trim()}
                                style={{
                                    background: (isGenerating || !activeSetting || !prompt.trim()) ? "#94A3B8" : "#2563EB",
                                    color: "white",
                                    border: "none",
                                    padding: "8px 16px",
                                    borderRadius: 6,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: (isGenerating || !activeSetting || !prompt.trim()) ? "not-allowed" : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                }}
                            >
                                {isGenerating && (
                                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 1s linear infinite" }} />
                                )}
                                {isGenerating ? "Processing..." : (generationMode === "create" ? "Generate Keyframe" : "Apply Changes")}
                            </button>
                        </div>
                    </div>

                    {error && <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{error}</p>}

                    <div style={{
                        position: "relative",
                        minHeight: 400,
                        background: "#F1F5F9",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {/* Generated or Composite Preview */}
                        {generatedSceneUrl ? (
                            <div style={{ width: "100%", height: "100%", position: "relative" }}>
                                <img src={generatedSceneUrl} alt="Generated Keyframe" style={{ width: "100%", height: "100%", objectFit: "contain", background: "black" }} />
                                <button
                                    onClick={() => setGeneratedSceneUrl("")}
                                    style={{
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        background: "rgba(0,0,0,0.6)",
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        color: "white",
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        fontSize: 11,
                                        cursor: "pointer"
                                    }}
                                >
                                    Back to Composition
                                </button>
                            </div>
                        ) : (
                            <div style={{ width: "100%", height: "100%", position: "relative", filter: activeGrade ? activeGrade.filter : "none", transition: "filter 0.3s ease" }}>
                                {/* Background */}
                                {activeBgUrl ? (
                                    <img src={activeBgUrl} alt="Background" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1" }}>
                                        Select a setting
                                    </div>
                                )}

                                {/* Character Overlay */}
                                {activeCharUrl && (
                                    <img
                                        src={activeCharUrl}
                                        alt="Character"
                                        style={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: "50%",
                                            transform: "translateX(-50%)",
                                            height: "85%", // Approximate scale
                                            objectFit: "contain",
                                            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))"
                                        }}
                                    />
                                )}
                            </div>
                        )}

                        {/* Loading Overlay */}
                        {isGenerating && (
                            <div style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(0,0,0,0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                flexDirection: "column",
                                gap: 12,
                                backdropFilter: "blur(2px)"
                            }}>
                                <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                <span style={{ fontSize: 13, fontWeight: 500 }}>AI is crafting your keyframe...</span>
                                <span style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>(this may take a few minutes)</span>
                            </div>
                        )}
                    </div>

                    <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
                </section>

                {/* Save Button Area (After Generation) */}
                {
                    generatedSceneUrl && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                            <button
                                onClick={handleSaveKeyframe}
                                disabled={!name.trim()}
                                style={{
                                    padding: "10px 24px",
                                    borderRadius: 999,
                                    background: !name.trim() ? "#94A3B8" : "#000",
                                    color: "white",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    border: "none",
                                    cursor: !name.trim() ? "not-allowed" : "pointer",
                                }}
                            >
                                {name.trim() ? "Save Keyframe" : "Enter Name to Save"}
                            </button>
                        </div>
                    )
                }

                <div style={{ height: 40 }} />

                {/* 6. Saved Keyframes */}
                <section style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, background: "#FFFFFF" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Saved Keyframes</h3>
                    {keyframes.length === 0 ? (
                        <p style={{ fontSize: 13, color: "#94A3B8" }}>No keyframes saved yet.</p>
                    ) : (
                        <div className="overflow-x-auto flex gap-4 pb-4 border-b border-gray-100 min-h-[120px]">
                            {keyframes.map(scene => (
                                <div
                                    key={scene.id}
                                    onClick={() => setActiveScene(scene)}
                                    className="flex-shrink-0 w-48 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all group flex flex-col"
                                >
                                    <div className="aspect-video bg-black relative">
                                        {(scene.status === 'pending' || !scene.imageUrl) ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2">
                                                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                                <span className="text-[10px] font-medium">Generating...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" />
                                                {/* Lip-Sync Ready Badge */}
                                                {scene.characterId && (scene.camera_angle === "Standard" || scene.camera_angle === "Close & Intimate") && (
                                                    <div className="absolute top-1 right-1 bg-green-500/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow backdrop-blur-sm flex items-center gap-1 font-bold z-10">
                                                        <span>👄</span>
                                                        <span>Ready</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="p-2 flex flex-col flex-1 gap-2">
                                        <div className="font-bold text-xs text-slate-800 truncate" title={scene.name}>{scene.name}</div>
                                        <div className="mt-auto flex justify-between items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleModifyScene(scene); }}
                                                className="flex-1 text-[10px] font-bold text-slate-700 border border-slate-200 rounded py-1 hover:bg-white hover:border-slate-400 transition-colors"
                                            >
                                                Modify
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setKeyframeToDelete(scene);
                                                }}
                                                className="flex-1 text-[10px] font-bold text-red-600 border border-slate-200 rounded py-1 hover:bg-red-50 hover:border-red-200 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Keyframe Card Modal */}
                {
                    activeScene && (
                        <KeyframeCard
                            scene={activeScene}
                            onClose={() => setActiveScene(null)}
                            onModify={() => handleModifyScene(activeScene)}
                            onDelete={() => handleDeleteScene(activeScene)}
                        />
                    )
                }

                {/* Delete Confirmation Modal */}
                {keyframeToDelete && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            background: 'white', padding: 24, borderRadius: 12,
                            width: '90%', maxWidth: 400,
                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Delete Keyframe?</h3>
                            <p style={{ color: '#64748B', marginBottom: 20 }}>
                                Are you sure you want to delete "{keyframeToDelete.name}"? This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setKeyframeToDelete(null)}
                                    style={{
                                        padding: "8px 16px", borderRadius: 6,
                                        border: "1px solid #E2E8F0",
                                        background: "white", color: "#64748B",
                                        fontWeight: 600, cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    style={{
                                        padding: "8px 16px", borderRadius: 6,
                                        border: "none", background: "#EF4444", color: "white",
                                        fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer",
                                        opacity: isDeleting ? 0.7 : 1
                                    }}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
