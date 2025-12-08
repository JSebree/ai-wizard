import React from "react";

export default function ProjectCard({ scene, onClose, onLoad, onDelete }) {
    if (!scene) return null;

    const {
        id,
        name,
        thumbnailUrl,
        thumbnail_url,
        video_url,
        videoUrl,
        status,
        created_at,
        data, // { timeline, musicStyle, burnCaptions, audioTrack }
    } = scene;

    const finalThumb = video_url || videoUrl || thumbnailUrl || thumbnail_url;
    const isRendering = status === 'rendering';
    const timeline = data?.timeline || [];
    const duration = timeline.reduce((acc, c) => acc + (Number(c.duration) || 0), 0) || Number(scene.duration) || 0;
    const clipCount = timeline.length;
    const musicStyle = data?.musicStyle || "None";
    const captions = data?.burnCaptions ? "On" : "Off";
    const audioTrack = data?.audioTrack;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Mobile */}
                <button
                    className="absolute top-4 right-4 md:hidden z-50 bg-white/90 rounded-full p-2 text-black"
                    onClick={onClose}
                >
                    ✕
                </button>

                {/* Left: Preview Area */}
                <div className="w-full md:w-2/3 bg-black flex items-center justify-center relative group">
                    {(video_url || videoUrl) ? (
                        <video
                            className="w-full h-full object-contain"
                            controls
                            src={video_url || videoUrl}
                        />
                    ) : (
                        <div className="relative w-full h-full">
                            <img
                                src={thumbnailUrl || thumbnail_url}
                                className="w-full h-full object-contain opacity-50"
                            />
                            {isRendering && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="animate-spin text-white text-4xl mb-4">◌</span>
                                    <span className="text-white font-bold bg-black/50 px-4 py-1 rounded-full backdrop-blur-md">
                                        Rendering in Progress...
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Metadata Panel */}
                <div className="w-full md:w-1/3 bg-white flex flex-col border-l border-gray-100">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{name}</h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono uppercase">
                                <span className={`px-2 py-0.5 rounded-full ${isRendering ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                    {status || 'Saved'}
                                </span>
                                <span>•</span>
                                <span>{new Date(created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="hidden md:block text-gray-400 hover:text-black text-2xl leading-none"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Duration</label>
                                <div className="text-xl font-mono text-slate-800">{duration.toFixed(1)}s</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Clips</label>
                                <div className="text-xl font-mono text-slate-800">{clipCount}</div>
                            </div>
                        </div>

                        {/* Configuration */}
                        <div>
                            <h3 className="text-xs font-bold text-black uppercase mb-3 border-b border-gray-100 pb-2">Configuration</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Music Style</span>
                                    <span className="font-medium">{musicStyle}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Captions</span>
                                    <span className="font-medium">{captions}</span>
                                </div>
                                {audioTrack && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Audio Track</span>
                                        <span className="font-medium truncate max-w-[150px]" title={audioTrack.name}>{audioTrack.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Clip List (Mini Timeline) */}
                        <div>
                            <h3 className="text-xs font-bold text-black uppercase mb-3 border-b border-gray-100 pb-2">Shot List</h3>
                            <div className="space-y-2">
                                {timeline.map((clip, idx) => (
                                    <div key={idx} className="flex gap-3 items-center group/clip">
                                        <div className="w-6 h-6 rounded bg-black text-white flex items-center justify-center text-[10px] font-mono flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate text-gray-800">{clip.name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                {(Number(clip.duration)).toFixed(1)}s • {clip.type === 'broll' ? 'B-Roll' : 'Character'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
                        <button
                            onClick={() => { onClose(); onLoad(scene); }}
                            className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                            <span>📂</span> Load Project
                        </button>

                        <div className="flex gap-3">
                            {(video_url || videoUrl) && (
                                <a
                                    href={video_url || videoUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 bg-white border border-gray-200 text-black font-bold py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>↓</span> Download
                                </a>
                            )}
                            <button
                                onClick={() => {
                                    if (confirm("Delete this scene permanently?")) {
                                        onDelete(id);
                                        onClose();
                                    }
                                }}
                                className="flex-1 bg-white border border-red-200 text-red-600 font-bold py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                            >
                                <span>×</span> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
