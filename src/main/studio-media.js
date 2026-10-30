'use strict';

const fsp = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');
const { extensionOf, formatCategory } = require('./constants');

const VIDEO_PRIORITY = new Map([
  'mp4', 'mkv', 'webm', 'mov', 'm4v', 'avi', 'ogv', 'flv', 'wmv', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp'
].map((extension, index) => [extension, index]));

async function findMatchingVideo(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  const directory = path.dirname(resolved);
  const stem = path.basename(resolved, path.extname(resolved)).toLowerCase();
  const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => []);
  const matches = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const candidatePath = path.join(directory, entry.name);
    if (candidatePath.toLowerCase() === resolved.toLowerCase()) continue;
    if (path.basename(entry.name, path.extname(entry.name)).toLowerCase() !== stem) continue;
    const ext = extensionOf(entry.name);
    if (formatCategory(ext) !== 'video') continue;
    const stat = await fsp.stat(candidatePath).catch(() => null);
    if (!stat?.isFile()) continue;
    matches.push({
      path: candidatePath,
      name: entry.name,
      size: stat.size,
      category: 'video',
      rank: VIDEO_PRIORITY.get(ext) ?? VIDEO_PRIORITY.size
    });
  }

  matches.sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
  if (matches.length === 0) return null;
  const { rank: _rank, ...match } = matches[0];
  return match;
}

async function getStudioMediaSource(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isFile()) throw new Error('The Studio media file could not be found.');
  const category = formatCategory(extensionOf(resolved));
  if (!['audio', 'video'].includes(category)) throw new Error('Choose an audio or video file.');
  return {
    url: pathToFileURL(resolved).href,
    path: resolved,
    category,
    name: path.basename(resolved),
    size: stat.size,
    ext: extensionOf(resolved),
    matchVideo: category === 'audio' ? await findMatchingVideo(resolved) : null
  };
}

module.exports = {
  findMatchingVideo,
  getStudioMediaSource
};
