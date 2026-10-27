'use strict';

const fs = require('fs');
const path = require('path');

const INSTALLER_PATTERN = /^OmniForge-Setup-(\d+)\.(\d+)\.(\d+)(?:(?:\s*\(\d+\))|(?:\s*-\s*copy))?\.exe$/i;

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
  scanUpdateFolder
};
