import React, { useEffect, useState } from 'react';

export default function CharacterCard({ character, onSelect }) {
  if (!character) return null;

  const [voices, setVoices] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVoices() {
      try {
        const res = await fetch('/voices.json', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setVoices([]);
          return;
        }
        const raw = await res.json();
        const arr = Array.isArray(raw) ? raw : raw?.voices || [];
        const list = arr
          .map((v) => ({
            id:
              v.id ||
              v.voice_id ||
              v.tts_id ||
              v.name ||
              '',
            previewUrl:
              v.audio_url ||
              v.preview_url ||
              v.previewUrl ||
              v.sample ||
              v.demo ||
              v.url ||
              v.audio ||
              null,
          }))
          .filter((v) => v.id);
        if (!cancelled) setVoices(list);
      } catch {
        if (!cancelled) setVoices([]);
      }
    }

    loadVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    name,
    base_image_url,
    referenceImageUrl,
    base_hero,
    fullbody_centered,
    fullbody_side,
    torso_front,
    headshot_front,
    headshot_right,
    headshot_left,
    voiceRefUrl,
    voicePreviewUrl,
    voiceKind,
    voiceId,
    voice_id,
    createdAt,
    updatedAt,
  } = character;

  // Choose a primary image to display as the main thumbnail
  const primaryImage =
    base_image_url ||
    base_hero ||
    referenceImageUrl ||
    fullbody_centered ||
    headshot_front ||
    headshot_right ||
    headshot_left ||
    null;

  // Build a lightweight gallery from any image fields that are present
  const galleryImages = [
    { key: 'base_image_url', label: 'Base', url: base_image_url },
    { key: 'base_hero', label: 'Base hero', url: base_hero },
    { key: 'referenceImageUrl', label: 'Reference', url: referenceImageUrl },
    { key: 'fullbody_centered', label: 'Full body (centered)', url: fullbody_centered },
    { key: 'fullbody_side', label: 'Full body (side)', url: fullbody_side },
    { key: 'torso_front', label: 'Torso (front)', url: torso_front },
    { key: 'headshot_front', label: 'Headshot (front)', url: headshot_front },
    { key: 'headshot_right', label: 'Headshot (right)', url: headshot_right },
    { key: 'headshot_left', label: 'Headshot (left)', url: headshot_left },
  ].filter(entry => !!entry.url);

  // Resolve voice preview:
  // 1) character-specific voiceRefUrl wins
  // 2) otherwise, try a global preset voice via voices.json
  const presetId = voiceId || voice_id || null;
  let registryPreview = null;
  if (presetId && Array.isArray(voices)) {
    const hit = voices.find((v) => v.id === presetId);
    registryPreview = hit?.previewUrl || null;
  }

  const effectiveVoiceUrl = voiceRefUrl || voicePreviewUrl || registryPreview;
  const hasAnyVoice = !!(effectiveVoiceUrl || presetId);
  const effectiveKind =
    voiceKind ||
    (voiceRefUrl ? 'character-only' : presetId ? 'preset' : null);

  return (
    <div
      className="border rounded-lg p-4 shadow-sm bg-white hover:shadow-md cursor-pointer transition"
      onClick={() => onSelect?.(character)}
    >
      <div className="flex items-center gap-4">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={name}
            className="w-20 h-20 rounded-md object-cover border"
          />
        ) : (
          <div className="w-20 h-20 rounded-md border bg-slate-100 flex items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{name}</h3>
          <p className="text-xs text-gray-500">
            Created: {new Date(createdAt || character.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {galleryImages.length > 1 && (
        <div className="mt-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {galleryImages.map((img) => (
              <img
                key={img.key}
                src={img.url}
                alt={`${name} - ${img.label}`}
                className="w-14 h-14 rounded-md object-cover border flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {hasAnyVoice && (
        <div className="mt-3">
          {effectiveKind && (
            <p className="text-xs text-gray-600 mb-1">
              Voice: {effectiveKind === 'character-only' ? 'Character-specific' : 'Preset voice'}
            </p>
          )}
          {effectiveVoiceUrl && (
            <audio
              controls
              src={effectiveVoiceUrl}
              className="w-full mt-1"
            />
          )}
        </div>
      )}
    </div>
  );
}