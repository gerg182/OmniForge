'use strict';

const path = require('path');
const crypto = require('crypto');
const { executeJob } = require('./operations');
const { TOOL_LABELS } = require('./constants');
const { isCancellation, clamp } = require('./utils');
const { isSupportedYouTubeUrl } = require('./youtube');

const SUPPORTED_TOOLS = new Set(Object.keys(TOOL_LABELS));

function scrubSecrets(spec) {
  if (!spec?.options) return;
  delete spec.options.password;
  delete spec.options.confirm;
}

function snapshotSpec(spec) {
  const clean = { ...spec, options: { ...(spec?.options || {}) } };
  if (Object.prototype.hasOwnProperty.call(clean.options, 'password')) clean.options.password = '';
  delete clean.options.confirm;
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
    outputPaths: job.outputPaths,
    data: job.data,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  };
}

class JobManager {
  constructor({ store, tools, emit }) {
    this.store = store;
    this.tools = tools;
    this.emit = emit;
    this.queue = [];
    this.jobs = new Map();
    this.activeJob = null;
    this.activeController = null;
    this.running = false;
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
    } else if (tool === 'checksum' || tool === 'info') {
      if (inputPaths.length === 0) throw new Error('Choose at least one input file.');
    } else if (inputPaths.length === 0) {
      throw new Error('Choose at least one input file.');
    }

    const outputDirectory = input.outputDirectory
      ? path.resolve(String(input.outputDirectory))
      : tool === 'checksum' || tool === 'info'
        ? null
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
      message: 'Waiting in queue…',
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
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return { cancelled: false, reason: 'Job is already finished.' };
    }
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.message = 'Cancelled';
      job.completedAt = new Date().toISOString();
      this.emitJob(job);
      this.store.addHistory(job);
      scrubSecrets(job.spec);
      return { cancelled: true };
    }
    if (job === this.activeJob) {
      job.status = 'cancelling';
      job.message = 'Cancelling…';
      this.emitJob(job);
      this.activeController?.abort();
      return { cancelled: true };
    }
    return { cancelled: false, reason: 'Job is not running.' };
  }

  get(id) {
    const job = this.jobs.get(String(id));
    return job ? snapshot(job) : null;
  }

  async runNext() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next || next.status === 'cancelled') continue;
        this.activeJob = next;
        this.activeController = new AbortController();
        next.status = 'running';
        next.startedAt = new Date().toISOString();
        next.progress = Math.max(next.progress, 1);
        next.message = 'Starting…';
        this.emitJob(next);

        const ctx = {
          signal: this.activeController.signal,
          report: (update) => this.update(next, update)
        };

        try {
          const result = await executeJob(next.spec, ctx, { tools: this.tools, store: this.store });
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
        }
      }
    } finally {
      this.running = false;
    }
  }
}

module.exports = { JobManager };
