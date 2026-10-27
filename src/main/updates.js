'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { compareVersions, describeInstaller, scanUpdateFolder } = require('./update-utils');

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

class UpdateManager {
  constructor(app, store) {
    this.app = app;
    this.store = store;
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
    const installer = describeInstaller(filePath);
    const currentVersion = this.app.getVersion();
    if (compareVersions(installer.version, currentVersion) <= 0) {
      throw new Error(`Version ${installer.version} is not newer than the installed version ${currentVersion}.`);
    }

    const appPath = this.app.getPath('exe');
    const installDirectory = path.dirname(appPath);
    const logPath = path.join(this.app.getPath('userData'), 'update-errors.log');
    const scriptPath = path.join(os.tmpdir(), `omniforge-update-${Date.now()}.ps1`);
    const script = `$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 2
try {
  $installer = ${psQuote(installer.path)}
  $appPath = ${psQuote(appPath)}
  Start-Process -FilePath $installer -ArgumentList '/S' -Wait
  Start-Sleep -Milliseconds 900
  if (Test-Path -LiteralPath $appPath) {
    Start-Process -FilePath $appPath
  }
} catch {
  $_.Exception.ToString() | Add-Content -LiteralPath ${psQuote(logPath)} -Encoding UTF8
}
Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
`;
    await fs.writeFile(scriptPath, script, 'utf8');
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    setTimeout(() => this.app.quit(), 500);
    return {
      started: true,
      version: installer.version,
      currentVersion,
      installDirectory
    };
  }
}

module.exports = { UpdateManager };
