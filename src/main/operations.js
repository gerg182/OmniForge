'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { PDFDocument, degrees } = require('pdf-lib');
const { OUTPUT_FORMATS, extensionOf, formatCategory } = require('./constants');
const { parseData, serializeData } = require('./data');
const { buildMediaArgs } = require('./media-args');
const { isSupportedYouTubeUrl, parseYouTubeProgressLine } = require('./youtube');
const {
  ensureDir,
  baseNameWithoutExtension,
  uniquePath,
  uniqueDir,
  parseTimestamp,
  clamp,
  runProcess,
  probeMedia,
  getMediaDuration,
  CANCELLED
} = require('./utils');
const { executeJoin, executeFrames, executeNormalize } = require('./extra-operations');
const { executeTranscribe } = require('./speech');
const { encryptFile, decryptFile, encryptedOutputPath } = require('./encryption');

function assertInputs(spec) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length === 0) {
    throw new Error('Choose at least one input file.');
  }
  for (const filePath of spec.inputPaths) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    if (!fs.statSync(filePath).isFile()) throw new Error(`Not a file: ${filePath}`);
  }
}

function assertToolFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing from the bundled tools.`);
}

function targetDefinition(target) {
  const format = String(target || '').toLowerCase().replace(/^\./, '');
  const definition = OUTPUT_FORMATS[format];
  if (!definition) throw new Error(`Unsupported output format: ${target}`);
  return { format, definition };
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
            ctx.report({ progress: Math.round(progressBase + progressSpan), message: 'Finalizing…' });
          }
        }
      }
    }
  );
  ctx.report({ progress: Math.round(progressBase + progressSpan) });
}

async function convertDataFile(spec, filePath, target, report) {
  const sourceFormat = extensionOf(filePath);
  if (!['json', 'csv', 'tsv', 'yaml', 'yml', 'xml'].includes(sourceFormat)) {
    throw new Error(`Cannot convert ${sourceFormat || 'this file'} as structured data.`);
  }
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const outputPath = uniquePath(outputDirectory, baseNameWithoutExtension(filePath), target);
  report({ message: `Reading ${path.basename(filePath)}…` });
  const text = await fsp.readFile(filePath, 'utf8');
  const records = parseData(text, sourceFormat);
  report({ message: `Writing ${target.toUpperCase()}…` });
  const serialized = serializeData(records, target);
  await fsp.writeFile(outputPath, serialized, 'utf8');
  return outputPath;
}

async function executeConvert(spec, ctx, deps) {
  assertInputs(spec);
  const target = String(spec.options.targetFormat || '').toLowerCase().replace(/^\./, '');
  const { definition } = targetDefinition(target);
  const outputs = [];
  const total = spec.inputPaths.length;

  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const sourceCategory = formatCategory(extensionOf(filePath));
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);

    if (definition.category === 'data') {
      ctx.report({ progress: base });
      const output = await convertDataFile(spec, filePath, target, ctx.report);
      outputs.push(output);
      ctx.report({ progress: base + span });
      continue;
    }

    if (sourceCategory === 'data') {
      throw new Error(`${path.basename(filePath)} is a data file. Choose a data output format instead.`);
    }
    if (sourceCategory === 'pdf' || sourceCategory === 'archive' || sourceCategory === 'unknown') {
      throw new Error(`The Universal Converter cannot convert ${path.basename(filePath)} to ${target.toUpperCase()}.`);
    }

    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, baseNameWithoutExtension(filePath), target);
    let media = {};
    try { media = await probeMedia(deps.tools.paths().ffprobe, filePath); } catch { media = {}; }
    const stream = (media.streams || []).find((entry) => entry.codec_type === 'video');
    const duration = Number(media?.format?.duration) || Number(stream?.duration) || 0;
    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target,
      options: spec.options,
      media: { height: Number(stream?.height) || 0, duration }
    });
    await runFfmpeg(ctx, deps, args, {
      duration: definition.category === 'video' ? duration : 0,
      progressBase: base,
      progressSpan: span,
      message: `Converting ${path.basename(filePath)} → ${target.toUpperCase()}`
    });
    if (!fs.existsSync(outputPath)) throw new Error('FFmpeg finished without creating an output file.');
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

async function executeCompress(spec, ctx, deps) {
  assertInputs(spec);
  const options = { ...spec.options };
  const outputs = [];
  const total = spec.inputPaths.length;

  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const sourceExt = extensionOf(filePath);
    const category = formatCategory(sourceExt);
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);
    let target = String(options.outputFormat || '').toLowerCase();

    if (!target || !OUTPUT_FORMATS[target] || OUTPUT_FORMATS[target].category !== category) {
      if (category === 'video') target = OUTPUT_FORMATS[sourceExt]?.category === 'video' ? sourceExt : 'mp4';
      else if (category === 'audio') target = OUTPUT_FORMATS[sourceExt]?.category === 'audio' ? sourceExt : 'mp3';
      else if (category === 'image') target = OUTPUT_FORMATS[sourceExt]?.category === 'image' ? sourceExt : 'jpg';
      else throw new Error(`Compression is not supported for ${path.basename(filePath)}.`);
    }
    if (target === 'gif') target = 'mp4';

    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_compressed`, target);
    let media = {};
    try { media = await probeMedia(deps.tools.paths().ffprobe, filePath); } catch { media = {}; }
    const stream = (media.streams || []).find((entry) => entry.codec_type === 'video');
    const duration = Number(media?.format?.duration) || Number(stream?.duration) || 0;
    const runOptions = {
      ...options,
      fast: options.mode === 'size' ? false : Boolean(options.fast),
      resolution: options.resolution || 'source'
    };

    if (options.mode === 'size' && (category === 'video' || category === 'audio')) {
      const targetMB = Number(options.targetSizeMB);
      if (!Number.isFinite(targetMB) || targetMB <= 0) throw new Error('Enter a target size in MB.');
      if (duration <= 0) throw new Error('Could not read the media duration needed for target-size compression.');
      const totalKbps = Math.floor((targetMB * 8 * 1024 * 1024) / duration / 1000);
      const audioKbps = category === 'video' ? 128 : Math.max(64, Math.floor(totalKbps * 0.3));
      const videoKbps = totalKbps - audioKbps;
      if (category === 'video' && videoKbps < 180) throw new Error('That target size is too small for this video. Choose a larger size.');
      if (category === 'video') {
        runOptions.videoBitrate = videoKbps;
        runOptions.audioBitrate = '128k';
      } else {
        runOptions.audioBitrate = `${Math.max(64, totalKbps)}k`;
      }
    }

    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target,
      options: runOptions,
      media: { height: Number(stream?.height) || 0, duration }
    });
    await runFfmpeg(ctx, deps, args, {
      duration: category === 'video' ? duration : 0,
      progressBase: base,
      progressSpan: span,
      message: `Compressing ${path.basename(filePath)}`
    });
    if (!fs.existsSync(outputPath)) throw new Error('Compression finished without creating an output file.');
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

async function executeTrim(spec, ctx, deps) {
  assertInputs(spec);
  const outputs = [];
  const total = spec.inputPaths.length;

  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const sourceExt = extensionOf(filePath);
    const sourceCategory = formatCategory(sourceExt);
    let target = String(spec.options.outputFormat || '').toLowerCase();
    if (!OUTPUT_FORMATS[target] || !['video', 'audio'].includes(OUTPUT_FORMATS[target].category)) {
      target = sourceCategory === 'audio' ? 'mp3' : 'mp4';
    }

    const start = parseTimestamp(spec.options.start) ?? 0;
    const end = parseTimestamp(spec.options.end);
    const requestedDuration = parseTimestamp(spec.options.duration);
    let duration = requestedDuration;
    const sourceDuration = await getMediaDuration(deps.tools.paths().ffprobe, filePath);
    if (end !== null) {
      if (end <= start) throw new Error('The end time must be after the start time.');
      duration = end - start;
    }
    if (!duration || duration <= 0) duration = Math.max(0.1, sourceDuration - start);
    if (duration <= 0) throw new Error('Could not determine a valid trim duration.');

    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_trimmed`, target);
    let media = {};
    try { media = await probeMedia(deps.tools.paths().ffprobe, filePath); } catch { media = {}; }
    const stream = (media.streams || []).find((entry) => entry.codec_type === 'video');
    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target,
      options: { ...spec.options, quality: spec.options.quality || 'high' },
      media: { height: Number(stream?.height) || 0, duration: sourceDuration },
      trim: { start, duration }
    });
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);
    await runFfmpeg(ctx, deps, args, {
      duration,
      progressBase: base,
      progressSpan: span,
      message: `Trimming ${path.basename(filePath)}`
    });
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

async function executeExtract(spec, ctx, deps) {
  assertInputs(spec);
  const target = String(spec.options.audioFormat || 'mp3').toLowerCase();
  if (!OUTPUT_FORMATS[target] || OUTPUT_FORMATS[target].category !== 'audio') {
    throw new Error('Choose a valid audio output format.');
  }
  const outputs = [];
  const total = spec.inputPaths.length;

  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, baseNameWithoutExtension(filePath), target);
    const duration = await getMediaDuration(deps.tools.paths().ffprobe, filePath);
    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target,
      options: { ...spec.options, quality: spec.options.quality || 'high' }
    });
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);
    await runFfmpeg(ctx, deps, args, {
      duration,
      progressBase: base,
      progressSpan: span,
      message: `Extracting audio from ${path.basename(filePath)}`
    });
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

async function executeGif(spec, ctx, deps) {
  assertInputs(spec);
  const outputs = [];
  const total = spec.inputPaths.length;
  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const start = parseTimestamp(spec.options.start) ?? 0;
    const duration = parseTimestamp(spec.options.duration) || 5;
    const fps = Math.max(1, Math.min(30, Number(spec.options.fps) || 12));
    const width = Math.max(120, Math.min(1920, Number(spec.options.width) || 640));
    const sourceDuration = await getMediaDuration(deps.tools.paths().ffprobe, filePath);
    const actualDuration = Math.min(duration, Math.max(0.1, sourceDuration - start || duration));
    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_animated`, 'gif');
    const args = buildMediaArgs({
      input: filePath,
      output: outputPath,
      target: 'gif',
      options: { ...spec.options, gifFps: fps, gifWidth: width },
      trim: { start, duration: actualDuration }
    });
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);
    await runFfmpeg(ctx, deps, args, {
      duration: actualDuration,
      progressBase: base,
      progressSpan: span,
      message: `Building GIF from ${path.basename(filePath)}`
    });
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}

function parsePageRanges(spec, pageCount) {
  if (!String(spec || '').trim()) {
    return [{ label: 'all', pages: Array.from({ length: pageCount }, (_, index) => index) }];
  }
  const tokens = String(spec).split(',').map((token) => token.trim()).filter(Boolean);
  const ranges = [];
  for (const token of tokens) {
    const single = token.match(/^(\d+)$/);
    if (single) {
      const page = Number(single[1]);
      if (page < 1 || page > pageCount) throw new Error(`Page ${page} is outside this PDF (${pageCount} pages).`);
      ranges.push({ label: `page_${page}`, pages: [page - 1] });
      continue;
    }
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!range) throw new Error(`Invalid page selection: ${token}. Use formats like 1-3,5.`);
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1 || end < 1 || start > end || end > pageCount) {
      throw new Error(`Page range ${token} is outside this PDF (${pageCount} pages).`);
    }
    ranges.push({
      label: `pages_${start}-${end}`,
      pages: Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index)
    });
  }
  return ranges;
}

async function savePdfDocument(document, outputPath) {
  const bytes = await document.save();
  await fsp.writeFile(outputPath, bytes);
}

async function executePdf(spec, ctx) {
  assertInputs(spec);
  const operation = String(spec.options.operation || 'merge').toLowerCase();
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const outputs = [];

  if (operation === 'merge') {
    if (spec.inputPaths.length < 2) throw new Error('Choose at least two PDFs to merge.');
    ctx.report({ message: 'Reading PDFs…', progress: 5 });
    const merged = await PDFDocument.create();
    for (let index = 0; index < spec.inputPaths.length; index += 1) {
      const filePath = spec.inputPaths[index];
      const document = await PDFDocument.load(await fsp.readFile(filePath), { ignoreEncryption: false });
      const pages = await merged.copyPages(document, document.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      ctx.report({ progress: Math.round(((index + 1) / spec.inputPaths.length) * 65), message: `Adding ${path.basename(filePath)}…` });
    }
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(spec.inputPaths[0])}_merged`, 'pdf');
    ctx.report({ message: 'Writing merged PDF…', progress: 80 });
    await savePdfDocument(merged, outputPath);
    outputs.push(outputPath);
  } else {
    for (let inputIndex = 0; inputIndex < spec.inputPaths.length; inputIndex += 1) {
      const filePath = spec.inputPaths[inputIndex];
      const document = await PDFDocument.load(await fsp.readFile(filePath), { ignoreEncryption: false });
      const pageCount = document.getPageCount();
      const baseName = baseNameWithoutExtension(filePath);
      const ranges = parsePageRanges(spec.options.pages, pageCount);
      const base = Math.round((inputIndex / spec.inputPaths.length) * 100);
      const span = Math.round(100 / spec.inputPaths.length);

      if (operation === 'split') {
        for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
          const range = ranges[rangeIndex];
          const next = await PDFDocument.create();
          const pages = await next.copyPages(document, range.pages);
          pages.forEach((page) => next.addPage(page));
          const outputPath = uniquePath(outputDirectory, `${baseName}_${range.label}`, 'pdf');
          await savePdfDocument(next, outputPath);
          outputs.push(outputPath);
          ctx.report({ progress: base + Math.round(((rangeIndex + 1) / ranges.length) * span), message: `Saved ${path.basename(outputPath)}` });
        }
      } else if (operation === 'extract' || operation === 'reorder') {
        const pagesToCopy = ranges.flatMap((range) => range.pages);
        const next = await PDFDocument.create();
        const pages = await next.copyPages(document, pagesToCopy);
        pages.forEach((page) => next.addPage(page));
        const outputPath = uniquePath(outputDirectory, `${baseName}_${operation === 'reorder' ? 'reordered' : 'pages'}`, 'pdf');
        await savePdfDocument(next, outputPath);
        outputs.push(outputPath);
        ctx.report({ progress: base + span, message: `Saved ${path.basename(outputPath)}` });
      } else if (operation === 'rotate') {
        const angle = ((Number(spec.options.rotation) || 90) % 360 + 360) % 360;
        for (const page of document.getPages()) {
          const current = page.getRotation().angle || 0;
          page.setRotation(degrees(current + angle));
        }
        const outputPath = uniquePath(outputDirectory, `${baseName}_rotated`, 'pdf');
        await savePdfDocument(document, outputPath);
        outputs.push(outputPath);
        ctx.report({ progress: base + span, message: `Rotated ${path.basename(outputPath)}` });
      } else {
        throw new Error(`Unknown PDF operation: ${operation}`);
      }
    }
  }

  ctx.report({ progress: 100 });
  return { outputPaths: outputs };
}

function looksLikeWarning(error) {
  return error?.code === 1;
}

async function executeArchive(spec, ctx, deps) {
  const paths = deps.tools.paths();
  assertToolFile(paths.sevenZip, '7-Zip');
  const operation = String(spec.options.operation || 'create').toLowerCase();
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const outputs = [];

  if (operation === 'create') {
    assertInputs(spec);
    const archiveFormat = String(spec.options.archiveFormat || 'zip').toLowerCase();
    const base = String(spec.options.archiveName || baseNameWithoutExtension(spec.inputPaths[0])).replace(/\.(zip|7z|tar|gz)$/i, '');
    let outputPath;
    let args;

    if (archiveFormat === 'tar.gz') {
      outputPath = uniquePath(outputDirectory, base, 'tar.gz');
      const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'omniforge-archive-'));
      const temporaryTar = path.join(tempDir, 'archive.tar');
      try {
        await runProcess(paths.sevenZip, ['a', '-ttar', '-y', '-bsp1', temporaryTar, ...spec.inputPaths], {
          signal: ctx.signal,
          onStdout: (chunk) => {
            const match = chunk.match(/(\d+)%/g);
            if (match) {
              const percent = Number(match[match.length - 1].replace('%', ''));
              ctx.report({ progress: Math.round(percent * 0.6), message: 'Creating TAR archive…' });
            }
          }
        });
        await runProcess(paths.sevenZip, ['a', '-tgzip', '-y', '-bsp1', outputPath, temporaryTar], {
          signal: ctx.signal,
          onStdout: (chunk) => {
            const match = chunk.match(/(\d+)%/g);
            if (match) {
              const percent = Number(match[match.length - 1].replace('%', ''));
              ctx.report({ progress: 60 + Math.round(percent * 0.4), message: 'Compressing TAR.GZ…' });
            }
          }
        });
      } finally {
        await fsp.rm(tempDir, { recursive: true, force: true });
      }
    } else {
      const extension = archiveFormat === 'gzip' ? 'gz' : archiveFormat;
      if (extension === 'gz' && spec.inputPaths.length !== 1) throw new Error('GZIP can only compress one file at a time.');
      outputPath = uniquePath(outputDirectory, base, extension);
      const flag = extension === 'gz' ? '-tgzip' : `-t${extension}`;
      args = ['a', flag, '-y', '-bsp1', outputPath, ...spec.inputPaths];
      try {
        await runProcess(paths.sevenZip, args, {
          signal: ctx.signal,
          onStdout: (chunk) => {
            const match = chunk.match(/(\d+)%/g);
            if (match) {
              const percent = Number(match[match.length - 1].replace('%', ''));
              ctx.report({ progress: percent, message: `Creating ${extension.toUpperCase()} archive…` });
            }
          }
        });
      } catch (error) {
        if (!looksLikeWarning(error)) throw error;
      }
    }

    if (!fs.existsSync(outputPath)) throw new Error('Archive creation finished without an output file.');
    outputs.push(outputPath);
  } else if (operation === 'extract') {
    assertInputs(spec);
    for (let index = 0; index < spec.inputPaths.length; index += 1) {
      const filePath = spec.inputPaths[index];
      const destination = uniqueDir(outputDirectory, `${baseNameWithoutExtension(filePath)}_extracted`);
      await ensureDir(destination);
      ctx.report({ message: `Extracting ${path.basename(filePath)}…`, progress: Math.round((index / spec.inputPaths.length) * 100) });
      try {
        await runProcess(paths.sevenZip, ['x', '-y', '-bsp1', `-o${destination}`, filePath], {
          signal: ctx.signal,
          onStdout: (chunk) => {
            const match = chunk.match(/(\d+)%/g);
            if (match) {
              const percent = Number(match[match.length - 1].replace('%', ''));
              ctx.report({
                progress: Math.round(((index + percent / 100) / spec.inputPaths.length) * 100),
                message: `Extracting ${path.basename(filePath)}…`
              });
            }
          }
        });
      } catch (error) {
        if (!looksLikeWarning(error)) throw error;
      }
      outputs.push(destination);
    }
  } else {
    throw new Error(`Unknown archive operation: ${operation}`);
  }

  ctx.report({ progress: 100 });
  return { outputPaths: outputs };
}

function hashFileWithAlgorithms(filePath, algorithms, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error(CANCELLED)); return; }
    const hashes = Object.fromEntries(algorithms.map((algorithm) => [algorithm, crypto.createHash(algorithm)]));
    const stat = fs.statSync(filePath);
    const total = stat.size;
    let processed = 0;
    let settled = false;
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    const abort = () => {
      if (settled) return;
      settled = true;
      stream.destroy(new Error(CANCELLED));
    };
    if (signal) signal.addEventListener('abort', abort, { once: true });
    stream.on('data', (chunk) => {
      if (settled) return;
      if (signal?.aborted) { abort(); return; }
      for (const hash of Object.values(hashes)) hash.update(chunk);
      processed += chunk.length;
      onProgress?.(total > 0 ? processed / total : 1);
    });
    stream.on('error', (error) => {
      if (settled && error.message === CANCELLED) { reject(new Error(CANCELLED)); return; }
      settled = true;
      reject(error);
    });
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', abort);
      resolve({
        size: total,
        values: Object.fromEntries(Object.entries(hashes).map(([algorithm, hash]) => [algorithm, hash.digest('hex')]))
      });
    });
  });
}

async function executeChecksum(spec, ctx) {
  assertInputs(spec);
  const allowed = ['md5', 'sha1', 'sha256'];
  const algorithms = (Array.isArray(spec.options.algorithms) ? spec.options.algorithms : ['sha256'])
    .map((value) => String(value).toLowerCase())
    .filter((value) => allowed.includes(value));
  if (algorithms.length === 0) throw new Error('Choose at least one checksum algorithm.');
  const results = [];
  for (let index = 0; index < spec.inputPaths.length; index += 1) {
    const filePath = spec.inputPaths[index];
    const base = index / spec.inputPaths.length;
    const span = 1 / spec.inputPaths.length;
    const hashed = await hashFileWithAlgorithms(filePath, algorithms, (fraction) => {
      ctx.report({
        progress: Math.round((base + fraction * span) * 100),
        message: `Hashing ${path.basename(filePath)}…`
      });
    }, ctx.signal);
    results.push({ filePath, fileName: path.basename(filePath), ...hashed });
  }
  return { outputPaths: [], data: { kind: 'checksum', results } };
}

async function executeEncryptor(spec, ctx) {
  assertInputs(spec);
  const mode = spec.options.mode === 'decrypt' ? 'decrypt' : 'encrypt';
  const password = String(spec.options.password || '');
  if (!password) throw new Error('Enter a password.');
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const outputs = [];
  const total = spec.inputPaths.length;

  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const base = (index / total) * 100;
    const span = 100 / total;
    const onProgress = (fraction) => {
      ctx.report({ progress: Math.round(base + clamp(fraction, 0, 1) * span) });
    };
    ctx.report({
      message: `${mode === 'encrypt' ? 'Encrypting' : 'Decrypting'} ${path.basename(filePath)}...`,
      progress: Math.round(base)
    });
    const outputPath = mode === 'encrypt'
      ? await encryptFile(filePath, encryptedOutputPath(outputDirectory, path.basename(filePath)), password, { signal: ctx.signal, onProgress })
      : await decryptFile(filePath, outputDirectory, password, { signal: ctx.signal, onProgress });
    outputs.push(outputPath);
  }

  return { outputPaths: outputs };
}

function summaryFromProbe(filePath, media) {
  const streams = media.streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  return {
    filePath,
    fileName: path.basename(filePath),
    size: Number(media?.format?.size) || fs.statSync(filePath).size,
    format: media?.format?.format_long_name || media?.format?.format_name || extensionOf(filePath),
    duration: Number(media?.format?.duration) || 0,
    bitrate: Number(media?.format?.bit_rate) || 0,
    video: video ? {
      codec: video.codec_long_name || video.codec_name,
      width: video.width,
      height: video.height,
      fps: video.avg_frame_rate || video.r_frame_rate,
      pixelFormat: video.pix_fmt
    } : null,
    audio: audio ? {
      codec: audio.codec_long_name || audio.codec_name,
      channels: audio.channels,
      sampleRate: Number(audio.sample_rate) || 0,
      bitrate: Number(audio.bit_rate) || 0
    } : null,
    raw: media
  };
}

async function executeInfo(spec, ctx, deps) {
  assertInputs(spec);
  const results = [];
  for (let index = 0; index < spec.inputPaths.length; index += 1) {
    const filePath = spec.inputPaths[index];
    ctx.report({ progress: Math.round((index / spec.inputPaths.length) * 100), message: `Inspecting ${path.basename(filePath)}…` });
    const media = await probeMedia(deps.tools.paths().ffprobe, filePath);
    results.push(summaryFromProbe(filePath, media));
  }
  return { outputPaths: [], data: { kind: 'info', results } };
}

function youtubeFormatSelector(mode, quality) {
  if (mode === 'audio') return 'ba/b';
  const height = Number(quality);
  if (!Number.isFinite(height) || height <= 0) return 'bv*+ba/b';
  return `bv*[height<=${height}]+ba/b[height<=${height}]/bv*+ba/b`;
}

async function newestOutput(directory, since) {
  try {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith('.part') || entry.name.endsWith('.ytdl')) continue;
      const fullPath = path.join(directory, entry.name);
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs >= since - 1500) candidates.push({ fullPath, mtimeMs: stat.mtimeMs });
    }
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0]?.fullPath || null;
  } catch {
    return null;
  }
}

async function executeYouTube(spec, ctx, deps) {
  const url = String(spec.options.url || '').trim();
  if (!isSupportedYouTubeUrl(url)) throw new Error('Enter a valid YouTube video URL.');
  const paths = deps.tools.paths();
  assertToolFile(paths.ytDlp, 'yt-dlp');
  assertToolFile(paths.deno, 'Deno');
  const outputDirectory = await ensureDir(spec.outputDirectory);
  const mode = spec.options.mode === 'audio' ? 'audio' : 'video';
  const quality = spec.options.quality || 'best';
  const audioFormat = String(spec.options.audioFormat || 'mp3').toLowerCase();
  const startedAt = Date.now();
  let outputPath = null;
  let buffer = '';

  const args = [
    '--no-config',
    '--no-playlist',
    '--newline',
    '--no-color',
    '--windows-filenames',
    '--trim-filenames', '180',
    '--ffmpeg-location', paths.toolsDir,
    '--js-runtimes', `deno:${paths.deno}`,
    '-P', outputDirectory,
    '-o', '%(title).160B [%(id)s].%(ext)s',
    '--print', 'after_move:MTOUT|%(filepath)s',
    '--progress-template', 'download:MTDL|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '-f', youtubeFormatSelector(mode, quality)
  ];

  if (mode === 'audio') {
    args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0', '--embed-metadata');
  } else {
    args.push('--merge-output-format', 'mp4', '--embed-metadata');
  }
  args.push(url);

  ctx.report({ message: 'Downloading from YouTube…', progress: 1 });
  await runProcess(paths.ytDlp, args, {
    signal: ctx.signal,
    maxOutputBytes: 16 * 1024 * 1024,
    onStdout: (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('MTOUT|')) {
          outputPath = line.slice(6).trim();
          continue;
        }
        const parsed = parseYouTubeProgressLine(line);
        if (parsed) {
          if (parsed.percent !== null && parsed.percent !== undefined) {
            const progress = parsed.postprocess ? 96 : Math.round(2 + parsed.percent * 93);
            const speed = parsed.speed ? `${(parsed.speed / 1024 / 1024).toFixed(1)} MB/s` : null;
            const eta = parsed.eta ? `${parsed.eta}s left` : null;
            ctx.report({
              progress,
              message: parsed.postprocess ? 'Processing download…' : ['Downloading…', speed, eta].filter(Boolean).join(' · ')
            });
          }
        } else if (/^\[download\]/.test(line)) {
          ctx.report({ message: line.replace(/^\[download\]\s*/, '') });
        }
      }
    }
  });

  if (!outputPath) outputPath = await newestOutput(outputDirectory, startedAt);
  if (!outputPath || !fs.existsSync(outputPath)) {
    throw new Error('The download completed but the output file could not be located.');
  }
  ctx.report({ progress: 100, message: 'Download complete.' });
  return { outputPaths: [outputPath] };
}

async function executeJob(spec, ctx, deps) {
  switch (spec.tool) {
    case 'youtube': return executeYouTube(spec, ctx, deps);
    case 'convert': return executeConvert(spec, ctx, deps);
    case 'compress': return executeCompress(spec, ctx, deps);
    case 'trim': return executeTrim(spec, ctx, deps);
    case 'join': return executeJoin(spec, ctx, deps);
    case 'normalize': return executeNormalize(spec, ctx, deps);
    case 'frames': return executeFrames(spec, ctx, deps);
    case 'extract': return executeExtract(spec, ctx, deps);
    case 'gif': return executeGif(spec, ctx, deps);
    case 'pdf': return executePdf(spec, ctx);
    case 'archive': return executeArchive(spec, ctx, deps);
    case 'encryptor': return executeEncryptor(spec, ctx);
    case 'checksum': return executeChecksum(spec, ctx);
    case 'info': return executeInfo(spec, ctx, deps);
    case 'transcribe': return executeTranscribe(spec, ctx, deps);
    default: throw new Error(`Unknown tool: ${spec.tool}`);
  }
}

module.exports = {
  executeJob,
  executeConvert,
  executeCompress,
  executeTrim,
  executeJoin,
  executeNormalize,
  executeFrames,
  executeExtract,
  executeGif,
  executePdf,
  executeArchive,
  executeEncryptor,
  executeChecksum,
  executeInfo,
  executeYouTube,
  parsePageRanges,
  youtubeFormatSelector
};
