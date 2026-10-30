'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { OUTPUT_FORMATS, extensionOf, formatCategory } = require('./constants');
const { buildMediaArgs } = require('./media-args');
const {
  ensureDir,
  baseNameWithoutExtension,
  uniquePath,
  uniqueDir,
  clamp,
  runProcess,
  probeMedia,
  getMediaDuration,
  parseTimestamp
} = require('./utils');
const { parseFfmpegSpeed } = require('./job-metrics');

function assertInputs(spec) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length === 0) throw new Error('Choose at least one input file.');
  for (const filePath of spec.inputPaths) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    if (!fs.statSync(filePath).isFile()) throw new Error(`Not a file: ${filePath}`);
  }
}

function assertToolFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing from the bundled tools.`);
}

async function runFfmpeg(ctx, deps, args, options = {}) {
  const paths = deps.tools.paths();
  assertToolFile(paths.ffmpeg, 'FFmpeg');
  const duration = Number(options.duration) || 0;
  const progressBase = options.progressBase ?? 0;
  const progressSpan = options.progressSpan ?? 100;
  const message = options.message || 'Processing media…';
  let buffer = '';
  let lastPercent = -1;
  let lastSent = 0;
  let latestSpeed = null;
  ctx.report({ message, progress: progressBase });
  await runProcess(
    paths.ffmpeg,
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
          if (key === 'speed') {
            latestSpeed = parseFfmpegSpeed(value);
            continue;
          }
          if (key === 'out_time_us' || key === 'out_time_ms') {
            const seconds = Number(value) / 1_000_000;
            if (duration > 0 && Number.isFinite(seconds)) {
              const fraction = clamp(seconds / duration, 0, 0.99);
              const percent = Math.round(progressBase + fraction * progressSpan);
              const now = Date.now();
              if (percent !== lastPercent && (now - lastSent > 250 || percent >= 99)) {
                lastPercent = percent;
                lastSent = now;
                ctx.report({ progress: percent, message, speed: latestSpeed });
              }
            }
          } else if (key === 'progress' && value === 'end') {
            ctx.report({ progress: Math.round(progressBase + progressSpan), message: 'Finalizing…' });
          }
        }
      }
    }
  );
  ctx.report({ progress: Math.round(progressBase + progressSpan) });
}

function even(value) {
  return Math.max(2, Math.round(Number(value) / 2) * 2);
}

function mediaStreams(media) {
  const streams = media?.streams || [];
  return {
    video: streams.find((stream) => stream.codec_type === 'video'),
    audio: streams.find((stream) => stream.codec_type === 'audio')
  };
}

async function executeJoin(spec, ctx, deps) {
  assertInputs(spec);
  if (spec.inputPaths.length < 2) throw new Error('Choose at least two files to join.');
  const firstExt = extensionOf(spec.inputPaths[0]);
  const category = formatCategory(firstExt);
  if (!['video', 'audio'].includes(category)) throw new Error('Join supports video and audio files only.');

  for (const filePath of spec.inputPaths) {
    const fileCategory = formatCategory(extensionOf(filePath));
    if (fileCategory !== category) throw new Error('All files in one join job must be the same media type.');
  }

  let target = String(spec.options.outputFormat || (category === 'video' ? 'mp4' : 'mp3')).toLowerCase();
  if (!OUTPUT_FORMATS[target] || OUTPUT_FORMATS[target].category !== category) {
    target = category === 'video' ? 'mp4' : 'mp3';
  }
  if (target === 'gif') throw new Error('Choose a video format for the joined result.');

  const outputDirectory = await ensureDir(spec.outputDirectory);
  const base = spec.options.joinName ? baseNameWithoutExtension(String(spec.options.joinName)) : 'joined';
  const outputPath = uniquePath(outputDirectory, base, target);
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-join-'));
  const paths = deps.tools.paths();
  assertToolFile(paths.ffmpeg, 'FFmpeg');

  try {
    const infoList = [];
    for (const filePath of spec.inputPaths) {
      const media = await probeMedia(paths.ffprobe, filePath);
      const streams = mediaStreams(media);
      infoList.push({
        filePath,
        media,
        streams,
        duration: Number(media?.format?.duration) || Number(streams.video?.duration) || Number(streams.audio?.duration) || 0
      });
    }

    const firstVideo = infoList.find((entry) => entry.streams.video)?.streams.video;
    if (category === 'video' && !firstVideo) throw new Error('No video stream was found in the first input.');
    if (category === 'audio' && !infoList.some((entry) => entry.streams.audio)) throw new Error('No audio stream was found in the selected files.');

    const sourceHeight = Number(firstVideo?.height) || 720;
    const requestedHeight = Number(spec.options.resolution);
    const targetHeight = even(Number.isFinite(requestedHeight) && requestedHeight > 0 ? Math.min(requestedHeight, sourceHeight) : Math.min(sourceHeight, 1080));
    const sourceWidth = Number(firstVideo?.width) || 1280;
    const targetWidth = even(Math.max(2, (sourceWidth * targetHeight) / sourceHeight));
    const totalDuration = infoList.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const parts = [];

    for (let index = 0; index < infoList.length; index += 1) {
      const entry = infoList[index];
      const fileName = `part-${String(index).padStart(3, '0')}.${category === 'video' ? 'mp4' : 'wav'}`;
      const partPath = path.join(tempDir, fileName);
      const baseProgress = Math.round((index / infoList.length) * 82);
      const span = Math.round(82 / infoList.length);
      const args = ['-i', entry.filePath];

      if (category === 'video') {
        const hasAudio = Boolean(entry.streams.audio);
        if (!hasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
        args.push('-map', '0:v:0');
        if (hasAudio) {
          args.push('-map', '0:a:0');
        } else {
          args.push('-map', '1:a:0', '-shortest');
        }
        args.push(
          '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
          partPath
        );
      } else {
        if (!entry.streams.audio) throw new Error(`No audio stream found in ${path.basename(entry.filePath)}.`);
        args.push('-map', '0:a:0', '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', partPath);
      }

      await runFfmpeg(ctx, deps, args, {
        duration: entry.duration,
        progressBase: baseProgress,
        progressSpan: span,
        message: `Preparing ${index + 1}/${infoList.length}: ${path.basename(entry.filePath)}`
      });
      parts.push(fileName);
    }

    const listPath = path.join(tempDir, 'parts.txt');
    await fsp.writeFile(listPath, `${parts.map((part) => `file '${part}'`).join('\n')}\n`, 'utf8');
    const concatPath = path.join(tempDir, `joined.${category === 'video' ? 'mp4' : 'wav'}`);
    ctx.report({ progress: 84, message: 'Joining clips…' });
    await runProcess(paths.ffmpeg, [
      '-hide_banner', '-nostdin', '-y',
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-c', 'copy', concatPath
    ], { signal: ctx.signal });

    if ((category === 'video' && target === 'mp4') || (category === 'audio' && target === 'wav')) {
      await fsp.copyFile(concatPath, outputPath);
      ctx.report({ progress: 100, message: 'Join complete.' });
    } else {
      const args = buildMediaArgs({
        input: concatPath,
        output: outputPath,
        target,
        options: { ...spec.options, quality: spec.options.quality || 'high' },
        media: { height: targetHeight, duration: totalDuration }
      });
      await runFfmpeg(ctx, deps, args, {
        duration: totalDuration,
        progressBase: 86,
        progressSpan: 14,
        message: 'Rendering the joined file…'
      });
    }

    if (!fs.existsSync(outputPath)) throw new Error('The joined file was not created.');
    return { outputPaths: [outputPath] };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function executeFrames(spec, ctx, deps) {
  assertInputs(spec);
  const target = String(spec.options.imageFormat || 'png').toLowerCase();
  if (!['png', 'jpg'].includes(target)) throw new Error('Choose PNG or JPG for extracted frames.');
  const mode = spec.options.mode === 'timestamp' ? 'timestamp' : 'interval';
  const interval = Math.max(0.05, Math.min(3600, Number(spec.options.interval) || 1));
  const maxFrames = Math.max(1, Math.min(2000, Number(spec.options.maxFrames) || 100));
  const width = Number(spec.options.width) || 0;
  const paths = deps.tools.paths();
  const outputs = [];

  if (mode === 'timestamp') {
    const timestamp = parseTimestamp(spec.options.timestamp);
    if (timestamp === null) throw new Error('Enter a valid timestamp, such as 5, 00:05, or 00:00:05.500.');
    for (let index = 0; index < spec.inputPaths.length; index += 1) {
      const filePath = spec.inputPaths[index];
      const duration = await getMediaDuration(paths.ffprobe, filePath);
      if (duration > 0 && timestamp >= duration) {
        throw new Error(`Timestamp ${spec.options.timestamp} is beyond the end of ${path.basename(filePath)} (${duration.toFixed(2)} seconds).`);
      }
      const outputDirectory = await ensureDir(spec.outputDirectory);
      const timeLabel = `${timestamp.toFixed(3).replace('.', '_')}s`;
      const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_at_${timeLabel}`, target);
      const args = ['-i', filePath, '-ss', String(timestamp), '-frames:v', '1', '-update', '1', '-an', '-map', '0:v:0'];
      if (width > 0) args.push('-vf', `scale=${Math.round(width)}:-2`);
      if (target === 'jpg') args.push('-q:v', '2');
      args.push(outputPath);
      const base = Math.round((index / spec.inputPaths.length) * 100);
      const span = Math.round(100 / spec.inputPaths.length);
      await runFfmpeg(ctx, deps, args, {
        progressBase: base,
        progressSpan: span,
        message: `Extracting frame at ${spec.options.timestamp} from ${path.basename(filePath)}`
      });
      if (!fs.existsSync(outputPath)) throw new Error('The requested frame could not be extracted.');
      outputs.push(outputPath);
    }
    return { outputPaths: outputs };
  }

  for (const filePath of spec.inputPaths) {
    const duration = await getMediaDuration(paths.ffprobe, filePath);
    const outputDirectory = await ensureDir(spec.outputDirectory);
    const framesDirectory = uniqueDir(outputDirectory, `${baseNameWithoutExtension(filePath)}_frames`);
    await ensureDir(framesDirectory);
    const filters = [`fps=1/${interval}`];
    if (width > 0) filters.push(`scale=${Math.round(width)}:-2`);
    const pattern = path.join(framesDirectory, `frame-%04d.${target}`);
    const args = ['-i', filePath, '-vf', filters.join(','), '-frames:v', String(maxFrames)];
    if (target === 'jpg') args.push('-q:v', '2');
    args.push('-start_number', '0', pattern);
    const base = Math.round((outputs.length / spec.inputPaths.length) * 100);
    const span = Math.round(100 / spec.inputPaths.length);
    await runFfmpeg(ctx, deps, args, {
      duration,
      progressBase: base,
      progressSpan: span,
      message: `Extracting frames from ${path.basename(filePath)}`
    });
    const count = (await fsp.readdir(framesDirectory)).length;
    if (count === 0) throw new Error('No frames were created. Try a shorter interval or a longer clip.');
    outputs.push(framesDirectory);
  }
  return { outputPaths: outputs };
}

async function executeNormalize(spec, ctx, deps) {
  assertInputs(spec);
  const target = String(spec.options.audioFormat || 'mp3').toLowerCase();
  if (!OUTPUT_FORMATS[target] || OUTPUT_FORMATS[target].category !== 'audio') {
    throw new Error('Choose a valid audio output format.');
  }
  const outputs = [];
  for (let index = 0; index < spec.inputPaths.length; index += 1) {
    const filePath = spec.inputPaths[index];
    const media = await probeMedia(deps.tools.paths().ffprobe, filePath);
    const streams = mediaStreams(media);
    if (!streams.audio) throw new Error(`No audio stream found in ${path.basename(filePath)}.`);
    const duration = Number(media?.format?.duration) || Number(streams.audio?.duration) || 0;
    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_normalized`, target);
    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target,
      options: { ...spec.options, quality: spec.options.quality || 'high' }
    });
    const metadataIndex = args.lastIndexOf('-map_metadata');
    args.splice(metadataIndex, 0, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11');
    const base = Math.round((index / spec.inputPaths.length) * 100);
    const span = Math.round(100 / spec.inputPaths.length);
    await runFfmpeg(ctx, deps, args, {
      duration,
      progressBase: base,
      progressSpan: span,
      message: `Normalizing ${path.basename(filePath)}`
    });
    if (!fs.existsSync(outputPath)) throw new Error('Normalization finished without creating an output file.');
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

module.exports = { executeJoin, executeFrames, executeNormalize };
