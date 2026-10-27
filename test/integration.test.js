'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
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
      runtimeDir: path.join(os.tmpdir(), 'omniforge-runtime-test')
    })
  }
};

function runTool(args) {
  const result = spawnSync(ffmpeg, args, { windowsHide: true, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ffmpeg failed: ${result.status}`);
}

async function run(spec, outputDirectory) {
  const updates = [];
  const controller = new AbortController();
  const result = await executeJob({ ...spec, outputDirectory }, {
    signal: controller.signal,
    report: (update) => updates.push(update)
  }, deps);
  return { result, updates };
}

test('media, data, PDF, archive, checksum, and inspection integration', { timeout: 180000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));

  const sample = path.join(temp, 'sample.mp4');
  runTool([
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '2', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', sample
  ]);

  const png = path.join(temp, 'frame.png');
  runTool(['-hide_banner', '-y', '-i', sample, '-frames:v', '1', png]);

  await t.test('video to WebM', async () => {
    const { result } = await run({ tool: 'convert', inputPaths: [sample], options: { targetFormat: 'webm', quality: 'small' } }, temp);
    assert.equal(result.outputPaths.length, 1);
    assert.ok(fs.existsSync(result.outputPaths[0]));
    assert.ok(fs.statSync(result.outputPaths[0]).size > 1000);
  });

  await t.test('video to MP3', async () => {
    const { result } = await run({ tool: 'convert', inputPaths: [sample], options: { targetFormat: 'mp3', quality: 'balanced' } }, temp);
    assert.ok(fs.existsSync(result.outputPaths[0]));
  });

  await t.test('PNG to WebP and ICO', async () => {
    for (const targetFormat of ['webp', 'ico']) {
      const { result } = await run({ tool: 'convert', inputPaths: [png], options: { targetFormat, quality: 'balanced' } }, temp);
      assert.ok(fs.existsSync(result.outputPaths[0]), targetFormat);
      assert.ok(fs.statSync(result.outputPaths[0]).size > 100, targetFormat);
    }
  });

  await t.test('compress, trim, extract, and GIF', async () => {
    const compressed = await run({ tool: 'compress', inputPaths: [sample], options: { mode: 'quality', quality: 'small', resolution: '360' } }, temp);
    assert.ok(fs.existsSync(compressed.result.outputPaths[0]));
    const trimmed = await run({ tool: 'trim', inputPaths: [sample], options: { start: '00:00:00.5', end: '00:00:01.5', outputFormat: 'mp4' } }, temp);
    assert.ok(fs.existsSync(trimmed.result.outputPaths[0]));
    const extracted = await run({ tool: 'extract', inputPaths: [sample], options: { audioFormat: 'wav', quality: 'high' } }, temp);
    assert.ok(fs.existsSync(extracted.result.outputPaths[0]));
    const gif = await run({ tool: 'gif', inputPaths: [sample], options: { start: '0', duration: '0.8', fps: '8', width: '180' } }, temp);
    assert.ok(fs.existsSync(gif.result.outputPaths[0]));
  });

  await t.test('CSV to JSON', async () => {
    const csvPath = path.join(temp, 'people.csv');
    await fsp.writeFile(csvPath, 'name,score\nAda,10\nGrace,20\n', 'utf8');
    const { result } = await run({ tool: 'convert', inputPaths: [csvPath], options: { targetFormat: 'json' } }, temp);
    const parsed = JSON.parse(await fsp.readFile(result.outputPaths[0], 'utf8'));
    assert.equal(parsed.length, 2);
    assert.equal(parsed[1].name, 'Grace');
  });

  await t.test('PDF merge, split, and rotate', async () => {
    const first = path.join(temp, 'first.pdf');
    const second = path.join(temp, 'second.pdf');
    for (const [file, count] of [[first, 2], [second, 1]]) {
      const document = await PDFDocument.create();
      for (let index = 0; index < count; index += 1) document.addPage([200, 300]);
      await fsp.writeFile(file, await document.save());
    }
    const merge = await run({ tool: 'pdf', inputPaths: [first, second], options: { operation: 'merge' } }, temp);
    assert.ok(fs.existsSync(merge.result.outputPaths[0]));
    const split = await run({ tool: 'pdf', inputPaths: [first], options: { operation: 'split', pages: '1-2' } }, temp);
    assert.ok(split.result.outputPaths.length >= 1);
    const rotated = await run({ tool: 'pdf', inputPaths: [second], options: { operation: 'rotate', rotation: '90' } }, temp);
    assert.ok(fs.existsSync(rotated.result.outputPaths[0]));
  });

  await t.test('ZIP round-trip', async () => {
    const archiveDir = path.join(temp, 'archives');
    fs.mkdirSync(archiveDir, { recursive: true });
    const created = await run({ tool: 'archive', inputPaths: [sample, png], options: { operation: 'create', archiveFormat: 'zip', archiveName: 'bundle' } }, archiveDir);
    assert.ok(fs.existsSync(created.result.outputPaths[0]));
    const extracted = await run({ tool: 'archive', inputPaths: [created.result.outputPaths[0]], options: { operation: 'extract' } }, archiveDir);
    assert.ok(fs.existsSync(extracted.result.outputPaths[0]));
    const extractedFiles = fs.readdirSync(extracted.result.outputPaths[0]);
    assert.ok(extractedFiles.length >= 2);
  });

  await t.test('checksum and media inspection', async () => {
    const checksum = await run({ tool: 'checksum', inputPaths: [sample], options: { algorithms: ['md5', 'sha256'] } });
    assert.equal(checksum.result.data.results.length, 1);
    assert.match(checksum.result.data.results[0].values.sha256, /^[a-f0-9]{64}$/);
    const info = await run({ tool: 'info', inputPaths: [sample], options: {} });
    assert.equal(info.result.data.results[0].video.width, 320);
    assert.ok(info.result.data.results[0].audio);
  });
});
