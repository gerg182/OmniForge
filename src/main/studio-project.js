'use strict';

const fs = require('fs/promises');
const path = require('path');
const { extensionOf, formatCategory } = require('./constants');
const {
  normalizeSegments,
  normalizeCaptionStyle,
  parseTranscript,
  serializeTranscript
} = require('./transcript');
const { normalizeStudioRatios, normalizeStudioFraming } = require('./studio-framing');

const PROJECT_VERSION = 1;
const PROJECT_EXTENSION = '.ofstudio';
const MAX_CLIPS = 100;
const MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024;
const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'mov'];
const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'];
const CAPTION_EXPORTS = ['none', 'srt', 'vtt', 'both'];

function normalizeLanguage(value) {
  const language = String(value || 'auto').trim().toLowerCase();
  return language === 'auto' || /^[a-z]{2,3}$/.test(language) ? language : 'auto';
}

function normalizeClips(input) {
  if (!Array.isArray(input)) return [];
  const clips = [];
  for (const entry of input.slice(0, MAX_CLIPS)) {
    if (!entry || typeof entry !== 'object') continue;
    const startMs = Math.round(Number(entry.startMs));
    const endMs = Math.round(Number(entry.endMs));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs) continue;
    clips.push({
      id: String(entry.id || `${clips.length + 1}`).slice(0, 120),
      label: String(entry.label || `Clip ${String(clips.length + 1).padStart(2, '0')}`).trim().slice(0, 120) || `Clip ${String(clips.length + 1).padStart(2, '0')}`,
      startMs,
      endMs
    });
  }
  return clips;
}

function normalizeOutput(input = {}) {
  return {
    directory: String(input.directory || ''),
    videoFormat: VIDEO_FORMATS.includes(input.videoFormat) ? input.videoFormat : 'mp4',
    audioFormat: AUDIO_FORMATS.includes(input.audioFormat) ? input.audioFormat : 'mp3',
    burnCaptions: input.burnCaptions !== false,
    exportCaptions: CAPTION_EXPORTS.includes(input.exportCaptions) ? input.exportCaptions : 'srt',
    ratios: normalizeStudioRatios(input.ratios),
    framing: normalizeStudioFraming(input.framing)
  };
}

function normalizeProject(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid Studio project.');
  if (Number(input.version) !== PROJECT_VERSION) throw new Error('Unsupported Studio project version.');
  const mediaPath = String(input.mediaPath || '').trim();
  if (!mediaPath) throw new Error('The Studio project has no media file.');
  const category = formatCategory(extensionOf(mediaPath));
  if (!['audio', 'video'].includes(category)) throw new Error('Studio projects require an audio or video file.');
  const durationMs = Math.max(0, Math.round(Number(input.durationMs) || 0));
  const clips = normalizeClips(input.clips);
  for (const clip of clips) {
    if (durationMs > 0 && clip.startMs >= durationMs) throw new Error('A clip starts beyond the end of the media.');
    if (durationMs > 0) clip.endMs = Math.min(clip.endMs, durationMs);
    if (clip.endMs <= clip.startMs) throw new Error('A clip has an invalid time range.');
  }
  return {
    version: PROJECT_VERSION,
    mediaPath,
    durationMs,
    language: normalizeLanguage(input.language),
    segments: normalizeSegments(input.segments),
    clips,
    clipPaddingMs: input.clipPaddingMs === undefined
      ? 150
      : Math.max(0, Math.min(2000, Math.round(Number(input.clipPaddingMs) || 0))),
    captionStyle: normalizeCaptionStyle(input.captionStyle),
    output: normalizeOutput(input.output),
    updatedAt: input.updatedAt ? String(input.updatedAt) : new Date().toISOString()
  };
}

async function writeJsonAtomic(filePath, value) {
  const target = path.resolve(String(filePath));
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function readJson(filePath) {
  const text = await fs.readFile(path.resolve(String(filePath)), 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The Studio project file is not valid JSON.');
  }
}

function mediaCandidates(projectPath, mediaPath) {
  if (!mediaPath) return [];
  const candidates = [];
  if (path.isAbsolute(mediaPath)) candidates.push(mediaPath);
  else if (projectPath) candidates.push(path.resolve(path.dirname(projectPath), mediaPath));
  if (projectPath) candidates.push(path.resolve(path.dirname(projectPath), path.basename(mediaPath)));
  return [...new Set(candidates.map((value) => path.resolve(value)))];
}

async function findProjectMedia(projectPath, mediaPath) {
  for (const candidate of mediaCandidates(projectPath, mediaPath)) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return { mediaPath: candidate, mediaMissing: false };
    } catch {
      // Try the next candidate before asking the user to relink.
    }
  }
  return { mediaPath: String(mediaPath || ''), mediaMissing: true };
}

async function loadProject(filePath) {
  const project = normalizeProject(await readJson(filePath));
  const resolved = await findProjectMedia(filePath, project.mediaPath);
  return {
    project: { ...project, mediaPath: resolved.mediaPath },
    projectPath: path.resolve(String(filePath)),
    mediaMissing: resolved.mediaMissing
  };
}

async function saveProject(filePath, input) {
  const project = normalizeProject(input);
  project.updatedAt = new Date().toISOString();
  await writeJsonAtomic(filePath, project);
  return { project, projectPath: path.resolve(String(filePath)) };
}

function suggestedProjectPath(mediaPath) {
  const base = mediaPath ? path.basename(mediaPath, path.extname(mediaPath)) : 'Untitled Studio';
  const directory = mediaPath ? path.dirname(mediaPath) : process.cwd();
  return path.join(directory, `${base}${PROJECT_EXTENSION}`);
}

async function loadTranscriptFile(filePath) {
  const ext = extensionOf(filePath);
  if (!['srt', 'vtt'].includes(ext)) throw new Error('Choose an SRT or VTT transcript.');
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('The transcript path is not a file.');
  if (stat.size > MAX_TRANSCRIPT_BYTES) throw new Error('The transcript file is too large.');
  const text = await fs.readFile(filePath, 'utf8');
  return {
    filePath: path.resolve(String(filePath)),
    format: ext,
    segments: parseTranscript(text, ext)
  };
}

async function saveTranscriptFile(filePath, segments, format) {
  const value = String(format || '').toLowerCase().replace(/^\./, '');
  let target = String(filePath || '');
  if (!target) throw new Error('Choose a transcript output path.');
  if (!target.toLowerCase().endsWith(`.${value}`)) target += `.${value}`;
  await fs.mkdir(path.dirname(path.resolve(target)), { recursive: true });
  await fs.writeFile(path.resolve(target), serializeTranscript(segments, value), 'utf8');
  return path.resolve(target);
}

module.exports = {
  PROJECT_VERSION,
  PROJECT_EXTENSION,
  MAX_CLIPS,
  VIDEO_FORMATS,
  AUDIO_FORMATS,
  CAPTION_EXPORTS,
  normalizeLanguage,
  normalizeClips,
  normalizeOutput,
  normalizeProject,
  writeJsonAtomic,
  readJson,
  loadProject,
  saveProject,
  findProjectMedia,
  suggestedProjectPath,
  loadTranscriptFile,
  saveTranscriptFile
};
