import React from "react";
import { useAuth } from "../../context/AuthContext";

export default function ExpressVideoCard({ vod, onClose, onDelete, onUseTemplate }) {
    if (!vod) return null;
    const { user, isAdmin } = useAuth();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    // Parse settings if string, otherwise use directly
    const settings = typeof vod.settings === "string" ? JSON.parse(vod.settings) : vod.settings || {};

    // Extract Metadata
    const title = vod.title || "Untitled Video";
    const driver = settings.ui?.driver || settings.driver || "None";
    const character = settings.ui?.characterName || settings.characterName || "Unknown";
    // Duration
    const duration = settings.ui?.durationSec || 0;

    // Scene description: check ui.scene, then ui.setting (as seen in screenshot), then fallbacks
    const topic = settings.ui?.scene || settings.scene || settings.ui?.setting || settings.setting || settings.ui?.topic || settings.topic || settings.ui?.prompt || settings.prompt || "No description provided.";

    const created = vod.created_at ? new Date(vod.created_at).toLocaleDateString() : "Unknown Date";

    // Cutaways
    const wantsCutawaysVal = settings.ui?.wantsCutaways ?? settings.wantsCutaways;
    const wantsCutaways = wantsCutawaysVal ? "Yes" : "No";

    // Cutaway images
    const cutaways = Array.isArray(settings.ui?.images) ? settings.ui.images : (Array.isArray(settings.images) ? settings.images : []);
    const cutawayCount = cutaways.length;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Mobile */}
                <button
                    className="absolute top-4 right-4 md:hidden z-50 bg-white/90 rounded-full p-2 text-black"
                    onClick={onClose}
                >
                    ✕
                </button>

                {/* Left: Video Player */}
                <div className="w-full h-[300px] md:h-auto md:w-2/3 shrink-0 bg-black flex items-center justify-center relative group">
                    {vod.video_url ? (
                        <video
                            className="w-full h-full object-contain"
                            controls
                            src={vod.video_url}
                        />
                    ) : (
                        <div className="text-white">Video Processing / Unavailable</div>
                    )}
                </div>

                {/* Right: Metadata Panel */}
                <div className="w-full md:w-1/3 bg-white flex flex-col border-l border-gray-100 flex-1 min-h-0 overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono uppercase">
                                {/* Status Badge could go here if relevant */}
                                <span>{created}</span>
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

                        {/* Description */}
                        <div>
                            <h3 className="text-xs font-bold text-black uppercase mb-2">Scene Description</h3>
                            <p className="text-sm text-gray-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                {topic}
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Duration</label>
                                <div className="text-xl font-mono text-slate-800">{duration}s</div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cutaways</label>
                                <div className="text-xl font-mono text-slate-800">{wantsCutaways}</div>
                            </div>
                        </div>

                        {/* Details List */}
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Character</span>
                                <span className="font-medium text-gray-900">{character}</span>
                            </div>
                            <div className="flex justify-between text-sm border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Driver</span>
                                <span className="font-medium text-gray-900 truncate max-w-[150px]" title={driver}>{driver}</span>
                            </div>
                        </div>

                        {/* Cutaways Preview (Optional / Extra) */}
                        {cutaways.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-black uppercase mb-2">Cutaway Sources</h3>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {cutaways.slice(0, 5).map((img, i) => (
                                        <div key={i} className="w-12 h-12 shrink-0 rounded overflow-hidden border border-gray-200 bg-gray-100">
                                            {img.url ? <img src={img.url} className="w-full h-full object-cover" /> : null}
                                        </div>
                                    ))}
                                    {cutaways.length > 5 && (
                                        <div className="w-12 h-12 shrink-0 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-bold">
                                            +{cutaways.length - 5}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Actions Footer */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
                        <div className="flex gap-3">
                            {/* Use Template */}
                            {onUseTemplate && (
                                <button
                                    onClick={() => { onUseTemplate(vod); onClose(); }} // Close after selecting template? checking workflow
                                    className="flex-1 bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>📄</span> Use Template
                                </button>
                            )}

                            {/* Delete */}
                            {(user && (vod.user_id === user.id || isAdmin)) && onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(vod);
                                        onClose();
                                    }}
                                    className="flex-1 bg-white border border-red-200 text-red-600 font-bold py-3 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>×</span> Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
