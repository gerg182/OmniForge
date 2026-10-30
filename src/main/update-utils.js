'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const INSTALLER_PATTERN = /^OmniForge-Setup-(\d+)\.(\d+)\.(\d+)(?:(?:\s*\(\d+\))|(?:\s*-\s*copy))?\.exe$/i;

// Installer names always come from Windows paths, so split on both separators
// instead of trusting path.basename, which only knows the host separator.
function installerFileName(filePath) {
  return String(filePath || '').split(/[\\/]/).filter(Boolean).pop() || '';
}

function parseInstallerVersion(filePath) {
  const match = INSTALLER_PATTERN.exec(installerFileName(filePath));
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

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(String(filePath));
    stream.on('data', (chunk) => hash.update(chunk));
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

module.exports = {
  INSTALLER_PATTERN,
  parseInstallerVersion,
  compareVersions,
  describeInstaller,
  scanUpdateFolder,
  installerHashPath,
  parseHashSidecar,
  computeFileSha256,
  inspectInstallerHash
};
