'use strict';

const fs = require('fs');
const path = require('path');
const { computeFileSha256, parseHashSidecar } = require('./update-utils');

const GITHUB_REPOSITORY = 'gerg182/OmniForge';
const GITHUB_API_BASE = 'https://api.github.com';
const RELEASE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_REQUEST_TIMEOUT_MS = 20 * 1000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const PROGRESS_INTERVAL_MS = 180;
const SPEED_WINDOW_MS = 5000;

function createTransferRateTracker(windowMs = SPEED_WINDOW_MS) {
  const samples = [];
  return {
    sample(bytes, now = Date.now()) {
      const value = Math.max(0, Number(bytes) || 0);
      samples.push({ at: now, bytes: value });
      while (samples.length > 2 && now - samples[0].at > windowMs) samples.shift();
      if (samples.length < 2) return { bytesPerSecond: null, etaMs: null };
      const first = samples[0];
      const elapsedSeconds = (now - first.at) / 1000;
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0.15) {
        return { bytesPerSecond: null, etaMs: null };
      }
      const bytesPerSecond = Math.max(0, (value - first.bytes) / elapsedSeconds);
      return { bytesPerSecond: bytesPerSecond > 0 ? bytesPerSecond : null, etaMs: null };
    }
  };
}

function progressPercent(receivedBytes, totalBytes) {
  if (!totalBytes) return null;
  return Math.min(100, Number(((receivedBytes / totalBytes) * 100).toFixed(1)));
}

function releaseApiUrl(repository = GITHUB_REPOSITORY) {
  return `${GITHUB_API_BASE}/repos/${repository}/releases/latest`;
}

function releaseTagUrl(repository = GITHUB_REPOSITORY, tag = '') {
  return `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`;
}

function httpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  return parsed.toString();
}

function releaseVersion(tag) {
  const match = RELEASE_TAG_PATTERN.exec(String(tag || ''));
  if (!match) throw new Error('The latest GitHub release tag is not in vX.Y.Z format.');
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function releaseAsset(release, fileName) {
  const matches = (Array.isArray(release.assets) ? release.assets : [])
    .filter((asset) => asset && asset.name === fileName);
  if (matches.length !== 1) {
    throw new Error(`The GitHub release must contain exactly one ${fileName} asset.`);
  }
  const asset = matches[0];
  return {
    name: asset.name,
    size: Number.isFinite(Number(asset.size)) ? Number(asset.size) : null,
    downloadUrl: httpsUrl(asset.browser_download_url, `${fileName} download URL`)
  };
}

function normalizeRelease(release, repository = GITHUB_REPOSITORY) {
  if (!release || typeof release !== 'object') throw new Error('GitHub returned an invalid release.');
  if (release.draft === true || release.prerelease === true) {
    throw new Error('The latest GitHub release must be a published, non-prerelease build.');
  }

  const version = releaseVersion(release.tag_name);
  const fileName = `OmniForge-Setup-${version}.exe`;
  const sidecarName = `${fileName}.sha256`;
  const installer = releaseAsset(release, fileName);
  const sidecar = releaseAsset(release, sidecarName);
  const releaseUrl = httpsUrl(
    release.html_url || releaseTagUrl(repository, release.tag_name),
    'GitHub release page URL'
  );

  return {
    source: 'github',
    version,
    tag: release.tag_name,
    fileName,
    sidecarName,
    size: installer.size,
    downloadUrl: installer.downloadUrl,
    sidecarUrl: sidecar.downloadUrl,
    releaseUrl,
    publishedAt: release.published_at || null,
    releaseName: String(release.name || `OmniForge ${version}`)
  };
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  if (typeof fetchImpl !== 'function') throw new Error('The network client is unavailable.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The GitHub request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedText(response, maxBytes, label) {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`${label} is unexpectedly large.`);
  return text;
}

async function fetchLatestRelease(options = {}) {
  const repository = options.repository || GITHUB_REPOSITORY;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const userAgent = options.userAgent || 'OmniForge';
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': userAgent,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const response = await fetchWithTimeout(
    fetchImpl,
    releaseApiUrl(repository),
    { headers, redirect: 'follow' },
    options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
  );

  if (response.status === 404) {
    const error = new Error('No published GitHub release was found.');
    error.code = 'NO_RELEASE';
    throw error;
  }
  if (!response.ok) {
    throw new Error(`GitHub update check failed with HTTP ${response.status}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('GitHub returned an unreadable release response.');
  }

  const release = normalizeRelease(payload, repository);
  const sidecarResponse = await fetchWithTimeout(
    fetchImpl,
    release.sidecarUrl,
    {
      headers: { Accept: 'text/plain', 'User-Agent': userAgent },
      redirect: 'follow'
    },
    options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
  );
  if (!sidecarResponse.ok) {
    throw new Error(`The GitHub release SHA-256 sidecar could not be downloaded (HTTP ${sidecarResponse.status}).`);
  }
  const sidecarText = await readLimitedText(sidecarResponse, 4096, 'GitHub SHA-256 sidecar');
  const parsed = parseHashSidecar(sidecarText, release.fileName);
  if (!parsed || !HASH_PATTERN.test(parsed.expected)) {
    throw new Error('The GitHub release SHA-256 sidecar is malformed or names the wrong installer.');
  }

  return {
    ...release,
    sha256: parsed.expected,
    sidecarText: `${parsed.expected}  ${release.fileName}\n`
  };
}

async function downloadReleaseInstaller(release, options = {}) {
  if (!release || release.source !== 'github') throw new Error('No verified GitHub release was selected.');
  if (!HASH_PATTERN.test(String(release.sha256 || ''))) throw new Error('The GitHub release has no valid SHA-256 hash.');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const directory = path.resolve(String(options.directory || ''));
  const userAgent = options.userAgent || 'OmniForge';

  await fs.promises.mkdir(directory, { recursive: true });
  const installerPath = path.join(directory, release.fileName);
  const partialPath = `${installerPath}.part`;
  await fs.promises.rm(partialPath, { force: true });

  const response = await fetchWithTimeout(
    fetchImpl,
    release.downloadUrl,
    {
      headers: { Accept: 'application/octet-stream', 'User-Agent': userAgent },
      redirect: 'follow'
    },
    options.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`The GitHub installer download failed with HTTP ${response.status}.`);
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('GitHub returned an unreadable installer download.');
  }

  const expectedBytes = Number(release.size) > 0 ? Number(release.size) : null;
  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = expectedBytes || (Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null);
  const handle = await fs.promises.open(partialPath, 'w');
  const reader = response.body.getReader();
  let receivedBytes = 0;
  let lastEmitAt = 0;
  const downloadStartedAt = Date.now();
  const downloadRate = createTransferRateTracker();

  const emitProgress = (payload) => {
    if (typeof options.onProgress === 'function') options.onProgress(payload);
  };

  const reportProgress = (phase = 'downloading', extra = {}) => {
    const now = Date.now();
    if (phase === 'downloading' && lastEmitAt && (!totalBytes || receivedBytes < totalBytes) && now - lastEmitAt < PROGRESS_INTERVAL_MS) return;
    const rate = phase === 'downloading' ? downloadRate.sample(receivedBytes, now) : { bytesPerSecond: null, etaMs: null };
    const etaMs = totalBytes && rate.bytesPerSecond
      ? Math.max(0, Math.round(((totalBytes - receivedBytes) / rate.bytesPerSecond) * 1000))
      : null;
    const percent = progressPercent(receivedBytes, totalBytes);
    lastEmitAt = now;
    emitProgress({
      phase,
      version: release.version,
      receivedBytes,
      totalBytes,
      percent,
      downloadPercent: percent,
      bytesPerSecond: rate.bytesPerSecond,
      etaMs,
      elapsedMs: now - downloadStartedAt,
      ...extra
    });
  };

  try {
    reportProgress();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value?.byteLength) {
        receivedBytes += chunk.value.byteLength;
        await handle.write(chunk.value);
        reportProgress();
      }
    }
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.promises.rm(partialPath, { force: true }).catch(() => {});
    throw new Error(`The installer download was interrupted: ${error.message}`);
  }
  await handle.close();

  if (expectedBytes && receivedBytes !== expectedBytes) {
    await fs.promises.rm(partialPath, { force: true }).catch(() => {});
    throw new Error(`The installer download size does not match the release metadata (${receivedBytes} of ${expectedBytes} bytes).`);
  }

  const verificationStartedAt = Date.now();
  const verificationTotalBytes = receivedBytes;
  const verificationRate = createTransferRateTracker();
  let lastVerificationEmitAt = 0;
  const reportVerification = (processedBytes, force = false) => {
    const now = Date.now();
    if (!force && processedBytes < verificationTotalBytes && now - lastVerificationEmitAt < PROGRESS_INTERVAL_MS) return;
    const rate = verificationRate.sample(processedBytes, now);
    const etaMs = verificationTotalBytes && rate.bytesPerSecond
      ? Math.max(0, Math.round(((verificationTotalBytes - processedBytes) / rate.bytesPerSecond) * 1000))
      : null;
    lastVerificationEmitAt = now;
    emitProgress({
      phase: 'verifying',
      version: release.version,
      receivedBytes,
      totalBytes,
      percent: 100,
      downloadPercent: 100,
      verificationBytes: processedBytes,
      verificationTotalBytes,
      verificationPercent: progressPercent(processedBytes, verificationTotalBytes),
      bytesPerSecond: rate.bytesPerSecond,
      etaMs,
      elapsedMs: now - verificationStartedAt
    });
  };

  reportVerification(0, true);
  const actualHash = await computeFileSha256(partialPath, ({ processedBytes }) => reportVerification(processedBytes));
  reportVerification(verificationTotalBytes, true);
  if (actualHash !== String(release.sha256).toLowerCase()) {
    await fs.promises.rm(partialPath, { force: true }).catch(() => {});
    throw new Error('Installer verification failed: the downloaded file does not match the published SHA-256 hash.');
  }

  await fs.promises.rename(partialPath, installerPath);
  await fs.promises.writeFile(
    `${installerPath}.sha256`,
    `${actualHash}  ${release.fileName}\n`,
    'utf8'
  );
  reportProgress('ready', {
    percent: 100,
    downloadPercent: 100,
    verificationBytes: verificationTotalBytes,
    verificationTotalBytes,
    verificationPercent: 100,
    bytesPerSecond: null,
    etaMs: null,
    actualHash
  });
  return {
    path: installerPath,
    fileName: release.fileName,
    version: release.version,
    size: receivedBytes,
    actualHash,
    expectedHash: release.sha256
  };
}

module.exports = {
  GITHUB_REPOSITORY,
  releaseApiUrl,
  normalizeRelease,
  fetchLatestRelease,
  downloadReleaseInstaller
};
