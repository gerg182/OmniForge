'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeJobSpeed,
  parseFfmpegSpeed,
  appendProgressSample,
  estimateEtaMs
} = require('../src/main/job-metrics');

test('job speed normalization accepts supported units only', () => {
  assert.deepEqual(normalizeJobSpeed({ value: 1.25, unit: 'x' }), { value: 1.25, unit: 'x' });
  assert.deepEqual(normalizeJobSpeed({ value: 1048576, unit: 'B/s' }), { value: 1048576, unit: 'B/s' });
  assert.deepEqual(parseFfmpegSpeed('1.42x'), { value: 1.42, unit: 'x' });
  assert.equal(parseFfmpegSpeed('N/A'), null);
  assert.equal(normalizeJobSpeed({ value: 2, unit: 'MB/s' }), null);
  assert.equal(normalizeJobSpeed({ value: 0, unit: 'x' }), null);
});

test('job ETA uses recent progress samples', () => {
  const now = 100_000;
  const samples = [
    { at: now - 20_000, progress: 10 },
    { at: now - 10_000, progress: 30 },
    { at: now, progress: 50 }
  ];
  assert.equal(estimateEtaMs(samples, now), 25_000);
  assert.equal(estimateEtaMs(samples.slice(0, 1), now), null);
  assert.equal(estimateEtaMs([{ at: now - 1_000, progress: 20 }, { at: now, progress: 30 }], now), null);
  assert.equal(estimateEtaMs([{ at: now - 10_000, progress: 50 }, { at: now, progress: 50 }], now), null);
  assert.equal(estimateEtaMs([{ at: now - 60_000, progress: 10 }, { at: now - 50_000, progress: 20 }], now), null);
});

test('progress samples keep only the recent window and changes', () => {
  const now = 100_000;
  const samples = appendProgressSample([
    { at: now - 40_000, progress: 1 },
    { at: now - 5_000, progress: 10 }
  ], 10, now);
  assert.deepEqual(samples, [{ at: now - 5_000, progress: 10 }]);
  assert.deepEqual(appendProgressSample(samples, 20, now), [
    { at: now - 5_000, progress: 10 },
    { at: now, progress: 20 }
  ]);
});
