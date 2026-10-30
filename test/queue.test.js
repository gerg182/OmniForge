'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../src/main/store');
const { JobManager } = require('../src/main/job-manager');
const { CANCELLED } = require('../src/main/utils');

function makeStore(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-queue-test-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const app = {
    getPath(name) {
      if (name === 'userData') return folder;
      return folder;
    }
  };
  const store = new Store(app);
  const outputDir = path.join(folder, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  store.save({ outputDir });
  return { folder, store, outputDir };
}

function entry(id, status = 'paused', tool = 'info') {
  return {
    id,
    tool,
    label: `${tool}-${id}`,
    status,
    progress: 0,
    message: status,
    spec: {
      tool,
      inputPaths: [path.join(os.tmpdir(), `${id}.txt`)],
      outputDirectory: null,
      options: {},
      label: `${tool}-${id}`
    },
    outputPaths: [],
    data: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null
  };
}

async function waitForIdle(manager) {
  for (let index = 0; index < 200 && manager.running; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('queue restores pending jobs paused and records interrupted jobs as failed history', async (t) => {
  const { store } = makeStore(t);
  store.writeQueue([
    entry('queued-one', 'queued'),
    entry('running-one', 'running'),
    entry('paused-one', 'paused')
  ]);
  const manager = new JobManager({ store, tools: {}, emit: () => {}, execute: async () => ({ outputPaths: [] }) });
  const jobs = manager.list();
  assert.equal(manager.running, false);
  assert.deepEqual(jobs.filter((job) => job.status === 'paused').map((job) => job.id), ['queued-one', 'paused-one']);
  const history = store.getHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].id, 'running-one');
  assert.equal(history[0].status, 'failed');
  assert.match(history[0].message, /Interrupted when OmniForge closed/);
  const persisted = JSON.parse(fs.readFileSync(store.queuePath, 'utf8'));
  assert.deepEqual(persisted.map((item) => item.status), ['paused', 'paused']);
});

test('queue reorders paused jobs and persists the new order', async (t) => {
  const { store } = makeStore(t);
  store.writeQueue([entry('first'), entry('second'), entry('third')]);
  const manager = new JobManager({ store, tools: {}, emit: () => {}, execute: async () => ({ outputPaths: [] }) });
  const result = manager.move('third', -1);
  assert.equal(result.moved, true);
  assert.deepEqual(result.jobs.map((job) => job.id), ['first', 'third', 'second']);
  const persisted = JSON.parse(fs.readFileSync(store.queuePath, 'utf8'));
  assert.deepEqual(persisted.map((item) => item.id), ['first', 'third', 'second']);
});

test('resuming a paused job validates prerequisites and runs it', async (t) => {
  const { store, outputDir } = makeStore(t);
  const saved = entry('resume-me');
  saved.spec.inputPaths = [path.join(outputDir, 'source.txt')];
  store.writeQueue([saved]);
  let executed = 0;
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async () => { executed += 1; return { outputPaths: [] }; }
  });
  const resumed = await manager.resume('resume-me');
  assert.equal(resumed.status === 'queued' || resumed.status === 'running', true);
  await waitForIdle(manager);
  assert.equal(executed, 1);
  assert.equal(manager.get('resume-me').status, 'succeeded');
});

test('failed history jobs retry with a new id and require fresh encryptor credentials', async (t) => {
  const { store, outputDir } = makeStore(t);
  const historyJob = {
    ...entry('old-job', 'failed', 'encryptor'),
    spec: {
      tool: 'encryptor',
      inputPaths: [path.join(outputDir, 'secret.txt')],
      outputDirectory: outputDir,
      options: { mode: 'encrypt', password: 'must-not-persist' },
      label: 'secret.txt'
    }
  };
  store.addHistory(historyJob);
  assert.doesNotMatch(fs.readFileSync(store.historyPath, 'utf8'), /must-not-persist/);
  const manager = new JobManager({ store, tools: {}, emit: () => {}, execute: async () => ({ outputPaths: [] }) });
  await assert.rejects(manager.retry('old-job'), /password/i);
  const retried = await manager.retry('old-job', { password: 'new password' });
  assert.notEqual(retried.id, 'old-job');
  await waitForIdle(manager);
  assert.equal(manager.get(retried.id).status, 'succeeded');
});

test('retrying secure delete requires a new acknowledgement', async (t) => {
  const { store, outputDir } = makeStore(t);
  const historyJob = {
    ...entry('shred-old', 'failed', 'shred'),
    spec: {
      tool: 'shred',
      inputPaths: [path.join(outputDir, 'gone.txt')],
      outputDirectory: null,
      options: { passes: 3 },
      label: 'gone.txt'
    }
  };
  store.addHistory(historyJob);
  const manager = new JobManager({ store, tools: {}, emit: () => {}, execute: async () => ({ outputPaths: [] }) });
  await assert.rejects(manager.retry('shred-old'), /Confirm/);
  const retried = await manager.retry('shred-old', { acknowledged: true });
  await waitForIdle(manager);
  assert.equal(manager.get(retried.id).status, 'succeeded');
});

test('resuming a paused secure-delete job requires a new acknowledgement', async (t) => {
  const { store, outputDir } = makeStore(t);
  const saved = entry('shred-paused', 'paused', 'shred');
  saved.spec.inputPaths = [path.join(outputDir, 'gone.txt')];
  saved.spec.options = { passes: 3 };
  store.writeQueue([saved]);
  const manager = new JobManager({ store, tools: {}, emit: () => {}, execute: async () => ({ outputPaths: [] }) });
  await assert.rejects(manager.resume('shred-paused'), /Confirm/);
  const resumed = await manager.resume('shred-paused', undefined, { acknowledged: true });
  await waitForIdle(manager);
  assert.equal(manager.get(resumed.id).status, 'succeeded');
});

test('active queue entries never persist passwords or confirmations', async (t) => {
  const { store, outputDir } = makeStore(t);
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async (_spec, ctx) => new Promise((resolve, reject) => {
      ctx.signal.addEventListener('abort', () => reject(new Error(CANCELLED)), { once: true });
    })
  });
  const started = manager.start({
    tool: 'encryptor',
    inputPaths: [path.join(outputDir, 'private.txt')],
    outputDirectory: outputDir,
    options: { mode: 'encrypt', password: 'queue-password', confirm: 'queue-password' }
  });
  const queueText = fs.readFileSync(store.queuePath, 'utf8');
  assert.doesNotMatch(queueText, /queue-password/);
  assert.doesNotMatch(queueText, /"password"/);
  manager.cancel(started.id);
  await waitForIdle(manager);
});
