import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from "../../context/AuthContext";
import { Link } from 'react-router-dom';
import { API_CONFIG } from "../../config/api";

// --- Reusable Components (Studio Style) ---

function SectionHeader({ number, title, subtitle }) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded bg-black text-white text-xs font-bold leading-none">{number}</span>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
            </div>
            {subtitle && <p className="text-xs text-gray-500 ml-9">{subtitle}</p>}
        </div>
    );
}

// Reusable Tile Component for Closed State
function CollapsedTile({ number, title, children, onClick }) {
    return (
        <div
            onClick={onClick}
            className="group bg-white rounded-xl border border-gray-200 p-4 cursor-pointer shadow-sm hover:border-black/20 hover:shadow-md transition-all duration-200 flex items-center justify-between"
        >
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <span className="text-xl font-bold text-gray-300 group-hover:text-gray-400 transition-colors">{number}</span>
                <div className="h-8 w-px bg-gray-100 mx-1"></div>
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    {children}
                </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-all ml-4 flex-shrink-0">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="stroke-current stroke-2"><path d="M1 1L5 5L9 1" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
        </div>
    );
}

function AccordionItem({ number, title, isOpen, onToggle, children, summary, renderCollapsed }) {
    // If closed and has custom collapsed view, render that
    if (!isOpen && renderCollapsed) {
        return (
            <CollapsedTile number={number} title={title} onClick={onToggle}>
                {renderCollapsed()}
            </CollapsedTile>
        );
    }

    return (
        <div className={`bg-white rounded-xl transition-all duration-200 overflow-hidden border border-gray-100 ${isOpen ? 'shadow-lg ring-1 ring-black/5' : 'shadow-sm hover:border-gray-200 hover:shadow-md'}`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-5 text-left group"
            >
                <div className="flex items-center gap-4">
                    {/* Studio Style Number: Subtle, gray */}
                    <span className={`text-2xl font-bold transition-colors ${isOpen ? 'text-black' : 'text-gray-300 group-hover:text-gray-400'}`}>{number}</span>
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold uppercase tracking-wide transition-colors ${isOpen ? 'text-black' : 'text-gray-600'}`}>{title}</span>
                        {!isOpen && summary && (
                            <div className="text-xs text-gray-500 font-medium mt-0.5 truncate max-w-[200px] md:max-w-md">{summary}</div>
                        )}
                    </div>
                </div>
                {/* Arrow */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-gray-100 rotate-180 text-black' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="stroke-current stroke-2"><path d="M1 1L5 5L9 1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
            </button>

            {isOpen && (
                <div className="px-5 pb-6 pt-0 animate-in fade-in duration-300">
                    <div className="h-px bg-gray-100 mb-6 w-full"></div>
                    {children}
                </div>
            )}
        </div>
    );
}

function Label({ children, className = '' }) {
    return <label className={`block text-xs font-bold text-slate-700 uppercase mb-2 ${className}`}>{children}</label>;
}

function Input({ className = '', ...props }) {
    return (
        <input
            className={`w-full bg-slate-50 border border-gray-200 text-sm text-gray-900 rounded-lg p-3 focus:bg-white focus:outline-none focus:border-black transition-all placeholder:text-gray-400 ${className}`}
            {...props}
        />
    );
}

function TextArea({ className = '', ...props }) {
    return (
        <textarea
            className={`w-full bg-slate-50 border border-gray-200 text-sm text-gray-900 rounded-lg p-3 focus:bg-white focus:outline-none focus:border-black transition-all placeholder:text-gray-400 resize-none ${className}`}
            {...props}
        />
    );
}

function Select({ options, ...props }) {
    return (
        <div className="relative">
            <select
                className="w-full bg-slate-50 border border-gray-200 text-sm text-gray-900 rounded-lg p-3 focus:bg-white focus:outline-none focus:border-black transition-all cursor-pointer appearance-none"
                {...props}
            >
                {options.map(o => (
                    <option key={o} value={o}>{o}</option>
                ))}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-[10px]">▼</div>
        </div>
    );
}

function Checkbox({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-2.5 cursor-pointer select-none group py-1">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${checked ? 'bg-black border-black' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                {checked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className="stroke-white stroke-2"><path d="M1 3L3 5L7 1" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
            <span className={`text-xs font-bold uppercase transition-colors ${checked ? 'text-black' : 'text-slate-500 group-hover:text-slate-700'}`}>{label}</span>
        </label>
    );
}

function ToggleOption({ active, onClick, label, icon }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 border ${active ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
        >
            {icon && <span className="text-sm opacity-80">{icon}</span>}
            {label}
        </button>
    );
}


// Helper for volume slider
function VolumeSlider({ value, onChange, label }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <Label className="mb-0">{label}</Label>
                <span className="text-[10px] font-bold text-gray-400">{value} / 10</span>
            </div>
            <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={value || 5}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
        </div>
    );
}

function VoicePreviewButton({ voice }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            audioRef.current.load(); // Ensure fresh load
            audioRef.current.play().catch(e => console.warn("Audio play failed", e));
            setIsPlaying(true);
        }
    };

    // Reset if voice changes
    useEffect(() => {
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, [voice]);

    const url = voice?.preview_url || voice?.previewUrl || voice?.audio_url || voice?.audio;

    if (!url) return null;

    return (
        <button
            type="button"
            onClick={togglePlay}
            className={`flex items-center justify-center w-11 h-11 rounded-lg border transition-all ${isPlaying ? 'bg-black text-white border-black ring-2 ring-black/20' : 'bg-white text-black border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            title={isPlaying ? "Stop Preview" : "Play Preview"}
        >
            <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} />
            {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="10" height="10" rx="1" /></svg>
            ) : (
                <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" className="ml-0.5"><path d="M1 1.5L11 7L1 12.5V1.5Z" /></svg>
            )}
        </button>
    );
}

export default function ExpressAccordionView({
    answers,
    setAnswers,
    voices = [],
    onSubmit,
    isSubmitting,
    characterGender,
    onReset,
    savedCharacters = [],
    savedSettings = []
}) {
    const { user } = useAuth();
    const [openSection, setOpenSection] = useState(1);

    // Alias for compatibility
    const payload = answers;
    const isDeploying = isSubmitting;
    const meetsMin = (s, n) => {
        const str = String(s ?? "").trim();
        return str.length >= n;
    };

    // --- Recording State ---
    const [isRecording, setIsRecording] = useState(false);
    const [voiceKind, setVoiceKind] = useState("preset"); // 'preset' | 'clone'
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            mediaRecorderRef.current.mimeTypeFromOpts = mimeType;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const type = mediaRecorderRef.current.mimeTypeFromOpts || 'audio/webm';
                const ext = type.split('/')[1];
                const audioBlob = new Blob(audioChunksRef.current, { type });
                const audioFile = new File([audioBlob], `recording_${Date.now()}.${ext}`, { type });
                await uploadVoiceFile(audioFile);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Microphone access denied or not supported.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const uploadVoiceFile = async (file) => {
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("kind", "voice_clone");
            const res = await fetch(API_CONFIG.UPLOAD_REFERENCE_IMAGE, {
                method: "POST",
                body: formData
            });

            if (!res.ok) throw new Error("Voice upload failed: " + res.status);
            const data = await res.json();
            const url = data.publicUrl || data.url || data.image_url;

            if (url) {
                // Update Payload directly
                setAnswers(prev => ({
                    ...prev,
                    voiceId: 'recording',
                    voiceUrl: url,
                    voiceLabel: 'Cloned Voice'
                }));
            }
        } catch (err) {
            console.error("Voice upload error", err);
            alert("Failed to upload voice recording.");
        }
    };

    const isGeneratable = (() => {
        const hasTitle = !!answers.title;
        // Relaxed constraints for smoother Express experience
        const hasScene = meetsMin(answers.scene, 10);
        const hasSetting = meetsMin(answers.setting, 10);
        const hasAction = meetsMin(answers.action, 10);
        const hasReference = meetsMin(answers.referenceText, 5); // Very short dialogue allowed
        const hasDuration = Number(answers.durationSec) > 0;
        const hasVoice = !!answers.voiceId;

        const isCharacterValid = answers.driver === 'narrator'
            ? true
            : (!!answers.characterName && meetsMin(answers.character, 10));

        return hasTitle && hasScene && hasSetting && hasAction && hasReference && hasDuration && hasVoice && isCharacterValid;
    })();
    const onGenerate = onSubmit;

    const toggleSection = (num) => setOpenSection(openSection === num ? null : num);

    // Adapter for state updates
    const updatePayload = (key, value) => {
        setAnswers(prev => {
            const next = { ...prev };

            // Direct Mapping
            if (['characterName', 'character', 'setting', 'scene', 'wantsMusic', 'musicCategoryLabel', 'musicIncludeVocals', 'musicSeed', 'musicLyrics', 'action', 'referenceText', 'directorsNotes', 'wantsCaptions', 'wantsCutaways', 'research', 'title', 'driver', 'durationSec', 'voiceUrl', 'cameraAngle'].includes(key)) {
                next[key] = value;
            }
            // Aliased Mapping
            else if (key === 'script') next.referenceText = value;
            else if (key === 'captions') next.wantsCaptions = value;
            else if (key === 'cutaways') next.wantsCutaways = value;
            else if (key === 'musicVocals') next.musicIncludeVocals = value;
            else if (key === 'musicCategory') next.musicCategoryLabel = value;

            // Direct Advanced Mappings (Flat State)
            else if (key === 'style') next.stylePreset = value;
            else if (key === 'resolution') next.resolution = value;
            // No volume slider in UI, default to 10 if not present
            else if (key === 'voiceVolume10') {
                next.voiceVolume10 = value;
            }

            // Voice Logic
            else if (key === 'voice') {
                const voiceId = value;
                const v = voices.find(x => x.id === voiceId);
                if (v) {
                    next.voiceId = voiceId;
                    next.voiceLabel = v.name;
                    // reset clone url if picking a preset
                    next.voiceUrl = null;
                }
            }

            return next;
        });
    };

    const hasValidExt = (url) => {
        if (!url) return false;
        return !!url.match(/\.(jpeg|jpg|png|webp|gif|bmp)$/i);
    };

    const handleLoadCharacter = (id) => {
        if (!id) {
            // Reset to default (AI Built)
            setAnswers(prev => ({
                ...prev,
                characterName: "",
                character: "",
                voiceId: "",
                voiceUrl: null,
                voiceLabel: "",
                savedCharacterId: null
            }));
        }
        const char = savedCharacters.find(c => c.id === id);
        if (char) {
            console.log("Debug Character Load:", {
                name: char.name,
                fullbody: char.fullbody_centered,
                base: char.base_image_url
            });

            // Explicit Logic:
            let preferredImage = null;
            if (char.fullbody_centered) {
                preferredImage = char.fullbody_centered;
                if (!hasValidExt(preferredImage)) {
                    preferredImage += "?.png"; // Query Shim
                }
            } else {
                preferredImage = char.base_image_url;
            }

            console.log("Debug Final Image Selection:", preferredImage);

            setAnswers(prev => ({
                ...prev,
                characterName: char.name,
                character: char.base_prompt,
                voiceId: char.voice_id || "",
                voiceUrl: char.voice_ref_url || null,
                voiceLabel: char.voice_id === 'recording' ? 'Cloned Voice' : (voices.find(v => v.id === char.voice_id)?.name || "Unknown Voice"),
                characterImage: preferredImage || null,
                savedCharacterId: char.id
            }));
        }
    };

    const handleLoadSetting = (id) => {
        if (!id) {
            updatePayload('setting', '');
            setAnswers(prev => ({ ...prev, savedSettingId: null, settingImage: null }));
            return;
        }
        const s = savedSettings.find(x => x.id === id);
        if (s) {
            // Logic: Ensure base image has valid extension (Settings seem to usually have them)
            const preferredImage = hasValidExt(s.base_image_url) ? s.base_image_url : (hasValidExt(s.base_hero) ? s.base_hero : null);

            updatePayload('setting', s.core_prompt || s.base_prompt);
            setAnswers(prev => ({
                ...prev,
                savedSettingId: s.id,
                settingImage: preferredImage,
            }));
        }
    };

    // Summaries for collapsed states
    const summaries = useMemo(() => {
        return {
            talent: payload.driver === 'narrator' ? 'Voiceover Only' : (payload.characterName ? `${payload.characterName} (${payload.voiceLabel || 'No Voice'})` : "No cast selected"),
            atmosphere: payload.setting ? `${payload.setting} • ${payload.musicCategoryLabel || 'No Music'}` : "Standard Atmosphere",
            action: payload.action || "No action described"
        };
    }, [payload]);

    const currentVoiceId = typeof payload.voiceId === 'object' ? payload.voiceId.id : payload.voiceId;

    return (
        <div className="py-8 pb-10 animate-in fade-in duration-500">

            {/* Header Removed to match Wizard View */}

            <div className="flex flex-col gap-4">

                {/* HEADER / TITLE INPUT - STUDIO STYLE (MATCHING ACCORDION BLOCK) */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all shadow-sm">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Project Name</label>
                        <input
                            type="text"
                            placeholder="Untitled Project Name"
                            value={payload.title}
                            onChange={e => updatePayload('title', e.target.value)}
                            className="w-full p-2 text-sm font-medium border border-gray-300 rounded-lg outline-none focus:border-black focus:ring-1 focus:ring-black transition-all bg-white shadow-sm placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* 01 THE TALENT */}
                <AccordionItem
                    number="01"
                    title="The Cast"
                    isOpen={openSection === 1}
                    onToggle={() => toggleSection(1)}
                    summary={summaries.talent}
                    renderCollapsed={() => (
                        <div className="flex items-center gap-3 w-full">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">The Cast</span>
                                <span className="text-xs text-gray-500 font-medium truncate max-w-[200px] md:max-w-md">
                                    {payload.characterName || 'No cast selected'}
                                </span>
                            </div>
                            {payload.savedCharacterId && savedCharacters.find(c => c.id === payload.savedCharacterId)?.previewUrl && (
                                <img
                                    src={savedCharacters.find(c => c.id === payload.savedCharacterId).previewUrl}
                                    alt="Char"
                                    className="w-8 h-8 rounded-full object-cover border border-gray-200 ml-auto"
                                />
                            )}
                        </div>
                    )}
                >
                    <div className="space-y-6">
                        {/* Driver Selection */}
                        <div>
                            <Label>Driver</Label>
                            <div className="flex flex-col md:flex-row bg-slate-50 p-1 rounded-lg border border-gray-200">
                                <ToggleOption
                                    label="On-Screen Character"
                                    active={payload.driver !== 'narrator'}
                                    onClick={() => updatePayload('driver', 'character')}
                                    icon="👤"
                                />
                                <ToggleOption
                                    label="Voiceover Only"
                                    active={payload.driver === 'narrator'}
                                    onClick={() => updatePayload('driver', 'narrator')}
                                    icon="🎙️"
                                />
                            </div>
                        </div>

                        {payload.driver !== 'narrator' && (
                            <div className="space-y-6 animate-in slide-in-from-top-2">
                                <SectionHeader number="A" title="Casting" />

                                {/* 1. Character Carousel (Full Width) */}
                                {savedCharacters && savedCharacters.length > 0 && (
                                    <div className="mb-6">
                                        <div className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Select a Character</div>
                                        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                            {/* AI Built Option */}
                                            <div
                                                onClick={() => handleLoadCharacter(null)}
                                                className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group snap-start"
                                            >
                                                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${!payload.savedCharacterId ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                                                    }`}>
                                                    <span className={`text-xs font-medium ${!payload.savedCharacterId ? 'text-black' : 'text-slate-400'}`}>New</span>
                                                </div>
                                                <span className={`text-xs font-medium text-center truncate max-w-[80px] ${!payload.savedCharacterId ? 'text-black' : 'text-slate-500'
                                                    }`}>Custom</span>
                                            </div>

                                            {savedCharacters
                                                .filter(char => char.voice_id && (char.voice_id !== 'recording' || char.voice_ref_url)) // Filter out invalid voices
                                                .map(char => {
                                                    const isSelected = payload.savedCharacterId === char.id;
                                                    return (
                                                        <div
                                                            key={char.id}
                                                            onClick={() => handleLoadCharacter(char.id)}
                                                            className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer group snap-start"
                                                        >
                                                            <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all duration-200 ${isSelected ? 'border-black ring-1 ring-black ring-offset-2' : 'border-white shadow-sm group-hover:border-slate-300'
                                                                }`}>
                                                                {char.previewUrl ? (
                                                                    <img
                                                                        src={char.previewUrl}
                                                                        alt={char.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300 text-[10px] font-bold">
                                                                        {char.name.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className={`text-xs font-medium text-center truncate max-w-[80px] ${isSelected ? 'text-black' : 'text-slate-500'
                                                                }`}>
                                                                {char.name}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}

                                {/* Manual Inputs - Only show if NO saved character is selected */}
                                {!payload.savedCharacterId && (
                                    <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                                        <div className="flex flex-col gap-6 mb-6">
                                            {/* Col 1: Character Name */}
                                            <div className="space-y-5">
                                                <div>
                                                    <Label>Character / narrator name</Label>
                                                    <Input
                                                        placeholder="e.g. Detective Miller"
                                                        value={payload.characterName || ''}
                                                        onChange={e => updatePayload('characterName', e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Col 2: Voice Select or Record */}
                                            <div className="space-y-5">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <Label className="mb-0">Voice</Label>
                                                        <div className="flex bg-slate-100 rounded p-0.5">
                                                            <button
                                                                onClick={() => setVoiceKind("preset")}
                                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${voiceKind === 'preset' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >Library</button>
                                                            <button
                                                                onClick={() => setVoiceKind("clone")}
                                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${voiceKind === 'clone' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                            >Clone</button>
                                                        </div>
                                                    </div>

                                                    {voiceKind === 'preset' ? (
                                                        <div className="relative flex items-center gap-2">
                                                            <div className="relative flex-1">
                                                                <select
                                                                    className="w-full bg-slate-50 border border-gray-200 text-sm font-medium text-gray-900 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-none focus:border-black transition-all cursor-pointer appearance-none"
                                                                    value={currentVoiceId || ''}
                                                                    onChange={e => updatePayload('voice', e.target.value)}
                                                                >
                                                                    <option value="" disabled>Select a voice...</option>
                                                                    {currentVoiceId === 'recording' && (
                                                                        <option value="recording">Cloned Voice (Loaded)</option>
                                                                    )}
                                                                    {(voices || []).map(v => (
                                                                        <option key={v.id} value={v.id}>{v.name} &mdash; {v.labels?.gender || 'Voice'}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                                            </div>
                                                            <VoicePreviewButton voice={payload.voiceUrl ? { preview_url: payload.voiceUrl } : (voices || []).find(v => v.id === currentVoiceId)} />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
                                                            {/* Upload Box */}
                                                            <label className="border border-dashed border-slate-300 rounded-lg p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                                                                <span className="text-xs text-slate-500 font-medium block">
                                                                    {payload.voiceUrl ? "✅ Audio Uploaded" : "📁 Upload Audio File"}
                                                                </span>
                                                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVoiceFile(e.target.files[0])} />
                                                            </label>

                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase justify-center">
                                                                <div className="h-px bg-slate-200 flex-1"></div> OR <div className="h-px bg-slate-200 flex-1"></div>
                                                            </div>

                                                            <button
                                                                onClick={isRecording ? stopRecording : startRecording}
                                                                className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${isRecording ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white hover:border-slate-300'}`}
                                                            >
                                                                {isRecording ? (
                                                                    <>
                                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                                        Stop Recording
                                                                    </>
                                                                ) : (
                                                                    <>🎙️ Record Voice</>
                                                                )}
                                                            </button>

                                                            {/* Audio Preview */}
                                                            {payload.voiceUrl && (
                                                                <audio src={payload.voiceUrl} controls className="w-full h-8 mt-1" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Character description</Label>
                                            <TextArea
                                                rows={3}
                                                placeholder="e.g. Weary face, trenchcoat, rain-soaked..."
                                                value={payload.character || ''}
                                                onChange={e => updatePayload('character', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {payload.driver === 'narrator' && (
                            <div className="space-y-5 animate-in slide-in-from-top-2">
                                <SectionHeader number="A" title="Narration Voice" />
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <Label className="mb-0">Voice</Label>
                                        <div className="flex bg-slate-100 rounded p-0.5">
                                            <button
                                                onClick={() => setVoiceKind("preset")}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${voiceKind === 'preset' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >Library</button>
                                            <button
                                                onClick={() => setVoiceKind("clone")}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${voiceKind === 'clone' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >Clone</button>
                                        </div>
                                    </div>

                                    {voiceKind === 'preset' ? (
                                        <div className="relative flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    className="w-full bg-slate-50 border border-gray-200 text-sm font-medium text-gray-900 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-none focus:border-black transition-all cursor-pointer appearance-none"
                                                    value={currentVoiceId || ''}
                                                    onChange={e => updatePayload('voice', e.target.value)}
                                                >
                                                    <option value="" disabled>Select a voice...</option>
                                                    {currentVoiceId === 'recording' && (
                                                        <option value="recording">Cloned Voice (Loaded)</option>
                                                    )}
                                                    {(voices || []).map(v => (
                                                        <option key={v.id} value={v.id}>{v.name} &mdash; {v.labels?.gender || 'Voice'}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                            </div>
                                            <VoicePreviewButton voice={payload.voiceUrl ? { preview_url: payload.voiceUrl } : (voices || []).find(v => v.id === currentVoiceId)} />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
                                            {/* Upload Box */}
                                            <label className="border border-dashed border-slate-300 rounded-lg p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                                                <span className="text-xs text-slate-500 font-medium block">
                                                    {payload.voiceUrl ? "✅ Audio Uploaded" : "📁 Upload Audio File"}
                                                </span>
                                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadVoiceFile(e.target.files[0])} />
                                            </label>

                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase justify-center">
                                                <div className="h-px bg-slate-200 flex-1"></div> OR <div className="h-px bg-slate-200 flex-1"></div>
                                            </div>

                                            <button
                                                onClick={isRecording ? stopRecording : startRecording}
                                                className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${isRecording ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-white hover:border-slate-300'}`}
                                            >
                                                {isRecording ? (
                                                    <>
                                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                        Stop Recording
                                                    </>
                                                ) : (
                                                    <>🎙️ Record Voice</>
                                                )}
                                            </button>

                                            {/* Audio Preview */}
                                            {payload.voiceUrl && (
                                                <audio src={payload.voiceUrl} controls className="w-full h-8 mt-1" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </AccordionItem>


                <AccordionItem
                    number="02"
                    title="The Set"
                    isOpen={openSection === 2}
                    onToggle={() => toggleSection(2)}
                    summary={summaries.atmosphere}
                    renderCollapsed={() => (
                        <div className="flex items-center gap-3 w-full">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">The Set</span>
                                <span className="text-xs text-gray-500 font-medium truncate max-w-[200px] md:max-w-md">
                                    {payload.setting || 'No set selected'}
                                </span>
                            </div>
                            {/* Tiny Setting Preview */}
                            {payload.savedSettingId && savedSettings.find(s => s.id === payload.savedSettingId)?.previewUrl && (
                                <img
                                    src={savedSettings.find(s => s.id === payload.savedSettingId).previewUrl}
                                    alt="Setting"
                                    className="w-12 h-8 rounded object-cover border border-gray-200 ml-auto"
                                />
                            )}
                        </div>
                    )}
                >
                    <div className="space-y-10">
                        {/* A. Plan Overview */}
                        <div>
                            <SectionHeader number="A" title="Plan Overview" />
                            <div className="mb-2">
                                <Label>Scene overview</Label>
                                <TextArea
                                    rows={3}
                                    placeholder="High level summary... (e.g. A tense standoff in a neon city)"
                                    value={payload.scene || ''}
                                    onChange={e => updatePayload('scene', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* B. Visual Vibe */}
                        <div>
                            <SectionHeader number="B" title="Visual Vibe" />

                            {/* Load Setting: Visual Carousel (Full Width) */}
                            {savedSettings && savedSettings.length > 0 && (
                                <div className="mb-6">
                                    <div className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Select a Set</div>
                                    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                        {/* New / Custom Option */}
                                        <div
                                            onClick={() => handleLoadSetting(null)}
                                            className={`relative flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden cursor-pointer group snap-start transition-all duration-200 border-2 ${!payload.savedSettingId ? 'border-black bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border mb-1 ${!payload.savedSettingId ? 'border-black text-black' : 'border-slate-300 text-slate-300'}`}>
                                                    <span className="text-xs font-bold">+</span>
                                                </div>
                                                <span className={`text-xs font-bold ${!payload.savedSettingId ? 'text-black' : 'text-slate-400'}`}>New</span>
                                                <span className="text-[10px] text-slate-400 font-medium">Custom</span>
                                            </div>
                                        </div>

                                        {savedSettings.map(setting => {
                                            const isSelected = payload.savedSettingId === setting.id;
                                            return (
                                                <div
                                                    key={setting.id}
                                                    onClick={() => handleLoadSetting(setting.id)}
                                                    className={`relative flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden cursor-pointer group snap-start transition-all duration-200 ${isSelected ? 'ring-2 ring-black ring-offset-2' : 'border border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {setting.previewUrl ? (
                                                        <img
                                                            src={setting.previewUrl}
                                                            alt={setting.name}
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300 text-[10px] font-bold px-2 text-center">
                                                            {setting.name}
                                                        </div>
                                                    )}

                                                    {/* Gradient Overlay & Name */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2.5">
                                                        <span className="text-white text-[10px] font-bold truncate w-full shadow-sm drop-shadow-md">
                                                            {setting.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}



                            {/* Hide Setting Description if Saved Setting Selected */}
                            {!payload.savedSettingId && (
                                <div className="mb-5 animate-in slide-in-from-top-2 fade-in duration-300">
                                    <Label>Setting description</Label>
                                    <Input
                                        placeholder="e.g. Cyberpunk noodle bar, interior, night..."
                                        value={payload.setting}
                                        onChange={e => updatePayload('setting', e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                                <div>
                                    <Label>Visual style</Label>
                                    <Select
                                        options={["Photorealistic", "Cinematic", "Documentary", "Anime", "Pixar-style", "Watercolor", "Comic-book", "Noir"]}
                                        value={payload.stylePreset || "Photorealistic"}
                                        onChange={e => updatePayload('style', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Resolution</Label>
                                    <Select
                                        options={["SD", "HD"]}
                                        value={payload.resolution || "SD"}
                                        onChange={e => updatePayload('resolution', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Camera Angle</Label>
                                    <Select
                                        options={[
                                            "Standard",
                                            "Close & Intimate"
                                        ]}
                                        value={payload.cameraAngle || "Standard"}
                                        onChange={e => updatePayload('cameraAngle', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Audio Vibe */}
                        <div>
                            <SectionHeader number="C" title="Audio Landscape" />
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between bg-slate-50 border border-gray-200 p-3 rounded-lg">
                                    <Label className="mb-0">Music</Label>
                                    <Checkbox
                                        label={payload.wantsMusic ? "Enabled" : "Disabled"}
                                        checked={payload.wantsMusic}
                                        onChange={e => updatePayload('wantsMusic', e.target.checked)}
                                    />
                                </div>

                                {payload.wantsMusic && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pl-1 animate-in slide-in-from-top-2">
                                        <div className="md:col-span-1">
                                            <Label>Music style</Label>
                                            <Select
                                                options={["Rock Instrumental", "Jazz Instrumental", "Hip-Hop / Trap Beat", "Orchestral / Cinematic", "Lo-Fi / Chillhop", "EDM / House", "Ambient / Soundscape", "Reggae / Dub", "Funk / Groove", "Country / Folk", "Blues", "Metal", "Techno", "Latin / Salsa", "R&B / Soul", "Gospel", "Indian Classical / Sitar", "African Percussion", "Celtic / Folk", "Synthwave / Retro"]}
                                                value={payload.musicCategoryLabel}
                                                onChange={e => updatePayload('musicCategory', e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <Label>Include vocals</Label>
                                            <div className="flex gap-2">
                                                <ToggleOption
                                                    label="Instrumental"
                                                    active={!payload.musicIncludeVocals}
                                                    onClick={() => updatePayload('musicVocals', false)}
                                                />
                                                <ToggleOption
                                                    label="Vocals"
                                                    active={payload.musicIncludeVocals}
                                                    onClick={() => updatePayload('musicVocals', true)}
                                                />
                                            </div>
                                        </div>

                                        <div className="md:col-span-1">
                                            <Label>Music seed (Optional)</Label>
                                            <Input
                                                placeholder="Random"
                                                className="font-mono text-xs"
                                                value={payload.musicSeed || ''}
                                                onChange={e => updatePayload('musicSeed', e.target.value)}
                                            />
                                        </div>

                                        {payload.musicIncludeVocals && (
                                            <div className="md:col-span-3">
                                                <Label>Lyrics Hint (Optional)</Label>
                                                <Input
                                                    placeholder="e.g. A solitary hero walking in rain..."
                                                    value={payload.musicLyrics}
                                                    onChange={e => updatePayload('musicLyrics', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </AccordionItem>

                {/* 03 THE ACTION */}
                <AccordionItem
                    number="03"
                    title="The Action"
                    isOpen={openSection === 3}
                    onToggle={() => toggleSection(3)}
                    summary={summaries.action}
                    renderCollapsed={() => (
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">The Action</span>
                            <span className="text-xs text-gray-500 font-medium truncate max-w-[200px] md:max-w-md">
                                {payload.action || 'Describe the action...'}
                            </span>
                        </div>
                    )}
                >
                    <div className="space-y-6">
                        <div>
                            <Label>Action</Label>
                            <TextArea
                                rows={3}
                                placeholder="What is happening in the scene? e.g. He lights a cigarette and looks up..."
                                value={payload.action}
                                onChange={e => updatePayload('action', e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Reference text (script context)</Label>
                            <TextArea
                                rows={4}
                                placeholder={`CHARACTER: "Line of dialogue here..."\n(Action text in parentheses)`}
                                value={payload.referenceText}
                                onChange={e => updatePayload('script', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <Label>Director’s notes (Optional)</Label>
                                <Input
                                    placeholder="e.g. Slow zoom in, warm lighting..."
                                    value={payload.directorsNotes}
                                    onChange={e => updatePayload('directorsNotes', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Duration (seconds)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        placeholder="30"
                                        value={payload.durationSec}
                                        onChange={e => updatePayload('durationSec', Number(e.target.value))}
                                    />
                                    <span className="text-sm font-bold text-gray-500">sec</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-2">
                            <Checkbox
                                label="Captions"
                                checked={payload.wantsCaptions}
                                onChange={e => updatePayload('captions', e.target.checked)}
                            />
                            {payload.driver !== 'narrator' && (
                                <Checkbox
                                    label="Cutaways"
                                    checked={payload.wantsCutaways}
                                    onChange={e => updatePayload('cutaways', e.target.checked)}
                                />
                            )}
                            <Checkbox
                                label="Agentic research"
                                checked={payload.research}
                                onChange={e => updatePayload('research', e.target.checked)}
                            />
                        </div>
                    </div>
                </AccordionItem >
            </div >

            {/* GENERATE ACTIONS */}
            {/* RESET ACTION (Floating in gap) */}
            <div className="mt-8 flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-700">
                <button
                    onClick={onReset}
                    className="text-xs font-bold uppercase tracking-widest text-gray-300 hover:text-red-500 transition-colors py-2"
                >
                    Reset all
                </button>
            </div>

            {/* GENERATE ACTIONS */}
            <div className="mt-4 pt-8 border-t border-gray-100 flex flex-col-reverse md:flex-row gap-6 items-center justify-end animate-in fade-in slide-in-from-bottom-4 duration-700">
                <button
                    onClick={onGenerate}
                    disabled={!isGeneratable || isDeploying}
                    className="w-full py-4 text-base font-bold uppercase tracking-widest rounded-xl shadow-xl transition-all disabled:bg-slate-400 disabled:text-gray-100 disabled:shadow-none disabled:cursor-not-allowed bg-black text-white hover:bg-gray-900 group"
                >
                    {isDeploying ? (
                        <span className="flex items-center justify-center gap-3">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            Production in Progress...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Start Production <span className="text-white/50 group-hover:translate-x-1 transition-transform">→</span>
                        </span>
                    )}
                </button>
            </div>

        </div >
    );
}
