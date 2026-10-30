'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  PROJECT_VERSION,
  normalizeProject,
  saveProject,
  loadProject,
  findProjectMedia,
  suggestedProjectPath,
  loadTranscriptFile,
  saveTranscriptFile
} = require('../src/main/studio-project');
const {
  normalizeStudioOptions,
  validateStudioSpec,
  escapeFilterPath,
  sidecarExtensions,
  uniqueClipPaths
} = require('../src/main/studio');
const { parseSrt, parseVtt } = require('../src/main/transcript');
const { executeJob } = require('../src/main/operations');

const root = path.join(__dirname, '..');
const toolsDir = path.join(root, 'tools');
const toolPaths = require('./tool-paths');
const ffmpeg = toolPaths.ffmpeg;
const ffprobe = toolPaths.ffprobe;

const deps = {
  tools: {
    paths: () => ({
      ffmpeg,
      ffprobe,
      ytDlp: toolPaths.ytDlp,
      deno: toolPaths.deno,
      sevenZip: toolPaths.sevenZip,
      toolsDir,
      runtimeDir: path.join(os.tmpdir(), 'omniforge-studio-test-runtime')
    })
  }
};

function runTool(args) {
  const result = spawnSync(ffmpeg, args, { windowsHide: true, encoding: 'utf8', timeout: 120000 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ffmpeg failed: ${result.status}`);
}

function probeDuration(filePath) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ffprobe failed: ${result.status}`);
  return Number(result.stdout.trim());
}

function probeStreamTypes(filePath) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', filePath], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ffprobe failed: ${result.status}`);
  return JSON.parse(result.stdout).streams.map((stream) => stream.codec_type);
}

function probeDimensions(filePath) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', filePath], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `ffprobe failed: ${result.status}`);
  const stream = JSON.parse(result.stdout).streams[0];
  return { width: Number(stream.width), height: Number(stream.height) };
}

async function render(spec, outputDirectory) {
  const updates = [];
  const result = await executeJob({ ...spec, outputDirectory }, {
    signal: new AbortController().signal,
    report: (update) => updates.push(update)
  }, deps);
  return { result, updates };
}

test('Studio project normalization validates and clamps saved state', () => {
  const project = normalizeProject({
    version: PROJECT_VERSION,
    mediaPath: 'C:\\media\\interview.mp4',
    durationMs: 5000,
    language: 'EN',
    segments: [{ id: 'a', startMs: 100, endMs: 900, text: 'Hello' }],
    clips: [{ id: 'clip', label: 'Opening', startMs: 1000, endMs: 9000 }],
    clipPaddingMs: 9999,
    captionStyle: { fontSize: 99, color: '#12abef', outline: 9, position: 'center' },
    output: { directory: 'C:\\out', videoFormat: 'mkv', audioFormat: 'flac', burnCaptions: false, exportCaptions: 'both' }
  });
  assert.equal(project.version, PROJECT_VERSION);
  assert.equal(project.language, 'en');
  assert.equal(project.clips[0].endMs, 5000);
  assert.equal(project.clipPaddingMs, 2000);
  assert.equal(project.captionStyle.fontSize, 48);
  assert.equal(project.captionStyle.color, '#12ABEF');
  assert.equal(project.output.videoFormat, 'mkv');
  assert.equal(project.output.exportCaptions, 'both');
  assert.equal(project.output.burnCaptions, false);
  assert.deepEqual(project.output.ratios, ['original']);
  assert.equal(project.output.framing, 'fill');
  assert.throws(() => normalizeProject({ version: 99, mediaPath: 'a.mp4' }), /Unsupported/);
  assert.throws(() => normalizeProject({ version: 1, mediaPath: 'a.png' }), /audio or video/);
  assert.throws(() => normalizeProject({
    version: 1,
    mediaPath: 'a.mp4',
    durationMs: 1000,
    clips: [{ startMs: 1000, endMs: 1200 }]
  }), /beyond/);
});

test('Studio projects save atomically and resolve media next to the project', async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-project-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const mediaPath = path.join(temp, 'interview.mp4');
  await fsp.writeFile(mediaPath, 'media placeholder');
  const project = {
    version: PROJECT_VERSION,
    mediaPath,
    durationMs: 2000,
    segments: [{ id: 'a', startMs: 200, endMs: 900, text: 'Saved line' }],
    clips: [{ id: 'clip', label: 'Saved clip', startMs: 100, endMs: 1000 }]
  };
  const saved = await saveProject(path.join(temp, 'session.ofstudio'), project);
  assert.equal(saved.projectPath, path.join(temp, 'session.ofstudio'));
  assert.ok(fs.existsSync(saved.projectPath));
  assert.equal(fs.readdirSync(temp).some((name) => name.endsWith('.tmp')), false);
  await saveProject(saved.projectPath, { ...project, segments: [] });
  assert.deepEqual(JSON.parse(await fsp.readFile(saved.projectPath, 'utf8')).segments, []);
  await saveProject(saved.projectPath, project);

  const loaded = await loadProject(saved.projectPath);
  assert.equal(loaded.mediaMissing, false);
  assert.equal(loaded.project.mediaPath, mediaPath);
  assert.equal(loaded.project.segments[0].text, 'Saved line');

  const relativeProjectPath = path.join(temp, 'relative.ofstudio');
  await fsp.writeFile(relativeProjectPath, JSON.stringify(project));
  const relative = await loadProject(relativeProjectPath);
  assert.equal(relative.mediaMissing, false);
  assert.equal(relative.project.mediaPath, mediaPath);

  await fsp.rm(mediaPath);
  const missing = await findProjectMedia(saved.projectPath, mediaPath);
  assert.equal(missing.mediaMissing, true);
  assert.equal(suggestedProjectPath(mediaPath), path.join(temp, 'interview.ofstudio'));
});

test('Studio transcript import and export are constrained to SRT and VTT', async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-transcript-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'input.srt');
  await fsp.writeFile(source, '\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n');
  const imported = await loadTranscriptFile(source);
  assert.equal(imported.format, 'srt');
  assert.equal(imported.segments[0].text, 'Hello');

  const exported = await saveTranscriptFile(path.join(temp, 'output'), imported.segments, 'vtt');
  assert.equal(exported, path.join(temp, 'output.vtt'));
  assert.equal(parseVtt(await fsp.readFile(exported, 'utf8'))[0].text, 'Hello');

  const invalid = path.join(temp, 'input.txt');
  await fsp.writeFile(invalid, 'Hello');
  await assert.rejects(() => loadTranscriptFile(invalid), /SRT or VTT/);
  await assert.rejects(() => saveTranscriptFile(path.join(temp, 'bad'), imported.segments, 'txt'), /SRT or VTT/);
});

test('Studio rendering options, paths, and collision handling are validated', async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-options-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const video = normalizeStudioOptions({
    outputFormat: 'webm',
    clips: [{ startMs: 0, endMs: 1000 }],
    segments: [],
    exportCaptions: 'invalid',
    burnCaptions: false
  }, 'video');
  assert.equal(video.outputFormat, 'webm');
  assert.equal(video.exportCaptions, 'srt');
  assert.equal(video.burnCaptions, false);
  const audio = normalizeStudioOptions({ clips: [{ startMs: 0, endMs: 1000 }] }, 'audio');
  assert.equal(audio.outputFormat, 'mp3');
  assert.equal(audio.burnCaptions, false);
  assert.throws(() => normalizeStudioOptions({ outputFormat: 'mp3', clips: [{ startMs: 0, endMs: 1000 }] }, 'video'), /valid video/);
  assert.throws(() => normalizeStudioOptions({ clips: [] }, 'audio'), /at least one/);

  const media = path.join(temp, 'source.mp4');
  await fsp.writeFile(media, 'placeholder');
  assert.throws(() => validateStudioSpec({ inputPaths: [media, media], options: { clips: [{ startMs: 0, endMs: 1000 }] } }), /one media file/);
  assert.throws(() => validateStudioSpec({ inputPaths: [media], options: { durationMs: 500, clips: [{ startMs: 1000, endMs: 2000 }] } }), /beyond/);

  assert.deepEqual(sidecarExtensions('both'), ['srt', 'vtt']);
  assert.deepEqual(sidecarExtensions('none'), []);
  assert.equal(escapeFilterPath("C:\\tmp\\a,b's\\captions.ass"), "C\\:/tmp/a\\,b\\'s/captions.ass");
  const first = uniqueClipPaths(temp, 'Same name', 'mp4', 'srt');
  assert.equal(path.basename(first.outputPath), 'Same name.mp4');
  await fsp.writeFile(first.outputPath, 'existing');
  const second = uniqueClipPaths(temp, 'Same name', 'mp4', 'srt');
  assert.equal(path.basename(second.outputPath), 'Same name (2).mp4');
});

test('Studio renders video clips with burned captions and relative SRT/VTT sidecars', { timeout: 180000 }, async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-video-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'output');
  const sample = path.join(temp, 'sample.mp4');
  runTool([
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '2', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', sample
  ]);
  const segments = [
    { id: 'a', startMs: 150, endMs: 850, text: 'First studio line' },
    { id: 'b', startMs: 1050, endMs: 1750, text: 'Second studio line' }
  ];
  const { result, updates } = await render({
    tool: 'studio',
    inputPaths: [sample],
    options: {
      durationMs: 2000,
      outputFormat: 'mp4',
      quality: 'high',
      burnCaptions: true,
      exportCaptions: 'both',
      captionStyle: { fontSize: 26, color: '#FFFF00', outline: 2, position: 'bottom' },
      segments,
      clips: [
        { id: 'one', label: 'Interview', startMs: 100, endMs: 1000 },
        { id: 'two', label: 'Interview', startMs: 1000, endMs: 1800 }
      ]
    }
  }, output);

  assert.equal(result.outputPaths.length, 2);
  assert.deepEqual(result.outputPaths.map((filePath) => path.basename(filePath)), ['Interview.mp4', 'Interview (2).mp4']);
  assert.equal(result.data.clips.length, 2);
  assert.equal(result.data.clips[0].captionPaths.length, 2);
  assert.ok(updates.some((update) => update.progress === 100));
  for (const filePath of result.outputPaths) {
    assert.ok(fs.statSync(filePath).size > 1000);
    assert.ok(Math.abs(probeDuration(filePath) - 0.8) < 0.16, path.basename(filePath));
    const streamTypes = probeStreamTypes(filePath);
    assert.ok(streamTypes.includes('video'), `${path.basename(filePath)} must contain video`);
    assert.ok(streamTypes.includes('audio'), `${path.basename(filePath)} must contain audio`);
  }
  const firstSrt = parseSrt(await fsp.readFile(result.data.clips[0].captionPaths[0], 'utf8'));
  const firstVtt = parseVtt(await fsp.readFile(result.data.clips[0].captionPaths[1], 'utf8'));
  const secondSrt = parseSrt(await fsp.readFile(result.data.clips[1].captionPaths[0], 'utf8'));
  assert.deepEqual(firstSrt.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })), [
    { startMs: 50, endMs: 750, text: 'First studio line' }
  ]);
  assert.deepEqual(firstVtt.map(({ startMs, endMs }) => ({ startMs, endMs })), [{ startMs: 50, endMs: 750 }]);
  assert.deepEqual(secondSrt.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })), [
    { startMs: 50, endMs: 750, text: 'Second studio line' }
  ]);
});

test('Studio renders creator aspect-ratio variants with blur framing', { timeout: 180000 }, async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-ratios-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'output');
  const sample = path.join(temp, 'sample.mp4');
  runTool([
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '1.4', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', sample
  ]);
  const { result } = await render({
    tool: 'studio',
    inputPaths: [sample],
    options: {
      durationMs: 1400,
      outputFormat: 'mp4',
      quality: 'high',
      burnCaptions: true,
      exportCaptions: 'srt',
      ratios: ['landscape', 'portrait'],
      framing: 'blur',
      captionStyle: { fontSize: 24, color: '#FFFFFF', outline: 2, position: 'bottom' },
      segments: [{ id: 'a', startMs: 150, endMs: 1050, text: 'Creator caption' }],
      clips: [{ id: 'one', label: 'Spot', startMs: 100, endMs: 1100 }]
    }
  }, output);

  assert.deepEqual(result.outputPaths.map((filePath) => path.basename(filePath)), ['Spot - 16x9.mp4', 'Spot - 9x16.mp4']);
  assert.deepEqual(result.data.clips.map((clip) => ({ ratio: clip.ratio, width: clip.width, height: clip.height, framing: clip.framing })), [
    { ratio: 'landscape', width: 1920, height: 1080, framing: 'blur' },
    { ratio: 'portrait', width: 1080, height: 1920, framing: 'blur' }
  ]);
  assert.deepEqual(result.data.clips.map((clip) => probeDimensions(clip.outputPath)), [
    { width: 1920, height: 1080 },
    { width: 1080, height: 1920 }
  ]);
  assert.deepEqual(result.data.clips.map((clip) => path.basename(clip.captionPaths[0])), ['Spot - 16x9.srt', 'Spot - 9x16.srt']);
});

test('Studio renders audio clips with caption sidecars', { timeout: 120000 }, async (t) => {
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-audio-'));
  t.after(() => fsp.rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'output');
  const sample = path.join(temp, 'sample.wav');
  runTool([
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100',
    '-t', '1.5', '-c:a', 'pcm_s16le', sample
  ]);
  const { result } = await render({
    tool: 'studio',
    inputPaths: [sample],
    options: {
      durationMs: 1500,
      outputFormat: 'flac',
      exportCaptions: 'vtt',
      burnCaptions: true,
      segments: [{ id: 'a', startMs: 200, endMs: 1000, text: 'Audio caption' }],
      clips: [{ id: 'one', label: 'Audio cut', startMs: 100, endMs: 1200 }]
    }
  }, output);
  assert.equal(result.outputPaths.length, 1);
  assert.equal(path.extname(result.outputPaths[0]), '.flac');
  assert.ok(fs.statSync(result.outputPaths[0]).size > 1000);
  assert.equal(result.data.clips[0].captionPaths.length, 1);
  assert.equal(path.extname(result.data.clips[0].captionPaths[0]), '.vtt');
  assert.deepEqual(probeStreamTypes(result.outputPaths[0]), ['audio']);
  assert.equal(parseVtt(await fsp.readFile(result.data.clips[0].captionPaths[0], 'utf8'))[0].text, 'Audio caption');
});
