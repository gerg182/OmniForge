'use strict';

const path = require('path');
const { compareVersions, describeInstaller, scanUpdateFolder } = require('./update-utils');

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

  describe(filePath) {
    const installer = describeInstaller(filePath);
    const currentVersion = this.app.getVersion();
    return {
      ...installer,
      currentVersion,
      newer: compareVersions(installer.version, currentVersion) > 0
    };
  }

  async install(filePath) {
    if (!this.app.isPackaged) throw new Error('In-app updates are available from the installed app.');
    if (!this.openInstaller) throw new Error('The Windows installer launcher is unavailable.');
    const installer = describeInstaller(filePath);
    const currentVersion = this.app.getVersion();
    if (compareVersions(installer.version, currentVersion) <= 0) {
      throw new Error(`Version ${installer.version} is not newer than the installed version ${currentVersion}.`);
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
      installDirectory
    };
  }
}

module.exports = { UpdateManager };
