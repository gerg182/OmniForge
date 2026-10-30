'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  STUDIO_RATIOS,
  studioRatio,
  normalizeStudioRatios,
  normalizeStudioFraming,
  buildStudioFramingFilter,
  fitAssToFrame
} = require('../src/main/studio-framing');
const { buildAss } = require('../src/main/transcript');
const { buildMediaArgs } = require('../src/main/media-args');

test('Studio ratio and framing normalization keeps supported values only', () => {
  assert.deepEqual(normalizeStudioRatios(['portrait', 'portrait', 'bad', 'original', 'square']), ['portrait', 'original', 'square']);
  assert.deepEqual(normalizeStudioRatios([]), ['original']);
  assert.deepEqual(normalizeStudioRatios('portrait'), ['original']);
  assert.equal(normalizeStudioFraming('BLUR'), 'blur');
  assert.equal(normalizeStudioFraming('stretch'), 'fill');
  assert.equal(studioRatio('missing').id, 'original');
  assert.deepEqual(STUDIO_RATIOS.map((ratio) => ratio.id), ['original', 'landscape', 'portrait', 'square', 'portrait45']);
});

test('Studio framing filters produce fill, fit, blur, and caption-aware graphs', () => {
  const fill = buildStudioFramingFilter('portrait', 'fill');
  assert.match(fill, /scale=1080:1920/);
  assert.match(fill, /force_original_aspect_ratio=increase/);
  assert.match(fill, /crop=1080:1920/);

  const fit = buildStudioFramingFilter('landscape', 'fit');
  assert.match(fit, /force_original_aspect_ratio=decrease/);
  assert.match(fit, /pad=1920:1080/);

  const blur = buildStudioFramingFilter('square', 'blur', "ass='C\\:/tmp/captions.ass'");
  assert.match(blur, /split=2\[bg\]\[fg\]/);
  assert.match(blur, /boxblur=24:2/);
  assert.match(blur, /overlay=\(W-w\)\/2:\(H-h\)\/2/);
  assert.match(blur, /,ass='C\\:\/tmp\/captions\.ass'$/);

  assert.equal(buildStudioFramingFilter('original', 'fill'), '');
  assert.equal(buildStudioFramingFilter('original', 'fit', 'eq=brightness=0.1'), 'eq=brightness=0.1');
});

test('Studio captions are resized to the selected output frame', () => {
  const ass = buildAss([{ id: 'a', startMs: 0, endMs: 1000, text: 'Hello' }], {
    fontSize: 24,
    color: '#FFFFFF',
    outline: 2,
    position: 'bottom'
  });
  const portrait = fitAssToFrame(ass, 'portrait');
  assert.match(portrait, /PlayResX: 1080/);
  assert.match(portrait, /PlayResY: 1920/);
  assert.match(portrait, /,43,43,77,1/);
  assert.equal(fitAssToFrame(ass, 'original'), ass);
});

test('media argument builder maps complex framing graphs to vout', () => {
  const args = buildMediaArgs({
    input: 'in.mp4',
    output: 'out.mp4',
    target: 'mp4',
    options: { videoFilterComplex: '[0:v]split=2[bg][fg];[bg][fg]overlay[vout]' },
    media: {}
  });
  assert.ok(args.includes('-filter_complex'));
  assert.equal(args[args.indexOf('-filter_complex') + 1], '[0:v]split=2[bg][fg];[bg][fg]overlay[vout]');
  assert.deepEqual(args.slice(args.indexOf('-map'), args.indexOf('-map') + 4), ['-map', '[vout]', '-map', '0:a:0?']);
  assert.equal(args.includes('-vf'), false);
});
