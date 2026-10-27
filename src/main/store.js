'use strict';

const fs = require('fs');
const path = require('path');

class Store {
  constructor(app) {
    this.app = app;
    this.directory = app.getPath('userData');
    this.settingsPath = path.join(this.directory, 'settings.json');
    this.historyPath = path.join(this.directory, 'history.json');
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
      historyLimit: 50
    };
  }

  loadSettings() {
    try {
      const stored = JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      return { ...this.defaults(), ...stored };
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

module.exports = { Store };
