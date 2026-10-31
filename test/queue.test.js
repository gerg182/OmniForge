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

async function waitFor(predicate) {
  for (let index = 0; index < 200; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for queue state.');
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

test('job updates reach the live progress handler', async (t) => {
  const { store, outputDir } = makeStore(t);
  const updates = [];
  let release;
  const manager = new JobManager({
    store,
    tools: {},
    emit: (job) => updates.push(job),
    execute: async (_spec, ctx) => {
      ctx.report({ progress: 42, message: 'Downloading...', speed: { value: 1024, unit: 'B/s' } });
      await new Promise((resolve) => { release = resolve; });
      return { outputPaths: [] };
    }
  });

  const job = manager.start({
    tool: 'info',
    inputPaths: [path.join(outputDir, 'source.txt')],
    label: 'live-progress'
  });
  await waitFor(() => updates.some((update) => update.progress === 42));
  const running = updates.find((update) => update.progress === 42);
  assert.equal(running.id, job.id);
  assert.equal(running.message, 'Downloading...');
  assert.deepEqual(running.speed, { value: 1024, unit: 'B/s' });

  release();
  await waitForIdle(manager);
  assert.ok(updates.some((update) => update.status === 'succeeded' && update.progress === 100));
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

test('queue runs two jobs by default and refills the freed slot', async (t) => {
  const { store } = makeStore(t);
  const releases = new Map();
  const started = [];
  let active = 0;
  let peak = 0;
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async (spec) => {
      started.push(spec.label);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => releases.set(spec.label, resolve));
      active -= 1;
      return { outputPaths: [] };
    }
  });

  for (const label of ['one', 'two', 'three']) {
    manager.start({ tool: 'info', inputPaths: [path.join(os.tmpdir(), `${label}.txt`)], label });
  }

  assert.deepEqual(started, ['one', 'two']);
  assert.equal(manager.list().filter((job) => job.status === 'running').length, 2);
  assert.equal(manager.list().filter((job) => job.status === 'queued').length, 1);

  releases.get('one')();
  await waitFor(() => started.includes('three'));
  assert.equal(peak, 2);
  assert.equal(manager.list().filter((job) => job.status === 'running').length, 2);

  releases.get('two')();
  releases.get('three')();
  await waitForIdle(manager);
  assert.equal(manager.list().filter((job) => job.status === 'succeeded').length, 3);
});

test('raising concurrency starts queued jobs immediately', async (t) => {
  const { store } = makeStore(t);
  store.save({ jobConcurrency: 1 });
  const releases = new Map();
  const started = [];
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async (spec) => {
      started.push(spec.label);
      await new Promise((resolve) => releases.set(spec.label, resolve));
      return { outputPaths: [] };
    }
  });

  for (const label of ['one', 'two', 'three']) {
    manager.start({ tool: 'info', inputPaths: [path.join(os.tmpdir(), `${label}.txt`)], label });
  }
  assert.deepEqual(started, ['one']);

  manager.setConcurrency(3);
  assert.deepEqual(started, ['one', 'two', 'three']);
  for (const release of releases.values()) release();
  await waitForIdle(manager);
});

test('lowering concurrency lets active jobs finish without cancelling them', async (t) => {
  const { store } = makeStore(t);
  const releases = new Map();
  const started = [];
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async (spec) => {
      started.push(spec.label);
      await new Promise((resolve) => releases.set(spec.label, resolve));
      return { outputPaths: [] };
    }
  });

  for (const label of ['one', 'two', 'three']) {
    manager.start({ tool: 'info', inputPaths: [path.join(os.tmpdir(), `${label}.txt`)], label });
  }
  assert.deepEqual(started, ['one', 'two']);

  manager.setConcurrency(1);
  assert.equal(manager.list().filter((job) => job.status === 'running').length, 2);
  releases.get('one')();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(started.includes('three'), false);

  releases.get('two')();
  await waitFor(() => started.includes('three'));
  releases.get('three')();
  await waitForIdle(manager);
  assert.equal(manager.list().some((job) => job.status === 'cancelled'), false);
});

test('all active jobs are persisted in queue.json', async (t) => {
  const { store } = makeStore(t);
  const releases = new Map();
  const manager = new JobManager({
    store,
    tools: {},
    emit: () => {},
    execute: async (spec) => {
      await new Promise((resolve) => releases.set(spec.label, resolve));
      return { outputPaths: [] };
    }
  });

  for (const label of ['one', 'two', 'three']) {
    manager.start({ tool: 'info', inputPaths: [path.join(os.tmpdir(), `${label}.txt`)], label });
  }
  const persisted = JSON.parse(fs.readFileSync(store.queuePath, 'utf8'));
  assert.deepEqual(persisted.map((job) => job.status), ['running', 'running', 'queued']);

  for (const release of releases.values()) release();
  await waitForIdle(manager);
});

test('store normalizes queue concurrency and failure notifications', (t) => {
  const { store, folder } = makeStore(t);
  assert.equal(store.get().jobConcurrency, 2);
  assert.equal(store.get().notifyOnFailure, true);
  assert.equal(store.get().legalAcceptedVersion, null);
  assert.equal(store.save({ jobConcurrency: 3 }).jobConcurrency, 3);
  assert.equal(store.save({ jobConcurrency: 99 }).jobConcurrency, 2);
  assert.equal(store.save({ notifyOnFailure: false }).notifyOnFailure, false);
  assert.equal(store.save({ legalAcceptedVersion: '2026-10-31', legalAcceptedAt: '2026-10-31T00:00:00.000Z' }).legalAcceptedVersion, '2026-10-31');

  fs.writeFileSync(store.settingsPath, JSON.stringify({ jobConcurrency: 'many', notifyOnFailure: false }), 'utf8');
  const reloaded = new Store({ getPath: () => folder });
  assert.equal(reloaded.get().jobConcurrency, 2);
  assert.equal(reloaded.get().notifyOnFailure, false);
  assert.equal(reloaded.get().legalAcceptedVersion, null);
});
