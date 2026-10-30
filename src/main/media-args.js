'use strict';

const { OUTPUT_FORMATS } = require('./constants');

const QUALITY = {
  high: { crf: 18, webmCrf: 25, audioBitrate: '256k', mp3Quality: '0', vorbisQuality: '8', gifFps: 15, gifWidth: 800, webpQuality: 94 },
  balanced: { crf: 23, webmCrf: 32, audioBitrate: '192k', mp3Quality: '2', vorbisQuality: '6', gifFps: 12, gifWidth: 640, webpQuality: 88 },
  small: { crf: 29, webmCrf: 40, audioBitrate: '128k', mp3Quality: '5', vorbisQuality: '4', gifFps: 10, gifWidth: 480, webpQuality: 78 }
};

function presetFor(options = {}) {
  return QUALITY[options.quality] || QUALITY.balanced;
}

function shouldScale(media, options) {
  const targetHeight = Number(options.resolution);
  return Number.isFinite(targetHeight) && targetHeight > 0 && Number(media?.height) > targetHeight;
}

function buildVideoArgs(target, options, media, preset) {
  const args = [];
  const scale = shouldScale(media, options) ? `scale=-2:${Number(options.resolution)}` : null;

  if (target === 'gif') {
    const fps = Math.max(1, Math.min(30, Number(options.gifFps) || preset.gifFps));
    const width = Math.max(120, Math.min(1920, Number(options.gifWidth) || preset.gifWidth));
    args.push(
      '-filter_complex',
      `[0:v]fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a`,
      '-loop', '0',
      '-an'
    );
    return args;
  }

  const filters = [];
  if (scale) filters.push(scale);
  if (options.extraVideoFilter) filters.push(String(options.extraVideoFilter));
  if (filters.length) args.push('-vf', filters.join(','));
  args.push('-map', '0:v:0?', '-map', '0:a:0?');

  if (target === 'webm') {
    args.push(
      '-c:v', 'libvpx-vp9',
      '-crf', String(preset.webmCrf),
      '-b:v', '0',
      '-row-mt', '1',
      '-c:a', 'libopus',
      '-b:a', options.audioBitrate || preset.audioBitrate
    );
  } else if (target === 'avi') {
    args.push(
      '-c:v', 'mpeg4',
      '-q:v', options.quality === 'high' ? '3' : options.quality === 'small' ? '8' : '5',
      '-c:a', 'libmp3lame',
      '-b:a', options.audioBitrate || preset.audioBitrate
    );
  } else {
    const videoBitrate = Number(options.videoBitrate);
    if (Number.isFinite(videoBitrate) && videoBitrate > 0) {
      const maxRate = Math.round(videoBitrate * 1.45);
      const buffer = Math.round(videoBitrate * 2);
      args.push(
        '-c:v', 'libx264',
        '-preset', options.fast ? 'veryfast' : 'medium',
        '-b:v', `${Math.round(videoBitrate)}k`,
        '-maxrate', `${maxRate}k`,
        '-bufsize', `${buffer}k`
      );
    } else {
      args.push(
        '-c:v', 'libx264',
        '-preset', options.fast ? 'veryfast' : 'medium',
        '-crf', String(Number.isFinite(Number(options.crf)) ? Number(options.crf) : preset.crf)
      );
    }
    args.push('-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', options.audioBitrate || preset.audioBitrate);
  }

  if (target === 'mp4' || target === 'mov') args.push('-movflags', '+faststart');
  return args;
}

function buildAudioArgs(target, options, preset) {
  const args = ['-vn', '-map', '0:a:0?'];
  const bitrate = options.audioBitrate || preset.audioBitrate;
  if (target === 'mp3') {
    args.push('-c:a', 'libmp3lame', '-q:a', String(options.mp3Quality || preset.mp3Quality));
  } else if (target === 'wav') {
    args.push('-c:a', 'pcm_s16le');
  } else if (target === 'flac') {
    args.push('-c:a', 'flac', '-compression_level', '8');
  } else if (target === 'm4a') {
    args.push('-c:a', 'aac', '-b:a', bitrate);
  } else if (target === 'ogg') {
    args.push('-c:a', 'libvorbis', '-q:a', String(preset.vorbisQuality));
  } else if (target === 'opus') {
    args.push('-c:a', 'libopus', '-b:a', bitrate);
  } else {
    throw new Error(`Unsupported audio format: ${target}`);
  }
  return args;
}

function buildImageArgs(target, options, preset) {
  const args = ['-frames:v', '1', '-update', '1', '-an', '-map', '0:v:0?'];
  const maxWidth = Number(options.imageWidth);
  const filters = [];
  if (Number.isFinite(maxWidth) && maxWidth > 0) filters.push(`scale='min(iw,${maxWidth})':-2`);
  if (target === 'ico') filters.push('scale=256:256:force_original_aspect_ratio=decrease', 'pad=256:256:(ow-iw)/2:(oh-ih)/2:color=#00000000');
  if (filters.length) args.push('-vf', filters.join(','));

  if (target === 'png') {
    args.push('-c:v', 'png', '-compression_level', '6');
  } else if (target === 'jpg') {
    args.push('-c:v', 'mjpeg', '-q:v', options.quality === 'high' ? '2' : options.quality === 'small' ? '7' : '4');
  } else if (target === 'webp') {
    args.push('-c:v', 'libwebp', '-q:v', String(preset.webpQuality));
  } else if (target === 'avif') {
    args.push('-c:v', 'libaom-av1', '-crf', options.quality === 'high' ? '22' : options.quality === 'small' ? '38' : '30', '-b:v', '0', '-still-picture', '1');
  } else if (target === 'bmp') {
    args.push('-c:v', 'bmp');
  } else if (target === 'tiff') {
    args.push('-c:v', 'tiff', '-compression_algo', 'lzw');
  } else if (target === 'ico') {
    args.push('-c:v', 'png', '-pix_fmt', 'rgba', '-f', 'ico');
  } else {
    throw new Error(`Unsupported image format: ${target}`);
  }
  return args;
}

function buildMediaArgs({ input, output, target, options = {}, media = {}, trim = {} }) {
  const format = String(target || '').toLowerCase().replace(/^\./, '');
  const definition = OUTPUT_FORMATS[format];
  if (!definition) throw new Error(`Unsupported output format: ${target}`);
  const preset = presetFor(options);
  const args = [];

  const start = Number(trim.start);
  const duration = Number(trim.duration);
  if (Number.isFinite(start) && start > 0) args.push('-ss', String(start));
  args.push('-i', input);
  if (Number.isFinite(duration) && duration > 0) args.push('-t', String(duration));

  if (definition.category === 'video') {
    args.push(...buildVideoArgs(format, options, media, preset));
  } else if (definition.category === 'audio') {
    args.push(...buildAudioArgs(format, options, preset));
  } else if (definition.category === 'image') {
    args.push(...buildImageArgs(format, options, preset));
  } else {
    throw new Error(`Format ${format} is not a media format.`);
  }

  args.push('-map_metadata', '0', output);
  return args;
}

module.exports = {
  QUALITY,
  presetFor,
  buildMediaArgs,
  buildVideoArgs,
  buildAudioArgs,
  buildImageArgs
};
