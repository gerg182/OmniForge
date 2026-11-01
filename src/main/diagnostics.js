'use strict';

const fs = require('fs');

const TOOL_NAMES = {
  ffmpeg: 'FFmpeg',
  ffprobe: 'FFprobe',
  ytDlp: 'yt-dlp',
  deno: 'Deno',
  sevenZip: '7-Zip',
  speech: 'Whisper'
};

function sanitizeDiagnosticText(value, options = {}) {
  const maxLength = Number.isFinite(options.maxLength) ? Math.max(100, options.maxLength) : 16000;
  let text = String(value ?? '').replace(/\u0000/g, '').replace(/\r\n/g, '\n');

  text = text.replace(/\bfile:\/\/\/[^\s<>"']+/gi, '[path]');
  text = text.replace(/\bhttps?:\/\/[^\s<>"']+/gi, '[url]');
  text = text.replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[token]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]');
  text = text.replace(/\b(password|passwd|pwd|token|secret|api[_-]?key|authorization)\b\s*[:=]\s*(?!Bearer\s+\[redacted\])(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[redacted]');
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]');
  text = text.replace(/\b([A-Za-z]:\\Users\\)[^\\\s"'<>|]+/gi, '$1[user]');
  text = text.replace(/\/home\/[^/\s"'<>]+/g, '/home/[user]');
  text = text.replace(/\/Users\/[^/\s"'<>]+/g, '/Users/[user]');
  text = text.replace(/\\\\[^\\\s"'<>|]+\\(?:[^\\\s"'<>|]+\\)*[^\\\s"'<>|]*/g, '[path]');
  text = text.replace(/\b[A-Za-z]:\\(?:[^\\\s"'<>|]+\\)*[^\\\s"'<>|]*/g, '[path]');
  text = text.replace(/(^|[\s("'=])\/(?:[^/\s"'<>]+\/)+[^\s"'<>),]+/g, '$1[path]');

  if (text.length > maxLength) return `${text.slice(0, maxLength)}\n[truncated]`;
  return text;
}

function readStartupLogTail(filePath, options = {}) {
  const maxBytes = Number.isFinite(options.maxBytes) ? Math.max(256, options.maxBytes) : 64 * 1024;
  const maxLines = Number.isFinite(options.maxLines) ? Math.max(1, options.maxLines) : 80;

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return '';
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    const descriptor = fs.openSync(filePath, 'r');
    try {
      fs.readSync(descriptor, buffer, 0, length, stat.size - length);
    } finally {
      fs.closeSync(descriptor);
    }
    const text = buffer.toString('utf8').replace(/^\uFFFD+/, '');
    return text.split(/\r?\n/).slice(-maxLines).join('\n').trim();
  } catch {
    return '';
  }
}

function buildDiagnosticsReport(input = {}) {
  const tools = input.tools && typeof input.tools === 'object' ? input.tools : {};
  const toolLines = Object.entries(tools).map(([key, value]) => {
    const name = TOOL_NAMES[key] || key;
    const available = Boolean(value?.available);
    const version = value?.version ? ` - ${sanitizeDiagnosticText(value.version, { maxLength: 200 })}` : '';
    return `- ${name}: ${available ? 'ready' : 'missing'}${version}`;
  });
  const generatedAt = input.now instanceof Date ? input.now : new Date();
  const startupLog = input.startupLogTail
    ? sanitizeDiagnosticText(input.startupLogTail, { maxLength: 12000 })
    : '(no startup errors recorded)';

  return sanitizeDiagnosticText([
    'OmniForge diagnostics',
    `Generated: ${generatedAt.toISOString()}`,
    `App version: ${input.appVersion || 'unknown'}`,
    `Platform: ${input.platform || process.platform} ${input.arch || process.arch}`,
    `Electron: ${input.electronVersion || 'unknown'}`,
    `Node: ${input.nodeVersion || process.versions.node}`,
    `Active queue items: ${Math.max(0, Number(input.queueActive) || 0)}`,
    `Job history entries: ${Math.max(0, Number(input.historyCount) || 0)}`,
    '',
    'Bundled engines:',
    ...(toolLines.length ? toolLines : ['- No engine data available.']),
    '',
    'Recent startup log:',
    startupLog
  ].join('\n'), { maxLength: 20000 });
}

module.exports = {
  sanitizeDiagnosticText,
  readStartupLogTail,
  buildDiagnosticsReport
};
