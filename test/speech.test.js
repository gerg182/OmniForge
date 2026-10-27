'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  normalizeLanguage,
  outputExtensionFor,
  normalizeThreads,
  buildWaveArgs,
  buildWhisperArgs,
  parseWhisperProgress,
  executeTranscribe
} = require('../src/main/speech');

const toolsDir = path.join(__dirname, '..', 'tools');
const ffmpeg = path.join(toolsDir, 'ffmpeg.exe');
const ffprobe = path.join(toolsDir, 'ffprobe.exe');
const whisper = path.join(toolsDir, 'whisper-cli.exe');
const whisperModel = path.join(toolsDir, 'ggml-base.bin');
const sample = path.join(__dirname, 'fixtures', 'jfk.wav');
const speechReady = fs.existsSync(ffmpeg) && fs.existsSync(ffprobe) && fs.existsSync(whisper) && fs.existsSync(whisperModel) && fs.existsSync(sample);

const deps = {
  tools: {
    paths: () => ({ ffmpeg, ffprobe, whisper, whisperModel })
  }
};

test('speech options validate language, format, and threads', () => {
  assert.equal(normalizeLanguage(''), 'auto');
  assert.equal(normalizeLanguage('EN'), 'en');
  assert.throws(() => normalizeLanguage('english!'), /valid transcription language/);
  assert.equal(outputExtensionFor('SRT'), 'srt');
  assert.throws(() => outputExtensionFor('pdf'), /TXT or SRT/);
  assert.equal(normalizeThreads(2), 2);
  assert.ok(normalizeThreads(0) >= 1);
  assert.equal(normalizeThreads(999), 32);
});

test('whisper and wave arguments are built correctly', () => {
  const wave = buildWaveArgs({ input: 'C:\\in.mp4', output: 'C:\\temp\\out.wav' });
  assert.ok(wave.includes('16000'));
  assert.ok(wave.includes('pcm_s16le'));
  assert.equal(wave[wave.length - 1], 'C:\\temp\\out.wav');

  const args = buildWhisperArgs({
    model: 'C:\\tools\\ggml-base.bin',
    input: 'C:\\temp\\out.wav',
    outputBase: 'C:\\temp\\transcript',
    language: 'es',
    format: 'srt',
    threads: 4
  });
  assert.ok(args.includes('-osrt'));
  assert.ok(args.includes('es'));
  assert.ok(args.includes('C:\\temp\\transcript'));
  assert.ok(!args.includes('-otxt'));
});

test('whisper progress lines are parsed', () => {
  assert.equal(parseWhisperProgress('whisper_print_progress_callback: progress = 42%'), 42);
  assert.equal(parseWhisperProgress('no progress here'), null);
  assert.equal(parseWhisperProgress('progress = 140%'), 100);
});

test('local whisper transcribes a spoken WAV and returns dictation text', { timeout: 180000, skip: !speechReady }, async (t) => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-speech-test-'));
  t.after(() => fs.rmSync(outputDirectory, { recursive: true, force: true }));
  const result = await executeTranscribe({
    tool: 'transcribe',
    inputPaths: [sample],
    outputDirectory,
    options: { language: 'auto', outputFormat: 'txt' }
  }, { signal: new AbortController().signal, report: () => {} }, deps);

  assert.equal(result.outputPaths.length, 1);
  assert.ok(result.outputPaths[0].endsWith('.txt'));
  const text = fs.readFileSync(result.outputPaths[0], 'utf8').toLowerCase();
  assert.ok(text.includes('country'), text);

  const dictation = await executeTranscribe({
    tool: 'transcribe',
    inputPaths: [sample],
    outputDirectory,
    options: { language: 'en', outputFormat: 'srt', dictation: true, baseName: 'Dictation test' }
  }, { signal: new AbortController().signal, report: () => {} }, deps);

  assert.ok(dictation.outputPaths[0].endsWith('.srt'));
  assert.ok(dictation.data.transcriptText.includes('-->'));
  assert.equal(dictation.data.transcriptPath, dictation.outputPaths[0]);
});