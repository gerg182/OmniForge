'use strict';

const path = require('path');
const { compareVersions, describeInstaller, scanUpdateFolder, inspectInstallerHash } = require('./update-utils');

class UpdateManager {
  constructor(app, store, options = {}) {
    this.app = app;
    this.store = store;
    this.openInstaller = typeof options.openInstaller === 'function' ? options.openInstaller : null;
    this.quit = typeof options.quit === 'function' ? options.quit : () => this.app.quit();
    this.quitDelayMs = Number.isFinite(Number(options.quitDelayMs)) ? Number(options.quitDelayMs) : 1200;
  }

  check() {
    return scanUpdateFolder(this.store.get().updateFolder, this.app.getVersion());
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
