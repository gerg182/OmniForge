'use strict';

const path = require('node:path');
const { resolveToolPath } = require('../src/main/tools');

const toolsDir = path.join(__dirname, '..', 'tools');

// Resolve exactly like the app does: the bundled copy first, then the PATH.
module.exports = {
  toolsDir,
  ffmpeg: resolveToolPath(toolsDir, 'ffmpeg'),
  ffprobe: resolveToolPath(toolsDir, 'ffprobe'),
  ytDlp: resolveToolPath(toolsDir, 'ytDlp'),
  deno: resolveToolPath(toolsDir, 'deno'),
  sevenZip: resolveToolPath(toolsDir, 'sevenZip'),
  whisper: resolveToolPath(toolsDir, 'whisper'),
  whisperModel: path.join(toolsDir, 'ggml-base.bin')
};
