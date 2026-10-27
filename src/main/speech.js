'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  ensureDir,
  sanitizeFilename,
  baseNameWithoutExtension,
  uniquePath,
  runProcess,
  getMediaDuration
} = require('./utils');
const { extensionOf, formatCategory } = require('./constants');

const SPEECH_OUTPUT_FORMATS = ['txt', 'srt'];
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/i;

function normalizeLanguage(value) {
  const language = String(value || 'auto').trim().toLowerCase();
  if (!language || language === 'auto') return 'auto';
  if (!LANGUAGE_PATTERN.test(language)) throw new Error('Choose a valid transcription language.');
  return language;
}

function outputExtensionFor(value) {
  const format = String(value || 'txt').trim().toLowerCase().replace(/^\./, '');
  if (!SPEECH_OUTPUT_FORMATS.includes(format)) throw new Error('Choose TXT or SRT for transcript output.');
  return format;
}

function normalizeThreads(value) {
  const requested = Math.round(Number(value) || 0);
  if (requested > 0) return Math.max(1, Math.min(32, requested));
  const cpus = os.cpus()?.length || 4;
  return Math.max(1, Math.min(8, cpus));
}

function buildWaveArgs({ input, output }) {
  return [
    '-hide_banner', '-nostdin', '-y',
    '-i', String(input),
    '-vn', '-sn', '-dn',
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    String(output)
  ];
}

function buildWhisperArgs({ model, input, outputBase, language = 'auto', format = 'txt', threads = 4 }) {
  const extension = outputExtensionFor(format);
  return [
    '-m', String(model),
    '-f', String(input),
    '-l', normalizeLanguage(language),
    '-t', String(normalizeThreads(threads)),
    '-of', String(outputBase),
    '-pp',
    '-np',
    extension === 'srt' ? '-osrt' : '-otxt'
  ];
}

function parseWhisperProgress(text) {
  const match = /progress\s*=\s*(\d{1,3})\s*%/i.exec(String(text || ''));
  if (!match) return null;
  return Math.max(0, Math.min(100, Number(match[1])));
}

function transcriptBaseName(filePath, requested) {
  const custom = requested ? sanitizeFilename(String(requested)) : '';
  return `${custom || baseNameWithoutExtension(filePath)}_transcript`;
}

async function executeTranscribe(spec, ctx, deps) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length === 0) {
    throw new Error('Choose at least one audio or video file.');
  }

  const paths = deps.tools.paths();
  if (!fs.existsSync(paths.whisper)) {
    throw new Error('The Whisper speech engine is missing from the bundled tools.');
  }
  if (!fs.existsSync(paths.whisperModel)) {
    throw new Error('The Whisper speech model is missing from the bundled tools.');
  }

  const format = outputExtensionFor(spec.options?.outputFormat);
  const language = normalizeLanguage(spec.options?.language);
  const threads = normalizeThreads(spec.options?.threads);
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-speech-'));
  const outputs = [];
  const total = spec.inputPaths.length;

  try {
    for (let index = 0; index < total; index += 1) {
      const filePath = spec.inputPaths[index];
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error(`File not found: ${filePath}`);
      }
      const category = formatCategory(extensionOf(filePath));
      if (!['audio', 'video'].includes(category)) {
        throw new Error(`${path.basename(filePath)} is not an audio or video file.`);
      }

      const base = Math.round((index / total) * 100);
      const span = Math.max(1, Math.round(100 / total));
      const convertEnd = Math.min(base + span, base + Math.max(2, Math.round(span * 0.12)));
      const transcribeStart = Math.min(convertEnd, base + Math.max(3, Math.round(span * 0.2)));
      const transcribeEnd = base + span;
      const name = path.basename(filePath);

      ctx.report({ progress: base + 1, message: `Preparing ${name}...` });
      const duration = await getMediaDuration(paths.ffprobe, filePath);
      const wavePath = path.join(tempRoot, `input-${index}.wav`);
      await runProcess(paths.ffmpeg, buildWaveArgs({ input: filePath, output: wavePath }), {
        signal: ctx.signal,
        timeoutMs: 30 * 60 * 1000,
        maxOutputBytes: 4 * 1024 * 1024
      });

      let waveSize = 0;
      try { waveSize = (await fsp.stat(wavePath)).size; } catch { waveSize = 0; }
      if (waveSize <= 44) {
        throw new Error(`${name} does not contain a usable audio track.`);
      }

      ctx.report({
        progress: Math.max(convertEnd, base + 2),
        message: `Transcribing ${name}...`
      });

      const outputBase = path.join(tempRoot, `transcript-${index}`);
      const args = buildWhisperArgs({
        model: paths.whisperModel,
        input: wavePath,
        outputBase,
        language,
        format,
        threads
      });
      let progressBuffer = '';
      let lastReported = -1;
      const handleOutput = (chunk) => {
        progressBuffer = (progressBuffer + chunk).slice(-8192);
        const percent = parseWhisperProgress(progressBuffer);
        if (percent === null || percent === lastReported) return;
        lastReported = percent;
        const scaled = transcribeStart + Math.round((percent / 100) * Math.max(0, transcribeEnd - transcribeStart));
        ctx.report({ progress: Math.min(transcribeEnd, Math.max(transcribeStart, scaled)), message: `Transcribing ${name}...` });
      };

      await runProcess(paths.whisper, args, {
        signal: ctx.signal,
        timeoutMs: 0,
        maxOutputBytes: 8 * 1024 * 1024,
        onStdout: handleOutput,
        onStderr: handleOutput
      });

      const tempOutput = `${outputBase}.${format}`;
      if (!fs.existsSync(tempOutput)) {
        throw new Error(`Whisper finished without creating a transcript for ${name}.`);
      }
      const finalPath = uniquePath(outputDirectory, transcriptBaseName(filePath, spec.options?.baseName), format);
      await fsp.copyFile(tempOutput, finalPath);
      outputs.push(finalPath);
      ctx.report({
        progress: transcribeEnd,
        message: `Transcript ready for ${name}${duration > 0 ? ` (${Math.round(duration)}s)` : ''}.`
      });
    }

    if (spec.options?.dictation && outputs.length === 1) {
      const text = await fsp.readFile(outputs[0], 'utf8');
      return {
        outputPaths: outputs,
        data: {
          transcriptText: text.slice(0, 500000),
          transcriptPath: outputs[0],
          format
        }
      };
    }
    return { outputPaths: outputs };
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  SPEECH_OUTPUT_FORMATS,
  normalizeLanguage,
  outputExtensionFor,
  normalizeThreads,
  buildWaveArgs,
  buildWhisperArgs,
  parseWhisperProgress,
  executeTranscribe
};