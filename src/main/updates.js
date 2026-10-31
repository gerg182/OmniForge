'use strict';

const fs = require('fs');
const path = require('path');
const { compareVersions, describeInstaller, scanUpdateFolder, inspectInstallerHash } = require('./update-utils');
const { fetchLatestRelease, downloadReleaseInstaller, GITHUB_REPOSITORY } = require('./github-updates');

class UpdateManager {
  constructor(app, store, options = {}) {
    this.app = app;
    this.store = store;
    this.openInstaller = typeof options.openInstaller === 'function' ? options.openInstaller : null;
    this.quit = typeof options.quit === 'function' ? options.quit : () => this.app.quit();
    this.quitDelayMs = Number.isFinite(Number(options.quitDelayMs)) ? Number(options.quitDelayMs) : 1200;
    this.fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : globalThis.fetch;
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
    this.repository = options.repository || GITHUB_REPOSITORY;
    this.userAgent = options.userAgent || `OmniForge/${this.app.getVersion?.() || '0.0.0'}`;
    this.updateDirectory = options.updateDirectory
      || (this.app.getPath ? path.join(this.app.getPath('userData'), 'updates') : null);
    this.latestRelease = null;
    this.downloadingVersion = null;
  }

  checkLocal() {
    return scanUpdateFolder(this.store.get().updateFolder, this.app.getVersion());
  }

  async check() {
    const currentVersion = this.app.getVersion();
    const local = this.checkLocal();
    try {
      const release = await fetchLatestRelease({
        repository: this.repository,
        fetchImpl: this.fetchImpl,
        userAgent: this.userAgent
      });
      this.latestRelease = release;
      const newer = compareVersions(release.version, currentVersion) > 0;
      const latest = {
        ...release,
        currentVersion,
        newer,
        path: null,
        hash: {
          status: 'expected',
          expected: release.sha256,
          actual: null,
          sidecarPath: null
        },
        hashStatus: 'expected',
        expectedHash: release.sha256,
        actualHash: null
      };
      return {
        source: 'github',
        github: { status: 'ok', error: null },
        exists: true,
        currentVersion,
        latest,
        newer,
        candidates: newer ? [latest] : [],
        local
      };
    } catch (error) {
      this.latestRelease = null;
      const status = error?.code === 'NO_RELEASE' ? 'no-release' : 'unavailable';
      return {
        ...local,
        source: local.latest ? 'local' : 'none',
        github: {
          status,
          error: error?.message || 'GitHub could not be checked.'
        },
        local
      };
    }
  }

  async download(version) {
    if (!this.app.isPackaged) throw new Error('In-app updates are available from the installed app.');
    const release = this.latestRelease;
    if (!release || release.version !== String(version || '')) {
      throw new Error('The selected GitHub release is no longer available. Check for updates again.');
    }
    const currentVersion = this.app.getVersion();
    if (compareVersions(release.version, currentVersion) <= 0) {
      throw new Error(`Version ${release.version} is not newer than the installed version ${currentVersion}.`);
    }
    if (!this.updateDirectory) throw new Error('No update download directory is available.');
    if (this.downloadingVersion) throw new Error(`OmniForge ${this.downloadingVersion} is already downloading.`);
    this.downloadingVersion = release.version;
    this.onProgress({
      phase: 'downloading',
      version: release.version,
      receivedBytes: 0,
      totalBytes: release.size,
      percent: 0,
      downloadPercent: 0,
      bytesPerSecond: null,
      etaMs: null
    });
    try {
      const downloaded = await downloadReleaseInstaller(release, {
        fetchImpl: this.fetchImpl,
        directory: path.join(this.updateDirectory, release.version),
        userAgent: this.userAgent,
        onProgress: (progress) => this.onProgress(progress)
      });
      const hash = await inspectInstallerHash(downloaded.path);
      if (hash.status !== 'valid') {
        await fs.promises.rm(downloaded.path, { force: true }).catch(() => {});
        throw new Error('The downloaded installer did not pass SHA-256 verification.');
      }
      return {
        ...downloaded,
        currentVersion,
        newer: true,
        hash,
        hashStatus: hash.status,
        expectedHash: hash.expected,
        actualHash: hash.actual,
        sidecarPath: hash.sidecarPath
      };
    } finally {
      this.downloadingVersion = null;
    }
  }

  releaseUrl() {
    return this.latestRelease?.releaseUrl || null;
  }

  async describe(filePath) {
    const installer = describeInstaller(filePath);
    const currentVersion = this.app.getVersion();
    const hash = await inspectInstallerHash(installer.path);
    return {
      ...installer,
      currentVersion,
      newer: compareVersions(installer.version, currentVersion) > 0,
      hash,
      hashStatus: hash.status,
      expectedHash: hash.expected,
      actualHash: hash.actual,
      sidecarPath: hash.sidecarPath
    };
  }

  async install(filePath, options = {}) {
    if (!this.app.isPackaged) throw new Error('In-app updates are available from the installed app.');
    if (!this.openInstaller) throw new Error('The Windows installer launcher is unavailable.');
    const installer = describeInstaller(filePath);
    const currentVersion = this.app.getVersion();
    if (compareVersions(installer.version, currentVersion) <= 0) {
      throw new Error(`Version ${installer.version} is not newer than the installed version ${currentVersion}.`);
    }

    const hash = await inspectInstallerHash(installer.path);
    if (hash.status === 'mismatch') {
      throw new Error('Installer verification failed: the SHA-256 hash does not match the adjacent .sha256 file.');
    }
    if (hash.status === 'malformed') {
      throw new Error('Installer verification failed: the adjacent .sha256 file is malformed.');
    }
    if (hash.status === 'missing' && options.allowMissingHash !== true) {
      throw new Error(`No SHA-256 sidecar was found. The installer hash is ${hash.actual}. Confirm that you trust this file before installing it.`);
    }

    const appPath = this.app.getPath('exe');
    const installDirectory = path.dirname(appPath);
    const launchError = await this.openInstaller(installer.path);
    if (launchError) throw new Error(`Windows could not open the installer: ${launchError}`);
    const timer = setTimeout(() => this.quit(), this.quitDelayMs);
    timer.unref?.();
    return {
      started: true,
      version: installer.version,
      currentVersion,
      installDirectory,
      hashStatus: hash.status,
      actualHash: hash.actual
    };
  }
}

module.exports = { UpdateManager };
