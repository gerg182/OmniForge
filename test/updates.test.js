'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  compareVersions,
  parseInstallerVersion,
  describeInstaller,
  scanUpdateFolder
} = require('../src/main/update-utils');
const { UpdateManager } = require('../src/main/updates');

test('version comparison follows semantic ordering', () => {
  assert.equal(compareVersions('1.1.6', '1.1.5'), 1);
  assert.equal(compareVersions('1.1.6', '1.1.6'), 0);
  assert.equal(compareVersions('1.0.9', '1.1.0'), -1);
  assert.equal(compareVersions('1.2', '1.1.9'), 1);
  assert.equal(compareVersions('garbage', '1.0.0'), -1);
});

test('installer names parse into versions', () => {
  assert.equal(parseInstallerVersion('C:\\updates\\OmniForge-Setup-1.2.3.exe'), '1.2.3');
  assert.equal(parseInstallerVersion('omniforge-setup-01.02.03.EXE'), '1.2.3');
  assert.equal(parseInstallerVersion('OmniForge-Setup-1.2.3 (1).exe'), '1.2.3');
  assert.equal(parseInstallerVersion('OmniForge-Setup-1.2.3 - Copy.exe'), '1.2.3');
  assert.equal(parseInstallerVersion('Other-App-Setup-1.2.3.exe'), null);
});

test('update folder scan chooses the newest installer', (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-updates-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.writeFileSync(path.join(folder, 'OmniForge-Setup-1.1.6.exe'), 'old');
  fs.writeFileSync(path.join(folder, 'OmniForge-Setup-1.1.7.exe'), 'new');
  fs.writeFileSync(path.join(folder, 'OmniForge-Setup-1.1.7 (1).exe'), 'duplicate download');
  fs.writeFileSync(path.join(folder, 'OmniForge-Setup-1.2.0.exe'), 'newest');
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'ignore me');

  const result = scanUpdateFolder(folder, '1.1.6');
  assert.equal(result.exists, true);
  assert.equal(result.candidates.length, 4);
  assert.equal(result.latest.version, '1.2.0');
  assert.equal(result.newer, true);

  const current = scanUpdateFolder(folder, '1.2.0');
  assert.equal(current.newer, false);

  const missing = scanUpdateFolder(path.join(folder, 'does-not-exist'), '1.1.6');
  assert.equal(missing.exists, false);
  assert.equal(missing.newer, false);
});

test('installer description rejects unrelated files and reports newer builds', (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-describe-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const installer = path.join(folder, 'OmniForge-Setup-1.1.8.exe');
  fs.writeFileSync(installer, 'installer');
  assert.throws(() => describeInstaller(path.join(folder, 'setup.exe')), /OmniForge-Setup/);

  const manager = new UpdateManager(
    { isPackaged: false, getVersion: () => '1.1.6' },
    { get: () => ({ updateFolder: folder }) }
  );
  const described = manager.describe(installer);
  assert.equal(described.version, '1.1.8');
  assert.equal(described.currentVersion, '1.1.6');
  assert.equal(described.newer, true);
});

test('in-app install is rejected outside the packaged app', async () => {
  const manager = new UpdateManager(
    { isPackaged: false, getVersion: () => '1.1.6' },
    { get: () => ({ updateFolder: null }) }
  );
  await assert.rejects(() => manager.install('C:\\fake\\OmniForge-Setup-9.9.9.exe'), /installed app/);
});

test('packaged install hands the installer to the Windows shell', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-install-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const installer = path.join(folder, 'OmniForge-Setup-1.1.8.exe');
  fs.writeFileSync(installer, 'installer');
  let openedPath = '';
  let quitCalled = false;
  const manager = new UpdateManager(
    {
      isPackaged: true,
      getVersion: () => '1.1.7',
      getPath: () => path.join(folder, 'OmniForge.exe')
    },
    { get: () => ({ updateFolder: folder }) },
    {
      openInstaller: async (installerPath) => { openedPath = installerPath; return ''; },
      quit: () => { quitCalled = true; },
      quitDelayMs: 0
    }
  );

  const result = await manager.install(installer);
  assert.equal(result.started, true);
  assert.equal(result.version, '1.1.8');
  assert.equal(openedPath, installer);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(quitCalled, true);
});

test('packaged install reports a Windows launch failure', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-install-error-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const installer = path.join(folder, 'OmniForge-Setup-1.1.8.exe');
  fs.writeFileSync(installer, 'installer');
  const manager = new UpdateManager(
    {
      isPackaged: true,
      getVersion: () => '1.1.7',
      getPath: () => path.join(folder, 'OmniForge.exe')
    },
    { get: () => ({ updateFolder: folder }) },
    { openInstaller: async () => 'Access denied.' }
  );

  await assert.rejects(() => manager.install(installer), /Access denied/);
});
