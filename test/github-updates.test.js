'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  normalizeRelease,
  fetchLatestRelease,
  downloadReleaseInstaller
} = require('../src/main/github-updates');
const { UpdateManager } = require('../src/main/updates');
const { installerHashPath } = require('../src/main/update-utils');

const VERSION = '1.5.0';
const FILE_NAME = `OmniForge-Setup-${VERSION}.exe`;
const INSTALLER_BYTES = Buffer.from('verified OmniForge installer');
const SHA256 = crypto.createHash('sha256').update(INSTALLER_BYTES).digest('hex');

function releasePayload(overrides = {}) {
  return {
    tag_name: `v${VERSION}`,
    name: `OmniForge ${VERSION}`,
    draft: false,
    prerelease: false,
    published_at: '2026-10-30T12:00:00Z',
    html_url: `https://github.com/gerg182/OmniForge/releases/tag/v${VERSION}`,
    assets: [
      {
        name: FILE_NAME,
        size: INSTALLER_BYTES.length,
        browser_download_url: `https://github.com/gerg182/OmniForge/releases/download/v${VERSION}/${FILE_NAME}`
      },
      {
        name: `${FILE_NAME}.sha256`,
        size: 100,
        browser_download_url: `https://github.com/gerg182/OmniForge/releases/download/v${VERSION}/${FILE_NAME}.sha256`
      }
    ],
    ...overrides
  };
}

function releaseInfo(overrides = {}) {
  return {
    source: 'github',
    version: VERSION,
    fileName: FILE_NAME,
    size: INSTALLER_BYTES.length,
    downloadUrl: `https://github.com/gerg182/OmniForge/releases/download/v${VERSION}/${FILE_NAME}`,
    releaseUrl: `https://github.com/gerg182/OmniForge/releases/tag/v${VERSION}`,
    sha256: SHA256,
    ...overrides
  };
}

function response(body, options = {}) {
  return new Response(body, {
    status: options.status || 200,
    headers: options.headers || {}
  });
}

test('GitHub release metadata requires exact versioned assets', () => {
  const release = normalizeRelease(releasePayload());
  assert.equal(release.version, VERSION);
  assert.equal(release.fileName, FILE_NAME);
  assert.equal(release.sha256, undefined);
  assert.throws(
    () => normalizeRelease(releasePayload({ assets: releasePayload().assets.slice(0, 1) })),
    /exactly one .*\.sha256 asset/
  );
  assert.throws(
    () => normalizeRelease(releasePayload({ tag_name: 'latest' })),
    /vX\.Y\.Z/
  );
  assert.throws(
    () => normalizeRelease(releasePayload({ prerelease: true })),
    /non-prerelease/
  );
});

test('latest release check reads and validates the adjacent hash sidecar', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith('/releases/latest')) return response(JSON.stringify(releasePayload()));
    return response(`${SHA256}  ${FILE_NAME}\n`);
  };
  const release = await fetchLatestRelease({ fetchImpl });
  assert.equal(release.version, VERSION);
  assert.equal(release.sha256, SHA256);
  assert.equal(requested.length, 2);
  assert.match(requested[0], /releases\/latest$/);
  assert.match(requested[1], new RegExp(`${FILE_NAME}\\.sha256$`));
});

test('latest release check reports a missing public release', async () => {
  const fetchImpl = async () => response('{}', { status: 404 });
  await assert.rejects(() => fetchLatestRelease({ fetchImpl }), (error) => {
    assert.equal(error.code, 'NO_RELEASE');
    return true;
  });
});

test('GitHub installer download streams progress and verifies SHA-256', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-github-download-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const events = [];
  const fetchImpl = async () => response(INSTALLER_BYTES, {
    headers: { 'content-length': String(INSTALLER_BYTES.length) }
  });
  const result = await downloadReleaseInstaller(releaseInfo(), {
    fetchImpl,
    directory: folder,
    onProgress: (event) => events.push(event)
  });
  assert.equal(result.actualHash, SHA256);
  assert.equal(fs.readFileSync(result.path).toString(), INSTALLER_BYTES.toString());
  assert.match(fs.readFileSync(installerHashPath(result.path), 'utf8'), new RegExp(`^${SHA256}  ${FILE_NAME}`));
  assert.equal(fs.existsSync(`${result.path}.part`), false);
  assert.equal(events[0].phase, 'downloading');
  assert.ok(events.some((event) => event.phase === 'verifying'));
  assert.equal(events.at(-1).phase, 'ready');
  assert.equal(events.at(-1).percent, 100);
});

test('GitHub installer download deletes a mismatched file', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-github-mismatch-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const fetchImpl = async () => response(Buffer.from('tampered'));
  await assert.rejects(
    () => downloadReleaseInstaller(releaseInfo(), { fetchImpl, directory: folder }),
    /does not match/
  );
  assert.equal(fs.existsSync(path.join(folder, FILE_NAME)), false);
  assert.equal(fs.existsSync(path.join(folder, `${FILE_NAME}.part`)), false);
});

test('update checks fall back to the local folder when GitHub is unavailable', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-github-fallback-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const installer = path.join(folder, 'OmniForge-Setup-1.4.4.exe');
  fs.writeFileSync(installer, 'local installer');
  const hash = crypto.createHash('sha256').update('local installer').digest('hex');
  fs.writeFileSync(`${installer}.sha256`, `${hash}  ${path.basename(installer)}\n`);
  const manager = new UpdateManager(
    { isPackaged: false, getVersion: () => '1.4.0', getPath: () => folder },
    { get: () => ({ updateFolder: folder }) },
    { fetchImpl: async () => { throw new Error('offline'); }, updateDirectory: folder }
  );
  const result = await manager.check();
  assert.equal(result.github.status, 'unavailable');
  assert.equal(result.source, 'local');
  assert.equal(result.latest.version, '1.4.4');
  assert.equal(result.newer, true);
});

test('update checks select the published GitHub release', async (t) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-github-check-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const fetchImpl = async (url) => (
    String(url).endsWith('/releases/latest')
      ? response(JSON.stringify(releasePayload()))
      : response(`${SHA256}  ${FILE_NAME}\n`)
  );
  const manager = new UpdateManager(
    { isPackaged: false, getVersion: () => '1.4.0', getPath: () => folder },
    { get: () => ({ updateFolder: folder }) },
    { fetchImpl, updateDirectory: folder }
  );
  const result = await manager.check();
  assert.equal(result.github.status, 'ok');
  assert.equal(result.source, 'github');
  assert.equal(result.latest.version, VERSION);
  assert.equal(result.latest.sha256, SHA256);
  assert.equal(result.latest.hash.status, 'expected');
  assert.equal(result.newer, true);
});
