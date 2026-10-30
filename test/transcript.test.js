'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  timestampToMs,
  msToTimestamp,
  parseSrt,
  parseVtt,
  normalizeSegments,
  serializeSrt,
  serializeVtt,
  clipSegments,
  normalizeCaptionStyle,
  assColor,
  escapeAssText,
  buildAss
} = require('../src/main/transcript');

test('SRT parser handles BOM, CRLF, multiline cues, and entities', () => {
  const parsed = parseSrt('\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\nHello\r\nworld &amp; friends\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nSecond cue\r\n');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].startMs, 1250);
  assert.equal(parsed[0].endMs, 3500);
  assert.equal(parsed[0].text, 'Hello\nworld & friends');
  assert.equal(parsed[1].text, 'Second cue');
  assert.match(parsed[0].id, /^[0-9a-f-]{36}$/i);
});

test('VTT parser removes tags and cue settings while skipping metadata blocks', () => {
  const parsed = parseVtt(`WEBVTT - demo

NOTE This is ignored
even with text

STYLE
::cue { color: white }

intro
00:00:01.000 --> 00:00:02.250 align:start position:10%
<v Ada>Hello</v> &amp; <c.green>Grace</c>

00:00:03.000 --> 00:00:04.000
Line one
Line two
`);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'Hello & Grace');
  assert.equal(parsed[1].text, 'Line one\nLine two');
});

test('transcript parsers reject empty and malformed input', () => {
  assert.throws(() => parseSrt(''), /empty/);
  assert.throws(() => parseSrt('not a transcript'), /No valid timed/);
  assert.throws(() => parseVtt('WEBVTT\n\nNOTE only metadata'), /No valid timed/);
  assert.throws(() => parseSrt('1\n00:00:03,000 --> 00:00:02,000\nInvalid\n'), /No valid timed/);
});

test('SRT and VTT serialization round-trip timing and text', () => {
  const segments = normalizeSegments([
    { id: 'first', startMs: 1000, endMs: 2500, text: 'Hello & welcome' },
    { id: 'second', startMs: 3000, endMs: 4200, text: 'Second line\nwith detail' }
  ]);
  const srt = serializeSrt(segments);
  const vtt = serializeVtt(segments);
  assert.match(srt, /00:00:01,000 --> 00:00:02,500/);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:03.000 --> 00:00:04.200/);
  assert.deepEqual(parseSrt(srt).map(({ startMs, endMs, text }) => ({ startMs, endMs, text })), segments.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })));
  assert.deepEqual(parseVtt(vtt).map(({ startMs, endMs, text }) => ({ startMs, endMs, text })), segments.map(({ startMs, endMs, text }) => ({ startMs, endMs, text })));
});

test('clip segments are clipped and shifted to clip-relative time', () => {
  const shifted = clipSegments([
    { id: 'a', startMs: 1000, endMs: 2000, text: 'First' },
    { id: 'b', startMs: 2500, endMs: 4000, text: 'Second' },
    { id: 'c', startMs: 5000, endMs: 6000, text: 'Third' }
  ], 1500, 3200);
  assert.deepEqual(shifted, [
    { id: 'a', startMs: 0, endMs: 500, text: 'First' },
    { id: 'b', startMs: 1000, endMs: 1700, text: 'Second' }
  ]);
});

test('timestamps and caption styles are normalized', () => {
  assert.equal(timestampToMs('01:02:03,456'), 3723456);
  assert.equal(timestampToMs('02:03.500'), 123500);
  assert.equal(timestampToMs('-01:00:00.000'), null);
  assert.equal(msToTimestamp(3723456), '01:02:03,456');
  assert.deepEqual(normalizeCaptionStyle({ fontSize: 99, color: '#12abEF', outline: 9, position: 'center' }), {
    fontSize: 48,
    color: '#12ABEF',
    outline: 4,
    position: 'center'
  });
  assert.equal(normalizeCaptionStyle({ fontSize: 4, color: 'red', outline: -2, position: 'sideways' }).fontSize, 16);
  assert.equal(assColor('#00FF00'), '&H0000FF00');
  assert.equal(escapeAssText('Use {braces}\nand \\ slashes'), 'Use \\{braces\\}\\Nand \\\\ slashes');
});

test('ASS generation applies position, colors, and escaped dialogue', () => {
  const ass = buildAss([
    { id: 'one', startMs: 1000, endMs: 2000, text: 'Use {braces}\n& commas, okay' }
  ], { fontSize: 32, color: '#00FF00', outline: 3, position: 'top' });
  assert.match(ass, /Style: Default,Segoe UI,32,&H0000FF00/);
  assert.match(ass, /,3,0,8,40,40,24,1/);
  assert.match(ass, /Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Use \\\{braces\\\}\\N& commas, okay/);
});
