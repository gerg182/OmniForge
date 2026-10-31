'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const INSTALLER_PATTERN = /^OmniForge-Setup-(\d+)\.(\d+)\.(\d+)(?:(?:\s*\(\d+\))|(?:\s*-\s*copy))?\.exe$/i;
const UPDATE_VERSION_DIRECTORY_PATTERN = /^\d+\.\d+\.\d+$/;

function parseInstallerVersion(filePath) {
  const match = INSTALLER_PATTERN.exec(path.basename(String(filePath || '')));
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function versionParts(version) {
  return String(version || '0.0.0')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function describeInstaller(filePath) {
  const fullPath = path.resolve(String(filePath || ''));
  const version = parseInstallerVersion(fullPath);
  if (!version) throw new Error('Select an OmniForge installer named OmniForge-Setup-<version>.exe.');
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) throw new Error('The selected installer no longer exists.');
  const stat = fs.statSync(fullPath);
  return {
    path: fullPath,
    fileName: path.basename(fullPath),
    version,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

function installerHashPath(filePath) {
  return `${path.resolve(String(filePath || ''))}.sha256`;
}

function parseHashSidecar(text, installerFileName) {
  const match = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(String(text || '').trim());
  if (!match) return null;
  const namedFile = path.basename(match[2].trim());
  if (installerFileName && namedFile.toLowerCase() !== String(installerFileName).toLowerCase()) return null;
  return { expected: match[1].toLowerCase(), fileName: namedFile };
}

function computeFileSha256(filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const fullPath = String(filePath);
    const totalBytes = fs.statSync(fullPath).size;
    let processedBytes = 0;
    let lastReportedAt = 0;
    const stream = fs.createReadStream(fullPath);
    stream.on('data', (chunk) => {
      hash.update(chunk);
      processedBytes += chunk.length;
      if (typeof onProgress !== 'function') return;
      const now = Date.now();
      if (processedBytes !== totalBytes && now - lastReportedAt < 150) return;
      lastReportedAt = now;
      onProgress({ processedBytes, totalBytes });
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function inspectInstallerHash(filePath) {
  const fullPath = path.resolve(String(filePath || ''));
  const sidecarPath = installerHashPath(fullPath);
  const actual = await computeFileSha256(fullPath);
  let text;
  try {
    text = await fs.promises.readFile(sidecarPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { status: 'missing', expected: null, actual, sidecarPath };
    }
    throw error;
  }
  const parsed = parseHashSidecar(text, path.basename(fullPath));
  if (!parsed) return { status: 'malformed', expected: null, actual, sidecarPath };
  return {
    status: parsed.expected === actual ? 'valid' : 'mismatch',
    expected: parsed.expected,
    actual,
    sidecarPath
  };
}

function scanUpdateFolder(folder, currentVersion) {
  const resolved = folder ? path.resolve(String(folder)) : null;
  const result = {
    folder: resolved,
    exists: Boolean(resolved && fs.existsSync(resolved)),
    currentVersion: String(currentVersion || '0.0.0'),
    candidates: [],
    latest: null,
    newer: false
  };
  if (!result.exists) return result;
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !INSTALLER_PATTERN.test(entry.name)) continue;
      try {
        result.candidates.push(describeInstaller(path.join(resolved, entry.name)));
      } catch {
        // Ignore files that disappear during the scan.
      }
    }
    result.candidates.sort((a, b) => compareVersions(b.version, a.version));
    result.latest = result.candidates[0] || null;
    result.newer = Boolean(result.latest && compareVersions(result.latest.version, result.currentVersion) > 0);
  } catch {
    result.exists = false;
  }
  return result;
}

async function removeInstallerFiles(filePath) {
  let installerRemoved = false;
  for (const candidate of [filePath, installerHashPath(filePath), `${filePath}.part`]) {
    try {
      const stat = await fs.promises.lstat(candidate);
      if (!stat.isFile()) continue;
      await fs.promises.unlink(candidate);
      if (candidate === filePath) installerRemoved = true;
    } catch {
      // A locked or already-removed artifact can be retried on the next launch.
    }
  }
  return installerRemoved;
}

async function cleanupOldInstallers(directory, currentVersion) {
  const root = directory ? path.resolve(String(directory)) : null;
  const current = String(currentVersion || '0.0.0');
  const removed = [];
  if (!root) return removed;

  const removeInstaller = async (filePath) => {
    const version = parseInstallerVersion(filePath);
    if (!version || compareVersions(version, current) > 0) return;
    if (await removeInstallerFiles(filePath)) removed.push(filePath);
  };

  let entries;
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return removed;
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && INSTALLER_PATTERN.test(entry.name)) {
      await removeInstaller(entryPath);
      continue;
    }
    if (!entry.isDirectory() || !UPDATE_VERSION_DIRECTORY_PATTERN.test(entry.name)) continue;
    let children;
    try {
      children = await fs.promises.readdir(entryPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (child.isFile() && INSTALLER_PATTERN.test(child.name)) {
        await removeInstaller(path.join(entryPath, child.name));
      }
    }
    await fs.promises.rmdir(entryPath).catch(() => {});
  }
  return removed;
}

module.exports = {
  INSTALLER_PATTERN,
  parseInstallerVersion,
  compareVersions,
  describeInstaller,
  scanUpdateFolder,
  cleanupOldInstallers,
  removeInstallerFiles,
  installerHashPath,
  parseHashSidecar,
  computeFileSha256,
  inspectInstallerHash
};
