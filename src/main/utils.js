'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const CANCELLED = '__OMNIFORGE_CANCELLED__';

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

function sanitizeFilename(value, fallback = 'output') {
  let name = String(value || fallback)
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `_${name}`;
  return name.slice(0, 180);
}

function baseNameWithoutExtension(filePath) {
  return sanitizeFilename(path.basename(filePath, path.extname(filePath)), 'output');
}

function uniquePath(directory, base, extension) {
  const safeBase = sanitizeFilename(base);
  const ext = String(extension || '').replace(/^\./, '');
  let candidate = path.join(directory, ext ? `${safeBase}.${ext}` : safeBase);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, ext ? `${safeBase} (${index}).${ext}` : `${safeBase} (${index})`);
    index += 1;
  }
  return candidate;
}

function uniqueDir(directory, base) {
  const safeBase = sanitizeFilename(base);
  let candidate = path.join(directory, safeBase);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${safeBase} (${index})`);
    index += 1;
  }
  return candidate;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** index;
  return `${scaled >= 10 || index === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : null;
  const text = String(value).trim().replace(',', '.');
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.max(0, Number(text));
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isFinite(number) || number < 0)) return null;
  if (parts.length === 2) return numbers[0] * 60 + numbers[1];
  return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        detached: false
      });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

function runProcess(command, args, options = {}) {
  const {
    cwd,
    env,
    onStdout,
    onStderr,
    onSpawn,
    signal,
    timeoutMs = 0,
    maxOutputBytes = 8 * 1024 * 1024
  } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(CANCELLED));
      return;
    }

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...(env || {}) },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let aborted = false;
    let timedOut = false;

    const append = (current, chunk) => {
      const next = current + chunk.toString('utf8');
      return next.length > maxOutputBytes ? next.slice(-maxOutputBytes) : next;
    };

    const abort = () => {
      if (settled || aborted) return;
      aborted = true;
      killProcessTree(child.pid);
    };

    const timeout = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          killProcessTree(child.pid);
        }, timeoutMs)
      : null;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', abort);
    };

    if (onSpawn) onSpawn(child);
    if (signal) signal.addEventListener('abort', abort, { once: true });

    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk);
      if (onStdout) onStdout(chunk.toString('utf8'), chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk);
      if (onStderr) onStderr(chunk.toString('utf8'), chunk);
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Could not start ${path.basename(command)}: ${error.message}`));
    });

    child.on('close', (code, closeSignal) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (aborted) {
        reject(new Error(CANCELLED));
        return;
      }
      if (timedOut) {
        reject(new Error(`${path.basename(command)} timed out`));
        return;
      }
      if (code !== 0) {
        const detail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-6).join('\n');
        const error = new Error(detail || `${path.basename(command)} exited with code ${code ?? closeSignal}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function probeMedia(ffprobe, filePath) {
  const { stdout } = await runProcess(
    ffprobe,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { timeoutMs: 30000, maxOutputBytes: 4 * 1024 * 1024 }
  );
  return JSON.parse(stdout);
}

async function getMediaDuration(ffprobe, filePath) {
  try {
    const info = await probeMedia(ffprobe, filePath);
    const duration = Number(info?.format?.duration);
    if (Number.isFinite(duration) && duration > 0) return duration;
    const streamDuration = (info?.streams || []).map((stream) => Number(stream.duration)).find((value) => value > 0);
    return Number.isFinite(streamDuration) && streamDuration > 0 ? streamDuration : 0;
  } catch {
    return 0;
  }
}

function hashFile(filePath, algorithm, onProgress) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stat = fs.statSync(filePath);
    const total = stat.size;
    let processed = 0;
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => {
      hash.update(chunk);
      processed += chunk.length;
      if (onProgress) onProgress(total > 0 ? processed / total : 0);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve({ digest: hash.digest('hex'), size: total }));
  });
}

function isCancellation(error) {
  return error?.message === CANCELLED;
}

module.exports = {
  CANCELLED,
  ensureDirSync,
  ensureDir,
  sanitizeFilename,
  baseNameWithoutExtension,
  uniquePath,
  uniqueDir,
  formatBytes,
  formatDuration,
  parseTimestamp,
  clamp,
  killProcessTree,
  runProcess,
  probeMedia,
  getMediaDuration,
  hashFile,
  isCancellation
};
