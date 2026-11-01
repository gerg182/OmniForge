'use strict';

const STUDIO_CREATOR_PRESETS = [
  {
    id: 'longform',
    label: 'Long-form',
    shortLabel: '16:9',
    description: 'Widescreen edits for YouTube, courses, and the web.',
    ratios: ['landscape'],
    framing: 'fill',
    safeZones: false,
    durationTargetSeconds: null
  },
  {
    id: 'shorts',
    label: 'Shorts',
    shortLabel: '9:16',
    description: 'Vertical short-form clips with a 60-second target.',
    ratios: ['portrait'],
    framing: 'blur',
    safeZones: true,
    durationTargetSeconds: 60
  },
  {
    id: 'square',
    label: 'Square',
    shortLabel: '1:1',
    description: 'Feed-friendly square exports for social posts.',
    ratios: ['square'],
    framing: 'blur',
    safeZones: false,
    durationTargetSeconds: null
  },
  {
    id: 'portrait',
    label: 'Portrait',
    shortLabel: '4:5',
    description: 'Tall feed posts that use more vertical screen space.',
    ratios: ['portrait45'],
    framing: 'fill',
    safeZones: true,
    durationTargetSeconds: null
  },
  {
    id: 'multiformat',
    label: 'Multi-format',
    shortLabel: '3 aspects',
    description: 'One edit, with landscape, vertical, and square renders.',
    ratios: ['landscape', 'portrait', 'square'],
    framing: 'blur',
    safeZones: true,
    durationTargetSeconds: null
  },
  {
    id: 'custom',
    label: 'Custom',
    shortLabel: 'Your mix',
    description: 'Keep your own aspect ratio and framing combination.',
    ratios: [],
    framing: null,
    safeZones: false,
    durationTargetSeconds: null
  }
];

const CREATOR_PRESET_IDS = STUDIO_CREATOR_PRESETS.map((preset) => preset.id);

function normalizeCreatorPreset(value) {
  const id = String(value || '').trim().toLowerCase();
  return CREATOR_PRESET_IDS.includes(id) ? id : 'custom';
}

function creatorPresetById(value) {
  const requestedId = value && typeof value === 'object' ? value.id : value;
  const id = normalizeCreatorPreset(requestedId);
  return STUDIO_CREATOR_PRESETS.find((preset) => preset.id === id)
    || STUDIO_CREATOR_PRESETS.find((preset) => preset.id === 'custom');
}

function creatorClipWarnings(clips, presetOrId) {
  const preset = creatorPresetById(presetOrId);
  const targetSeconds = Number(preset.durationTargetSeconds);
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return [];
  const targetMs = Math.round(targetSeconds * 1000);
  const warnings = [];
  (Array.isArray(clips) ? clips : []).forEach((clip, index) => {
    if (!clip || typeof clip !== 'object') return;
    const startMs = Number(clip.startMs);
    const endMs = Number(clip.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
    const durationMs = Math.round(endMs - startMs);
    if (durationMs <= targetMs) return;
    const label = String(clip.label || `Clip ${index + 1}`);
    warnings.push({
      id: String(clip.id || `${index + 1}`),
      label,
      durationMs,
      targetMs,
      excessMs: durationMs - targetMs
    });
  });
  return warnings;
}

module.exports = {
  STUDIO_CREATOR_PRESETS,
  CREATOR_PRESET_IDS,
  normalizeCreatorPreset,
  creatorPresetById,
  creatorClipWarnings
};
