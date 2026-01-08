import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function ProjectThumbnail({ scene, onDelete, onLoad, onClick }) {
    if (!scene) return null;
    const { user, isAdmin } = useAuth();

    const {
        id,
        name,
        thumbnailUrl, // From DB
        thumbnail_url,
        video_url,    // From DB (final URL)
        videoUrl,     // legacy
        status,
        created_at,
        data,         // Contains { timeline, etc }
    } = scene;

    const finalThumb = thumbnailUrl || thumbnail_url;
    const finalVideo = video_url || videoUrl;
    const isRendering = status === 'rendering';
    const clipCount = data?.timeline?.length || 0;
    const duration = data?.timeline?.reduce((acc, c) => acc + (Number(c.duration) || 0), 0) || Number(scene.duration) || 0;

    return (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col relative h-full">
            {/* Thumbnail / Preview Area */}
            <div
                className="aspect-video bg-black relative cursor-pointer"
                onClick={onClick}
            >
                {finalThumb ? (
                    <img
                        src={finalThumb}
                        className={`w-full h-full object-cover transition-opacity ${isRendering ? 'opacity-50' : 'opacity-90 group-hover:opacity-100'}`}
                        alt={name}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-700">
                        No Preview
                    </div>
                )}

                {/* Clip Count Badge */}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono backdrop-blur-sm">
                        {clipCount} clip{clipCount !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Status / Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {isRendering ? (
                        <div className="flex flex-col items-center gap-2">
                            <span className="animate-spin text-white">◌</span>
                            <span className="text-[10px] text-white font-bold bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">PROCESSING</span>
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                            <span className="text-white text-xl ml-1">▶</span>
                        </div>
                    )}
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono backdrop-blur-sm">
                    {duration.toFixed(1)}s
                </div>
            </div>

            {/* Card Body */}
            <div className="p-3 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                    <h3
                        className="text-sm font-bold text-gray-900 truncate flex-1 pr-2 cursor-pointer hover:text-blue-600"
                        onClick={onClick}
                        title={name}
                    >
                        {name}
                    </h3>
                </div>

                {/* Date removed as requested */}

                {/* Actions Footer - Pushed to bottom */}
                <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                    {/* Delete Button */}
                    {user && (scene.user_id === user.id || isAdmin) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(scene.id);
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Delete Scene"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    )}

                    {/* Download Button */}
                    {finalVideo && !isRendering && (
                        <a
                            href={finalVideo}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-black transition-colors p-1 flex items-center gap-1"
                            title="Download Video"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
