'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { executeJob } = require('../src/main/operations');

const root = path.join(__dirname, '..');
const toolsDir = path.join(root, 'tools');
const ffmpeg = path.join(toolsDir, 'ffmpeg.exe');
const deps = {
  tools: {
    paths: () => ({
      ffmpeg,
      ffprobe: path.join(toolsDir, 'ffprobe.exe'),
      ytDlp: path.join(toolsDir, 'yt-dlp.exe'),
      deno: path.join(toolsDir, 'deno.exe'),
      sevenZip: path.join(toolsDir, '7za.exe'),
      toolsDir,
      runtimeDir: path.join(os.tmpdir(), 'omniforge-runtime-extra-test')
    })
  }
};

function makeClip(output, size, rate) {
  const result = spawnSync(ffmpeg, [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=${rate}`,
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '1.2', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', output
  ], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

async function run(spec, outputDirectory) {
  return executeJob({ ...spec, outputDirectory }, {
    signal: new AbortController().signal,
    report: () => {}
  }, deps);
}

test('join, normalize, and frame extraction work', { timeout: 180000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-extra-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const first = path.join(temp, 'first.mp4');
  const second = path.join(temp, 'second.mp4');
  makeClip(first, '320x180', 24);
  makeClip(second, '480x270', 30);

  await t.test('video join normalizes mixed clip sizes', async () => {
    const result = await run({
      tool: 'join',
      inputPaths: [first, second],
      options: { outputFormat: 'mp4', quality: 'high', resolution: 'source', joinName: 'combined' }
    }, temp);
    assert.equal(result.outputPaths.length, 1);
    assert.ok(fs.existsSync(result.outputPaths[0]));
    assert.ok(fs.statSync(result.outputPaths[0]).size > 5000);
    const probe = spawnSync(path.join(toolsDir, 'ffprobe.exe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', result.outputPaths[0]], { encoding: 'utf8' });
    assert.ok(Number(probe.stdout.trim()) > 2, probe.stdout);
  });

  await t.test('audio normalization creates a new audio file', async () => {
    const result = await run({
      tool: 'normalize',
      inputPaths: [first, second],
      options: { audioFormat: 'mp3', quality: 'high' }
    }, temp);
    assert.equal(result.outputPaths.length, 2);
    for (const outputPath of result.outputPaths) assert.ok(fs.existsSync(outputPath));
  });

  await t.test('audio-only join works', async () => {
    const extracted = await run({ tool: 'extract', inputPaths: [first, second], options: { audioFormat: 'mp3', quality: 'high' } }, temp);
    const joined = await run({
      tool: 'join',
      inputPaths: extracted.outputPaths,
      options: { outputFormat: 'mp3', quality: 'high', joinName: 'audio-joined' }
    }, temp);
    assert.ok(fs.existsSync(joined.outputPaths[0]));
    assert.ok(fs.statSync(joined.outputPaths[0]).size > 1000);
  });

  await t.test('frame extraction creates numbered images', async () => {
    const result = await run({
      tool: 'frames',
      inputPaths: [first],
      options: { mode: 'interval', imageFormat: 'png', interval: '0.4', maxFrames: '10', width: '0' }
    }, temp);
    assert.equal(result.outputPaths.length, 1);
    const files = fs.readdirSync(result.outputPaths[0]);
    assert.ok(files.length >= 2);
    assert.ok(files.every((name) => name.endsWith('.png')));
  });

  await t.test('frame extraction supports one exact timestamp', async () => {
    const result = await run({
      tool: 'frames',
      inputPaths: [first],
      options: { mode: 'timestamp', imageFormat: 'jpg', timestamp: '00:00:00.700', width: '160' }
    }, temp);
    assert.equal(result.outputPaths.length, 1);
    assert.ok(fs.existsSync(result.outputPaths[0]));
    assert.ok(result.outputPaths[0].endsWith('.jpg'));
    assert.ok(fs.statSync(result.outputPaths[0]).size > 100);
  });
});
