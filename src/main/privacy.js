'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { extensionOf, formatCategory } = require('./constants');
const { ensureDir, baseNameWithoutExtension, uniquePath, runProcess, CANCELLED } = require('./utils');

const JPEG_METADATA_MARKERS = new Set([0xe1, 0xed, 0xfe]);
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const WEBP_METADATA_CHUNKS = new Set(['EXIF', 'XMP ']);
const SHRED_CHUNK_SIZE = 1024 * 1024;
const SHRED_PASSES = new Set([1, 3, 7]);

function assertInputFiles(spec) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length === 0) {
    throw new Error('Choose at least one input file.');
  }
  for (const filePath of spec.inputPaths) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`File not found: ${filePath}`);
  }
}

function stripJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('This is not a valid JPEG file.');
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error('The JPEG contains an invalid marker.');
    const markerStart = offset;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9) {
      parts.push(buffer.subarray(markerStart));
      break;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(markerStart, offset));
      continue;
    }
    if (offset + 2 > buffer.length) throw new Error('The JPEG is truncated.');
    const length = buffer.readUInt16BE(offset);
    if (length < 2) throw new Error('The JPEG contains an invalid segment length.');
    const segmentEnd = offset + length;
    if (segmentEnd > buffer.length) throw new Error('The JPEG is truncated.');
    if (marker === 0xda) {
      parts.push(buffer.subarray(markerStart));
      break;
    }
    if (!JPEG_METADATA_MARKERS.has(marker)) parts.push(buffer.subarray(markerStart, segmentEnd));
    offset = segmentEnd;
  }
  return Buffer.concat(parts);
}

function stripPngMetadata(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 20 || !buffer.subarray(0, 8).equals(signature)) throw new Error('This is not a valid PNG file.');
  const parts = [signature];
  let offset = 8;
  let sawEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) throw new Error('The PNG is truncated.');
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (!PNG_METADATA_CHUNKS.has(type)) parts.push(buffer.subarray(offset, chunkEnd));
    offset = chunkEnd;
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd) throw new Error('The PNG is missing its end marker.');
  if (offset < buffer.length) parts.push(buffer.subarray(offset));
  return Buffer.concat(parts);
}

function stripWebpMetadata(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('This is not a valid WebP file.');
  }
  const declaredEnd = Math.min(buffer.length, buffer.readUInt32LE(4) + 8);
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= declaredEnd) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const dataEnd = offset + 8 + length;
    const paddedEnd = dataEnd + (length % 2);
    if (paddedEnd > buffer.length) throw new Error('The WebP is truncated.');
    if (!WEBP_METADATA_CHUNKS.has(type)) {
      if (type === 'VP8X' && length >= 1) {
        const chunk = Buffer.from(buffer.subarray(offset, paddedEnd));
        chunk[8] &= ~0x0c;
        chunks.push(chunk);
      } else {
        chunks.push(buffer.subarray(offset, paddedEnd));
      }
    }
    offset = paddedEnd;
  }
  const payload = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, payload]);
}

function cleanImageBuffer(extension, buffer) {
  const ext = String(extension || '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return stripJpegMetadata(buffer);
  if (ext === 'png') return stripPngMetadata(buffer);
  if (ext === 'webp') return stripWebpMetadata(buffer);
  throw new Error(`Metadata stripping is not supported for .${ext || 'unknown'} images.`);
}

async function executeMetadata(spec, ctx, deps) {
  assertInputFiles(spec);
  const supportedCategories = new Set(['image', 'audio', 'video']);
  for (const filePath of spec.inputPaths) {
    const ext = extensionOf(filePath);
    const category = formatCategory(ext);
    if (!supportedCategories.has(category)) throw new Error(`Metadata stripping is not supported for ${path.basename(filePath)}.`);
    if (category === 'image' && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      throw new Error(`Image metadata stripping supports JPEG, PNG, and WebP only: ${path.basename(filePath)}`);
    }
  }

  const outputDirectory = await ensureDir(spec.outputDirectory);
  const outputs = [];
  const total = spec.inputPaths.length;
  for (let index = 0; index < total; index += 1) {
    if (ctx.signal?.aborted) throw new Error(CANCELLED);
    const filePath = spec.inputPaths[index];
    const ext = extensionOf(filePath);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_clean`, ext);
    const base = Math.round((index / total) * 100);
    const span = Math.round(100 / total);
    ctx.report({ message: `Removing metadata from ${path.basename(filePath)}...`, progress: base });

    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const source = await fsp.readFile(filePath);
      await fsp.writeFile(outputPath, cleanImageBuffer(ext, source));
    } else {
      const ffmpeg = deps?.tools?.paths?.().ffmpeg;
      if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('FFmpeg is missing from the bundled tools.');
      await runProcess(ffmpeg, [
        '-hide_banner', '-nostdin', '-y', '-i', filePath,
        '-map', '0', '-map_metadata', '-1', '-map_chapters', '-1',
        '-c', 'copy', outputPath
      ], { signal: ctx.signal });
    }

    if (!fs.existsSync(outputPath)) throw new Error('Metadata removal finished without creating an output file.');
    outputs.push(outputPath);
    ctx.report({ progress: base + span, message: `Cleaned ${path.basename(filePath)}` });
  }
  return { outputPaths: outputs, data: { kind: 'metadata', files: outputs } };
}

function normalizeShredPasses(value) {
  const passes = Number(value);
  return SHRED_PASSES.has(passes) ? passes : 3;
}

async function shredFile(filePath, passes, ctx, onProgress) {
  const initial = await fsp.lstat(filePath);
  if (initial.isSymbolicLink()) throw new Error(`Symbolic links cannot be securely deleted: ${path.basename(filePath)}`);
  if (initial.isDirectory()) throw new Error(`Secure Delete only accepts files, not directories: ${path.basename(filePath)}`);
  if (!initial.isFile()) throw new Error(`Unsupported file type: ${path.basename(filePath)}`);
  const size = initial.size;
  let handle;
  try {
    handle = await fsp.open(filePath, 'r+');
    for (let pass = 1; pass <= passes; pass += 1) {
      let position = 0;
      while (position < size) {
        if (ctx.signal?.aborted) throw new Error(CANCELLED);
        const length = Math.min(SHRED_CHUNK_SIZE, size - position);
        const chunk = crypto.randomBytes(length);
        const writeResult = await handle.write(chunk, 0, length, position);
        const written = typeof writeResult === 'number' ? writeResult : writeResult.bytesWritten;
        if (!written) throw new Error(`Could not overwrite ${path.basename(filePath)}.`);
        position += written;
        onProgress(written, pass);
      }
      await handle.sync();
    }
    await handle.truncate(0);
    await handle.sync();
  } finally {
    if (handle) await handle.close().catch(() => {});
  }

  const randomName = `.omniforge-shred-${crypto.randomBytes(12).toString('hex')}${path.extname(filePath)}`;
  const temporaryPath = path.join(path.dirname(filePath), randomName);
  await fsp.rename(filePath, temporaryPath);
  await fsp.unlink(temporaryPath);
  return size;
}

async function executeShred(spec, ctx) {
  if (!Array.isArray(spec.inputPaths) || spec.inputPaths.length === 0) {
    throw new Error('Choose at least one input file.');
  }
  if (spec.options?.acknowledged !== true) {
    throw new Error('Confirm that secure deletion cannot guarantee removal from SSD, backup, or cloud copies.');
  }
  const passes = normalizeShredPasses(spec.options?.passes);
  const targets = [];
  for (const filePath of spec.inputPaths) {
    const stat = await fsp.lstat(filePath);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links cannot be securely deleted: ${path.basename(filePath)}`);
    if (stat.isDirectory()) throw new Error(`Secure Delete only accepts files, not directories: ${path.basename(filePath)}`);
    if (!stat.isFile()) throw new Error(`Unsupported file type: ${path.basename(filePath)}`);
    targets.push({ filePath, size: stat.size });
  }

  const totalBytes = targets.reduce((sum, item) => sum + item.size, 0) * passes;
  let processed = 0;
  const files = [];
  for (const target of targets) {
    await shredFile(target.filePath, passes, ctx, (bytes, pass) => {
      processed += bytes;
      const progress = totalBytes > 0 ? Math.round((processed / totalBytes) * 100) : 0;
      ctx.report({
        progress,
        message: `Overwriting ${path.basename(target.filePath)} - pass ${pass} of ${passes}`,
        data: { kind: 'shred', bytesProcessed: processed, bytesTotal: totalBytes, pass, passes }
      });
    });
    files.push({ filePath: target.filePath, fileName: path.basename(target.filePath), passes });
  }
  ctx.report({ progress: 100, message: 'Secure deletion complete' });
  return { outputPaths: [], data: { kind: 'shred', passes, files } };
}

module.exports = {
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
  cleanImageBuffer,
  executeMetadata,
  executeShred,
  normalizeShredPasses
};
