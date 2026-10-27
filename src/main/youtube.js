'use strict';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

function isSupportedYouTubeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    return YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function parseYouTubeProgressLine(line) {
  const text = String(line || '').trim();
  if (text.startsWith('MTDL|')) {
    const [, downloaded, total, estimate, speed, eta] = text.split('|');
    const downloadedBytes = Number(downloaded) || 0;
    const totalBytes = Number(total) || Number(estimate) || 0;
    return {
      percent: totalBytes > 0 ? Math.min(0.99, downloadedBytes / totalBytes) : null,
      downloadedBytes,
      totalBytes,
      speed: Number(speed) || 0,
      eta: Number(eta) || 0
    };
  }
  const match = text.match(/\[download\]\s+([\d.]+)%/i);
  if (match) return { percent: Math.min(0.99, Number(match[1]) / 100) };
  if (/\[Merger\]|\[ExtractAudio\]|\[Metadata\]/i.test(text)) return { percent: 0.96, postprocess: true };
  return null;
}

module.exports = { isSupportedYouTubeUrl, parseYouTubeProgressLine };
