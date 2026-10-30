'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
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
const { isSupportedYouTubeUrl } = require('./youtube');

let mainWindow = null;
let store = null;
let tools = null;
let jobs = null;
let updates = null;

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
      toolLabels: TOOL_LABELS
    };
  });

  ipcMain.handle('settings:get', () => store.get());
  ipcMain.handle('settings:save', (_event, patch) => store.save(patch || {}));
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

  ipcMain.handle('youtube:probe', async (_event, url) => {
    if (!isSupportedYouTubeUrl(url)) throw new Error('Enter a valid YouTube video URL.');
    return tools.probeYouTube(String(url).trim());
  });
  ipcMain.handle('youtube:update', () => tools.updateYouTubeEngine());

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
  ipcMain.handle('updates:install', (_event, installerPath) => updates.install(String(installerPath || '')));

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
  jobs = new JobManager({ store, tools, emit: send });
  updates = new UpdateManager(app, store, {
    openInstaller: (installerPath) => shell.openPath(installerPath)
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
