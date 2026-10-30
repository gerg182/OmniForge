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
const toolPaths = require('./tool-paths');
const ffmpeg = toolPaths.ffmpeg;

const deps = {
  tools: {
    paths: () => ({
      ffmpeg,
      ffprobe: toolPaths.ffprobe,
      ytDlp: toolPaths.ytDlp,
      deno: toolPaths.deno,
      sevenZip: toolPaths.sevenZip,
      toolsDir,
      runtimeDir: path.join(os.tmpdir(), 'omniforge-runtime-format-test')
    })
  }
};

async function run(spec, outputDirectory) {
  return executeJob({ ...spec, outputDirectory }, {
    signal: new AbortController().signal,
    report: () => {}
  }, deps);
}

test('all advertised media output formats produce a file', { timeout: 180000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-format-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const sample = path.join(temp, 'sample.mp4');
  const result = spawnSync(ffmpeg, [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=240x136:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '0.7', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', sample
  ], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);

  const formats = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'gif', 'mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'png', 'jpg', 'webp', 'avif', 'bmp', 'tiff', 'ico'];
  for (const targetFormat of formats) {
    const outcome = await run({ tool: 'convert', inputPaths: [sample], options: { targetFormat, quality: 'small', resolution: '240' } }, temp);
    assert.equal(outcome.outputPaths.length, 1, targetFormat);
    assert.ok(fs.existsSync(outcome.outputPaths[0]), targetFormat);
    assert.ok(fs.statSync(outcome.outputPaths[0]).size > 100, targetFormat);
  }
});

test('all advertised archive formats create and extract', { timeout: 120000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-archive-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const input = path.join(temp, 'note.txt');
  fs.writeFileSync(input, 'archive test\n', 'utf8');
  for (const archiveFormat of ['zip', '7z', 'tar', 'tar.gz', 'gz']) {
    const created = await run({ tool: 'archive', inputPaths: [input], options: { operation: 'create', archiveFormat, archiveName: `bundle-${archiveFormat.replace('.', '-')}` } }, temp);
    assert.ok(fs.existsSync(created.outputPaths[0]), archiveFormat);
    if (archiveFormat !== 'gz') {
      const extracted = await run({ tool: 'archive', inputPaths: [created.outputPaths[0]], options: { operation: 'extract' } }, temp);
      assert.ok(fs.existsSync(extracted.outputPaths[0]), archiveFormat);
      assert.ok(fs.readdirSync(extracted.outputPaths[0]).length >= 1, archiveFormat);
    }
  }
});
