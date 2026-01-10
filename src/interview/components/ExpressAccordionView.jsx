import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from "../../context/AuthContext";
import { Link } from 'react-router-dom';

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

function AccordionItem({ number, title, isOpen, onToggle, children, summary }) {
    return (
        <div className={`bg-white rounded-xl transition-all duration-200 overflow-hidden border border-gray-100 ${isOpen ? 'shadow-lg ring-1 ring-black/5' : 'hover:border-gray-200 hover:shadow-sm'}`}>
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
    onReset
}) {
    const { user } = useAuth();
    const [openSection, setOpenSection] = useState(1);

    // Alias for compatibility
    const payload = answers;
    const isDeploying = isSubmitting;
    // Helper for validation (internal to this component)
    const meetsMin = (s, n) => {
        const str = String(s ?? "").trim();
        return str.length >= n;
    };

    const isGeneratable = (() => {
        const hasTitle = !!answers.title;
        const hasScene = meetsMin(answers.scene, 40);
        const hasSetting = meetsMin(answers.setting, 40);
        const hasAction = meetsMin(answers.action, 30);
        const hasReference = meetsMin(answers.referenceText, 30);
        const hasDuration = Number(answers.durationSec) > 0;
        const hasVoice = !!answers.voiceId;

        const isCharacterValid = answers.driver === 'narrator'
            ? true
            : (!!answers.characterName && meetsMin(answers.character, 40));

        return hasTitle && hasScene && hasSetting && hasAction && hasReference && hasDuration && hasVoice && isCharacterValid;
    })();
    const onGenerate = onSubmit;

    const toggleSection = (num) => setOpenSection(openSection === num ? null : num);

    // Adapter for state updates
    const updatePayload = (key, value) => {
        setAnswers(prev => {
            const next = { ...prev };

            // Direct Mapping
            if (['characterName', 'character', 'setting', 'scene', 'wantsMusic', 'musicCategoryLabel', 'musicIncludeVocals', 'musicSeed', 'musicLyrics', 'action', 'referenceText', 'directorsNotes', 'wantsCaptions', 'wantsCutaways', 'research', 'title', 'driver', 'durationSec'].includes(key)) {
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
            else if (key === 'voiceVolume10') {
                next.voiceVolume10 = value;
                // We don't store decimal voiceVolume in flat state usually, but if needed:
                // next.voiceVolume = value / 10; 
            }
            else if (key === 'musicVolume10') {
                next.musicVolume10 = value;
                // next.musicVolume = value / 10;
            }

            // Voice Logic
            else if (key === 'voice') {
                const voiceId = value;
                const v = voices.find(x => x.id === voiceId);
                if (v) {
                    next.voiceId = voiceId;
                    next.voiceLabel = v.name;
                }
            }

            return next;
        });
    };

    // Summaries for collapsed states
    const summaries = useMemo(() => {
        return {
            talent: payload.driver === 'narrator' ? 'Voiceover Only' : (payload.characterName ? `${payload.characterName} (${payload.voiceLabel || 'No Voice'})` : "No talent selected"),
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
                    title="The Talent"
                    isOpen={openSection === 1}
                    onToggle={() => toggleSection(1)}
                    summary={summaries.talent}
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Col 1: Casting Name */}
                                    <div className="space-y-5">
                                        <SectionHeader number="A" title="Casting" />
                                        <div>
                                            <Label>Character / narrator name</Label>
                                            <Input
                                                placeholder="e.g. Detective Miller"
                                                value={payload.characterName || ''}
                                                onChange={e => updatePayload('characterName', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Col 2: Voice Select */}
                                    <div className="space-y-5">
                                        <SectionHeader number="B" title="Voice & Performance" />
                                        <div>
                                            <Label>Voice</Label>
                                            <div className="relative flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <select
                                                        className="w-full bg-slate-50 border border-gray-200 text-sm font-medium text-gray-900 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-none focus:border-black transition-all cursor-pointer appearance-none"
                                                        value={currentVoiceId || ''}
                                                        onChange={e => updatePayload('voice', e.target.value)}
                                                    >
                                                        <option value="" disabled>Select a voice...</option>
                                                        {(voices || []).map(v => (
                                                            <option key={v.id} value={v.id}>{v.name} &mdash; {v.labels?.gender || 'Voice'}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                                </div>

                                                <VoicePreviewButton voice={(voices || []).find(v => v.id === currentVoiceId)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Full Width Description */}
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

                        {payload.driver === 'narrator' && (
                            <div className="space-y-5 animate-in slide-in-from-top-2">
                                <SectionHeader number="A" title="Narration Voice" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <Label>Voice</Label>
                                        <div className="relative flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    className="w-full bg-slate-50 border border-gray-200 text-sm font-medium text-gray-900 rounded-lg px-3 py-2.5 focus:bg-white focus:outline-none focus:border-black transition-all cursor-pointer appearance-none"
                                                    value={currentVoiceId || ''}
                                                    onChange={e => updatePayload('voice', e.target.value)}
                                                >
                                                    <option value="" disabled>Select a voice...</option>
                                                    {(voices || []).map(v => (
                                                        <option key={v.id} value={v.id}>{v.name} &mdash; {v.labels?.gender || 'Voice'}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                            </div>
                                            <VoicePreviewButton voice={(voices || []).find(v => v.id === currentVoiceId)} />
                                        </div>
                                    </div>
                                    <div>
                                        <VolumeSlider
                                            label="Voice volume (0.1–1.0)"
                                            value={payload.advanced?.voiceVolume10}
                                            onChange={v => updatePayload('voiceVolume10', v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </AccordionItem>


                {/* 02 THE ATMOSPHERE */}
                <AccordionItem
                    number="02"
                    title="The Atmosphere"
                    isOpen={openSection === 2}
                    onToggle={() => toggleSection(2)}
                    summary={summaries.atmosphere}
                >
                    <div className="space-y-8">
                        {/* Visual Vibe */}
                        <div>
                            <SectionHeader number="A" title="Visual Vibe" />
                            <div className="mb-5">
                                <Label>Scene overview</Label>
                                <TextArea
                                    rows={2}
                                    placeholder="High level summary... (e.g. A tense standoff in a neon city)"
                                    value={payload.scene || ''}
                                    onChange={e => updatePayload('scene', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <Label>Setting description</Label>
                                    <Input
                                        placeholder="e.g. Cyberpunk noodle bar, interior, night..."
                                        value={payload.setting}
                                        onChange={e => updatePayload('setting', e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <Label>Visual style</Label>
                                        <Select
                                            options={["Photorealistic", "Cinematic", "Documentary", "Anime", "Pixar-style", "Watercolor", "Comic-book", "Noir"]}
                                            value={payload.stylePreset || "Photorealistic"}
                                            onChange={e => updatePayload('style', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-full md:w-1/3">
                                        <Label>Resolution</Label>
                                        <Select
                                            options={["SD", "HD"]}
                                            value={payload.resolution || "SD"}
                                            onChange={e => updatePayload('resolution', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Audio Vibe */}
                        <div>
                            <SectionHeader number="B" title="Audio Landscape" />
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
                            <Label>Reference text</Label>
                            <TextArea
                                rows={4}
                                className="font-mono text-xs"
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
                </AccordionItem>
            </div>

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

        </div>
    );
}
