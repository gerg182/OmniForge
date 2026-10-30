'use strict';

const fs = require('fs');
const path = require('path');
const { runProcess } = require('./utils');

const EXECUTABLE_SUFFIX = process.platform === 'win32' ? '.exe' : '';

// Bundled names stay stable per platform; the PATH names cover a Linux install
// where the pinned tools were installed by the package manager instead.
const TOOL_BINARIES = {
  ffmpeg: { bundled: 'ffmpeg', path: ['ffmpeg'] },
  ffprobe: { bundled: 'ffprobe', path: ['ffprobe'] },
  ytDlp: { bundled: 'yt-dlp', path: ['yt-dlp'] },
  deno: { bundled: 'deno', path: ['deno'] },
  sevenZip: { bundled: '7za', path: ['7zz', '7z', '7za'] },
  whisper: { bundled: 'whisper-cli', path: ['whisper-cli', 'main'] }
};

function firstLine(text) {
  return String(text || '').trim().split(/\r?\n/)[0] || '';
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findOnPath(names) {
  const directories = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const name of names) {
    const fileName = `${name}${EXECUTABLE_SUFFIX}`;
    for (const directory of directories) {
      const candidate = path.join(directory, fileName);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

function bundledToolPath(toolsDir, tool) {
  return path.join(toolsDir, `${TOOL_BINARIES[tool].bundled}${EXECUTABLE_SUFFIX}`);
}

// Resolve a tool by preferring the bundled copy, then the platform PATH.
function resolveToolPath(toolsDir, tool) {
  const definition = TOOL_BINARIES[tool];
  if (!definition) throw new Error(`Unknown tool: ${tool}`);
  const bundled = bundledToolPath(toolsDir, tool);
  if (isFile(bundled)) return bundled;
  return findOnPath(definition.path) || bundled;
}

class ToolsManager {
  constructor(app) {
    this.app = app;
    this.appRoot = path.join(__dirname, '..', '..');
    this.toolsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'tools')
      : path.join(this.appRoot, 'tools');
    this.runtimeDir = path.join(app.getPath('userData'), 'runtime');
    this.manifestPath = path.join(this.toolsDir, 'manifest.json');
    this.ensureRuntime();
  }

  ensureRuntime() {
    try {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
      const bundled = bundledToolPath(this.toolsDir, 'ytDlp');
      const runtime = path.join(this.runtimeDir, path.basename(bundled));
      if (fs.existsSync(bundled) && (!fs.existsSync(runtime) || fs.statSync(runtime).size < 1024 * 1024)) {
        fs.copyFileSync(bundled, runtime);
      }
    } catch {
      // A missing tool is surfaced by systemStatus and the relevant operation.
    }
  }

  paths() {
    const bundledYtDlp = resolveToolPath(this.toolsDir, 'ytDlp');
    const runtimeYtDlp = path.join(this.runtimeDir, path.basename(bundledYtDlp));
    return {
      ffmpeg: resolveToolPath(this.toolsDir, 'ffmpeg'),
      ffprobe: resolveToolPath(this.toolsDir, 'ffprobe'),
      ytDlp: fs.existsSync(runtimeYtDlp) ? runtimeYtDlp : bundledYtDlp,
      bundledYtDlp,
      runtimeYtDlp,
      deno: resolveToolPath(this.toolsDir, 'deno'),
      sevenZip: resolveToolPath(this.toolsDir, 'sevenZip'),
      whisper: resolveToolPath(this.toolsDir, 'whisper'),
      whisperModel: path.join(this.toolsDir, 'ggml-base.bin'),
      toolsDir: this.toolsDir,
      runtimeDir: this.runtimeDir
    };
  }

  manifest() {
    try {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    } catch {
      return null;
    }
  }

  async versionOf(command, args) {
    if (!command || !fs.existsSync(command)) {
      return { available: false, version: null };
    }
    try {
      const { stdout, stderr } = await runProcess(command, args, {
        timeoutMs: 8000,
        maxOutputBytes: 256 * 1024
      });
      return { available: true, version: firstLine(stdout || stderr) };
    } catch (error) {
      return { available: false, version: null, error: error.message };
    }
  }

  async systemStatus() {
    const paths = this.paths();
    const [ffmpeg, ffprobe, ytDlp, deno, sevenZip, whisper] = await Promise.all([
      this.versionOf(paths.ffmpeg, ['-version']),
      this.versionOf(paths.ffprobe, ['-version']),
      this.versionOf(paths.ytDlp, ['--version']),
      this.versionOf(paths.deno, ['--version']),
      this.versionOf(paths.sevenZip, ['i']),
      this.versionOf(paths.whisper, ['--version'])
    ]);
    const modelReady = fs.existsSync(paths.whisperModel);
    const speech = {
      available: Boolean(whisper.available && modelReady),
      version: whisper.available ? `${whisper.version || 'whisper.cpp'}${modelReady ? ' / base model' : ' / model missing'}` : null,
      error: modelReady ? whisper.error : 'The ggml-base.bin speech model is missing.'
    };
    return {
      appVersion: this.app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      toolsDir: paths.toolsDir,
      manifest: this.manifest(),
      tools: { ffmpeg, ffprobe, ytDlp, deno, sevenZip, speech }
    };
  }

  async probeYouTube(url) {
    const paths = this.paths();
    if (!fs.existsSync(paths.ytDlp)) throw new Error('The yt-dlp engine is missing. Reinstall the app or run the tools setup.');
    if (!fs.existsSync(paths.deno)) throw new Error('The Deno JavaScript runtime is missing from the bundled tools.');

    const args = [
      '--no-config',
      '--no-playlist',
      '--skip-download',
      '--dump-single-json',
      '--no-warnings',
      '--no-color',
      '--ffmpeg-location', paths.toolsDir,
      '--js-runtimes', `deno:${paths.deno}`,
      url
    ];
    const { stdout } = await runProcess(paths.ytDlp, args, {
      timeoutMs: 120000,
      maxOutputBytes: 24 * 1024 * 1024
    });
    const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
    if (!line) throw new Error('YouTube did not return any video information.');
    const data = JSON.parse(line);
    if (data.is_live) throw new Error('Live streams are not supported in this version.');
    return {
      id: data.id,
      title: data.title,
      thumbnail: data.thumbnail,
      uploader: data.uploader || data.channel || 'Unknown channel',
      duration: Number(data.duration) || 0,
      viewCount: Number(data.view_count) || 0,
      webpageUrl: data.webpage_url || url,
      live: Boolean(data.is_live)
    };
  }

  async updateYouTubeEngine() {
    this.ensureRuntime();
    const paths = this.paths();
    if (!fs.existsSync(paths.ytDlp)) throw new Error('The yt-dlp engine is missing.');
    const { stdout, stderr } = await runProcess(paths.ytDlp, ['--update-to', 'nightly'], {
      timeoutMs: 180000,
      maxOutputBytes: 2 * 1024 * 1024
    });
    const version = await this.versionOf(paths.ytDlp, ['--version']);
    return {
      updated: true,
      output: `${stdout}\n${stderr}`.trim(),
      version: version.version
    };
  }
}

module.exports = {
  ToolsManager,
  TOOL_BINARIES,
  EXECUTABLE_SUFFIX,
  bundledToolPath,
  resolveToolPath
};
