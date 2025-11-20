// src/studios/components/SettingCard.jsx
import React, { useState } from 'react';

export default function SettingCard({ setting, onClose }) {
  const [fullImage, setFullImage] = useState(null);

  if (!setting) return null;

  const {
    name,
    core_prompt,
    mood,
    base_image_url,
    baseImageUrl,
    base_hero,
    baseHero,
    referenceImageUrl,
    reference_image_url,
    scene_n,
    scene_ne,
    scene_e,
    scene_se,
    scene_s,
    scene_sw,
    scene_w,
    scene_nw,
    establishing_overhead,
    createdAt,
    created_at,
    status,
  } = setting;

  const resolvedBaseImage =
    base_hero ||
    baseHero ||
    base_image_url ||
    baseImageUrl ||
    referenceImageUrl ||
    reference_image_url ||
    null;

  // Choose a primary image to display as the main thumbnail
  const primaryImage =
    resolvedBaseImage ||
    scene_n ||
    scene_e ||
    scene_s ||
    scene_w ||
    scene_ne ||
    scene_se ||
    scene_sw ||
    scene_nw ||
    establishing_overhead ||
    null;

  // All images we might have for this setting
  const galleryImages = [
    { key: 'base', label: 'Base image', url: resolvedBaseImage },
    { key: 'scene_n', label: 'North', url: scene_n },
    { key: 'scene_ne', label: 'North-east', url: scene_ne },
    { key: 'scene_e', label: 'East', url: scene_e },
    { key: 'scene_se', label: 'South-east', url: scene_se },
    { key: 'scene_s', label: 'South', url: scene_s },
    { key: 'scene_sw', label: 'South-west', url: scene_sw },
    { key: 'scene_w', label: 'West', url: scene_w },
    { key: 'scene_nw', label: 'North-west', url: scene_nw },
    { key: 'establishing_overhead', label: 'Overhead', url: establishing_overhead },
  ].filter((entry) => !!entry.url);

  // Checkmark indicator row (same idea as CharacterCard)
  const galleryStatus = [
    { key: 'base', label: 'Base', present: !!resolvedBaseImage },
    { key: 'n', label: 'N', present: !!scene_n },
    { key: 'ne', label: 'NE', present: !!scene_ne },
    { key: 'e', label: 'E', present: !!scene_e },
    { key: 'se', label: 'SE', present: !!scene_se },
    { key: 's', label: 'S', present: !!scene_s },
    { key: 'sw', label: 'SW', present: !!scene_sw },
    { key: 'w', label: 'W', present: !!scene_w },
    { key: 'nw', label: 'NW', present: !!scene_nw },
    { key: 'overhead', label: 'Overhead', present: !!establishing_overhead },
  ];

  function handleClose() {
    setFullImage(null);
    onClose?.();
  }

  return (
    <>
      {/* Outer modal */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-black"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
          >
            ✕
          </button>

          <div className="flex items-start gap-6">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={name}
                className="max-w-[380px] max-h-[320px] rounded-lg object-cover border cursor-pointer"
                onClick={() => setFullImage(primaryImage)}
              />
            ) : (
              <div className="w-72 h-60 rounded-lg border bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                No image
              </div>
            )}

            <div className="flex-1 space-y-2">
              <div>
                <h3 className="font-semibold text-lg">{name}</h3>
                <p className="text-xs text-gray-500">
                  Created: {new Date(createdAt || created_at).toLocaleString()}
                </p>
                {status && (
                  <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    Status: {status}
                  </p>
                )}
              </div>

              {mood && (
                <p className="text-xs text-gray-500">
                  Mood: <span className="font-medium text-gray-700">{mood}</span>
                </p>
              )}

              {core_prompt && (
                <div className="mt-2 text-xs text-gray-600 border rounded-md p-2 bg-slate-50 max-h-32 overflow-y-auto">
                  {core_prompt}
                </div>
              )}
            </div>
          </div>

          {galleryImages.length > 1 && (
            <div className="mt-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img) => (
                  <img
                    key={img.key}
                    src={img.url}
                    alt={`${name} - ${img.label}`}
                    className="w-16 h-16 rounded-md object-cover border flex-shrink-0 cursor-pointer"
                    onClick={() => setFullImage(img.url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Checkmark indicator row */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            {galleryStatus.map((slot) => (
              <span key={slot.key} className="flex items-center gap-1">
                <span
                  className={
                    slot.present
                      ? 'inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white'
                      : 'inline-flex h-3 w-3 items-center justify-center rounded-full border border-gray-300 text-[9px] text-gray-400'
                  }
                >
                  {slot.present ? '✓' : '–'}
                </span>
                {slot.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen image viewer */}
      {fullImage && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={() => setFullImage(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <img
              src={fullImage}
              className="max-w-[90vw] max-h-[90vh] rounded-lg"
              alt={name}
            />
          </div>
        </div>
      )}
    </>
  );
}