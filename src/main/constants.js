'use strict';

const OUTPUT_GROUPS = [
  {
    id: 'video',
    label: 'Video',
    formats: [
      { value: 'mp4', label: 'MP4', hint: 'H.264 + AAC · most compatible' },
      { value: 'mkv', label: 'MKV', hint: 'H.264 + AAC · flexible container' },
      { value: 'webm', label: 'WebM', hint: 'VP9 + Opus · web-friendly' },
      { value: 'mov', label: 'MOV', hint: 'H.264 + AAC · Apple-friendly' },
      { value: 'avi', label: 'AVI', hint: 'MPEG-4 + MP3 · legacy-friendly' },
      { value: 'gif', label: 'GIF', hint: 'Animated, optimized palette' }
    ]
  },
  {
    id: 'audio',
    label: 'Audio',
    formats: [
      { value: 'mp3', label: 'MP3', hint: 'Universal lossy audio' },
      { value: 'wav', label: 'WAV', hint: 'Uncompressed PCM' },
      { value: 'flac', label: 'FLAC', hint: 'Lossless compressed' },
      { value: 'm4a', label: 'M4A', hint: 'AAC audio' },
      { value: 'ogg', label: 'OGG', hint: 'Vorbis audio' },
      { value: 'opus', label: 'OPUS', hint: 'Efficient modern audio' }
    ]
  },
  {
    id: 'image',
    label: 'Image',
    formats: [
      { value: 'png', label: 'PNG', hint: 'Lossless with transparency' },
      { value: 'jpg', label: 'JPG', hint: 'Compact photographs' },
      { value: 'webp', label: 'WEBP', hint: 'Modern web image' },
      { value: 'avif', label: 'AVIF', hint: 'Next-gen compression' },
      { value: 'bmp', label: 'BMP', hint: 'Uncompressed bitmap' },
      { value: 'tiff', label: 'TIFF', hint: 'Print and archival' },
      { value: 'ico', label: 'ICO', hint: 'Windows application icon' }
    ]
  },
  {
    id: 'data',
    label: 'Data',
    formats: [
      { value: 'json', label: 'JSON', hint: 'Structured data' },
      { value: 'csv', label: 'CSV', hint: 'Comma-separated values' },
      { value: 'tsv', label: 'TSV', hint: 'Tab-separated values' },
      { value: 'yaml', label: 'YAML', hint: 'Human-readable configuration' },
      { value: 'xml', label: 'XML', hint: 'Markup data' }
    ]
  }
];

const OUTPUT_FORMATS = Object.fromEntries(
  OUTPUT_GROUPS.flatMap((group) =>
    group.formats.map((format) => [format.value, { ...format, category: group.id }])
  )
);

const INPUT_EXTENSIONS = {
  video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp', 'ogv'],
  audio: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'alac', 'amr'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'ico', 'svg', 'heic', 'heif', 'jxl', 'tga', 'ppm', 'pgm'],
  data: ['json', 'csv', 'tsv', 'yaml', 'yml', 'xml'],
  pdf: ['pdf'],
  archive: ['zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'rar', 'iso', 'cab'],
  encrypted: ['ofenc']
};

const MEDIA_FORMAT_ORDER = ['video', 'audio', 'image'];
const DATA_FORMAT_ORDER = ['data'];
const ARCHIVE_FORMATS = ['zip', '7z', 'tar', 'tar.gz', 'gz'];

const QUALITY_PRESETS = [
  { value: 'high', label: 'High quality', hint: 'Larger output' },
  { value: 'balanced', label: 'Balanced', hint: 'Recommended' },
  { value: 'small', label: 'Small file', hint: 'Faster sharing' }
];

const TOOL_LABELS = {
  youtube: 'YouTube Downloader',
  convert: 'Universal Converter',
  compress: 'Media Compressor',
  trim: 'Video / Audio Trimmer',
  join: 'Media Joiner',
  normalize: 'Audio Normalizer',
  frames: 'Frame Extractor',
  extract: 'Audio Extractor',
  gif: 'GIF Studio',
  pdf: 'PDF Toolkit',
  archive: 'Archive Toolkit',
  encryptor: 'File Encryptor',
  checksum: 'Checksum Verifier',
  info: 'Media Inspector',
  transcribe: 'Audio to Text'
};

function extensionOf(filePath) {
  const name = String(filePath || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

function formatCategory(ext) {
  const value = String(ext || '').toLowerCase().replace(/^\./, '');
  if (OUTPUT_FORMATS[value]) return OUTPUT_FORMATS[value].category;
  for (const [category, extensions] of Object.entries(INPUT_EXTENSIONS)) {
    if (extensions.includes(value)) return category;
  }
  return 'unknown';
}

function isKnownExtension(ext) {
  return formatCategory(ext) !== 'unknown';
}

module.exports = {
  OUTPUT_GROUPS,
  OUTPUT_FORMATS,
  INPUT_EXTENSIONS,
  MEDIA_FORMAT_ORDER,
  DATA_FORMAT_ORDER,
  ARCHIVE_FORMATS,
  QUALITY_PRESETS,
  TOOL_LABELS,
  extensionOf,
  formatCategory,
  isKnownExtension
};
