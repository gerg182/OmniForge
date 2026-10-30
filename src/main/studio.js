'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { extensionOf, formatCategory } = require('./constants');
const { buildMediaArgs } = require('./media-args');
const { clipSegments, buildAss, serializeTranscript, normalizeCaptionStyle } = require('./transcript');
const { normalizeClips, VIDEO_FORMATS, AUDIO_FORMATS, CAPTION_EXPORTS } = require('./studio-project');
const {
  ensureDir,
  sanitizeFilename,
  runProcess,
  probeMedia,
  getMediaDuration,
  clamp
} = require('./utils');

function assertInputs(spec) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length !== 1) {
    throw new Error('Transcript Clip Studio renders one media file per job.');
  }
  const filePath = spec.inputPaths[0];
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  if (!fs.statSync(filePath).isFile()) throw new Error(`Not a file: ${filePath}`);
}

function normalizeStudioOptions(options = {}, category) {
  const allowedFormats = category === 'video' ? VIDEO_FORMATS : category === 'audio' ? AUDIO_FORMATS : [];
  const requestedFormat = String(options.outputFormat || '').toLowerCase();
  const outputFormat = requestedFormat || (category === 'video' ? 'mp4' : 'mp3');
  if (!allowedFormats.includes(outputFormat)) {
    throw new Error(`Choose a valid ${category === 'video' ? 'video' : 'audio'} output format.`);
  }
  const clips = normalizeClips(options.clips);
  if (clips.length === 0) throw new Error('Add at least one transcript clip.');
  const segments = Array.isArray(options.segments) ? options.segments : [];
  const exportCaptions = CAPTION_EXPORTS.includes(options.exportCaptions) ? options.exportCaptions : 'srt';
  return {
    outputFormat,
    quality: ['high', 'balanced', 'small'].includes(options.quality) ? options.quality : 'high',
    burnCaptions: category === 'video' && options.burnCaptions !== false,
    exportCaptions,
    captionStyle: normalizeCaptionStyle(options.captionStyle),
    clips,
    segments
  };
}

function validateStudioSpec(spec) {
  assertInputs(spec);
  const filePath = spec.inputPaths[0];
  const category = formatCategory(extensionOf(filePath));
  if (!['audio', 'video'].includes(category)) throw new Error('Choose an audio or video file.');
  const options = normalizeStudioOptions(spec.options, category);
  const durationMs = Math.max(0, Math.round(Number(spec.options?.durationMs) || 0));
  for (const clip of options.clips) {
    if (durationMs > 0 && clip.startMs >= durationMs) throw new Error('A clip starts beyond the end of the media.');
    if (durationMs > 0 && clip.endMs > durationMs + 50) throw new Error('A clip ends beyond the end of the media.');
  }
  return { category, options };
}

function escapeFilterPath(filePath) {
  return String(filePath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,');
}

async function runFfmpeg(ctx, ffmpeg, args, options = {}) {
  const duration = Number(options.duration) || 0;
  const progressBase = options.progressBase ?? 0;
  const progressSpan = options.progressSpan ?? 100;
  const message = options.message || 'Rendering clip...';
  let buffer = '';
  let lastPercent = -1;
  let lastSent = 0;

  ctx.report({ message, progress: progressBase });
  await runProcess(
    ffmpeg,
    ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-stats_period', '0.4', ...args],
    {
      signal: ctx.signal,
      onStdout: (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          const separator = line.indexOf('=');
          if (separator === -1) continue;
          const key = line.slice(0, separator);
          const value = line.slice(separator + 1);
          if (key === 'out_time_us' || key === 'out_time_ms') {
            const seconds = Number(value) / 1_000_000;
            if (duration > 0 && Number.isFinite(seconds)) {
              const fraction = clamp(seconds / duration, 0, 0.99);
              const percent = Math.round(progressBase + fraction * progressSpan);
              const now = Date.now();
              if (percent !== lastPercent && (now - lastSent > 250 || percent >= 99)) {
                lastPercent = percent;
                lastSent = now;
                ctx.report({ progress: percent, message });
              }
            }
          } else if (key === 'progress' && value === 'end') {
            ctx.report({ progress: Math.round(progressBase + progressSpan), message: 'Finalizing...' });
          }
        }
      }
    }
  );
}

function sidecarExtensions(mode) {
  if (mode === 'both') return ['srt', 'vtt'];
  return ['srt', 'vtt'].includes(mode) ? [mode] : [];
}

function uniqueClipPaths(outputDirectory, label, outputFormat, captionMode) {
  const safeBase = sanitizeFilename(label, 'clip');
  let index = 1;
  while (true) {
    const suffix = index === 1 ? '' : ` (${index})`;
    const base = `${safeBase}${suffix}`;
    const outputPath = path.join(outputDirectory, `${base}.${outputFormat}`);
    const sidecars = sidecarExtensions(captionMode).map((ext) => path.join(outputDirectory, `${base}.${ext}`));
    if (![outputPath, ...sidecars].some((candidate) => fs.existsSync(candidate))) {
      return { outputPath, sidecars };
    }
    index += 1;
  }
}

async function executeStudioClips(spec, ctx, deps) {
  const { category, options } = validateStudioSpec(spec);
  const paths = deps.tools.paths();
  if (!fs.existsSync(paths.ffmpeg)) throw new Error('FFmpeg is missing from the bundled tools.');
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-studio-'));
  const mediaPath = spec.inputPaths[0];
  const mediaDuration = await getMediaDuration(paths.ffprobe, mediaPath);
  const mediaInfo = await probeMedia(paths.ffprobe, mediaPath).catch(() => null);
  const height = Number((mediaInfo?.streams || []).find((stream) => stream.codec_type === 'video')?.height) || 0;
  const outputPaths = [];
  const clipResults = [];
  const total = options.clips.length;

  try {
    for (let index = 0; index < total; index += 1) {
      const clip = options.clips[index];
      const startMs = Math.max(0, Math.round(clip.startMs));
      const endMs = mediaDuration > 0
        ? Math.min(Math.round(clip.endMs), Math.round(mediaDuration * 1000))
        : Math.round(clip.endMs);
      if (endMs <= startMs) throw new Error(`Clip "${clip.label}" has an invalid time range.`);
      const duration = (endMs - startMs) / 1000;
      const targetPaths = uniqueClipPaths(outputDirectory, clip.label, options.outputFormat, options.exportCaptions);
      const captionSegments = clipSegments(options.segments, startMs, endMs);
      const base = (index / total) * 100;
      const span = 100 / total;
      const message = `Rendering ${clip.label}`;
      let currentOutput = targetPaths.outputPath;

      try {
        let captionFilter = '';
        if (category === 'video' && options.burnCaptions && captionSegments.length > 0) {
          const assPath = path.join(tempRoot, `captions-${index}.ass`);
          await fsp.writeFile(assPath, buildAss(captionSegments, options.captionStyle), 'utf8');
          captionFilter = `ass='${escapeFilterPath(assPath)}'`;
        }

        const args = buildMediaArgs({
          input: mediaPath,
          output: targetPaths.outputPath,
          target: options.outputFormat,
          options: {
            quality: options.quality,
            extraVideoFilter: captionFilter || undefined
          },
          media: { height, duration: mediaDuration },
          trim: { start: startMs / 1000, duration }
        });
        await runFfmpeg(ctx, paths.ffmpeg, args, {
          duration,
          progressBase: base,
          progressSpan: span,
          message
        });
        if (!fs.existsSync(targetPaths.outputPath)) {
          throw new Error(`Clip "${clip.label}" finished without creating an output file.`);
        }

        const captionPaths = [];
        for (const sidecar of targetPaths.sidecars) {
          const format = extensionOf(sidecar);
          await fsp.writeFile(sidecar, serializeTranscript(captionSegments, format), 'utf8');
          captionPaths.push(sidecar);
        }

        outputPaths.push(targetPaths.outputPath);
        clipResults.push({
          id: clip.id,
          label: clip.label,
          startMs,
          endMs,
          outputPath: targetPaths.outputPath,
          captionPaths
        });
      } catch (error) {
        try {
          await Promise.all([currentOutput, ...targetPaths.sidecars].map(async (candidate) => {
            if (fs.existsSync(candidate)) await fsp.unlink(candidate);
          }));
        } catch {
          // The source error is more useful than a cleanup failure.
        }
        throw error;
      }
      ctx.report({ progress: Math.round(base + span), message: `${clip.label} complete.` });
    }
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }

  return {
    outputPaths,
    data: {
      kind: 'studio',
      clips: clipResults
    }
  };
}

module.exports = {
  assertInputs,
  normalizeStudioOptions,
  validateStudioSpec,
  escapeFilterPath,
  sidecarExtensions,
  uniqueClipPaths,
  executeStudioClips
};
