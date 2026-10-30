'use strict';

const STUDIO_RATIOS = [
  { id: 'original', label: 'Original', suffix: '', width: null, height: null },
  { id: 'landscape', label: '16:9 · Landscape', shortLabel: '16:9', suffix: '16x9', width: 1920, height: 1080 },
  { id: 'portrait', label: '9:16 · Shorts', shortLabel: '9:16', suffix: '9x16', width: 1080, height: 1920 },
  { id: 'square', label: '1:1 · Square', shortLabel: '1:1', suffix: '1x1', width: 1080, height: 1080 },
  { id: 'portrait45', label: '4:5 · Portrait', shortLabel: '4:5', suffix: '4x5', width: 1080, height: 1350 }
];

const STUDIO_RATIO_IDS = STUDIO_RATIOS.map((ratio) => ratio.id);
const STUDIO_FRAMING_MODES = ['fill', 'fit', 'blur'];

function studioRatio(id) {
  return STUDIO_RATIOS.find((ratio) => ratio.id === id) || STUDIO_RATIOS[0];
}

function normalizeStudioRatios(input) {
  if (!Array.isArray(input)) return ['original'];
  const selected = [];
  for (const value of input) {
    const id = String(value || '').trim();
    if (STUDIO_RATIO_IDS.includes(id) && !selected.includes(id)) selected.push(id);
  }
  return selected.length ? selected : ['original'];
}

function normalizeStudioFraming(value) {
  const framing = String(value || '').toLowerCase();
  return STUDIO_FRAMING_MODES.includes(framing) ? framing : 'fill';
}

function buildStudioFramingFilter(ratioId, framing, captionFilter = '') {
  const ratio = studioRatio(ratioId);
  if (!ratio.width || !ratio.height) return captionFilter ? String(captionFilter) : '';
  const width = ratio.width;
  const height = ratio.height;
  const mode = normalizeStudioFraming(framing);
  let graph;
  if (mode === 'fit') {
    graph = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  } else if (mode === 'blur') {
    graph = [
      'split=2[bg][fg]',
      `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=24:2[bgblur]`,
      `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fgfit]`,
      '[bgblur][fgfit]overlay=(W-w)/2:(H-h)/2,setsar=1'
    ].join(';');
  } else {
    graph = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
  }
  return captionFilter ? `${graph},${captionFilter}` : graph;
}

function fitAssToFrame(ass, ratioId) {
  const ratio = studioRatio(ratioId);
  if (!ratio.width || !ratio.height) return String(ass);
  const width = ratio.width;
  const height = ratio.height;
  const horizontalMargin = Math.max(32, Math.round(width * 0.04));
  const verticalMargin = Math.max(32, Math.round(height * 0.04));
  return String(ass)
    .replace('PlayResX: 960', `PlayResX: ${width}`)
    .replace('PlayResY: 540', `PlayResY: ${height}`)
    .replace(/,40,40,24,1(?=\r?\n)/, `,${horizontalMargin},${horizontalMargin},${verticalMargin},1`);
}

module.exports = {
  STUDIO_RATIOS,
  STUDIO_RATIO_IDS,
  STUDIO_FRAMING_MODES,
  studioRatio,
  normalizeStudioRatios,
  normalizeStudioFraming,
  buildStudioFramingFilter,
  fitAssToFrame
};
