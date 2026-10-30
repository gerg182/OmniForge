'use strict';

const crypto = require('crypto');

const MAX_SEGMENTS = 20000;
const MAX_SEGMENT_TEXT = 20000;
const CAPTION_POSITIONS = ['bottom', 'center', 'top'];
const DEFAULT_CAPTION_STYLE = {
  fontSize: 24,
  color: '#FFFFFF',
  outline: 2,
  position: 'bottom'
};

function timestampToMs(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const secondsPart = Number(parts.pop());
  const minutesPart = Number(parts.pop());
  const hoursPart = parts.length ? Number(parts.pop()) : 0;
  if (![secondsPart, minutesPart, hoursPart].every(Number.isFinite)) return null;
  if (hoursPart < 0) return null;
  if (minutesPart < 0 || minutesPart >= 60 || secondsPart < 0 || secondsPart >= 60) return null;
  return Math.round(((hoursPart * 3600) + (minutesPart * 60) + secondsPart) * 1000);
}

function msToTimestamp(value, separator = ',') {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const milliseconds = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`;
}

function msToAssTime(value) {
  const total = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanCueText(value, format) {
  let text = String(value || '');
  if (format === 'vtt') text = text.replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
    .slice(0, MAX_SEGMENT_TEXT);
}

function parseCues(text, format) {
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!source) throw new Error('The transcript file is empty.');
  const blocks = source.split(/\n{2,}/);
  const segments = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;
    if (format === 'vtt' && /^WEBVTT(?:\s|$)/i.test(block)) continue;
    if (format === 'vtt' && /^(NOTE|STYLE|REGION)(?:\s|$)/i.test(block)) continue;
    const lines = block.split('\n').map((line) => line.trim());
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex === -1) continue;
    const match = lines[timeIndex].match(/^(\S+)\s*-->\s*(\S+)/);
    if (!match) continue;
    const startMs = timestampToMs(match[1]);
    const endMs = timestampToMs(match[2]);
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    const cueText = cleanCueText(lines.slice(timeIndex + 1).join('\n'), format);
    if (!cueText) continue;
    segments.push({
      id: crypto.randomUUID(),
      startMs,
      endMs,
      text: cueText
    });
  }

  if (!segments.length) throw new Error('No valid timed transcript cues were found.');
  segments.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  return segments.slice(0, MAX_SEGMENTS);
}

function parseSrt(text) {
  return parseCues(text, 'srt');
}

function parseVtt(text) {
  return parseCues(text, 'vtt');
}

function parseTranscript(text, format) {
  const value = String(format || '').toLowerCase().replace(/^\./, '');
  if (value === 'srt') return parseSrt(text);
  if (value === 'vtt') return parseVtt(text);
  throw new Error('Choose an SRT or VTT transcript.');
}

function normalizeSegments(input, { assignIds = true } = {}) {
  if (!Array.isArray(input)) return [];
  const segments = [];
  for (const entry of input.slice(0, MAX_SEGMENTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const startMs = Math.max(0, Math.round(Number(entry.startMs)));
    const endMs = Math.max(0, Math.round(Number(entry.endMs)));
    const text = String(entry.text ?? '').trim().slice(0, MAX_SEGMENT_TEXT);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || !text) continue;
    segments.push({
      id: String(entry.id || (assignIds ? crypto.randomUUID() : '')).slice(0, 120),
      startMs,
      endMs,
      text
    });
  }
  segments.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  return segments;
}

function serializeSrt(input) {
  return normalizeSegments(input).map((segment, index) => [
    String(index + 1),
    `${msToTimestamp(segment.startMs)} --> ${msToTimestamp(segment.endMs)}`,
    segment.text
  ].join('\n')).join('\n\n') + '\n';
}

function serializeVtt(input) {
  const cues = normalizeSegments(input).map((segment, index) => [
    String(index + 1),
    `${msToTimestamp(segment.startMs, '.')} --> ${msToTimestamp(segment.endMs, '.')}`,
    segment.text
  ].join('\n')).join('\n\n');
  return `WEBVTT\n\n${cues}${cues ? '\n' : ''}`;
}

function serializeTranscript(input, format) {
  const value = String(format || '').toLowerCase().replace(/^\./, '');
  if (value === 'srt') return serializeSrt(input);
  if (value === 'vtt') return serializeVtt(input);
  throw new Error('Choose SRT or VTT for transcript output.');
}

function clipSegments(input, startMs, endMs) {
  const start = Math.max(0, Math.round(Number(startMs)));
  const end = Math.max(start + 1, Math.round(Number(endMs)));
  return normalizeSegments(input)
    .filter((segment) => segment.endMs > start && segment.startMs < end)
    .map((segment) => ({
      id: segment.id,
      startMs: Math.max(segment.startMs, start) - start,
      endMs: Math.min(segment.endMs, end) - start,
      text: segment.text
    }));
}

function normalizeCaptionStyle(input = {}) {
  const fontSize = Math.round(Number(input.fontSize) || DEFAULT_CAPTION_STYLE.fontSize);
  const outline = Number(input.outline);
  const color = /^#[0-9a-f]{6}$/i.test(String(input.color || '')) ? String(input.color).toUpperCase() : DEFAULT_CAPTION_STYLE.color;
  return {
    fontSize: Math.max(16, Math.min(48, fontSize)),
    color,
    outline: Number.isFinite(outline) ? Math.max(0, Math.min(4, outline)) : DEFAULT_CAPTION_STYLE.outline,
    position: CAPTION_POSITIONS.includes(input.position) ? input.position : DEFAULT_CAPTION_STYLE.position
  };
}

function assColor(value) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).slice(1) : 'FFFFFF';
  const red = color.slice(0, 2);
  const green = color.slice(2, 4);
  const blue = color.slice(4, 6);
  return `&H00${blue}${green}${red}`.toUpperCase();
}

function escapeAssText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\N');
}

function buildAss(input, styleInput = {}) {
  const style = normalizeCaptionStyle(styleInput);
  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 960',
    'PlayResY: 540',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,Segoe UI,${style.fontSize},${assColor(style.color)},${assColor(style.color)},&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,${style.outline},0,${alignment},40,40,24,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];
  const events = normalizeSegments(input).map((segment) => (
    `Dialogue: 0,${msToAssTime(segment.startMs)},${msToAssTime(segment.endMs)},Default,,0,0,0,,${escapeAssText(segment.text)}`
  ));
  return `${header.join('\n')}\n${events.join('\n')}${events.length ? '\n' : ''}`;
}

module.exports = {
  MAX_SEGMENTS,
  CAPTION_POSITIONS,
  DEFAULT_CAPTION_STYLE,
  timestampToMs,
  msToTimestamp,
  msToAssTime,
  parseSrt,
  parseVtt,
  parseTranscript,
  normalizeSegments,
  serializeSrt,
  serializeVtt,
  serializeTranscript,
  clipSegments,
  normalizeCaptionStyle,
  assColor,
  escapeAssText,
  buildAss
};
