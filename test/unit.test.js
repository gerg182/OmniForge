'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseDelimited, parseData, serializeData } = require('../src/main/data');
const { isSupportedYouTubeUrl, parseYouTubeProgressLine } = require('../src/main/youtube');
const { buildMediaArgs } = require('../src/main/media-args');
const { parsePageRanges, buildYouTubeArgs } = require('../src/main/operations');

test('CSV parser handles quoted commas and newlines', () => {
  const rows = parseDelimited('name,note\n"Ada, A.","hello\nworld"\nGrace,"plain"', ',');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Ada, A.');
  assert.equal(rows[0].note, 'hello\nworld');
});

test('data formats round-trip', () => {
  const records = [{ name: 'Ada', score: 10 }, { name: 'Grace', score: 20 }];
  for (const format of ['json', 'csv', 'tsv', 'yaml', 'xml']) {
    const text = serializeData(records, format);
    const parsed = parseData(text, format);
    assert.equal(parsed.length, 2, format);
    assert.equal(parsed[0].name, 'Ada', format);
  }
});

test('YouTube URL validation rejects lookalikes', () => {
  assert.equal(isSupportedYouTubeUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(isSupportedYouTubeUrl('https://youtu.be/abc'), true);
  assert.equal(isSupportedYouTubeUrl('https://youtube.com.evil.example/watch?v=abc'), false);
  assert.equal(isSupportedYouTubeUrl('javascript:alert(1)'), false);
});

test('YouTube progress parser handles custom and fallback output', () => {
  const custom = parseYouTubeProgressLine('MTDL|50|100|0|1048576|4');
  assert.equal(custom.percent, 0.5);
  assert.equal(custom.speed, 1048576);
  const fallback = parseYouTubeProgressLine('[download]  12.5% of 10MiB');
  assert.equal(fallback.percent, 0.125);
});

test('YouTube download args keep live progress enabled', () => {
  const args = buildYouTubeArgs({
    url: 'https://www.youtube.com/watch?v=abc',
    outputDirectory: 'C:\\out',
    mode: 'video',
    quality: 'best',
    audioFormat: 'mp3',
    paths: {
      toolsDir: 'C:\\tools',
      deno: 'C:\\tools\\deno.exe'
    }
  });
  assert.ok(args.includes('--print'));
  assert.ok(args.includes('--no-quiet'));
  assert.ok(args.includes('--progress-template'));
  assert.equal(args[args.length - 1], 'https://www.youtube.com/watch?v=abc');
});

test('media args select expected codecs', () => {
  const video = buildMediaArgs({ input: 'in.mp4', output: 'out.webm', target: 'webm', options: { quality: 'balanced' }, media: { height: 1080 } });
  assert.ok(video.includes('libvpx-vp9'));
  assert.ok(video.includes('libopus'));
  const audio = buildMediaArgs({ input: 'in.mp4', output: 'out.mp3', target: 'mp3', options: { quality: 'high' }, media: {} });
  assert.ok(audio.includes('libmp3lame'));
  const image = buildMediaArgs({ input: 'in.png', output: 'out.webp', target: 'webp', options: { quality: 'balanced' }, media: {} });
  assert.ok(image.includes('libwebp'));
});

test('PDF page ranges parse and validate', () => {
  assert.deepEqual(parsePageRanges('1-2,4', 5).map((range) => range.pages), [[0, 1], [3]]);
  assert.throws(() => parsePageRanges('7', 5), /outside/);
});

test('file target is included in build output', () => {
  const args = buildMediaArgs({ input: 'in.mp4', output: 'C:\\out\\x.mp4', target: 'mp4', options: {}, media: {} });
  assert.equal(args[args.length - 1], 'C:\\out\\x.mp4');
});
