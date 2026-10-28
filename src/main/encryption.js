'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { CANCELLED, ensureDir, sanitizeFilename, uniquePath } = require('./utils');

const MAGIC = Buffer.from('OFENC001', 'ascii');
const PREFIX_SIZE = MAGIC.length + 4;
const TAG_SIZE = 16;
const SALT_SIZE = 16;
const IV_SIZE = 12;
const MAX_HEADER_SIZE = 64 * 1024;
const KDF = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const ENCRYPTED_EXTENSION = 'ofenc';

function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error(CANCELLED);
}

function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 32, KDF, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, null);
    if (!bytesWritten) throw new Error('Could not write the encrypted file.');
    offset += bytesWritten;
  }
}

async function readExact(handle, length, position) {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (!bytesRead) throw new Error('The encrypted file is incomplete.');
    offset += bytesRead;
  }
  return buffer;
}

function buildHeaderPrefix(header) {
  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  if (headerBytes.length > MAX_HEADER_SIZE) throw new Error('The encrypted file header is too large.');
  const lengthBytes = Buffer.alloc(4);
  lengthBytes.writeUInt32BE(headerBytes.length, 0);
  return { headerBytes, prefix: Buffer.concat([MAGIC, lengthBytes]) };
}

function encryptedOutputPath(directory, originalName) {
  const safeName = sanitizeFilename(path.basename(String(originalName || 'file')), 'file');
  return uniquePath(directory, safeName, ENCRYPTED_EXTENSION);
}

function decryptedOutputPath(directory, originalName) {
  const safeName = sanitizeFilename(path.basename(String(originalName || 'decrypted')), 'decrypted');
  const parsed = path.parse(safeName);
  const base = parsed.name || 'decrypted';
  return uniquePath(directory, base, parsed.ext.replace(/^\./, ''));
}

async function encryptFile(inputPath, outputPath, password, options = {}) {
  const { signal, onProgress } = options;
  throwIfAborted(signal);
  if (!password) throw new Error('Enter a password.');

  const stat = await fsp.stat(inputPath);
  const salt = crypto.randomBytes(SALT_SIZE);
  const iv = crypto.randomBytes(IV_SIZE);
  const header = {
    format: 'omniforge-encrypted',
    version: 1,
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    kdfParams: { N: KDF.N, r: KDF.r, p: KDF.p },
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    originalName: path.basename(inputPath),
    originalSize: stat.size,
    createdAt: new Date().toISOString()
  };
  const { headerBytes, prefix } = buildHeaderPrefix(header);
  const key = await deriveKey(password, salt);
  throwIfAborted(signal);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.concat([prefix, headerBytes]));
  const handle = await fsp.open(outputPath, 'wx');
  let processed = 0;
  let stream;

  try {
    await writeAll(handle, prefix);
    await writeAll(handle, headerBytes);
    stream = fs.createReadStream(inputPath, { highWaterMark: 1024 * 1024 });
    for await (const chunk of stream) {
      throwIfAborted(signal);
      const encrypted = cipher.update(chunk);
      if (encrypted.length) await writeAll(handle, encrypted);
      processed += chunk.length;
      if (onProgress && stat.size > 0) onProgress(processed / stat.size);
    }
    const final = cipher.final();
    if (final.length) await writeAll(handle, final);
    await writeAll(handle, cipher.getAuthTag());
    if (onProgress) onProgress(1);
  } catch (error) {
    if (stream) stream.destroy();
    await handle.close().catch(() => {});
    await fsp.rm(outputPath, { force: true }).catch(() => {});
    throw error;
  }
  await handle.close();
  return outputPath;
}

function parseHeader(headerBytes) {
  let header;
  try {
    header = JSON.parse(headerBytes.toString('utf8'));
  } catch {
    throw new Error('This is not a valid OmniForge encrypted file.');
  }
  if (!header || header.format !== 'omniforge-encrypted' || header.version !== 1 || header.cipher !== 'aes-256-gcm' || header.kdf !== 'scrypt') {
    throw new Error('This encrypted file uses an unsupported format.');
  }
  const params = header.kdfParams || {};
  if (params.N !== KDF.N || params.r !== KDF.r || params.p !== KDF.p) {
    throw new Error('This encrypted file uses unsupported key derivation settings.');
  }
  const salt = Buffer.from(String(header.salt || ''), 'base64');
  const iv = Buffer.from(String(header.iv || ''), 'base64');
  if (salt.length !== SALT_SIZE || iv.length !== IV_SIZE) {
    throw new Error('This encrypted file has invalid encryption metadata.');
  }
  if (!Number.isSafeInteger(header.originalSize) || header.originalSize < 0) {
    throw new Error('This encrypted file has an invalid original size.');
  }
  return { header, salt, iv };
}

async function decryptFile(inputPath, outputDirectory, password, options = {}) {
  const { signal, onProgress } = options;
  throwIfAborted(signal);
  if (!password) throw new Error('Enter a password.');
  await ensureDir(outputDirectory);

  const stat = await fsp.stat(inputPath);
  if (stat.size < PREFIX_SIZE + TAG_SIZE) throw new Error('This is not a valid OmniForge encrypted file.');

  const handle = await fsp.open(inputPath, 'r');
  try {
    const prefix = await readExact(handle, PREFIX_SIZE, 0);
    if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('This is not an OmniForge encrypted file.');
    const headerLength = prefix.readUInt32BE(MAGIC.length);
    if (headerLength <= 0 || headerLength > MAX_HEADER_SIZE) throw new Error('This encrypted file has an invalid header.');
    const headerBytes = await readExact(handle, headerLength, PREFIX_SIZE);
    const headerResult = parseHeader(headerBytes);
    const dataStart = PREFIX_SIZE + headerLength;
    const cipherLength = stat.size - dataStart - TAG_SIZE;
    if (cipherLength < 0) throw new Error('The encrypted file is incomplete.');

    const key = await deriveKey(password, headerResult.salt);
    throwIfAborted(signal);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, headerResult.iv);
    decipher.setAAD(Buffer.concat([prefix, headerBytes]));
    const tag = await readExact(handle, TAG_SIZE, stat.size - TAG_SIZE);
    decipher.setAuthTag(tag);

    const outputPath = decryptedOutputPath(outputDirectory, headerResult.header.originalName);
    const output = await fsp.open(outputPath, 'wx');
    let processed = 0;
    let plaintextSize = 0;
    let stream;
    try {
      if (cipherLength > 0) {
        stream = fs.createReadStream(inputPath, {
          start: dataStart,
          end: dataStart + cipherLength - 1,
          highWaterMark: 1024 * 1024
        });
        for await (const chunk of stream) {
          throwIfAborted(signal);
          const plaintext = decipher.update(chunk);
          if (plaintext.length) {
            await writeAll(output, plaintext);
            plaintextSize += plaintext.length;
          }
          processed += chunk.length;
          if (onProgress && cipherLength > 0) onProgress(processed / cipherLength);
        }
      }
      let final;
      try {
        final = decipher.final();
      } catch {
        throw new Error('Incorrect password or corrupted encrypted file.');
      }
      if (final.length) {
        await writeAll(output, final);
        plaintextSize += final.length;
      }
      if (plaintextSize !== headerResult.header.originalSize) {
        throw new Error('Incorrect password or corrupted encrypted file.');
      }
      if (onProgress) onProgress(1);
    } catch (error) {
      if (stream) stream.destroy();
      await output.close().catch(() => {});
      await fsp.rm(outputPath, { force: true }).catch(() => {});
      throw error;
    }
    await output.close();
    return outputPath;
  } finally {
    await handle.close().catch(() => {});
  }
}

module.exports = {
  ENCRYPTED_EXTENSION,
  encryptFile,
  decryptFile,
  encryptedOutputPath,
  decryptedOutputPath
};
