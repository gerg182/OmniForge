'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { executeJob } = require('../src/main/operations');
const { JobManager } = require('../src/main/job-manager');

function context() {
  return { signal: new AbortController().signal, report: () => {} };
}

async function run(spec, outputDirectory) {
  return executeJob({ ...spec, outputDirectory }, context(), {});
}

async function waitForIdle(manager) {
  for (let index = 0; index < 100 && manager.running; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('encryptor round-trips a file and restores its name', { timeout: 60000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-encryptor-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'notes.txt');
  const content = crypto.randomBytes(2 * 1024 * 1024);
  await fsp.writeFile(source, content);

  const encryptedDir = path.join(temp, 'encrypted');
  const encrypted = await run({
    tool: 'encryptor',
    inputPaths: [source],
    options: { mode: 'encrypt', password: 'correct horse battery staple', confirm: 'correct horse battery staple' }
  }, encryptedDir);
  assert.equal(encrypted.outputPaths.length, 1);
  assert.equal(path.extname(encrypted.outputPaths[0]), '.ofenc');
  assert.ok(fs.statSync(encrypted.outputPaths[0]).size > content.length);

  const decryptedDir = path.join(temp, 'decrypted');
  const decrypted = await run({
    tool: 'encryptor',
    inputPaths: encrypted.outputPaths,
    options: { mode: 'decrypt', password: 'correct horse battery staple' }
  }, decryptedDir);
  assert.equal(path.basename(decrypted.outputPaths[0]), 'notes.txt');
  assert.deepEqual(await fsp.readFile(decrypted.outputPaths[0]), content);
});

test('encryptor rejects a wrong password and tampered data without leaving output', { timeout: 60000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-encryptor-fail-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'secret.txt');
  await fsp.writeFile(source, 'This must stay private.', 'utf8');
  const encrypted = await run({
    tool: 'encryptor',
    inputPaths: [source],
    options: { mode: 'encrypt', password: 'a sufficiently long password' }
  }, path.join(temp, 'encrypted'));
  const encryptedPath = encrypted.outputPaths[0];

  const wrongDir = path.join(temp, 'wrong-password');
  await assert.rejects(run({
    tool: 'encryptor',
    inputPaths: [encryptedPath],
    options: { mode: 'decrypt', password: 'the wrong password' }
  }, wrongDir), /Incorrect password or corrupted encrypted file/);
  assert.deepEqual(fs.readdirSync(wrongDir), []);

  const bytes = await fsp.readFile(encryptedPath);
  bytes[bytes.length - 17] ^= 0xff;
  const tampered = path.join(temp, 'tampered.ofenc');
  await fsp.writeFile(tampered, bytes);
  const tamperedDir = path.join(temp, 'tampered-output');
  await assert.rejects(run({
    tool: 'encryptor',
    inputPaths: [tampered],
    options: { mode: 'decrypt', password: 'a sufficiently long password' }
  }, tamperedDir), /Incorrect password or corrupted encrypted file/);
  assert.deepEqual(fs.readdirSync(tamperedDir), []);
});

test('job manager validates passwords and redacts them from snapshots', { timeout: 60000 }, async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-encryptor-job-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'job.txt');
  await fsp.writeFile(source, 'job password test', 'utf8');
  const manager = new JobManager({
    store: { get: () => ({ outputDir: temp }), addHistory: () => {} },
    tools: {},
    emit: () => {}
  });

  assert.throws(() => manager.normalizeSpec({
    tool: 'encryptor',
    inputPaths: [source],
    outputDirectory: temp,
    options: { mode: 'encrypt', password: 'short', confirm: 'short' }
  }), /at least 8 characters/);
  assert.throws(() => manager.normalizeSpec({
    tool: 'encryptor',
    inputPaths: [source],
    outputDirectory: temp,
    options: { mode: 'decrypt', password: 'a sufficiently long password' }
  }), /Not an OmniForge encrypted file/);

  const started = manager.start({
    tool: 'encryptor',
    inputPaths: [source],
    outputDirectory: temp,
    options: { mode: 'encrypt', password: 'a sufficiently long password', confirm: 'a sufficiently long password' }
  });
  assert.equal(started.spec.options.password, '');
  assert.equal(Object.prototype.hasOwnProperty.call(started.spec.options, 'confirm'), false);
  manager.cancel(started.id);
  await waitForIdle(manager);
});
