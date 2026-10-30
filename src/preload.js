'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('omniforge', {
  getSystemStatus: () => ipcRenderer.invoke('system:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  getHistory: () => ipcRenderer.invoke('history:get'),
  chooseFiles: () => ipcRenderer.invoke('dialog:files'),
  getFileMetadata: (paths) => ipcRenderer.invoke('files:metadata', paths),
  chooseOutputFolder: () => ipcRenderer.invoke('dialog:output'),
  startJob: (spec) => ipcRenderer.invoke('job:start', spec),
  cancelJob: (id) => ipcRenderer.invoke('job:cancel', id),
  getJob: (id) => ipcRenderer.invoke('job:get', id),
  listJobs: () => ipcRenderer.invoke('job:list'),
  resumeJob: (id, password, options) => ipcRenderer.invoke('job:resume', id, password, options),
  moveJob: (id, direction) => ipcRenderer.invoke('job:move', id, direction),
  retryJob: (id, options) => ipcRenderer.invoke('job:retry', id, options),
  probeYouTube: (url) => ipcRenderer.invoke('youtube:probe', url),
  updateYouTubeEngine: () => ipcRenderer.invoke('youtube:update'),
  getStudioMediaUrl: (filePath) => ipcRenderer.invoke('studio:media-url', filePath),
  readStudioTranscript: (filePath) => ipcRenderer.invoke('studio:read-transcript', filePath),
  chooseStudioTranscript: () => ipcRenderer.invoke('studio:choose-transcript'),
  openStudioProject: () => ipcRenderer.invoke('studio:open-project'),
  saveStudioProject: (project, options) => ipcRenderer.invoke('studio:save-project', project, options || {}),
  exportStudioTranscript: (payload) => ipcRenderer.invoke('studio:export-transcript', payload || {}),
  getStudioRecovery: () => ipcRenderer.invoke('studio:recovery-get'),
  saveStudioRecovery: (payload) => ipcRenderer.invoke('studio:recovery-save', payload || {}),
  clearStudioRecovery: () => ipcRenderer.invoke('studio:recovery-clear'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  chooseUpdateFolder: () => ipcRenderer.invoke('updates:choose-folder'),
  chooseUpdateInstaller: () => ipcRenderer.invoke('updates:choose-installer'),
  describeUpdateInstaller: (installerPath) => ipcRenderer.invoke('updates:describe', installerPath),
  installUpdate: (installerPath, options) => ipcRenderer.invoke('updates:install', installerPath, options),
  downloadUpdate: (version) => ipcRenderer.invoke('updates:download', version),
  openUpdateRelease: () => ipcRenderer.invoke('updates:open-release'),
  saveDictationRecording: (bytes, mimeType) => ipcRenderer.invoke('dictation:save-recording', { bytes, mimeType }),
  openPath: (targetPath) => ipcRenderer.invoke('path:open', targetPath),
  revealPath: (targetPath) => ipcRenderer.invoke('path:reveal', targetPath),
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return ''; }
  },
  onJobUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('job:update', listener);
    return () => ipcRenderer.removeListener('job:update', listener);
  },
  onOpenQueue: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('queue:open', listener);
    return () => ipcRenderer.removeListener('queue:open', listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updates:progress', listener);
    return () => ipcRenderer.removeListener('updates:progress', listener);
  }
});
