import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const toolsDir = path.join(root, 'tools');
const force = process.argv.includes('--force');

fs.mkdirSync(toolsDir, { recursive: true });

function log(message) {
  console.log(`[tools] ${message}`);
}

function copyBinary(source, destination, label) {
  if (!source || !fs.existsSync(source)) throw new Error(`${label} source not found: ${source}`);
  fs.copyFileSync(source, destination);
  const size = fs.statSync(destination).size;
  log(`${label}: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

async function download(url, destination) {
  const temporary = `${destination}.download`;
  log(`Downloading ${url}`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'OmniForge/1.0 (+local desktop app)' }
  });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(temporary, Buffer.from(arrayBuffer));
  fs.renameSync(temporary, destination);
  log(`Saved ${path.basename(destination)} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

function runVersion(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with code ${result.status}: ${output}`);
  return output.split(/\r?\n/)[0];
}

async function main() {
  const ffmpeg = require('ffmpeg-static');
  const ffprobe = require('ffprobe-static').path;
  const sevenZip = require('7zip-bin').path7za;

  copyBinary(ffmpeg, path.join(toolsDir, 'ffmpeg.exe'), 'FFmpeg');
  copyBinary(ffprobe, path.join(toolsDir, 'ffprobe.exe'), 'FFprobe');
  copyBinary(sevenZip, path.join(toolsDir, '7za.exe'), '7-Zip');

  const ytDlpPath = path.join(toolsDir, 'yt-dlp.exe');
  if (force || !fs.existsSync(ytDlpPath) || fs.statSync(ytDlpPath).size < 1024 * 1024) {
    await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytDlpPath);
  } else {
    log('yt-dlp already present; use --force to download it again.');
  }

  const denoPath = path.join(toolsDir, 'deno.exe');
  if (force || !fs.existsSync(denoPath) || fs.statSync(denoPath).size < 1024 * 1024) {
    const zipPath = path.join(os.tmpdir(), `omniforge-deno-${Date.now()}.zip`);
    await download('https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip', zipPath);
    log('Extracting Deno…');
    const result = spawnSync(path.join(toolsDir, '7za.exe'), ['x', '-y', `-o${toolsDir}`, zipPath], {
      encoding: 'utf8',
      windowsHide: true
    });
    fs.rmSync(zipPath, { force: true });
    if (result.status !== 0) throw new Error(`Could not extract Deno: ${result.stderr || result.stdout}`);
  } else {
    log('Deno already present; use --force to download it again.');
  }

  const whisperCliPath = path.join(toolsDir, 'whisper-cli.exe');
  if (force || !fs.existsSync(whisperCliPath)) {
    const zipPath = path.join(os.tmpdir(), `omniforge-whisper-${Date.now()}.zip`);
    await download('https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip', zipPath);
    log('Extracting Whisper...');
    const result = spawnSync(path.join(toolsDir, '7za.exe'), [
      'e', '-y', `-o${toolsDir}`, zipPath,
      'Release\\whisper-cli.exe',
      'Release\\whisper.dll',
      'Release\\ggml.dll',
      'Release\\ggml-base.dll',
      'Release\\ggml-cpu-*.dll'
    ], { encoding: 'utf8', windowsHide: true });
    fs.rmSync(zipPath, { force: true });
    if (result.status !== 0) throw new Error(`Could not extract Whisper: ${result.stderr || result.stdout}`);
  } else {
    log('Whisper already present; use --force to download it again.');
  }

  const whisperModelPath = path.join(toolsDir, 'ggml-base.bin');
  if (force || !fs.existsSync(whisperModelPath) || fs.statSync(whisperModelPath).size < 100 * 1024 * 1024) {
    await download('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin', whisperModelPath);
  } else {
    log('Whisper base model already present; use --force to download it again.');
  }

  const licenseSources = [
    ['node_modules/ffmpeg-static/LICENSE', 'FFMPEG-LICENSE.txt'],
    ['node_modules/ffmpeg-static/ffmpeg.exe.LICENSE', 'FFMPEG-BUILD-LICENSE.txt'],
    ['node_modules/ffprobe-static/LICENSE', 'FFPROBE-LICENSE.txt'],
    ['node_modules/7zip-bin/LICENSE', '7ZIP-LICENSE.txt']
  ];
  for (const [relative, destination] of licenseSources) {
    const source = path.join(root, relative);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(toolsDir, destination));
  }

  const notices = `# Third-party notices\n\nOmniForge bundles the following local command-line tools:\n\n- FFmpeg and FFprobe: https://ffmpeg.org/ — FFmpeg licensing information is included in FFMPEG-LICENSE.txt and FFMPEG-BUILD-LICENSE.txt.\n- yt-dlp: https://github.com/yt-dlp/yt-dlp — Unlicense. See YT-DLP-LICENSE.txt.\n- Deno: https://deno.land/ — MIT License. See DENO-LICENSE.txt.\n- 7-Zip: https://www.7-zip.org/ — GNU LGPL, with unRAR restrictions. See 7ZIP-LICENSE.txt.
- whisper.cpp: https://github.com/ggml-org/whisper.cpp — MIT License. See WHISPER-LICENSE.txt. The bundled ggml-base model is distributed under the MIT License from OpenAI Whisper.\n\nOmniForge invokes these tools locally. yt-dlp is used only for user-requested downloads; users are responsible for complying with the source site's terms and applicable copyright law.\n`;
  fs.writeFileSync(path.join(toolsDir, 'THIRD_PARTY_NOTICES.md'), notices, 'utf8');

  const versions = {
    ffmpeg: runVersion(path.join(toolsDir, 'ffmpeg.exe'), ['-version']),
    ffprobe: runVersion(path.join(toolsDir, 'ffprobe.exe'), ['-version']),
    sevenZip: runVersion(path.join(toolsDir, '7za.exe'), ['i']),
    ytDlp: runVersion(ytDlpPath, ['--version']),
    deno: runVersion(denoPath, ['--version']),
    whisper: runVersion(whisperCliPath, ['--version']),
    preparedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(toolsDir, 'manifest.json'), `${JSON.stringify(versions, null, 2)}\n`, 'utf8');
  log('All bundled tools are ready.');
  console.log(JSON.stringify(versions, null, 2));
}

main().catch((error) => {
  console.error(`[tools] ${error.stack || error.message}`);
  process.exitCode = 1;
});
