'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  sanitizeDiagnosticText,
  readStartupLogTail,
  buildDiagnosticsReport
} = require('../src/main/diagnostics');

test('diagnostic text redacts URLs, paths, identities, and credentials', () => {
  const source = [
    'Request failed for https://alice:secret@example.com/private?token=abc',
    'Input C:\\Users\\Alice\\Videos\\private clip.mp4',
    'Share \\\\server\\share\\private.txt',
    'Home /home/alice/.ssh/id_rsa',
    'Contact alice@example.com',
    'password=hunter2',
    'Authorization: Bearer abcdefghijklmnop',
    'GitHub ghp_123456789012345678901234567890'
  ].join('\n');

  const redacted = sanitizeDiagnosticText(source);
  assert.match(redacted, /\[url\]/);
  assert.match(redacted, /\[path\]/);
  assert.match(redacted, /\[email\]/);
  assert.match(redacted, /password=\[redacted\]/);
  assert.match(redacted, /Bearer \[redacted\]/);
  assert.match(redacted, /\[token\]/);
  assert.doesNotMatch(redacted, /alice|Alice|server|hunter2|example\.com|private\.txt|id_rsa/);
});

test('startup log tail is bounded and returns the newest lines', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-diagnostics-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const logPath = path.join(directory, 'startup-errors.log');
  fs.writeFileSync(logPath, Array.from({ length: 12 }, (_, index) => `line-${index + 1}`).join('\n'), 'utf8');

  const tail = readStartupLogTail(logPath, { maxLines: 4 });
  assert.deepEqual(tail.split('\n'), ['line-9', 'line-10', 'line-11', 'line-12']);
  assert.equal(readStartupLogTail(path.join(directory, 'missing.log')), '');
});

test('diagnostics report includes versions, engines, counts, and a redacted log', () => {
  const report = buildDiagnosticsReport({
    appVersion: '1.6.4',
    platform: 'win32',
    arch: 'x64',
    electronVersion: '38.0.0',
    nodeVersion: '22.0.0',
    tools: {
      ffmpeg: { available: true, version: 'ffmpeg 7.0' },
      ytDlp: { available: false, version: null }
    },
    queueActive: 2,
    historyCount: 9,
    startupLogTail: 'Failed at C:\\Users\\Alice\\private.log',
    now: new Date('2026-11-01T12:00:00.000Z')
  });

  assert.match(report, /App version: 1\.6\.4/);
  assert.match(report, /Platform: win32 x64/);
  assert.match(report, /FFmpeg: ready - ffmpeg 7\.0/);
  assert.match(report, /yt-dlp: missing/);
  assert.match(report, /Active queue items: 2/);
  assert.match(report, /Job history entries: 9/);
  assert.match(report, /Recent startup log:\nFailed at \[path\]/);
  assert.doesNotMatch(report, /Alice/);
});
