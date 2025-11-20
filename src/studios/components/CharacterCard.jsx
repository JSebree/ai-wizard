import React from 'react';

export default function CharacterCard({ character, onSelect }) {
  if (!character) return null;

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
    voiceKind,
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
    { key: 'fullbody_centered', label: 'Full body (centered)', url: fullbody_centered },
    { key: 'fullbody_side', label: 'Full body (side)', url: fullbody_side },
    { key: 'torso_front', label: 'Torso (front)', url: torso_front },
    { key: 'headshot_front', label: 'Headshot (front)', url: headshot_front },
    { key: 'headshot_right', label: 'Headshot (right)', url: headshot_right },
    { key: 'headshot_left', label: 'Headshot (left)', url: headshot_left },
  ].filter(entry => !!entry.url);

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

      {voiceKind && (
        <div className="mt-3">
          <p className="text-xs text-gray-600 mb-1">
            Voice: {voiceKind === 'character-only' ? 'Character-specific' : 'Preset voice'}
          </p>
          {voiceRefUrl && (
            <audio controls src={voiceRefUrl} className="w-full mt-1" />
          )}
        </div>
      )}
    </div>
  );
}