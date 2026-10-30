'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeRecipes } = require('./recipes');

const JOB_CONCURRENCY_OPTIONS = [1, 2, 3];

function normalizeJobConcurrency(value) {
  const count = Number(value);
  return JOB_CONCURRENCY_OPTIONS.includes(count) ? count : 2;
}

class Store {
  constructor(app) {
    this.app = app;
    this.directory = app.getPath('userData');
    this.settingsPath = path.join(this.directory, 'settings.json');
    this.historyPath = path.join(this.directory, 'history.json');
    this.queuePath = path.join(this.directory, 'queue.json');
    fs.mkdirSync(this.directory, { recursive: true });
    this.settings = this.loadSettings();
    this.history = this.loadHistory();
  }

  defaultUpdateFolder() {
    const candidates = [
      path.join(this.app.getPath('desktop'), 'mutitool', 'dist'),
      path.join(this.app.getPath('downloads'), 'OmniForge Updates')
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[1];
  }

  defaults() {
    return {
      outputDir: path.join(this.app.getPath('downloads'), 'OmniForge'),
      lastOutputDir: null,
      updateFolder: this.defaultUpdateFolder(),
      theme: 'dark',
      historyLimit: 50,
      jobConcurrency: 2,
      notifyOnFailure: true,
      recipes: []
    };
  }

  loadSettings() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      const merged = { ...this.defaults(), ...stored };
      merged.jobConcurrency = normalizeJobConcurrency(merged.jobConcurrency);
      merged.notifyOnFailure = merged.notifyOnFailure !== false;
      merged.recipes = sanitizeRecipes(stored.recipes);
      return merged;
    } catch {
      return this.defaults();
    }
  }

  loadHistory() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  writeSettings() {
    const temp = `${this.settingsPath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.settings, null, 2), 'utf8');
    fs.renameSync(temp, this.settingsPath);
  }

  writeHistory() {
    const temp = `${this.historyPath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.history, null, 2), 'utf8');
    fs.renameSync(temp, this.historyPath);
  }

  sanitizeSpec(spec) {
    if (!spec || typeof spec !== 'object') return null;
    const clean = {
      ...spec,
      inputPaths: Array.isArray(spec.inputPaths) ? spec.inputPaths.map((value) => String(value)) : [],
      options: { ...(spec.options && typeof spec.options === 'object' ? spec.options : {}) }
    };
    delete clean.options.password;
    delete clean.options.confirm;
    delete clean.options.acknowledged;
    delete clean.options.acknowledgement;
    return clean;
  }

  queueEntry(job) {
    return {
      id: job.id,
      tool: job.tool,
      label: job.label,
      status: job.status,
      progress: job.progress,
      message: job.message,
      spec: this.sanitizeSpec(job.spec),
      outputPaths: Array.isArray(job.outputPaths) ? job.outputPaths : [],
      data: job.data || null,
      error: job.error || null,
      createdAt: job.createdAt || null,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null
    };
  }

  loadQueue() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((entry) => entry && entry.id && entry.tool && entry.spec)
        .map((entry) => ({ ...entry, spec: this.sanitizeSpec(entry.spec) }));
    } catch {
      return [];
    }
  }

  writeQueue(jobs) {
    const entries = Array.isArray(jobs) ? jobs.map((job) => this.queueEntry(job)) : [];
    const temp = `${this.queuePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(entries, null, 2), 'utf8');
    fs.renameSync(temp, this.queuePath);
  }

  get() {
    return { ...this.settings };
  }

  save(patch = {}) {
    const allowed = ['outputDir', 'lastOutputDir', 'updateFolder', 'theme'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        this.settings[key] = typeof patch[key] === 'string' ? patch[key] : null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'recipes')) {
      this.settings.recipes = sanitizeRecipes(patch.recipes);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'jobConcurrency')) {
      this.settings.jobConcurrency = normalizeJobConcurrency(patch.jobConcurrency);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'notifyOnFailure')) {
      this.settings.notifyOnFailure = patch.notifyOnFailure !== false;
    }
    this.writeSettings();
    return this.get();
  }

  addHistory(job) {
    const entry = {
      id: job.id,
      tool: job.tool,
      label: job.label,
      status: job.status,
      progress: job.progress,
      message: job.message,
      inputPaths: job.spec?.inputPaths || [],
      outputPaths: job.outputPaths || [],
      error: job.error || null,
      spec: this.sanitizeSpec(job.spec),
      createdAt: job.createdAt || null,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null
    };
    this.history.unshift(entry);
    this.history = this.history.slice(0, this.settings.historyLimit || 50);
    this.writeHistory();
  }

  getHistory() {
    return this.history.slice();
  }
}

module.exports = { Store, JOB_CONCURRENCY_OPTIONS, normalizeJobConcurrency };
