'use strict';

const SPEED_UNITS = new Set(['x', 'B/s']);
const SAMPLE_WINDOW_MS = 30_000;
const MAX_SAMPLES = 120;
const MAX_ETA_MS = 24 * 60 * 60 * 1000;

function normalizeJobSpeed(input) {
  if (!input || typeof input !== 'object') return null;
  const value = Number(input.value);
  const unit = String(input.unit || '');
  if (!Number.isFinite(value) || value <= 0 || !SPEED_UNITS.has(unit)) return null;
  return { value, unit };
}

function parseFfmpegSpeed(value) {
  const match = String(value || '').trim().match(/^([\d.]+)x$/i);
  if (!match) return null;
  return normalizeJobSpeed({ value: Number(match[1]), unit: 'x' });
}

function appendProgressSample(samples, progress, now = Date.now()) {
  const list = Array.isArray(samples) ? samples.slice() : [];
  const value = Number(progress);
  if (!Number.isFinite(value)) return list;
  const last = list[list.length - 1];
  if (!last || last.progress !== value) list.push({ at: now, progress: value });
  return list.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS).slice(-MAX_SAMPLES);
}

function estimateEtaMs(samples, now = Date.now()) {
  if (!Array.isArray(samples)) return null;
  const recent = samples
    .filter((sample) => sample && Number.isFinite(Number(sample.at)) && Number.isFinite(Number(sample.progress)))
    .filter((sample) => now - Number(sample.at) <= SAMPLE_WINDOW_MS)
    .sort((left, right) => left.at - right.at);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (last.progress <= first.progress || last.progress >= 100) return null;
  const elapsedMs = Number(last.at) - Number(first.at);
  if (elapsedMs < 2_000) return null;
  const rate = (Number(last.progress) - Number(first.progress)) / elapsedMs;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const remaining = 100 - Number(last.progress);
  const etaMs = remaining / rate;
  if (!Number.isFinite(etaMs) || etaMs <= 0) return null;
  return Math.max(1_000, Math.min(MAX_ETA_MS, Math.round(etaMs)));
}

module.exports = {
  normalizeJobSpeed,
  parseFfmpegSpeed,
  appendProgressSample,
  estimateEtaMs
};
