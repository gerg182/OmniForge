'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, shell, session, Notification, net } = require('electron');
const { Store } = require('./store');
const { ToolsManager } = require('./tools');
const { JobManager } = require('./job-manager');
const { UpdateManager } = require('./updates');
const {
  OUTPUT_GROUPS,
  INPUT_EXTENSIONS,
  ARCHIVE_FORMATS,
  QUALITY_PRESETS,
  TOOL_LABELS
} = require('./constants');
const { RECIPE_TOOLS } = require('./recipes');
const { STUDIO_RATIOS, STUDIO_FRAMING_MODES } = require('./studio-framing');
const { isSupportedYouTubeUrl } = require('./youtube');
const {
  PROJECT_EXTENSION,
  normalizeProject,
  writeJsonAtomic,
  readJson,
  loadProject,
  saveProject,
  suggestedProjectPath,
  loadTranscriptFile,
  saveTranscriptFile
} = require('./studio-project');
const { getStudioMediaSource } = require('./studio-media');

let mainWindow = null;
let store = null;
let tools = null;
let jobs = null;
let updates = null;
const activeJobSnapshots = new Map();
const notifiedFailureIds = new Set();

function writeStartupLog(error) {
  try {
    const directory = app.getPath('userData');
    fs.mkdirSync(directory, { recursive: true });
    const detail = error?.stack || error?.message || String(error);
    fs.appendFileSync(path.join(directory, 'startup-errors.log'), `[${new Date().toISOString()}] ${detail}\n`, 'utf8');
  } catch {
    // Logging must never prevent the app from starting.
  }
}

function reportStartupError(error) {
  writeStartupLog(error);
  try {
    dialog.showErrorBox('OmniForge failed to start', error?.message || String(error));
  } catch {
    // The app is quitting because startup could not complete.
  }
}

process.on('uncaughtException', (error) => writeStartupLog(error));
process.on('unhandledRejection', (error) => writeStartupLog(error));

function extensionForMimeType(value) {
  const mime = String(value || '').toLowerCase();
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

function registerMediaPermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const trusted = Boolean(mainWindow && webContents === mainWindow.webContents);
    if (!trusted || permission !== 'media') {
      callback(false);
      return;
    }
    const mediaTypes = Array.isArray(details?.mediaTypes) ? details.mediaTypes : [];
    callback(mediaTypes.length === 0 || mediaTypes.includes('audio'));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission !== 'media') return false;
    return Boolean(mainWindow && webContents === mainWindow.webContents);
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function updateTaskbarProgress() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const active = [...activeJobSnapshots.values()].filter((job) => ['running', 'cancelling'].includes(job.status));
  if (active.length === 0) {
    mainWindow.setProgressBar(-1);
    return;
  }
  const average = active.reduce((total, job) => total + (Number(job.progress) || 0), 0) / active.length;
  mainWindow.setProgressBar(Math.max(0, Math.min(1, average / 100)));
}

function focusQueueFromNotification() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  send('queue:open');
}

function notifyFailedJob(job) {
  if (store?.get?.().notifyOnFailure === false || notifiedFailureIds.has(job.id)) return;
  notifiedFailureIds.add(job.id);
  try {
    if (typeof Notification?.isSupported === 'function' && !Notification.isSupported()) return;
    const detail = String(job.error || job.message || 'The job could not be completed.').replace(/\s+/g, ' ').trim();
    const notification = new Notification({
      title: 'OmniForge job failed',
      body: `${job.label || 'Job'} · ${detail}`.slice(0, 240),
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png')
    });
    notification.on('click', focusQueueFromNotification);
    notification.show();
  } catch { /* notifications are optional */ }
}

function handleJobEvent(job) {
  if (!job || !job.id) return;
  if (['running', 'cancelling'].includes(job.status)) activeJobSnapshots.set(job.id, job);
  else activeJobSnapshots.delete(job.id);
  updateTaskbarProgress();
  if (job.status === 'failed') notifyFailedJob(job);
  send('job:update', job);
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#080a0e',
    title: 'OmniForge',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#080a0e',
      symbolColor: '#d8dee9',
      height: 42
    },
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch((error) => {
    reportStartupError(error);
    app.quit();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc() {
  ipcMain.handle('system:status', async () => {
    const status = await tools.systemStatus();
    return {
      ...status,
      settings: store.get(),
      formats: OUTPUT_GROUPS,
      inputExtensions: INPUT_EXTENSIONS,
      archiveFormats: ARCHIVE_FORMATS,
      qualityPresets: QUALITY_PRESETS,
      toolLabels: TOOL_LABELS,
      recipeTools: RECIPE_TOOLS,
      studioRatios: STUDIO_RATIOS,
      studioFramingModes: STUDIO_FRAMING_MODES
    };
  });

  ipcMain.handle('settings:get', () => store.get());
  ipcMain.handle('settings:save', (_event, patch) => {
    const saved = store.save(patch || {});
    jobs.setConcurrency(saved.jobConcurrency);
    return saved;
  });
  ipcMain.handle('history:get', () => store.getHistory());

  ipcMain.handle('files:metadata', async (_event, filePaths) => {
    const list = Array.isArray(filePaths) ? filePaths : [];
    return list.map((filePath) => {
      try {
        const stat = fs.statSync(String(filePath));
        return { path: String(filePath), name: path.basename(String(filePath)), size: stat.size, isFile: stat.isFile() };
      } catch {
        return { path: String(filePath), name: path.basename(String(filePath)), size: 0, isFile: false };
      }
    });
  });

  ipcMain.handle('dialog:files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose files',
      properties: ['openFile', 'multiSelections']
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:output', async () => {
    const current = store.get();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose an output folder',
      defaultPath: current.lastOutputDir || current.outputDir,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    store.save({ lastOutputDir: result.filePaths[0] });
    return result.filePaths[0];
  });

  ipcMain.handle('job:start', (_event, spec) => jobs.start(spec));
  ipcMain.handle('job:cancel', (_event, id) => jobs.cancel(id));
  ipcMain.handle('job:get', (_event, id) => jobs.get(id));
  ipcMain.handle('job:list', () => jobs.list());
  ipcMain.handle('job:resume', (_event, id, password, options) => jobs.resume(id, password, options || {}));
  ipcMain.handle('job:move', (_event, id, direction) => jobs.move(id, direction));
  ipcMain.handle('job:retry', (_event, id, options) => jobs.retry(id, options || {}));

  ipcMain.handle('youtube:probe', async (_event, url) => {
    if (!isSupportedYouTubeUrl(url)) throw new Error('Enter a valid YouTube video URL.');
    return tools.probeYouTube(String(url).trim());
  });
  ipcMain.handle('youtube:update', () => tools.updateYouTubeEngine());

  const studioRecoveryPath = () => path.join(app.getPath('userData'), 'studio-recovery.json');

  ipcMain.handle('studio:media-url', (_event, filePath) => getStudioMediaSource(filePath));

  ipcMain.handle('studio:read-transcript', async (_event, filePath) => {
    return loadTranscriptFile(String(filePath || ''));
  });

  ipcMain.handle('studio:choose-transcript', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a transcript',
      properties: ['openFile'],
      filters: [{ name: 'Transcript', extensions: ['srt', 'vtt'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, ...(await loadTranscriptFile(result.filePaths[0])) };
  });

  ipcMain.handle('studio:open-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Transcript Clip Studio project',
      properties: ['openFile'],
      filters: [{ name: 'OmniForge Studio project', extensions: ['ofstudio'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, ...(await loadProject(result.filePaths[0])) };
  });

  ipcMain.handle('studio:save-project', async (_event, project, options = {}) => {
    const normalized = normalizeProject(project);
    let projectPath = String(options.projectPath || '');
    if (!projectPath || options.saveAs) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Transcript Clip Studio project',
        defaultPath: projectPath || suggestedProjectPath(normalized.mediaPath),
        filters: [{ name: 'OmniForge Studio project', extensions: ['ofstudio'] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      projectPath = result.filePath;
    }
    if (!projectPath.toLowerCase().endsWith(PROJECT_EXTENSION)) projectPath += PROJECT_EXTENSION;
    return { canceled: false, ...(await saveProject(projectPath, normalized)) };
  });

  ipcMain.handle('studio:export-transcript', async (_event, payload = {}) => {
    const format = String(payload.format || 'srt').toLowerCase();
    if (!['srt', 'vtt'].includes(format)) throw new Error('Choose SRT or VTT for transcript output.');
    const mediaPath = String(payload.mediaPath || '');
    const directory = String(payload.directory || (mediaPath ? path.dirname(mediaPath) : ''));
    const base = mediaPath ? path.basename(mediaPath, path.extname(mediaPath)) : 'transcript';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export transcript',
      defaultPath: path.join(directory || app.getPath('documents'), `${base}_transcript.${format}`),
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const outputPath = await saveTranscriptFile(result.filePath, payload.segments, format);
    return { canceled: false, path: outputPath };
  });

  ipcMain.handle('studio:recovery-get', async () => {
    try {
      const stored = await readJson(studioRecoveryPath());
      return {
        savedAt: stored.savedAt || null,
        projectPath: stored.projectPath || null,
        project: normalizeProject(stored.project)
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('studio:recovery-save', async (_event, payload = {}) => {
    const project = normalizeProject(payload.project);
    const entry = {
      savedAt: new Date().toISOString(),
      projectPath: payload.projectPath ? String(payload.projectPath) : null,
      project
    };
    await writeJsonAtomic(studioRecoveryPath(), entry);
    return { saved: true, savedAt: entry.savedAt };
  });

  ipcMain.handle('studio:recovery-clear', async () => {
    await fs.promises.rm(studioRecoveryPath(), { force: true });
    return { cleared: true };
  });

  ipcMain.handle('updates:check', () => updates.check());
  ipcMain.handle('updates:describe', (_event, installerPath) => updates.describe(String(installerPath || '')));
  ipcMain.handle('updates:choose-folder', async () => {
    const current = store.get();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose the OmniForge update folder',
      defaultPath: current.updateFolder,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    store.save({ updateFolder: result.filePaths[0] });
    return updates.check();
  });
  ipcMain.handle('updates:choose-installer', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select an OmniForge installer',
      properties: ['openFile'],
      filters: [{ name: 'OmniForge installer', extensions: ['exe'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return updates.describe(result.filePaths[0]);
  });
  ipcMain.handle('updates:install', (_event, installerPath, options) => updates.install(String(installerPath || ''), options || {}));
  ipcMain.handle('updates:download', (_event, version) => updates.download(String(version || '')));
  ipcMain.handle('updates:open-release', async () => {
    const releaseUrl = updates.releaseUrl();
    if (!releaseUrl) throw new Error('Check for updates before opening release notes.');
    let parsed;
    try {
      parsed = new URL(releaseUrl);
    } catch {
      throw new Error('The release notes URL is invalid.');
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith('/gerg182/OmniForge/releases/')) {
      throw new Error('The release notes URL is not an OmniForge GitHub release.');
    }
    await shell.openExternal(parsed.toString());
    return { opened: true };
  });

  ipcMain.handle('dictation:save-recording', async (_event, payload) => {
    const source = payload?.bytes;
    let buffer = null;
    if (Buffer.isBuffer(source)) buffer = source;
    else if (source instanceof Uint8Array) buffer = Buffer.from(source.buffer, source.byteOffset, source.byteLength);
    else if (source instanceof ArrayBuffer) buffer = Buffer.from(new Uint8Array(source));
    else if (Array.isArray(source)) buffer = Buffer.from(source);
    if (!buffer || buffer.length === 0) throw new Error('No recording data was received.');
    if (buffer.length > 250 * 1024 * 1024) throw new Error('The recording is too large to transcribe.');
    const directory = path.join(app.getPath('temp'), 'omniforge-dictation');
    await fs.promises.mkdir(directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(directory, `dictation-${stamp}.${extensionForMimeType(payload?.mimeType)}`);
    await fs.promises.writeFile(target, buffer);
    return { path: target, name: path.basename(target), size: buffer.length };
  });

  ipcMain.handle('path:open', async (_event, targetPath) => {
    if (!targetPath) return { ok: false, error: 'No path supplied.' };
    const result = await shell.openPath(String(targetPath));
    return result ? { ok: false, error: result } : { ok: true };
  });
  ipcMain.handle('path:reveal', (_event, targetPath) => {
    if (!targetPath) return { ok: false, error: 'No path supplied.' };
    shell.showItemInFolder(String(targetPath));
    return { ok: true };
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.omniforge.desktop');
  store = new Store(app);
  tools = new ToolsManager(app);
  jobs = new JobManager({ store, tools, emit: handleJobEvent });
  updates = new UpdateManager(app, store, {
    openInstaller: (installerPath) => shell.openPath(installerPath),
    fetchImpl: (url, options) => net.fetch(url, options),
    onProgress: (progress) => send('updates:progress', progress)
  });
  registerIpc();
  registerMediaPermissions();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  reportStartupError(error);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
