import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const toolsDir = path.join(root, 'tools');
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools-lock.json'), 'utf8'));
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const manifestPath = path.join(toolsDir, 'manifest.json');
const force = process.argv.includes('--force');
const bootstrap7za = require('7zip-bin').path7za;
const { resolveToolPath } = require('../src/main/tools');
const isWindows = process.platform === 'win32';
const REQUIRED_FILES = isWindows
  ? ['ffmpeg.exe', 'ffprobe.exe', '7za.exe', 'yt-dlp.exe', 'deno.exe', 'whisper-cli.exe', 'ggml-base.bin']
  : ['ggml-base.bin'];

fs.mkdirSync(toolsDir, { recursive: true });

function log(message) {
  console.log(`[tools] ${message}`);
}

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with code ${result.status}: ${result.stderr || result.stdout}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`.trim();
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function hashMatches(filePath, expected) {
  try {
    return fs.existsSync(filePath) && (await hashFile(filePath)) === String(expected).toLowerCase();
  } catch {
    return false;
  }
}

async function download(url, destination, sha256, label) {
  if (!force && await hashMatches(destination, sha256)) {
    log(`${label} already matches the pinned SHA-256.`);
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  await fs.promises.rm(temporary, { force: true });
  log(`Downloading ${label} from ${url}`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': `OmniForge/${packageVersion} (+https://github.com/gerg182/OmniForge)` }
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error(`Download returned no readable body for ${label}.`);
  }
  const handle = await fs.promises.open(temporary, 'w');
  const reader = response.body.getReader();
  let received = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value?.byteLength) {
        received += chunk.value.byteLength;
        await handle.write(chunk.value);
      }
    }
  } catch (error) {
    await handle.close().catch(() => {});
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  await handle.close();
  const actual = await hashFile(temporary);
  if (actual !== String(sha256).toLowerCase()) {
    await fs.promises.rm(temporary, { force: true }).catch(() => {});
    throw new Error(`${label} SHA-256 mismatch. Expected ${sha256}, got ${actual}.`);
  }
  await fs.promises.rm(destination, { force: true });
  await fs.promises.rename(temporary, destination);
  log(`Saved ${label} (${(received / 1024 / 1024).toFixed(1)} MB).`);
}

function extract(sevenZip, archive, destination, patterns = []) {
  fs.mkdirSync(destination, { recursive: true });
  run(sevenZip, ['x', '-y', `-o${destination}`, archive, ...patterns], 'Archive extraction');
}

function findFiles(directory, matcher) {
  if (!fs.existsSync(directory)) return [];
  const matches = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(fullPath, matcher));
    else if (entry.isFile() && matcher(entry.name, fullPath)) matches.push(fullPath);
  }
  return matches;
}

function findFile(directory, name) {
  return findFiles(directory, (fileName) => fileName.toLowerCase() === name.toLowerCase())[0] || null;
}

function copyBinary(source, destination, label) {
  if (!source || !fs.existsSync(source)) throw new Error(`${label} source not found.`);
  fs.copyFileSync(source, destination);
  log(`${label}: ${(fs.statSync(destination).size / 1024 / 1024).toFixed(1)} MB`);
}

function temporaryDirectory(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `omniforge-${label}-`));
}

function lockedManifest(versions) {
  return {
    ffmpeg: lock.ffmpeg.version,
    sevenZip: lock.sevenZip.version,
    ytDlp: lock.ytDlp.version,
    deno: lock.deno.version,
    whisper: lock.whisper.version,
    speechModel: lock.speechModel.version,
    ...versions
  };
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

async function downloadWindowsTools() {
  const sevenZipTemp = temporaryDirectory('7zip');
  const sevenZipArchive = path.join(os.tmpdir(), `omniforge-7zip-${lock.sevenZip.version}.7z`);
  await download(lock.sevenZip.url, sevenZipArchive, lock.sevenZip.sha256, '7-Zip');
  extract(bootstrap7za, sevenZipArchive, sevenZipTemp, ['x64\\7za.exe', 'License.txt']);
  copyBinary(findFile(sevenZipTemp, '7za.exe'), path.join(toolsDir, '7za.exe'), '7-Zip');
  const sevenLicense = findFile(sevenZipTemp, 'License.txt');
  if (sevenLicense) fs.copyFileSync(sevenLicense, path.join(toolsDir, '7ZIP-LICENSE.txt'));
  fs.rmSync(sevenZipTemp, { recursive: true, force: true });

  const ffmpegTemp = temporaryDirectory('ffmpeg');
  const ffmpegArchive = path.join(os.tmpdir(), `omniforge-ffmpeg-${lock.ffmpeg.version}.zip`);
  await download(lock.ffmpeg.url, ffmpegArchive, lock.ffmpeg.sha256, 'FFmpeg and FFprobe');
  extract(path.join(toolsDir, '7za.exe'), ffmpegArchive, ffmpegTemp);
  copyBinary(findFile(ffmpegTemp, 'ffmpeg.exe'), path.join(toolsDir, 'ffmpeg.exe'), 'FFmpeg');
  copyBinary(findFile(ffmpegTemp, 'ffprobe.exe'), path.join(toolsDir, 'ffprobe.exe'), 'FFprobe');
  const ffmpegLicense = findFiles(ffmpegTemp, (name) => /^LICENSE/i.test(name))[0];
  if (ffmpegLicense) fs.copyFileSync(ffmpegLicense, path.join(toolsDir, 'FFMPEG-BUILD-LICENSE.txt'));
  fs.rmSync(ffmpegTemp, { recursive: true, force: true });

  await download(lock.ytDlp.url, path.join(toolsDir, 'yt-dlp.exe'), lock.ytDlp.sha256, 'yt-dlp');

  const denoTemp = temporaryDirectory('deno');
  const denoArchive = path.join(os.tmpdir(), `omniforge-deno-${lock.deno.version}.zip`);
  await download(lock.deno.url, denoArchive, lock.deno.sha256, 'Deno');
  extract(path.join(toolsDir, '7za.exe'), denoArchive, denoTemp, ['deno.exe']);
  copyBinary(findFile(denoTemp, 'deno.exe'), path.join(toolsDir, 'deno.exe'), 'Deno');
  fs.rmSync(denoTemp, { recursive: true, force: true });

  const whisperTemp = temporaryDirectory('whisper');
  const whisperArchive = path.join(os.tmpdir(), `omniforge-whisper-${lock.whisper.version}.zip`);
  await download(lock.whisper.url, whisperArchive, lock.whisper.sha256, 'whisper.cpp');
  extract(path.join(toolsDir, '7za.exe'), whisperArchive, whisperTemp);
  const whisperRelease = path.join(whisperTemp, 'Release');
  const whisperFiles = [
    'whisper-cli.exe',
    'whisper.dll',
    'ggml.dll',
    'ggml-base.dll',
    ...fs.readdirSync(whisperRelease).filter((name) => /^ggml-cpu-.*\.dll$/i.test(name))
  ];
  for (const fileName of whisperFiles) {
    const source = path.join(whisperRelease, fileName);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(toolsDir, fileName));
  }
  log('whisper.cpp runtime copied.');
  fs.rmSync(whisperTemp, { recursive: true, force: true });
}

async function prepareSpeechModel() {
  await download(lock.speechModel.url, path.join(toolsDir, 'ggml-base.bin'), lock.speechModel.sha256, 'Whisper base model');
}

function toolVersion(tool, args) {
  const command = resolveToolPath(toolsDir, tool);
  if (!fs.existsSync(command)) return null;
  try {
    return run(command, args, `${tool} version check`).split(/\r?\n/)[0];
  } catch (error) {
    log(`${tool} version check failed: ${error.message}`);
    return null;
  }
}

async function main() {
  const previous = loadManifest();
  const versionsMatch = previous?.lockedVersions
    && previous.lockedVersions.ffmpeg === lock.ffmpeg.version
    && previous.lockedVersions.sevenZip === lock.sevenZip.version
    && previous.lockedVersions.ytDlp === lock.ytDlp.version
    && previous.lockedVersions.deno === lock.deno.version
    && previous.lockedVersions.whisper === lock.whisper.version
    && previous.lockedVersions.speechModel === lock.speechModel.version;
  const filesPresent = REQUIRED_FILES.every((name) => fs.existsSync(path.join(toolsDir, name)));

  if (!force && versionsMatch && filesPresent) {
    log('Pinned tools are already prepared; use --force to download them again.');
  } else if (isWindows) {
    await downloadWindowsTools();
    await prepareSpeechModel();
  } else {
    log(`No pinned ${process.platform} binaries are published for this project.`);
    log('Using FFmpeg, FFprobe, 7-Zip, yt-dlp, Deno, and whisper.cpp from PATH; install them with your package manager.');
    await prepareSpeechModel();
  }

  const notices = `# Third-party notices\n\nOmniForge bundles the following pinned local command-line tools:\n\n- FFmpeg and FFprobe ${lock.ffmpeg.version}: https://ffmpeg.org/ - see FFMPEG-LICENSE.txt and FFMPEG-BUILD-LICENSE.txt.\n- yt-dlp ${lock.ytDlp.version}: https://github.com/yt-dlp/yt-dlp - Unlicense. See YT-DLP-LICENSE.txt.\n- Deno ${lock.deno.version}: https://deno.land/ - MIT License. See DENO-LICENSE.txt.\n- 7-Zip ${lock.sevenZip.version}: https://www.7-zip.org/ - GNU LGPL. See 7ZIP-LICENSE.txt.\n- whisper.cpp ${lock.whisper.version}: https://github.com/ggml-org/whisper.cpp - MIT License. See WHISPER-LICENSE.txt. The bundled ggml-base model is distributed under the MIT License from OpenAI Whisper.\n\nOmniForge invokes these tools locally. yt-dlp is used only for user-requested downloads; users are responsible for complying with the source site's terms and applicable copyright law.\n`;
  fs.writeFileSync(path.join(toolsDir, 'THIRD_PARTY_NOTICES.md'), notices, 'utf8');

  const versions = {
    ffmpeg: toolVersion('ffmpeg', ['-version']),
    ffprobe: toolVersion('ffprobe', ['-version']),
    sevenZip: toolVersion('sevenZip', ['i']),
    ytDlp: toolVersion('ytDlp', ['--version']),
    deno: toolVersion('deno', ['--version']),
    whisper: toolVersion('whisper', ['--version']),
    speechModel: lock.speechModel.version,
    platform: process.platform,
    preparedAt: new Date().toISOString(),
    lockedVersions: lockedManifest({})
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(versions, null, 2)}\n`, 'utf8');
  log('All pinned tools are ready.');
  console.log(JSON.stringify(versions, null, 2));
}

main().catch((error) => {
  console.error(`[tools] ${error.stack || error.message}`);
  process.exitCode = 1;
});
