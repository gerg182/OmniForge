'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
  executeMetadata,
  executeShred,
  normalizeShredPasses
} = require('../src/main/privacy');

function context() {
  return { signal: new AbortController().signal, report: () => {} };
}

function jpegSegment(marker, payload) {
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function pngChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'ascii');
  return Buffer.concat([header, data, Buffer.alloc(4)]);
}

function webpChunk(type, data, flags) {
  if (flags !== undefined && data.length > 0) data[0] = flags;
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

test('JPEG metadata stripping removes EXIF and comments while preserving ICC data', () => {
  const jfif = jpegSegment(0xe0, Buffer.from('JFIF\0', 'binary'));
  const exif = jpegSegment(0xe1, Buffer.from('Exif\0secret-camera', 'binary'));
  const icc = jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0color-data', 'binary'));
  const comment = jpegSegment(0xfe, Buffer.from('private comment', 'utf8'));
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  const source = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, icc, comment, scan]);
  const cleaned = stripJpegMetadata(source);
  assert.equal(cleaned.subarray(0, 2).toString('hex'), 'ffd8');
  assert.ok(cleaned.includes(Buffer.from('JFIF')));
  assert.ok(cleaned.includes(Buffer.from('ICC_PROFILE')));
  assert.ok(!cleaned.includes(Buffer.from('Exif')));
  assert.ok(!cleaned.includes(Buffer.from('private comment')));
  assert.deepEqual(cleaned.subarray(-4), Buffer.from([0x11, 0x22, 0xff, 0xd9]));
});

test('PNG metadata stripping removes text and time chunks but keeps ICC and image data', () => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk('IHDR', Buffer.alloc(13, 1));
  const iccp = pngChunk('iCCP', Buffer.from('profile-data'));
  const exif = pngChunk('eXIf', Buffer.from('camera-data'));
  const text = pngChunk('tEXt', Buffer.from('Author\0Ada'));
  const time = pngChunk('tIME', Buffer.alloc(7, 2));
  const idat = pngChunk('IDAT', Buffer.from('pixels'));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  const cleaned = stripPngMetadata(Buffer.concat([signature, ihdr, iccp, exif, text, time, idat, iend]));
  assert.ok(cleaned.includes(Buffer.from('IHDR')));
  assert.ok(cleaned.includes(Buffer.from('iCCP')));
  assert.ok(cleaned.includes(Buffer.from('IDAT')));
  assert.ok(cleaned.includes(Buffer.from('IEND')));
  assert.ok(!cleaned.includes(Buffer.from('eXIf')));
  assert.ok(!cleaned.includes(Buffer.from('tEXt')));
  assert.ok(!cleaned.includes(Buffer.from('tIME')));
});

test('WebP metadata stripping removes EXIF and XMP while preserving ICC and animation', () => {
  const vp8x = webpChunk('VP8X', Buffer.from([0x3e, 0, 0, 0, 1, 0, 0, 1, 0, 0]));
  const iccp = webpChunk('ICCP', Buffer.from('color-profile'));
  const anim = webpChunk('ANIM', Buffer.from([0, 0, 0, 0, 0, 0]));
  const image = webpChunk('VP8 ', Buffer.from('image-data'));
  const exif = webpChunk('EXIF', Buffer.from('camera-data'));
  const xmp = webpChunk('XMP ', Buffer.from('xmp-data'));
  const chunks = Buffer.concat([vp8x, iccp, anim, image, exif, xmp]);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(chunks.length + 4, 4);
  header.write('WEBP', 8, 'ascii');
  const cleaned = stripWebpMetadata(Buffer.concat([header, chunks]));
  assert.equal(cleaned.toString('ascii', 0, 4), 'RIFF');
  assert.ok(cleaned.includes(Buffer.from('ICCP')));
  assert.ok(cleaned.includes(Buffer.from('ANIM')));
  assert.ok(cleaned.includes(Buffer.from('VP8 ')));
  assert.ok(!cleaned.includes(Buffer.from('EXIF')));
  assert.ok(!cleaned.includes(Buffer.from('XMP ')));
  const vp8xOffset = cleaned.indexOf(Buffer.from('VP8X')) + 8;
  assert.equal(cleaned[vp8xOffset] & 0x0c, 0);
});

test('metadata job writes cleaned image copies with a _clean suffix', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-metadata-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const source = path.join(folder, 'photo.jpg');
  const jfif = jpegSegment(0xe0, Buffer.from('JFIF\0', 'binary'));
  const exif = jpegSegment(0xe1, Buffer.from('Exif\0remove-me', 'binary'));
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
  fs.writeFileSync(source, Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, scan]));
  const outputDirectory = path.join(folder, 'out');
  const result = await executeMetadata({
    inputPaths: [source],
    outputDirectory,
    options: {}
  }, context(), {});
  assert.equal(result.outputPaths.length, 1);
  assert.equal(path.basename(result.outputPaths[0]), 'photo_clean.jpg');
  const cleaned = fs.readFileSync(result.outputPaths[0]);
  assert.ok(!cleaned.includes(Buffer.from('remove-me')));
});

test('audio metadata stripping uses FFmpeg stream copy when available', async (t) => {
  const root = path.resolve(__dirname, '..');
  const ffmpeg = path.join(root, 'tools', 'ffmpeg.exe');
  if (!fs.existsSync(ffmpeg)) t.skip('Bundled FFmpeg is unavailable.');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-metadata-media-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const source = path.join(root, 'test', 'fixtures', 'jfk.wav');
  const result = await executeMetadata({
    inputPaths: [source],
    outputDirectory: folder,
    options: {}
  }, context(), { tools: { paths: () => ({ ffmpeg }) } });
  assert.equal(result.outputPaths.length, 1);
  assert.ok(fs.statSync(result.outputPaths[0]).size > 0);
});

test('secure delete requires acknowledgement and removes overwritten files', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-shred-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const target = path.join(folder, 'secret.txt');
  fs.writeFileSync(target, 'delete this private data');

  await assert.rejects(executeShred({ inputPaths: [target], options: { passes: 1 } }, context()), /Confirm/);
  assert.equal(fs.existsSync(target), true);

  const result = await executeShred({ inputPaths: [target], options: { passes: 1, acknowledged: true } }, context());
  assert.equal(fs.existsSync(target), false);
  assert.equal(result.data.passes, 1);
  assert.equal(result.data.files[0].fileName, 'secret.txt');
});

test('secure delete defaults to three passes and rejects directories', async (t) => {
  assert.equal(normalizeShredPasses(undefined), 3);
  assert.equal(normalizeShredPasses('7'), 7);
  assert.equal(normalizeShredPasses('5'), 3);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-shred-directory-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  await assert.rejects(executeShred({ inputPaths: [folder], options: { passes: 3, acknowledged: true } }, context()), /directories/);
});

test('secure delete rejects symbolic links', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-shred-link-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const target = path.join(folder, 'target.txt');
  const link = path.join(folder, 'link.txt');
  fs.writeFileSync(target, 'target');
  try {
    fs.symlinkSync(target, link, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) {
      t.skip('Creating symbolic links is not permitted on this system.');
      return;
    }
    throw error;
  }
  await assert.rejects(executeShred({ inputPaths: [link], options: { passes: 3, acknowledged: true } }, context()), /Symbolic links/);
  assert.equal(fs.existsSync(target), true);
});
