'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STUDIO_CREATOR_PRESETS,
  CREATOR_PRESET_IDS,
  normalizeCreatorPreset,
  creatorPresetById,
  creatorClipWarnings
} = require('../src/main/creator-presets');
const { STUDIO_RATIO_IDS, STUDIO_FRAMING_MODES } = require('../src/main/studio-framing');

test('creator presets normalize known ids and fall back to custom', () => {
  assert.deepEqual(CREATOR_PRESET_IDS, ['longform', 'shorts', 'square', 'portrait', 'multiformat', 'custom']);
  assert.equal(normalizeCreatorPreset(' SHORTS '), 'shorts');
  assert.equal(normalizeCreatorPreset('missing'), 'custom');
  assert.equal(normalizeCreatorPreset(null), 'custom');
  assert.equal(creatorPresetById({ id: 'SQUARE' }).id, 'square');
  assert.equal(creatorPresetById('missing').id, 'custom');
});

test('creator presets only use supported ratios and framing modes', () => {
  for (const preset of STUDIO_CREATOR_PRESETS) {
    if (preset.id !== 'custom') assert.ok(preset.ratios.length > 0, preset.id);
    for (const ratio of preset.ratios) assert.ok(STUDIO_RATIO_IDS.includes(ratio), `${preset.id}: ${ratio}`);
    if (preset.framing) assert.ok(STUDIO_FRAMING_MODES.includes(preset.framing), `${preset.id}: ${preset.framing}`);
  }
  assert.deepEqual(creatorPresetById('longform').ratios, ['landscape']);
  assert.deepEqual(creatorPresetById('shorts').ratios, ['portrait']);
  assert.equal(creatorPresetById('shorts').durationTargetSeconds, 60);
  assert.equal(creatorPresetById('shorts').safeZones, true);
  assert.deepEqual(creatorPresetById('multiformat').ratios, ['landscape', 'portrait', 'square']);
});

test('creator clip warnings flag only clips beyond the Shorts target', () => {
  const clips = [
    { id: 'ok', label: 'Exactly one minute', startMs: 1000, endMs: 61000 },
    { id: 'long', label: 'Too long', startMs: 2000, endMs: 65000 },
    { id: 'bad', label: 'Invalid', startMs: 5000, endMs: 5000 }
  ];
  assert.deepEqual(creatorClipWarnings(clips, 'shorts'), [{
    id: 'long',
    label: 'Too long',
    durationMs: 63000,
    targetMs: 60000,
    excessMs: 3000
  }]);
  assert.deepEqual(creatorClipWarnings(clips, creatorPresetById('shorts')).map((warning) => warning.id), ['long']);
  assert.deepEqual(creatorClipWarnings(clips, 'longform'), []);
  assert.deepEqual(creatorClipWarnings(null, 'shorts'), []);
});
