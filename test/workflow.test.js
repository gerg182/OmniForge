'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('smart drop suggests tools from the dropped file category', async () => {
  const { suggestDropTools } = await import('../src/renderer/workflow.mjs');
  const video = suggestDropTools(['interview.mp4', 'b-roll.mov']);
  assert.equal(video.category, 'video');
  assert.equal(video.suggestions[0].tool, 'convert');
  assert.equal(video.suggestions[0].recommended, true);
  assert.ok(video.suggestions.some((entry) => entry.tool === 'studio'));

  const encrypted = suggestDropTools(['report.ofenc']);
  assert.equal(encrypted.category, 'encrypted');
  assert.deepEqual(encrypted.suggestions.map((entry) => entry.tool), ['encryptor']);

  const mixed = suggestDropTools(['photo.png', 'notes.pdf']);
  assert.equal(mixed.category, 'mixed');
  assert.ok(mixed.suggestions.some((entry) => entry.tool === 'checksum'));
});

test('smart drop honors custom input extension maps and empty drops', async () => {
  const { suggestDropTools } = await import('../src/renderer/workflow.mjs');
  const custom = suggestDropTools(['capture.raw'], { camera: ['raw'] });
  assert.equal(custom.category, 'mixed');
  assert.equal(suggestDropTools([]).category, 'unknown');
  assert.deepEqual(suggestDropTools([]).suggestions, []);
});

test('command filtering ranks exact, prefix, title, and keyword matches', async () => {
  const { filterCommandItems } = await import('../src/renderer/workflow.mjs');
  const items = [
    { label: 'Open converter', keywords: ['video', 'format'] },
    { label: 'Converter', keywords: ['media'] },
    { label: 'Compress files', keywords: ['converter'] },
    { label: 'Settings', keywords: ['system'] }
  ];
  assert.deepEqual(filterCommandItems(items, 'converter').map((item) => item.label), ['Converter', 'Open converter', 'Compress files']);
  assert.deepEqual(filterCommandItems(items, 'video').map((item) => item.label), ['Open converter']);
  assert.equal(filterCommandItems(items, '', 2).length, 2);
  assert.deepEqual(filterCommandItems(items, 'missing'), []);
});

test('Studio preview frames fit unusual source ratios inside the stage', async () => {
  const { fitPreviewFrame } = await import('../src/renderer/workflow.mjs');
  assert.deepEqual(fitPreviewFrame(1000, 1000, 1920, 1080), { width: 1000, height: 562 });
  assert.deepEqual(fitPreviewFrame(1000, 1000, 1080, 1920), { width: 562, height: 1000 });
  assert.deepEqual(fitPreviewFrame(800, 1000, 1080, 1350), { width: 800, height: 1000 });
  assert.deepEqual(fitPreviewFrame(1000, 400, 7680, 1080), { width: 1000, height: 140 });
  assert.deepEqual(fitPreviewFrame(1000, 400, 100, 7680), { width: 5, height: 400 });
  assert.equal(fitPreviewFrame(0, 400, 1920, 1080), null);
  assert.equal(fitPreviewFrame(1000, 400, 0, 1080), null);
});

test('Studio select-all toggles every transcript line', async () => {
  const { toggleAllSelection } = await import('../src/renderer/workflow.mjs');
  assert.deepEqual(toggleAllSelection(['a', 'b', 'c'], ['b']), ['a', 'b', 'c']);
  assert.deepEqual(toggleAllSelection(['a', 'b', 'c'], ['c', 'a', 'b']), []);
  assert.deepEqual(toggleAllSelection([], ['a']), []);
  assert.deepEqual(toggleAllSelection(['a', 'a', '', 'b'], []), ['a', 'b']);
});

test('queue metrics format ETA and speed for display', async () => {
  const { formatJobEta, formatJobSpeed } = await import('../src/renderer/workflow.mjs');
  assert.equal(formatJobEta(8_000), '8s');
  assert.equal(formatJobEta(125_000), '2m 5s');
  assert.equal(formatJobEta(7_500_000), '2h 5m');
  assert.equal(formatJobEta(0), '');
  assert.equal(formatJobSpeed({ value: 1.234, unit: 'x' }), '1.23x');
  assert.equal(formatJobSpeed({ value: 1_048_576, unit: 'B/s' }), '1.0 MB/s');
  assert.equal(formatJobSpeed({ value: 2, unit: 'MB/s' }), '');
});
