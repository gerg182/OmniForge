'use strict';

const path = require('path');
const crypto = require('crypto');
const { executeJob } = require('./operations');
const { TOOL_LABELS } = require('./constants');
const { isCancellation, clamp } = require('./utils');
const { isSupportedYouTubeUrl } = require('./youtube');
const { validateStudioSpec } = require('./studio');

const SUPPORTED_TOOLS = new Set(Object.keys(TOOL_LABELS));
const FINISHED_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);
const PENDING_STATUSES = new Set(['queued', 'paused']);

function scrubSecrets(spec) {
  if (!spec?.options) return;
  delete spec.options.password;
  delete spec.options.confirm;
  delete spec.options.acknowledged;
  delete spec.options.acknowledgement;
}

function snapshotSpec(spec) {
  const clean = { ...spec, options: { ...(spec?.options || {}) } };
  if (Object.prototype.hasOwnProperty.call(clean.options, 'password')) clean.options.password = '';
  delete clean.options.confirm;
  delete clean.options.acknowledged;
  delete clean.options.acknowledgement;
  return clean;
}

function snapshot(job) {
  return {
    id: job.id,
    tool: job.tool,
    label: job.label,
    status: job.status,
    progress: job.progress,
    message: job.message,
    spec: snapshotSpec(job.spec),
    outputPaths: job.outputPaths || [],
    data: job.data,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  };
}

class JobManager {
  constructor({ store, tools, emit, execute }) {
    this.store = store;
    this.tools = tools;
    this.emit = emit;
    this.execute = typeof execute === 'function' ? execute : executeJob;
    this.queue = [];
    this.jobs = new Map();
    this.activeJob = null;
    this.activeController = null;
    this.running = false;
    this.restorePersistedQueue();
  }

  restorePersistedQueue() {
    if (typeof this.store.loadQueue !== 'function') return;
    const entries = this.store.loadQueue();
    if (!entries.length) return;

    const interrupted = [];
    for (const entry of entries) {
      const status = String(entry.status || '');
      if (status === 'running' || status === 'cancelling') {
        const job = {
          ...entry,
          status: 'failed',
          message: 'Interrupted when OmniForge closed.',
          error: 'Interrupted when OmniForge closed.',
          completedAt: new Date().toISOString()
        };
        interrupted.push(job);
        continue;
      }
      if (status !== 'queued' && status !== 'paused') continue;
      const requiresPassword = entry.tool === 'encryptor';
      const job = {
        ...entry,
        status: 'paused',
        progress: 0,
        message: requiresPassword ? 'Paused after restart. Enter the password to resume.' : 'Paused after restart.',
        error: null,
        completedAt: null,
        data: null
      };
      this.jobs.set(job.id, job);
      this.queue.push(job);
    }

    for (const job of interrupted) {
      try { this.store.addHistory(job); } catch { /* history persistence is best effort */ }
    }
    this.persistQueue();
  }

  persistQueue() {
    if (typeof this.store.writeQueue !== 'function') return;
    const pending = [];
    if (this.activeJob && !FINISHED_STATUSES.has(this.activeJob.status)) pending.push(this.activeJob);
    for (const job of this.queue) {
      if (!PENDING_STATUSES.has(job.status) && job.status !== 'running' && job.status !== 'cancelling') continue;
      if (pending.some((entry) => entry.id === job.id)) continue;
      pending.push(job);
    }
    try { this.store.writeQueue(pending); } catch { /* a disk error must not stop the current job */ }
  }

  normalizeSpec(input) {
    if (!input || typeof input !== 'object') throw new Error('Invalid job request.');
    const tool = String(input.tool || '');
    if (!SUPPORTED_TOOLS.has(tool)) throw new Error(`Unknown tool: ${tool}`);
    const options = input.options && typeof input.options === 'object' ? { ...input.options } : {};
    const inputPaths = Array.isArray(input.inputPaths)
      ? input.inputPaths.map((value) => String(value)).filter(Boolean)
      : [];
    if (inputPaths.length > 100) throw new Error('A single job can contain at most 100 files.');

    if (tool === 'youtube') {
      if (!isSupportedYouTubeUrl(options.url)) throw new Error('Enter a valid YouTube video URL.');
    } else if (tool === 'encryptor') {
      const mode = options.mode === 'decrypt' ? 'decrypt' : 'encrypt';
      const password = typeof options.password === 'string' ? options.password : '';
      if (inputPaths.length === 0) throw new Error('Choose at least one input file.');
      if (!password) throw new Error('Enter a password.');
      if (password.length > 1024) throw new Error('The password is too long.');
      if (mode === 'encrypt' && password.length < 8) throw new Error('Use a password with at least 8 characters.');
      if (mode === 'encrypt' && typeof options.confirm === 'string' && options.confirm !== password) {
        throw new Error('The password confirmation does not match.');
      }
      for (const filePath of inputPaths) {
        const encrypted = filePath.toLowerCase().endsWith('.ofenc');
        if (mode === 'decrypt' && !encrypted) throw new Error(`Not an OmniForge encrypted file: ${path.basename(filePath)}`);
        if (mode === 'encrypt' && encrypted) throw new Error(`Already encrypted: ${path.basename(filePath)}`);
      }
      options.mode = mode;
      delete options.confirm;
    } else if (tool === 'shred') {
      if (inputPaths.length === 0) throw new Error('Choose at least one input file.');
      if (options.acknowledged !== true) {
        throw new Error('Confirm that secure deletion cannot guarantee removal from SSD, backup, or cloud copies.');
      }
      const passes = Number(options.passes);
      options.passes = [1, 3, 7].includes(passes) ? passes : 3;
      options.acknowledged = true;
    } else if (tool === 'checksum' || tool === 'info') {
      if (inputPaths.length === 0) throw new Error('Choose at least one input file.');
    } else if (tool === 'studio') {
      const validated = validateStudioSpec({ tool, inputPaths, options });
      Object.assign(options, validated.options);
      options.durationMs = Math.max(0, Math.round(Number(options.durationMs) || 0));
    } else if (inputPaths.length === 0) {
      throw new Error('Choose at least one input file.');
    }

    const noOutputFolder = ['checksum', 'info', 'shred'].includes(tool);
    const outputDirectory = noOutputFolder
      ? null
      : input.outputDirectory
        ? path.resolve(String(input.outputDirectory))
        : path.resolve(this.store.get().outputDir);

    const label = String(input.label || options.title || (inputPaths[0] ? path.basename(inputPaths[0]) : TOOL_LABELS[tool])).slice(0, 160);
    return { tool, inputPaths, outputDirectory, options, label };
  }

  start(input) {
    const spec = this.normalizeSpec(input);
    const id = crypto.randomUUID();
    const job = {
      id,
      tool: spec.tool,
      label: spec.label,
      status: 'queued',
      progress: 0,
      message: 'Waiting in queue...',
      spec,
      outputPaths: [],
      data: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };
    this.jobs.set(id, job);
    this.queue.push(job);
    this.persistQueue();
    this.emitJob(job);
    this.runNext();
    return snapshot(job);
  }

  emitJob(job) {
    try { this.emit('job:update', snapshot(job)); } catch { /* window may be closing */ }
  }

  update(job, update = {}) {
    if (update.message) job.message = String(update.message);
    if (Number.isFinite(Number(update.progress))) {
      const next = clamp(Math.round(Number(update.progress)), 0, 100);
      job.progress = Math.max(job.progress, next);
    }
    if (update.data) job.data = update.data;
    this.emitJob(job);
  }

  cancel(id) {
    const job = this.jobs.get(String(id));
    if (!job) return { cancelled: false, reason: 'Job not found.' };
    if (FINISHED_STATUSES.has(job.status)) {
      return { cancelled: false, reason: 'Job is already finished.' };
    }
    if (PENDING_STATUSES.has(job.status)) {
      job.status = 'cancelled';
      job.message = 'Cancelled';
      job.completedAt = new Date().toISOString();
      this.queue = this.queue.filter((entry) => entry.id !== job.id);
      this.emitJob(job);
      this.store.addHistory(job);
      this.persistQueue();
      return { cancelled: true };
    }
    if (job === this.activeJob) {
      job.status = 'cancelling';
      job.message = 'Cancelling...';
      this.emitJob(job);
      this.activeController?.abort();
      return { cancelled: true };
    }
    return { cancelled: false, reason: 'Job is not running.' };
  }

  move(id, direction) {
    const job = this.jobs.get(String(id));
    if (!job) return { moved: false, reason: 'Job not found.' };
    if (!PENDING_STATUSES.has(job.status)) return { moved: false, reason: 'Only queued or paused jobs can be reordered.' };
    const index = this.queue.findIndex((entry) => entry.id === job.id);
    if (index === -1) return { moved: false, reason: 'Job is not waiting in the queue.' };
    const amount = Number(direction) < 0 ? -1 : 1;
    const target = clamp(index + amount, 0, this.queue.length - 1);
    if (target === index) return { moved: false, reason: 'Job is already at the edge of the queue.' };
    this.queue.splice(index, 1);
    this.queue.splice(target, 0, job);
    this.persistQueue();
    return { moved: true, jobs: this.list() };
  }

  async resume(id, password, input = {}) {
    const job = this.jobs.get(String(id));
    if (!job) throw new Error('Job not found.');
    if (job.status !== 'paused') throw new Error('Only paused jobs can be resumed.');
    const options = { ...(job.spec.options || {}) };
    if (job.tool === 'encryptor') {
      if (typeof password !== 'string' || !password) throw new Error('Enter the password to resume this encryptor job.');
      options.password = password;
    }
    if (job.tool === 'shred') {
      if (input.acknowledged !== true) throw new Error('Confirm the secure deletion warning before resuming.');
      options.acknowledged = true;
    }
    const validated = this.normalizeSpec({
      ...job.spec,
      outputDirectory: job.spec.outputDirectory,
      options,
      label: job.label
    });
    scrubSecrets(job.spec);
    job.spec = validated;
    job.status = 'queued';
    job.progress = 0;
    job.message = 'Waiting in queue...';
    job.error = null;
    job.completedAt = null;
    if (!this.queue.some((entry) => entry.id === job.id)) this.queue.push(job);
    this.persistQueue();
    this.emitJob(job);
    this.runNext();
    return snapshot(job);
  }

  async retry(historyId, input = {}) {
    if (typeof this.store.getHistory !== 'function') throw new Error('Job history is unavailable.');
    const entry = this.store.getHistory().find((item) => item.id === String(historyId));
    if (!entry) throw new Error('History entry not found.');
    if (!entry.spec) throw new Error('This history entry is too old to retry. Start the job again from its tool.');
    const options = { ...(entry.spec.options || {}) };
    if (entry.tool === 'encryptor') {
      if (typeof input.password !== 'string' || !input.password) throw new Error('Enter the password to retry this encryptor job.');
      options.password = input.password;
    }
    if (entry.tool === 'shred') {
      if (input.acknowledged !== true) throw new Error('Confirm the secure deletion warning before retrying.');
      options.acknowledged = true;
    }
    return this.start({
      ...entry.spec,
      inputPaths: entry.spec.inputPaths || entry.inputPaths || [],
      outputDirectory: entry.spec.outputDirectory,
      options,
      label: entry.label
    });
  }

  get(id) {
    const job = this.jobs.get(String(id));
    return job ? snapshot(job) : null;
  }

  list() {
    const ordered = [];
    if (this.activeJob) ordered.push(this.activeJob);
    for (const job of this.queue) ordered.push(job);
    const finished = [...this.jobs.values()]
      .filter((job) => FINISHED_STATUSES.has(job.status) && !ordered.includes(job))
      .sort((left, right) => new Date(right.completedAt || 0) - new Date(left.completedAt || 0));
    return [...ordered, ...finished].map((job, index) => ({ ...snapshot(job), queuePosition: index }));
  }

  async runNext() {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const index = this.queue.findIndex((job) => job.status === 'queued');
        if (index === -1) break;
        const [next] = this.queue.splice(index, 1);
        this.activeJob = next;
        this.activeController = new AbortController();
        next.status = 'running';
        next.startedAt = new Date().toISOString();
        next.progress = Math.max(next.progress, 1);
        next.message = 'Starting...';
        this.persistQueue();
        this.emitJob(next);

        const ctx = {
          signal: this.activeController.signal,
          report: (update) => this.update(next, update)
        };

        try {
          const result = await this.execute(next.spec, ctx, { tools: this.tools, store: this.store });
          next.outputPaths = Array.isArray(result?.outputPaths) ? result.outputPaths : [];
          if (result?.data) next.data = result.data;
          next.status = 'succeeded';
          next.progress = 100;
          next.message = next.outputPaths.length > 0
            ? `Finished ${next.outputPaths.length} item${next.outputPaths.length === 1 ? '' : 's'}`
            : 'Finished';
          next.completedAt = new Date().toISOString();
          this.store.addHistory(next);
          this.emitJob(next);
        } catch (error) {
          if (isCancellation(error) || next.status === 'cancelling') {
            next.status = 'cancelled';
            next.message = 'Cancelled';
            next.error = null;
          } else {
            next.status = 'failed';
            next.message = 'Failed';
            next.error = error?.message || String(error);
          }
          next.completedAt = new Date().toISOString();
          this.store.addHistory(next);
          this.emitJob(next);
        } finally {
          scrubSecrets(next.spec);
          this.activeJob = null;
          this.activeController = null;
          this.persistQueue();
        }
      }
    } finally {
      this.running = false;
      this.persistQueue();
    }
  }
}

module.exports = { JobManager, scrubSecrets, snapshotSpec };
