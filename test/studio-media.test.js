'use strict';

const assert = require('node:assert/strict');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { findMatchingVideo, getStudioMediaSource } = require('../src/main/studio-media');

test('Studio source detection suggests a same-name video for audio media', async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-source-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const audio = path.join(temp, 'interview.mp3');
  const webm = path.join(temp, 'interview.webm');
  const mp4 = path.join(temp, 'interview.mp4');
  const unrelated = path.join(temp, 'other.mp4');
  await Promise.all([
    fsp.writeFile(audio, 'audio'),
    fsp.writeFile(webm, 'webm'),
    fsp.writeFile(mp4, 'mp4'),
    fsp.writeFile(unrelated, 'other')
  ]);

  const match = await findMatchingVideo(audio);
  assert.equal(match.path, mp4);
  assert.equal(match.category, 'video');

  const source = await getStudioMediaSource(audio);
  assert.equal(source.category, 'audio');
  assert.equal(source.matchVideo.name, 'interview.mp4');
  assert.equal((await getStudioMediaSource(mp4)).matchVideo, null);
});

test('Studio source detection returns no match when only unrelated media exists', async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-source-none-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const audio = path.join(temp, 'voice.wav');
  await fsp.writeFile(audio, 'audio');
  assert.equal(await findMatchingVideo(audio), null);
  await assert.rejects(() => getStudioMediaSource(path.join(temp, 'missing.wav')), /could not be found/);
});
