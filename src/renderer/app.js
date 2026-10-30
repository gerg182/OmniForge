import { suggestDropTools, filterCommandItems, fitPreviewFrame, toggleAllSelection, formatJobEta, formatJobSpeed } from './workflow.mjs';

const api = window.omniforge;
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  convert: '<path d="M4 7h11"/><path d="m12 4 3 3-3 3"/><path d="M20 17H9"/><path d="m12 14-3 3 3 3"/>',
  merge: '<path d="M5 4v4a5 5 0 0 0 5 5h10"/><path d="m16 9 4 4-4 4"/><path d="M5 20v-4a5 5 0 0 1 5-5"/>',
  frames: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14"/><path d="M17 5v14"/><path d="M3 9h4"/><path d="M17 9h4"/><path d="M3 15h4"/><path d="M17 15h4"/>',
  wave: '<path d="M3 12h2l2-6 3 12 3-16 3 14 2-4h3"/>',
  compress: '<path d="M9 4v4H5"/><path d="m4 8 4-4"/><path d="M15 4v4h4"/><path d="m20 8-4-4"/><path d="M9 20v-4H5"/><path d="m4 16 4 4"/><path d="M15 20v-4h4"/><path d="m20 16-4 4"/>',
  scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m20 4-9 9"/><path d="m20 20-9-9"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  gif: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 10h3v4H8z"/><path d="M15 10h3"/><path d="M18 10v4"/><path d="M5.5 6.5h.01"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 16h2a2 2 0 0 0 0-4H8v6"/><path d="M14 12v4"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/>',
  hash: '<path d="M9 3 8 21"/><path d="M16 3l-1 18"/><path d="M4 9h17"/><path d="M3 15h17"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.62.7 1.05 1.55 1.05H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
  queue: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 14h10l1-14"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-4L3 10"/><path d="M3 4v6h6"/><path d="M4 13a8 8 0 0 0 14.9 4l2.1-3"/><path d="M21 20v-6h-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16"/><path d="M17 4v16"/><path d="M3 9h4"/><path d="M17 9h4"/><path d="M3 15h4"/><path d="M17 15h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  braces: '<path d="M8 3H6a3 3 0 0 0-3 3v3a3 3 0 0 1-3 3 3 3 0 0 1 3 3v3a3 3 0 0 0 3 3h2"/><path d="M16 3h2a3 3 0 0 1 3 3v3a3 3 0 0 0 3 3 3 3 0 0 0-3 3v3a3 3 0 0 1-3 3h-2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  harddrive: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h.01"/><path d="M11 15h.01"/><path d="M3 12h18"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4"/><path d="M21 18h-4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  captions: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h4"/><path d="M7 14h7"/><path d="M14 10h3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>'
};

function icon(name, className = '') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
}

const VIEW_META = {
  home: ['Workspace', 'Overview'],
  youtube: ['Download', 'YouTube Downloader'],
  convert: ['Convert', 'Universal Converter'],
  compress: ['Media', 'Compress Files'],
  trim: ['Media', 'Trim & Clip'],
  join: ['Media', 'Media Joiner'],
  normalize: ['Media', 'Audio Normalizer'],
  frames: ['Media', 'Frame Extractor'],
  extract: ['Media', 'Extract Audio'],
  gif: ['Media', 'GIF Studio'],
  pdf: ['Files', 'PDF Toolkit'],
  archive: ['Files', 'Archives'],
  encryptor: ['Files', 'File Encryptor'],
  checksum: ['Files', 'Checksum Verifier'],
  info: ['Files', 'Media Inspector'],
  metadata: ['Privacy', 'Metadata Stripper'],
  shred: ['Privacy', 'Secure Delete'],
  studio: ['Speech', 'Transcript Clip Studio'],
  transcribe: ['Speech', 'Audio to Text'],
  dictation: ['Speech', 'Dictation'],
  settings: ['System', 'Settings']
};

const TOOL_ICONS = {
  youtube: 'download', convert: 'convert', compress: 'compress', trim: 'scissors', extract: 'music',
  join: 'merge', normalize: 'wave', frames: 'frames', gif: 'gif', pdf: 'pdf', archive: 'archive', encryptor: 'shield', checksum: 'hash', info: 'info', transcribe: 'mic', studio: 'captions', metadata: 'file', shred: 'harddrive'
};

const TOOL_COLORS = {
  youtube: '#ff8c8c', convert: '#c9ff51', compress: '#66e9ff', trim: '#74ffb2', join: '#ff9f6b',
  extract: '#ffc857', normalize: '#66e9ff', gif: '#b18cff', frames: '#b18cff', pdf: '#ff8c8c',
  archive: '#7a9cff', encryptor: '#ff8c8c', checksum: '#f3a6ff', info: '#9aa6ba', transcribe: '#74ffb2', studio: '#c9ff51',
  metadata: '#c9ff51', shred: '#ff8c8c'
};

const STUDIO_RATIOS = [
  { id: 'original', label: 'Original', shortLabel: 'Original', suffix: '', width: null, height: null },
  { id: 'landscape', label: '16:9 · Landscape', shortLabel: '16:9', suffix: '16x9', width: 1920, height: 1080 },
  { id: 'portrait', label: '9:16 · Shorts', shortLabel: '9:16', suffix: '9x16', width: 1080, height: 1920 },
  { id: 'square', label: '1:1 · Square', shortLabel: '1:1', suffix: '1x1', width: 1080, height: 1080 },
  { id: 'portrait45', label: '4:5 · Portrait', shortLabel: '4:5', suffix: '4x5', width: 1080, height: 1350 }
];

const STUDIO_FRAMING_MODES = [
  { id: 'fill', label: 'Fill', description: 'Crop to fill the frame.' },
  { id: 'fit', label: 'Fit', description: 'Keep the whole frame with letterboxing.' },
  { id: 'blur', label: 'Blur', description: 'Fill the frame with a blurred backdrop.' }
];

const ALLOWED_CATEGORIES = {
  convert: ['video', 'audio', 'image', 'data'],
  compress: ['video', 'audio', 'image'],
  trim: ['video', 'audio'],
  join: ['video', 'audio'],
  normalize: ['video', 'audio'],
  frames: ['video'],
  extract: ['video', 'audio'],
  gif: ['video'],
  pdf: ['pdf'],
  archive: null,
  encryptor: null,
  checksum: null,
  info: null,
  metadata: ['image', 'audio', 'video'],
  shred: null,
  transcribe: ['audio', 'video'],
  studio: ['audio', 'video']
};

const GUIDES = {
  convert: { icon: 'convert', title: 'One converter, every direction', text: 'FFmpeg handles media while a native data engine handles structured files. Everything runs on your PC.', steps: [['Choose files', 'Drop a batch or pick files from disk.'], ['Pick a format', 'Video, audio, image, or structured data.'], ['Convert', 'Choose an output folder and let the queue work.']] },
  compress: { icon: 'compress', title: 'Smaller files, same idea', text: 'Use a quality preset for predictable results, or set a target size for video and audio.', steps: [['Add media', 'Video, audio, and images are supported.'], ['Choose a strategy', 'Quality preset or target file size.'], ['Compare', 'Files are saved beside each other in your chosen folder.']] },
  trim: { icon: 'scissors', title: 'Keep only the good part', text: 'Timestamps can be seconds (12.5) or clock values (00:01:12.5).', steps: [['Add clips', 'Video and audio files both work.'], ['Set a range', 'Enter a start and an end time.'], ['Render', 'The result is re-encoded for accurate cuts.']] },
  join: { icon: 'merge', title: 'Put the pieces together', text: 'Clips are normalized to matching video, audio, and frame settings before they are joined.', steps: [['Add two or more files', 'Use files of the same media type.'], ['Choose a result format', 'Video or audio output is available.'], ['Join', 'Clips play back-to-back in the selected order.']] },
  normalize: { icon: 'wave', title: 'Even out the volume', text: 'Loudness normalization targets -16 LUFS with a -1.5 dB true-peak ceiling, a good fit for spoken audio and mixed clips.', steps: [['Add media', 'Video or audio files with an audio track.'], ['Choose a format', 'The audio track is re-encoded.'], ['Normalize', 'Quiet and loud sections move closer together.']] },
  frames: { icon: 'frames', title: 'Turn motion into stills', text: 'Extract one exact frame or a series of frames at a chosen interval.', steps: [['Add a video', 'Choose any video FFmpeg can read.'], ['Pick a moment or interval', 'Use 00:00:05.500 for one frame, or 1 second for a series.'], ['Extract', 'Single frames are saved as images; intervals create a folder.']] },
  extract: { icon: 'music', title: 'Pull the soundtrack out', text: 'Choose MP3 for compatibility or FLAC for a lossless copy when the source allows it.', steps: [['Add video', 'Any FFmpeg-readable video works.'], ['Choose audio', 'MP3, WAV, FLAC, M4A, OGG, or Opus.'], ['Extract', 'Only the audio stream is written.']] },
  gif: { icon: 'gif', title: 'Make a clean, small GIF', text: 'The palette is generated per clip for better color and file size than a basic conversion.', steps: [['Add a video', 'Pick the clip you want to animate.'], ['Set the moment', 'Start time, duration, frame rate, and width.'], ['Create', 'A palette-optimized GIF is generated.']] },
  pdf: { icon: 'pdf', title: 'PDFs without uploads', text: 'Merge, split, extract, reorder, or rotate pages locally. Encrypted PDFs are not supported.', steps: [['Add PDFs', 'Merge uses every selected file.'], ['Choose an action', 'Page ranges look like 1-3,5.'], ['Save', 'New PDFs are written to your chosen folder.']] },
  archive: { icon: 'archive', title: 'Pack files or unpack archives', text: 'Create ZIP, 7Z, TAR, TAR.GZ, or GZ archives and extract common archive formats.', steps: [['Add items', 'Select files to pack or archives to open.'], ['Choose a mode', 'Create a new archive or extract an existing one.'], ['Finish', 'Extracted content gets its own folder.']] },
  encryptor: { icon: 'shield', title: 'Encrypt files before they travel', text: 'AES-256-GCM with an scrypt-derived key encrypts the contents and authenticates the stored metadata. Everything runs locally.', steps: [['Add files', 'Encrypt anything, or choose .ofenc files to restore.'], ['Set a password', 'Use at least 8 characters. OmniForge never stores it.'], ['Save', 'Decrypted files get their original names back.']] },
  checksum: { icon: 'hash', title: 'Verify that a file is intact', text: 'Checksums are calculated locally with streaming reads, so large files stay responsive.', steps: [['Add files', 'Any file type can be hashed.'], ['Pick algorithms', 'MD5, SHA-1, and SHA-256 can run together.'], ['Compare', 'Copy a digest and compare it with the source.']] },
  info: { icon: 'info', title: 'See what is inside', text: 'FFprobe reports container details, duration, bitrate, video dimensions, and audio properties.', steps: [['Add media', 'Video and audio files work best.'], ['Inspect', 'The whole probe result is summarized.'], ['Review', 'Open technical details directly in the app.']] },
  metadata: { icon: 'file', title: 'Leave less behind', text: 'Remove EXIF, XMP, IPTC, comments, and media tags while preserving image data and color profiles.', steps: [['Add media', 'JPEG, PNG, WebP, audio, and video are supported.'], ['Choose a folder', 'Cleaned copies get a _clean suffix.'], ['Clean', 'Streams are copied without re-encoding media.']] },
  shred: { icon: 'harddrive', title: 'Overwrite before deleting', text: 'Files are overwritten with random data, truncated, renamed, and removed. This is not a guarantee on SSDs or copies in backups and cloud storage.', steps: [['Add files', 'Directories and symbolic links are rejected.'], ['Choose passes', 'One, three, or seven passes; three is the default.'], ['Confirm', 'The original file is destroyed and cannot be recovered.']] },
  transcribe: { icon: 'mic', title: 'Turn speech into text', text: 'Whisper runs locally on your PC. Audio never leaves the machine and nothing is uploaded.', steps: [['Add audio or video', 'Drop a recording, podcast, or video file.'], ['Pick a language', 'Auto-detect works for most recordings.'], ['Transcribe', 'Save a plain TXT or timed SRT transcript.']] },
  studio: { icon: 'captions', title: 'Edit video by its words', text: 'Transcribe locally, select sentences, and turn them into captioned clips without sending media anywhere.', steps: [['Load media', 'Transcribe with Whisper or import SRT/VTT.'], ['Select a range', 'Click a line, then Shift-click another.'], ['Render clips', 'Save trimmed media with optional captions.']] }
};

const state = {
  status: null,
  settings: null,
  history: [],
  view: 'home',
  files: { convert: [], compress: [], trim: [], join: [], normalize: [], frames: [], extract: [], gif: [], pdf: [], archive: [], encryptor: [], checksum: [], info: [], transcribe: [], studio: [], metadata: [], shred: [] },
  options: {
    convert: { targetFormat: 'mp4', quality: 'balanced', resolution: 'source' },
    compress: { mode: 'quality', quality: 'balanced', resolution: 'source', targetSizeMB: '25' },
    trim: { start: '00:00:00', end: '', outputFormat: 'mp4', quality: 'high' },
    join: { outputFormat: 'mp4', resolution: 'source', quality: 'high', joinName: '' },
    normalize: { audioFormat: 'mp3', quality: 'high' },
    frames: { imageFormat: 'png', mode: 'interval', interval: '1', timestamp: '00:00:05', maxFrames: '100', width: '0' },
    extract: { audioFormat: 'mp3', quality: 'high' },
    gif: { start: '00:00:00', duration: '5', fps: '12', width: '640' },
    pdf: { operation: 'merge', pages: '', rotation: '90' },
    archive: { operation: 'create', archiveFormat: 'zip', archiveName: '' },
    encryptor: { mode: 'encrypt', password: '', confirm: '' },
    checksum: { algorithms: ['sha256'] },
    info: {},
    metadata: {},
    shred: { passes: '3', acknowledged: false },
    transcribe: { language: 'auto', outputFormat: 'txt' },
    studio: { language: 'auto', exportFormat: 'srt' },
    dictation: { language: 'auto', outputFormat: 'txt' },
    youtube: { url: '', mode: 'video', quality: 'best', audioFormat: 'mp3' }
  },
  ytMeta: null,
  ytLoading: false,
  jobs: new Map(),
  results: [],
  queueOpen: false,
  queueFilter: 'all',
  updateInfo: null,
  updateChecking: false,
  updateProgress: null,
  updateDownloading: false,
  resetScroll: true,
  command: { open: false, index: 0, query: '', items: [], restoreFocus: null },
  recipesPopoverOpen: false,
  dropPicker: null,
  draggingFiles: false,
  studio: {
    project: null,
    projectPath: null,
    dirty: false,
    inspectorTab: 'clips',
    recovery: null,
    matchVideo: null,
    mediaUrl: '',
    mediaError: '',
    selectionAnchor: null,
    selectedIds: [],
    transcriptionJobId: null,
    busy: false,
    auditionEndMs: 0,
    pendingSeekMs: 0,
    recoveryTimer: null,
    previewObserver: null,
    search: '',
    previewRatio: 'original'
  },
  dictation: {
    recording: false,
    busy: false,
    elapsed: 0,
    startedAt: 0,
    timer: null,
    recorder: null,
    stream: null,
    chunks: [],
    error: '',
    lastTranscript: null,
    recordingPath: null
  }
};

const $ = (selector) => document.querySelector(selector);
const viewEl = $('#view');
const queueDrawer = $('#queue-drawer');
const queueOverlay = $('#queue-overlay');
let fileDragDepth = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** index;
  return `${scaled >= 10 || index === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`;
}

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function relativeTime(iso) {
  if (!iso) return '';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60000) return 'Just now';
  if (delta < 3600000) return `${Math.floor(delta / 60000)}m ago`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}h ago`;
  return `${Math.floor(delta / 86400000)}d ago`;
}

function extensionFor(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  if (lower.endsWith('.tar.bz2')) return 'tar.bz2';
  if (lower.endsWith('.tar.xz')) return 'tar.xz';
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot + 1);
}

function categoryFor(ext, name = '') {
  const value = String(ext || extensionFor(name)).toLowerCase();
  if (!state.status) return 'file';
  for (const [category, extensions] of Object.entries(state.status.inputExtensions)) {
    if (extensions.includes(value)) return category;
  }
  return 'file';
}

function categoryIcon(category) {
  return { video: 'film', audio: 'music', image: 'image', data: 'braces', pdf: 'pdf', archive: 'archive', encrypted: 'shield' }[category] || 'file';
}

function categoryColor(category) {
  return { video: '#66e9ff', audio: '#b18cff', image: '#74ffb2', data: '#ffc857', pdf: '#ff8c8c', archive: '#7a9cff', encrypted: '#ff8c8c' }[category] || '#838d9f';
}

function toolIcon(tool) {
  return TOOL_ICONS[tool] || 'file';
}

function setStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}

function showToast(message, type = 'info', timeout = 4400) {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `<span class="nav-icon">${icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info')}</span><span>${escapeHtml(message)}</span>`;
  $('#toasts').appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(5px)';
    setTimeout(() => node.remove(), 220);
  }, timeout);
}

function currentMeta() {
  return VIEW_META[state.view] || VIEW_META.home;
}

function navigate(view) {
  if (!VIEW_META[view]) return;
  closeRecipesPopover();
  if (state.view === 'encryptor' && view !== 'encryptor') {
    state.options.encryptor.password = '';
    state.options.encryptor.confirm = '';
  }
  state.view = view;
  state.resetScroll = true;
  closeQueue();
  updateShell();
  render();
}

function updateShell() {
  const [eyebrow, title] = currentMeta();
  $('#page-eyebrow').textContent = eyebrow;
  $('#page-title').textContent = title;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
  const engineCard = $('#engine-card');
  engineCard.classList.toggle('active', state.view === 'settings');
}

function availableRecipeTools() {
  return Array.isArray(state.status?.recipeTools)
    ? state.status.recipeTools
    : ['youtube', 'convert', 'compress', 'trim', 'join', 'extract', 'normalize', 'gif', 'frames', 'pdf', 'archive', 'checksum', 'transcribe'];
}

function savedRecipes() {
  return Array.isArray(state.settings?.recipes) ? state.settings.recipes : [];
}

function recipeToolLabel(tool) {
  return VIEW_META[tool]?.[1] || tool;
}

function updateRecipeBadge() {
  const count = savedRecipes().length;
  document.querySelectorAll('#recipe-count, [data-recipe-count]').forEach((element) => {
    element.textContent = String(count);
  });
}

async function persistRecipes(recipes) {
  state.settings = await api.saveSettings({ recipes });
  updateRecipeBadge();
  if (state.recipesPopoverOpen) renderRecipesPopover();
  if (state.view === 'settings') render();
}

function recipeRowsMarkup(recipes, compact = false) {
  if (!recipes.length) {
    return `<div class="recipe-empty">${icon('file')}<div><strong>No saved recipes</strong><span>Configure a tool, then save those options as a reusable preset.</span></div></div>`;
  }
  return recipes.map((recipe) => `<div class="recipe-item ${compact ? 'compact' : ''}">
    <span class="recipe-item-icon" style="--icon-color:${TOOL_COLORS[recipe.tool] || 'var(--muted)'}">${icon(TOOL_ICONS[recipe.tool] || 'file')}</span>
    <div class="recipe-item-copy"><strong>${escapeHtml(recipe.name)}</strong><span>${escapeHtml(recipeToolLabel(recipe.tool))} · ${Object.keys(recipe.options || {}).length} settings</span></div>
    <div class="recipe-item-actions"><button class="secondary-button" data-action="recipe-apply" data-id="${escapeHtml(recipe.id)}">Use</button><button class="ghost-button danger-text" data-action="recipe-delete" data-id="${escapeHtml(recipe.id)}">Delete</button></div>
  </div>`).join('');
}

function renderRecipesPopover() {
  const popover = $('#recipe-popover');
  if (!popover) return;
  const recipes = savedRecipes();
  const currentTool = state.view;
  const canSave = availableRecipeTools().includes(currentTool);
  const currentRecipes = recipes.filter((recipe) => recipe.tool === currentTool);
  const otherRecipes = recipes.filter((recipe) => recipe.tool !== currentTool);
  popover.innerHTML = `<div class="recipe-popover-head">
      <div><span class="eyebrow">Reusable options</span><h2>Tool recipes</h2></div>
      <button class="icon-button" data-action="recipe-popover-close" aria-label="Close recipes">${icon('x')}</button>
    </div>
    <div class="recipe-save-current">
      <div><strong>${canSave ? escapeHtml(recipeToolLabel(currentTool)) : 'Current view'}</strong><span>${canSave ? 'Save the settings on this page as a preset.' : 'Open a configurable tool to save its current settings.'}</span></div>
      <button class="primary-button" data-action="recipe-save-current" ${canSave ? '' : 'disabled'}>${icon('plus')} Save current</button>
    </div>
    <div class="recipe-list-label">${currentRecipes.length ? 'For this tool' : 'Saved recipes'}</div>
    ${recipeRowsMarkup(currentRecipes, true)}
    ${otherRecipes.length ? `<div class="recipe-list-label">Other tools</div>${recipeRowsMarkup(otherRecipes, true)}` : ''}
    <button class="recipe-manage-link" data-view="settings">Manage recipes in Settings</button>`;
}

function positionRecipesPopover() {
  const popover = $('#recipe-popover');
  const button = $('#recipes-button');
  if (!popover || !button) return;
  const rect = button.getBoundingClientRect();
  const width = Math.min(380, window.innerWidth - 24);
  popover.style.width = `${width}px`;
  popover.style.top = `${Math.round(rect.bottom + 8)}px`;
  popover.style.left = `${Math.round(Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width)))}px`;
}

function openRecipesPopover() {
  const popover = $('#recipe-popover');
  if (!popover) return;
  state.recipesPopoverOpen = true;
  renderRecipesPopover();
  popover.hidden = false;
  positionRecipesPopover();
}

function closeRecipesPopover() {
  const popover = $('#recipe-popover');
  state.recipesPopoverOpen = false;
  if (popover) popover.hidden = true;
}

function toggleRecipesPopover() {
  if (state.recipesPopoverOpen) closeRecipesPopover();
  else openRecipesPopover();
}

async function saveCurrentRecipe() {
  const tool = state.view;
  if (!availableRecipeTools().includes(tool)) {
    showToast('Open a configurable tool before saving a recipe.', 'error');
    return;
  }
  const suggested = `${recipeToolLabel(tool)} preset`;
  const entered = window.prompt('Name this recipe', suggested);
  const name = String(entered || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return;
  try {
    const now = new Date().toISOString();
    const existing = savedRecipes().find((recipe) => recipe.tool === tool && recipe.name.toLowerCase() === name.toLowerCase());
    const recipe = {
      id: existing?.id || globalThis.crypto?.randomUUID?.() || `recipe-${Date.now()}`,
      name,
      tool,
      options: JSON.parse(JSON.stringify(state.options[tool] || {})),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    const next = [recipe, ...savedRecipes().filter((entry) => entry.id !== recipe.id)];
    await persistRecipes(next);
    renderRecipesPopover();
    showToast(`Saved “${name}” for ${recipeToolLabel(tool)}.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

function applyRecipe(id) {
  const recipe = savedRecipes().find((entry) => entry.id === id);
  if (!recipe || !state.options[recipe.tool]) return;
  state.options[recipe.tool] = { ...state.options[recipe.tool], ...JSON.parse(JSON.stringify(recipe.options || {})) };
  closeRecipesPopover();
  navigate(recipe.tool);
  showToast(`Applied “${recipe.name}”.`, 'success', 2600);
}

async function deleteRecipe(id) {
  const recipe = savedRecipes().find((entry) => entry.id === id);
  if (!recipe) return;
  if (!window.confirm(`Delete the “${recipe.name}” recipe?`)) return;
  try {
    await persistRecipes(savedRecipes().filter((entry) => entry.id !== id));
    showToast('Recipe deleted.', 'success', 2400);
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

function commandItems() {
  const items = Object.entries(VIEW_META).map(([view, [eyebrow, title]]) => ({
    id: `view:${view}`,
    label: title,
    description: `${eyebrow} workspace`,
    keywords: [view, eyebrow, 'open', 'go', 'tool'],
    icon: TOOL_ICONS[view] || 'file',
    color: TOOL_COLORS[view] || 'var(--muted)',
    run: () => navigate(view)
  }));
  items.push(
    { id: 'action:queue', label: 'Open job queue', description: 'Review active and finished jobs', keywords: ['activity', 'jobs', 'queue'], icon: 'queue', color: 'var(--cyan)', run: openQueue },
    { id: 'action:updates', label: 'Check for updates', description: 'Look for a newer installer', keywords: ['update', 'installer', 'version'], icon: 'refresh', color: 'var(--warning)', run: () => checkForUpdates(true) }
  );
  if (availableRecipeTools().includes(state.view)) {
    items.push({ id: 'action:save-recipe', label: 'Save current settings as a recipe', description: `Capture ${recipeToolLabel(state.view)} options`, keywords: ['recipe', 'preset', 'save'], icon: 'plus', color: 'var(--lime)', run: saveCurrentRecipe });
  }
  for (const recipe of savedRecipes()) {
    items.push({
      id: `recipe:${recipe.id}`,
      label: `Apply recipe: ${recipe.name}`,
      description: recipeToolLabel(recipe.tool),
      keywords: [recipe.tool, 'recipe', 'preset', recipe.name],
      icon: TOOL_ICONS[recipe.tool] || 'file',
      color: TOOL_COLORS[recipe.tool] || 'var(--muted)',
      run: () => applyRecipe(recipe.id)
    });
  }
  return items;
}

function filteredCommandItems() {
  return filterCommandItems(state.command.items, state.command.query, 20);
}

function renderCommandResults() {
  const results = filteredCommandItems();
  const container = $('#command-results');
  if (!container) return;
  if (state.command.index >= results.length) state.command.index = Math.max(0, results.length - 1);
  container.innerHTML = results.length ? results.map((item, index) => `<button class="command-result ${index === state.command.index ? 'active' : ''}" data-command-index="${index}" role="option" aria-selected="${index === state.command.index}">
      <span class="command-result-icon" style="--icon-color:${item.color || 'var(--muted)'}">${icon(item.icon || 'file')}</span>
      <span class="command-result-copy"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description || '')}</span></span>
      ${index === state.command.index ? '<kbd>Enter</kbd>' : ''}
    </button>`).join('') : `<div class="command-empty">${icon('info')}<span>No matching tools, recipes, or actions.</span></div>`;
  const hint = $('#command-hint');
  if (hint) hint.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
}

function openCommandPalette() {
  const overlay = $('#command-overlay');
  const input = $('#command-input');
  if (!overlay || !input) return;
  state.command.open = true;
  state.command.index = 0;
  state.command.query = '';
  state.command.items = commandItems();
  state.command.restoreFocus = document.activeElement;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  input.value = '';
  renderCommandResults();
  setTimeout(() => input.focus(), 0);
}

function closeCommandPalette() {
  const overlay = $('#command-overlay');
  if (!overlay || !state.command.open) return;
  state.command.open = false;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  try { state.command.restoreFocus?.focus?.(); } catch { /* focus target may be gone */ }
}

function executeCommand(index = state.command.index) {
  const item = filteredCommandItems()[index];
  if (!item) return;
  closeCommandPalette();
  setTimeout(() => {
    try { item.run(); } catch (error) { showToast(error.message || String(error), 'error', 7000); }
  }, 0);
}

function moveCommandSelection(delta) {
  const results = filteredCommandItems();
  if (!results.length) return;
  state.command.index = (state.command.index + delta + results.length) % results.length;
  renderCommandResults();
}

function render() {
  if (state.studio.previewObserver) {
    state.studio.previewObserver.disconnect();
    state.studio.previewObserver = null;
  }
  updateShell();
  const resetScroll = state.resetScroll !== false;
  const scrollTop = resetScroll ? 0 : viewEl.scrollTop;
  let html = '';
  switch (state.view) {
    case 'home': html = renderHome(); break;
    case 'youtube': html = renderYouTube(); break;
    case 'convert': html = renderConvert(); break;
    case 'compress': html = renderCompress(); break;
    case 'trim': html = renderTrim(); break;
    case 'join': html = renderJoin(); break;
    case 'normalize': html = renderNormalize(); break;
    case 'frames': html = renderFrames(); break;
    case 'extract': html = renderExtract(); break;
    case 'gif': html = renderGif(); break;
    case 'pdf': html = renderPdf(); break;
    case 'archive': html = renderArchive(); break;
    case 'encryptor': html = renderEncryptor(); break;
    case 'checksum': html = renderChecksum(); break;
    case 'info': html = renderInfo(); break;
    case 'metadata': html = renderMetadata(); break;
    case 'shred': html = renderShred(); break;
    case 'studio': html = renderStudio(); break;
    case 'transcribe': html = renderTranscribe(); break;
    case 'dictation': html = renderDictation(); break;
    case 'settings': html = renderSettings(); break;
    default: html = renderHome();
  }
  viewEl.innerHTML = html;
  viewEl.classList.toggle('studio-view', state.view === 'studio');
  if (state.view === 'studio') bindStudioPreview();
  viewEl.scrollTop = scrollTop;
  state.resetScroll = false;
  updateQueueBadge();
}

function renderHome() {
  const outputCount = state.status ? state.status.formats.reduce((total, group) => total + group.formats.length, 0) : 24;
  const recent = state.history.slice(0, 4);
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="hero-kicker"><span class="status-dot"></span> Local-first file workbench</div>
        <h2>One app.<br><span class="gradient-text">Every file.</span><br>Zero uploads.</h2>
        <p>Download, convert, compress, trim, extract, encrypt, archive, and inspect files without sending them to a server. Built for fast batches and the formats you actually use.</p>
        <div class="hero-actions">
          <button class="primary-button" data-view="convert">${icon('convert')} Open converter</button>
          <button class="secondary-button" data-view="youtube">${icon('download')} Download from YouTube</button>
          <span class="hero-note">No account. No cloud. No uploads.</span>
        </div>
      </div>
      <div class="hero-drop">
        <div class="dropzone" data-action="pick-files" data-tool="convert">
          <div class="dropzone-icon">${icon('upload')}</div>
          <strong>Drop files to get started</strong>
          <span>Media, images, PDFs, or data files<br><b>or click to browse</b></span>
        </div>
      </div>
    </section>

    <div class="stats-strip">
      <div class="stat-cell"><div class="stat-value">${outputCount}<span> formats</span></div><div class="stat-label">Ready to convert</div></div>
      <div class="stat-cell"><div class="stat-value">0<span> bytes uploaded</span></div><div class="stat-label">Everything stays local</div></div>
      <div class="stat-cell"><div class="stat-value">${state.status?.tools?.ffmpeg?.available ? 'Ready' : 'Setup'}<span> engine status</span></div><div class="stat-label">Bundled tools</div></div>
    </div>

    <div class="section-head">
      <div><h2>Pick a tool</h2><p>Fast paths for the jobs you do most.</p></div>
      <button class="section-link" data-view="convert">See all tools →</button>
    </div>
    <div class="tool-grid">
      ${toolCard('youtube', 'download', 'YouTube Downloader', 'Video or audio, direct to disk', '#ff8c8c')}
      ${toolCard('convert', 'convert', 'Universal Convert', '24 output formats + data files', '#c9ff51')}
      ${toolCard('compress', 'compress', 'Compress', 'Quality presets or target size', '#66e9ff')}
      ${toolCard('pdf', 'pdf', 'PDF Toolkit', 'Merge, split, reorder, rotate', '#b18cff')}
      ${toolCard('trim', 'scissors', 'Trim & Clip', 'Keep exactly the moment you need', '#74ffb2')}
      ${toolCard('join', 'merge', 'Join Media', 'Play clips back-to-back', '#ff9f6b')}
      ${toolCard('extract', 'music', 'Extract Audio', 'Turn video into MP3 or FLAC', '#ffc857')}
      ${toolCard('normalize', 'wave', 'Normalize Audio', 'Even out quiet and loud audio', '#66e9ff')}
      ${toolCard('transcribe', 'mic', 'Audio to Text', 'Local Whisper transcripts', '#74ffb2')}
      ${toolCard('studio', 'captions', 'Transcript Clip Studio', 'Turn transcript lines into clips', '#c9ff51')}
      ${toolCard('dictation', 'mic', 'Dictation', 'Speak and get text instantly', '#74ffb2')}
      ${toolCard('frames', 'frames', 'Frame Extractor', 'Save video moments as images', '#b18cff')}
      ${toolCard('archive', 'archive', 'Archives', 'ZIP, 7Z, TAR and more', '#7a9cff')}
      ${toolCard('encryptor', 'shield', 'File Encryptor', 'Password-protect files locally', '#ff8c8c')}
      ${toolCard('checksum', 'hash', 'Checksums', 'Verify files with MD5 or SHA', '#f3a6ff')}
      ${toolCard('metadata', 'file', 'Metadata Stripper', 'Remove tags without re-encoding', '#c9ff51')}
      ${toolCard('shred', 'harddrive', 'Secure Delete', 'Overwrite files before removal', '#ff8c8c')}
    </div>

    <div class="two-col" style="margin-top: 28px;">
      <div class="panel">
        <div class="panel-head"><div><h2>Recent activity</h2><p>Your last local operations.</p></div><button class="section-link" data-action="open-history">View queue →</button></div>
        <div class="panel-body tight">
          ${recent.length ? `<div class="recent-list">${recent.map(recentRow).join('')}</div>` : `<div class="empty-state" style="min-height:150px"><div class="tool-icon" style="--icon-color:var(--muted)">${icon('clock')}</div><h3>No jobs yet</h3><p>Your recent conversions and downloads will appear here.</p></div>`}
        </div>
      </div>
      <div class="panel side-panel">
        <div class="tool-icon side-icon" style="--icon-color: var(--lime)">${icon('shield')}</div>
        <h3>Built to stay on your machine</h3>
        <p>OmniForge runs FFmpeg, 7-Zip, yt-dlp, and its encryption engine locally. Your files never pass through a third-party conversion service.</p>
        <div class="side-list">
          <div class="side-step"><span class="side-step-number">01</span><div><strong>Local by default</strong><span>Only YouTube downloads need the internet.</span></div></div>
          <div class="side-step"><span class="side-step-number">02</span><div><strong>Batch friendly</strong><span>Queue many files and keep working.</span></div></div>
          <div class="side-step"><span class="side-step-number">03</span><div><strong>Clear output</strong><span>Choose a folder for every job.</span></div></div>
        </div>
      </div>
    </div>
  `;
}

function toolCard(view, iconName, title, text, color) {
  return `<button class="tool-card" data-view="${view}" style="--icon-color:${color}; --tool-glow:${color}22">
    <span class="tool-icon" style="--icon-color:${color}">${icon(iconName)}</span>
    <strong>${title}</strong>
    <span>${text}</span>
  </button>`;
}

function recentRow(job) {
  const tool = TOOL_ICONS[job.tool] || 'file';
  return `<div class="recent-row">
    <span class="tool-icon" style="--icon-color: var(--muted)">${icon(tool)}</span>
    <div style="min-width:0"><div class="recent-name">${escapeHtml(job.label || job.tool)}</div><div class="recent-meta">${escapeHtml(job.tool)} · ${relativeTime(job.completedAt || job.startedAt)}</div></div>
    <span class="status-pill ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
  </div>`;
}

GUIDES.youtube = {
  icon: 'download',
  title: 'A direct line to your media',
  text: 'yt-dlp handles extraction while the bundled Deno runtime and FFmpeg keep formats and audio conversion reliable.',
  steps: [['Paste a URL', 'One public YouTube video at a time.'], ['Pick a format', 'MP4 video at up to 1080p or audio only.'], ['Save', 'Choose an output folder and download.']]
};

function allFormats() {
  return state.status ? state.status.formats.flatMap((group) => group.formats.map((format) => ({ ...format, category: group.id }))) : [];
}

function formatInfo(target) {
  return allFormats().find((format) => format.value === target) || null;
}

function renderGuide(tool) {
  const guide = GUIDES[tool] || GUIDES.convert;
  return `<aside class="panel side-panel">
    <div class="tool-icon side-icon" style="--icon-color: var(--lime)">${icon(guide.icon)}</div>
    <h3>${escapeHtml(guide.title)}</h3>
    <p>${escapeHtml(guide.text)}</p>
    <div class="side-list">${guide.steps.map((step, index) => `<div class="side-step"><span class="side-step-number">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(step[0])}</strong><span>${escapeHtml(step[1])}</span></div></div>`).join('')}</div>
  </aside>`;
}

function renderDropzone(tool, heading, subheading) {
  const hasFiles = state.files[tool].length > 0;
  return `<div class="dropzone" data-action="pick-files" data-tool="${tool}" style="${hasFiles ? 'min-height:104px;padding:16px' : ''}">
    <div class="dropzone-icon">${icon('upload')}</div>
    <strong>${escapeHtml(heading)}</strong>
    <span>${escapeHtml(subheading)}<br><b>or click to browse</b></span>
  </div>`;
}

function renderFileList(tool) {
  const files = state.files[tool] || [];
  if (!files.length) return '';
  return `<div class="file-stack">${files.map((file, index) => {
    const category = file.category || categoryFor(file.ext, file.name);
    return `<div class="file-row">
      <span class="file-kind" style="--kind-color:${categoryColor(category)}">${icon(categoryIcon(category))}</span>
      <div style="min-width:0"><div class="file-name" title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</div><div class="file-meta">${escapeHtml(file.ext || category)} · ${formatBytes(file.size)}</div></div>
      <span class="status-pill">${escapeHtml(category)}</span>
      <div class="file-actions">
        ${tool === 'join' ? `<button class="file-move" data-action="move-file" data-tool="${tool}" data-index="${index}" data-dir="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="file-move" data-action="move-file" data-tool="${tool}" data-index="${index}" data-dir="1" ${index === files.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>` : ''}
        <button class="file-remove" data-action="remove-file" data-tool="${tool}" data-index="${index}" aria-label="Remove file">${icon('x')}</button>
      </div>
    </div>`;
  }).join('')}</div>
  <div class="file-add"><span class="file-count">${files.length} file${files.length === 1 ? '' : 's'} selected</span><button class="ghost-button" data-action="clear-files" data-tool="${tool}">${icon('trash')} Clear all</button></div>`;
}

function renderStartBar(tool, label, note, disabled) {
  const needsOutput = !['checksum', 'info', 'shred'].includes(tool);
  return `<div class="action-row">
    <div class="action-copy"><strong>${escapeHtml(note || (needsOutput ? 'You will choose an output folder next.' : 'No output folder is needed.'))}</strong>${needsOutput ? 'Each job asks where to save its results.' : 'Results appear inside the app.'}</div>
    <div class="action-buttons"><button class="primary-button" data-action="start-tool" data-tool="${tool}" ${disabled ? 'disabled' : ''}>${icon('play')} ${escapeHtml(label)}</button></div>
  </div>`;
}

function qualityPicker(tool, selected) {
  const choices = [
    { value: 'high', label: 'Best quality', hint: 'Larger file' },
    { value: 'balanced', label: 'Balanced', hint: 'Recommended' },
    { value: 'small', label: 'Smallest file', hint: 'Most compact' }
  ];
  return `<div class="quality-picker" role="radiogroup" aria-label="Quality">${choices.map((choice) => `<label class="quality-choice"><input type="radio" name="quality-${tool}" value="${choice.value}" data-tool="${tool}" data-option="quality" ${String(selected) === choice.value ? 'checked' : ''}><span><strong>${choice.label}</strong><small>${choice.hint}</small></span></label>`).join('')}</div>`;
}

function selectOptions(items, selected, placeholder) {
  const prefix = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
  return prefix + items.map((item) => `<option value="${escapeHtml(item.value)}" ${String(item.value) === String(selected) ? 'selected' : ''}>${escapeHtml(item.label)}${item.hint ? ` — ${escapeHtml(item.hint)}` : ''}</option>`).join('');
}

function renderYouTube() {
  const options = state.options.youtube;
  const media = state.ytMeta;
  const preview = media ? `<div class="yt-preview">
      <div class="yt-thumb">${media.thumbnail ? `<img src="${escapeHtml(media.thumbnail)}" alt="">` : ''}</div>
      <div class="yt-info">
        <h3>${escapeHtml(media.title)}</h3>
        <div class="yt-meta">${escapeHtml(media.uploader)} · ${formatDuration(media.duration)}${media.viewCount ? ` · ${Number(media.viewCount).toLocaleString()} views` : ''}</div>
        <div class="yt-badges"><span class="yt-badge">YouTube</span><span class="yt-badge">${escapeHtml(media.id)}</span><span class="yt-badge">Ready</span></div>
      </div>
    </div>` : `<div class="yt-empty">${icon('link')} Paste a link and fetch details for a preview. You can also download without a preview.</div>`;

  const modeVideo = options.mode !== 'audio';
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Paste a YouTube link</h2><p>Public, single-video URLs only. Playlists and live streams are not supported.</p></div><span class="status-pill ${media ? 'succeeded' : ''}">${media ? 'Metadata ready' : 'Waiting'}</span></div>
        <div class="panel-body">
          <div class="field full">
            <label>Video URL</label>
            <div class="input-with-button">
              <input id="yt-url" data-tool="youtube" data-option="url" value="${escapeHtml(options.url)}" placeholder="https://www.youtube.com/watch?v=..." spellcheck="false">
              <button class="secondary-button" data-action="yt-fetch" ${state.ytLoading ? 'disabled' : ''}>${state.ytLoading ? `${icon('refresh', 'spin')} Fetching` : `${icon('refresh')} Fetch details`}</button>
            </div>
          </div>
          <div style="margin-top:14px">${preview}</div>
          <div class="form-grid" style="margin-top:16px">
            <div class="field">
              <label>Download as</label>
              <div class="segmented">
                <label><input type="radio" name="yt-mode" value="video" data-tool="youtube" data-option="mode" data-rerender="true" ${modeVideo ? 'checked' : ''}><span>Video · MP4</span></label>
                <label><input type="radio" name="yt-mode" value="audio" data-tool="youtube" data-option="mode" data-rerender="true" ${!modeVideo ? 'checked' : ''}><span>Audio only</span></label>
              </div>
            </div>
            ${modeVideo ? `<div class="field"><label>Quality</label><select data-tool="youtube" data-option="quality">${selectOptions([
              { value: 'best', label: 'Best available' }, { value: '1080', label: 'Up to 1080p' }, { value: '720', label: 'Up to 720p' }, { value: '480', label: 'Up to 480p' }
            ], options.quality)}</select></div>` : `<div class="field"><label>Audio format</label><select data-tool="youtube" data-option="audioFormat">${selectOptions([
              { value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' }, { value: 'wav', label: 'WAV' }, { value: 'flac', label: 'FLAC' }, { value: 'opus', label: 'OPUS' }
            ], options.audioFormat)}</select></div>`}
          </div>
          <div class="action-row">
            <div class="action-copy"><strong>You will choose an output folder next.</strong>Download only content you own or are authorized to download.</div>
            <div class="action-buttons"><button class="primary-button" data-action="start-tool" data-tool="youtube" ${options.url.trim() ? '' : 'disabled'}>${icon('download')} Download</button></div>
          </div>
          <div class="legal-note">${icon('alert')} YouTube downloads may be subject to YouTube's terms and copyright law. OmniForge does not bypass DRM or access controls.</div>
        </div>
      </div>
    </div>
    ${renderGuide('youtube')}
  </div>`;
}

function renderConvert() {
  const options = state.options.convert;
  const target = formatInfo(options.targetFormat);
  const targetCategory = target?.category || 'video';
  const formatGroups = state.status ? state.status.formats : [];
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Files to convert</h2><p>Media is processed with FFmpeg. Structured data is converted natively.</p></div><span class="status-pill">${state.files.convert.length ? `${state.files.convert.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('convert', 'Drop files to convert', 'Video, audio, images, JSON, CSV, YAML, or XML')}
          ${renderFileList('convert')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Output settings</h2><p>Choose the format and quality for this batch.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field full"><label>Convert to <span>${targetCategory === 'data' ? 'structured data' : 'media'}</span></label><select data-tool="convert" data-option="targetFormat" data-rerender="true">${formatGroups.map((group) => `<optgroup label="${escapeHtml(group.label)}">${group.formats.map((format) => `<option value="${format.value}" ${options.targetFormat === format.value ? 'selected' : ''}>${escapeHtml(format.label)} — ${escapeHtml(format.hint)}</option>`).join('')}</optgroup>`).join('')}</select>
              <div class="field-note">${escapeHtml(target?.hint || 'FFmpeg will choose the best codec for this container.')}</div>
            </div>
            ${targetCategory !== 'data' ? `<div class="field"><label>Quality</label>${qualityPicker('convert', options.quality)}</div>` : ''}
            ${targetCategory === 'video' ? `<div class="field"><label>Maximum resolution</label><select data-tool="convert" data-option="resolution">${selectOptions([
              { value: 'source', label: 'Keep source resolution' }, { value: '2160', label: '2160p / 4K' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }, { value: '360', label: '360p' }
            ], options.resolution)}</select></div>` : ''}
            ${targetCategory === 'data' ? `<div class="field full"><div class="field-note">Supported data inputs: ${escapeHtml((state.status?.inputExtensions?.data || []).join(', ').toUpperCase())}. Nested values are preserved in JSON and YAML; CSV flattens objects to JSON text.</div></div>` : ''}
          </div>
          ${renderStartBar('convert', 'Convert files', 'A target format is required.', state.files.convert.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('convert')}
  </div>`;
}

function renderCompress() {
  const options = state.options.compress;
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Media to compress</h2><p>Shrink large files with predictable quality or a target size.</p></div><span class="status-pill">${state.files.compress.length ? `${state.files.compress.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('compress', 'Drop video, audio, or images', 'Keep the same container or choose a new one')}
          ${renderFileList('compress')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Compression strategy</h2><p>Target-size mode is approximate and works for video and audio.</p></div></div>
        <div class="panel-body">
          <div class="field full" style="margin-bottom:14px">
            <label>Mode</label>
            <div class="segmented">
              <label><input type="radio" name="compress-mode" value="quality" data-tool="compress" data-option="mode" data-rerender="true" ${options.mode !== 'size' ? 'checked' : ''}><span>Quality preset</span></label>
              <label><input type="radio" name="compress-mode" value="size" data-tool="compress" data-option="mode" data-rerender="true" ${options.mode === 'size' ? 'checked' : ''}><span>Target file size</span></label>
            </div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Output format</label><select data-tool="compress" data-option="outputFormat"><option value="">Auto · match source</option>${state.status.formats.filter((group) => ['video', 'audio', 'image'].includes(group.id)).map((group) => `<optgroup label="${group.label}">${group.formats.map((format) => `<option value="${format.value}" ${options.outputFormat === format.value ? 'selected' : ''}>${format.label}</option>`).join('')}</optgroup>`).join('')}</select></div>
            ${options.mode === 'size' ? `<div class="field"><label>Target size <span>megabytes</span></label><input type="number" min="1" step="1" value="${escapeHtml(options.targetSizeMB)}" data-tool="compress" data-option="targetSizeMB"><div class="field-note">Approximate output size in MB.</div></div>` : `<div class="field"><label>Quality</label>${qualityPicker('compress', options.quality)}</div>`}
            <div class="field"><label>Maximum resolution</label><select data-tool="compress" data-option="resolution">${selectOptions([
              { value: 'source', label: 'Keep source resolution' }, { value: '2160', label: '2160p / 4K' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }
            ], options.resolution)}</select></div>
          </div>
          ${renderStartBar('compress', 'Compress files', 'Videos use H.264 for the smallest compatible output.', state.files.compress.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('compress')}
  </div>`;
}

function renderTrim() {
  const options = state.options.trim;
  const audioVideoFormats = allFormats().filter((format) => ['video', 'audio'].includes(format.category));
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Clips to trim</h2><p>Accurate cuts are re-encoded, so they work with most source files.</p></div><span class="status-pill">${state.files.trim.length ? `${state.files.trim.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('trim', 'Drop video or audio', 'MP4, MKV, MOV, MP3, WAV and more')}
          ${renderFileList('trim')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Cut range</h2><p>Leave end blank to keep everything from the start time onward.</p></div></div>
        <div class="panel-body">
          <div class="form-grid three">
            <div class="field"><label>Start time</label><input value="${escapeHtml(options.start)}" placeholder="00:00:00" data-tool="trim" data-option="start"><div class="field-note">Seconds or HH:MM:SS.</div></div>
            <div class="field"><label>End time</label><input value="${escapeHtml(options.end)}" placeholder="00:00:30" data-tool="trim" data-option="end"><div class="field-note">Optional.</div></div>
            <div class="field"><label>Output format</label><select data-tool="trim" data-option="outputFormat">${audioVideoFormats.map((format) => `<option value="${format.value}" ${options.outputFormat === format.value ? 'selected' : ''}>${format.label}</option>`).join('')}</select></div>
          </div>
          ${renderStartBar('trim', 'Trim files', 'The selected range is rendered into a new file.', state.files.trim.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('trim')}
  </div>`;
}

function renderJoin() {
  const options = state.options.join;
  const files = state.files.join;
  const firstCategory = files[0]?.category;
  const categories = firstCategory ? [firstCategory] : ['video', 'audio'];
  const target = formatInfo(options.outputFormat);
  const targetCategory = target?.category || categories[0] || 'video';
  const joinGroups = state.status.formats
    .filter((group) => categories.includes(group.id))
    .map((group) => ({ ...group, formats: group.formats.filter((format) => format.value !== 'gif') }))
    .filter((group) => group.formats.length > 0);
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Clips to join</h2><p>Use the arrows to set the playback order.</p></div><span class="status-pill">${files.length ? `${files.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('join', 'Drop video or audio clips', 'Choose at least two files of the same media type')}
          ${renderFileList('join')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Join settings</h2><p>Mixed formats are normalized before they are joined.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Output format</label><select data-tool="join" data-option="outputFormat" data-rerender="true">${joinGroups.map((group) => `<optgroup label="${escapeHtml(group.label)}">${group.formats.map((format) => `<option value="${format.value}" ${options.outputFormat === format.value ? 'selected' : ''}>${format.label} — ${escapeHtml(format.hint)}</option>`).join('')}</optgroup>`).join('')}</select></div>
            <div class="field"><label>Quality</label>${qualityPicker('join', options.quality)}</div>
            ${targetCategory === 'video' ? `<div class="field"><label>Maximum resolution</label><select data-tool="join" data-option="resolution">${selectOptions([
              { value: 'source', label: 'Use first clip resolution' }, { value: '2160', label: '2160p / 4K' }, { value: '1080', label: '1080p' }, { value: '720', label: '720p' }, { value: '480', label: '480p' }
            ], options.resolution)}</select></div>` : ''}
            <div class="field"><label>Output name <span>optional</span></label><input value="${escapeHtml(options.joinName)}" placeholder="joined" data-tool="join" data-option="joinName"><div class="field-note">A format extension is added automatically.</div></div>
          </div>
          ${renderStartBar('join', 'Join media', 'Files are combined in the order shown above.', files.length < 2)}
        </div>
      </div>
    </div>
    ${renderGuide('join')}
  </div>`;
}

function renderNormalize() {
  const options = state.options.normalize;
  const audioFormats = allFormats().filter((format) => format.category === 'audio');
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Media to normalize</h2><p>Video files work too; only the audio track is kept.</p></div><span class="status-pill">${state.files.normalize.length ? `${state.files.normalize.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('normalize', 'Drop video or audio', 'Audio is normalized to -16 LUFS with a -1.5 dB ceiling')}
          ${renderFileList('normalize')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Normalization settings</h2><p>Single-pass loudness normalization is suitable for podcasts, voice notes, and mixed clips.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Audio format</label><select data-tool="normalize" data-option="audioFormat">${audioFormats.map((format) => `<option value="${format.value}" ${options.audioFormat === format.value ? 'selected' : ''}>${format.label} — ${format.hint}</option>`).join('')}</select></div>
            <div class="field"><label>Quality</label>${qualityPicker('normalize', options.quality)}</div>
          </div>
          ${renderStartBar('normalize', 'Normalize audio', 'The result is saved as a separate audio file.', state.files.normalize.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('normalize')}
  </div>`;
}

function renderFrames() {
  const options = state.options.frames;
  const timestampMode = options.mode === 'timestamp';
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Videos to sample</h2><p>${timestampMode ? 'One image is saved per video at the exact timestamp.' : 'Each video gets its own folder of numbered frames.'}</p></div><span class="status-pill">${state.files.frames.length ? `${state.files.frames.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('frames', 'Drop videos to extract frames from', timestampMode ? 'Save the exact frame at a chosen moment' : 'A frame is saved at the chosen time interval')}
          ${renderFileList('frames')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Frame settings</h2><p>PNG keeps full quality; JPG creates smaller files.</p></div></div>
        <div class="panel-body">
          <div class="field full" style="margin-bottom:14px">
            <label>Extraction mode</label>
            <div class="segmented">
              <label><input type="radio" name="frames-mode" value="interval" data-tool="frames" data-option="mode" data-rerender="true" ${timestampMode ? '' : 'checked'}><span>Every N seconds</span></label>
              <label><input type="radio" name="frames-mode" value="timestamp" data-tool="frames" data-option="mode" data-rerender="true" ${timestampMode ? 'checked' : ''}><span>One exact frame</span></label>
            </div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Image format</label><select data-tool="frames" data-option="imageFormat">${selectOptions([{ value: 'png', label: 'PNG — lossless' }, { value: 'jpg', label: 'JPG — smaller files' }], options.imageFormat)}</select></div>
            ${timestampMode ? `<div class="field"><label>Timestamp</label><input value="${escapeHtml(options.timestamp)}" placeholder="00:00:05.500" data-tool="frames" data-option="timestamp"><div class="field-note">Seconds or HH:MM:SS.mmm.</div></div>` : `<div class="field"><label>Interval <span>seconds</span></label><input type="number" min="0.05" step="0.05" value="${escapeHtml(options.interval)}" data-tool="frames" data-option="interval"><div class="field-note">0.5 = one frame every half second.</div></div>`}
            ${timestampMode ? '' : `<div class="field"><label>Maximum frames</label><input type="number" min="1" max="2000" step="1" value="${escapeHtml(options.maxFrames)}" data-tool="frames" data-option="maxFrames"></div>`}
            <div class="field"><label>Width <span>pixels, optional</span></label><input type="number" min="0" max="7680" step="2" value="${escapeHtml(options.width)}" data-tool="frames" data-option="width"><div class="field-note">0 keeps the source size.</div></div>
          </div>
          ${renderStartBar('frames', timestampMode ? 'Extract frame' : 'Extract frames', timestampMode ? 'The output is a single image per video.' : 'The output is a folder containing numbered images.', state.files.frames.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('frames')}
  </div>`;
}
function renderExtract() {
  const options = state.options.extract;
  const audioFormats = allFormats().filter((format) => format.category === 'audio');
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Video files</h2><p>Keep the soundtrack and discard the video stream.</p></div><span class="status-pill">${state.files.extract.length ? `${state.files.extract.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('extract', 'Drop videos to extract audio from', 'MP4, MKV, MOV, WebM, AVI and more')}
          ${renderFileList('extract')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Audio settings</h2><p>Choose a format and quality for the extracted track.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Audio format</label><select data-tool="extract" data-option="audioFormat">${audioFormats.map((format) => `<option value="${format.value}" ${options.audioFormat === format.value ? 'selected' : ''}>${format.label} — ${format.hint}</option>`).join('')}</select></div>
            <div class="field"><label>Quality</label>${qualityPicker('extract', options.quality)}</div>
          </div>
          ${renderStartBar('extract', 'Extract audio', 'Output is written as a standalone audio file.', state.files.extract.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('extract')}
  </div>`;
}


const SPEECH_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'fi', label: 'Finnish' },
  { value: 'no', label: 'Norwegian' },
  { value: 'cs', label: 'Czech' },
  { value: 'ro', label: 'Romanian' },
  { value: 'hu', label: 'Hungarian' },
  { value: 'el', label: 'Greek' },
  { value: 'he', label: 'Hebrew' },
  { value: 'id', label: 'Indonesian' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'th', label: 'Thai' }
];

function renderTranscribe() {
  const options = state.options.transcribe;
  const ready = Boolean(state.status?.tools?.speech?.available);
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Audio &amp; video files</h2><p>Whisper converts each file to a local transcript. Nothing is uploaded.</p></div><span class="status-pill ${ready ? 'succeeded' : 'failed'}">${ready ? 'Engine ready' : 'Engine missing'}</span></div>
        <div class="panel-body">
          ${renderDropzone('transcribe', 'Drop audio or video to transcribe', 'MP3, WAV, M4A, FLAC, MP4, MKV, MOV, WebM and more')}
          ${renderFileList('transcribe')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Transcript settings</h2><p>Auto-detect handles mixed-language recordings. Choosing a language can speed things up.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Spoken language</label><select data-tool="transcribe" data-option="language">${selectOptions(SPEECH_LANGUAGES, options.language)}</select></div>
            <div class="field"><label>Output</label><div class="segmented"><label><input type="radio" name="transcribe-format" value="txt" data-tool="transcribe" data-option="outputFormat" ${options.outputFormat === 'txt' ? 'checked' : ''}><span>TXT</span></label><label><input type="radio" name="transcribe-format" value="srt" data-tool="transcribe" data-option="outputFormat" ${options.outputFormat === 'srt' ? 'checked' : ''}><span>SRT</span></label></div><div class="field-note">SRT includes timestamps for subtitles.</div></div>
          </div>
          ${renderStartBar('transcribe', 'Transcribe files', 'Each file gets its own transcript in the output folder.', state.files.transcribe.length === 0 || !ready)}
        </div>
      </div>
    </div>
    ${renderGuide('transcribe')}
  </div>`;
}

function renderDictation() {
  const options = state.options.dictation;
  const dictation = state.dictation;
  const ready = Boolean(state.status?.tools?.speech?.available);
  const recording = dictation.recording;
  const busy = dictation.busy;
  const status = recording ? 'Recording...' : busy ? 'Preparing your recording...' : 'Tap the microphone to start';
  const hint = recording ? 'Speak naturally. Tap stop when you are done.' : 'Your voice is transcribed locally with Whisper.';
  const transcript = dictation.lastTranscript;
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel dictation-panel ${recording ? 'is-recording' : ''}">
        <div class="panel-head"><div><h2>Live dictation</h2><p>Speak, stop, and OmniForge transcribes the recording on this PC.</p></div><span class="status-pill ${recording ? 'running' : ready ? 'succeeded' : 'failed'}">${recording ? 'recording' : ready ? 'ready' : 'engine missing'}</span></div>
        <div class="panel-body">
          <div class="dictation-stage">
            <div class="dictation-orb ${recording ? 'recording' : ''}">${recording ? icon('stop') : icon('mic')}</div>
            <div class="dictation-status" id="dictation-status">${status}</div>
            <div class="dictation-timer" id="dictation-timer">${formatDuration(dictation.elapsed)}</div>
            <div class="dictation-actions">
              ${recording
                ? `<button class="danger-button" data-action="stop-dictation">${icon('stop')} Stop &amp; transcribe</button>`
                : `<button class="primary-button" data-action="start-dictation" ${busy || !ready ? 'disabled' : ''}>${icon('mic')} ${busy ? 'Preparing...' : 'Start recording'}</button>`}
            </div>
            <div class="dictation-hint">${hint}</div>
          </div>
          <div class="form-grid" style="margin-top:16px">
            <div class="field"><label>Spoken language</label><select data-tool="dictation" data-option="language" ${recording || busy ? 'disabled' : ''}>${selectOptions(SPEECH_LANGUAGES, options.language)}</select></div>
            <div class="field"><label>Output</label><div class="segmented"><label><input type="radio" name="dictation-format" value="txt" data-tool="dictation" data-option="outputFormat" ${options.outputFormat === 'txt' ? 'checked' : ''} ${recording || busy ? 'disabled' : ''}><span>TXT</span></label><label><input type="radio" name="dictation-format" value="srt" data-tool="dictation" data-option="outputFormat" ${options.outputFormat === 'srt' ? 'checked' : ''} ${recording || busy ? 'disabled' : ''}><span>SRT</span></label></div></div>
          </div>
          ${dictation.error ? `<div class="dictation-error">${icon('alert')} ${escapeHtml(dictation.error)}</div>` : ''}
          ${transcript ? `<div class="transcript-card">
            <div class="transcript-head"><div><strong>Latest transcript</strong><span>${escapeHtml(baseName(transcript.path || ''))}</span></div><div class="action-buttons"><button class="secondary-button" data-action="copy-dictation">${icon('copy')} Copy</button>${transcript.path ? `<button class="secondary-button" data-action="reveal-output" data-path="${escapeHtml(transcript.path)}">${icon('folder')} Show file</button>` : ''}</div></div>
            <div class="transcript-body">${escapeHtml(transcript.text || '')}</div>
          </div>` : `<div class="dictation-empty">${icon('file')} Your latest transcript will appear here after the queue finishes.</div>`}
        </div>
      </div>
    </div>
    ${renderGuide('transcribe')}
  </div>`;
}

const STUDIO_VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WebM' },
  { value: 'mov', label: 'MOV' }
];

const STUDIO_AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'm4a', label: 'M4A' },
  { value: 'ogg', label: 'OGG' },
  { value: 'opus', label: 'OPUS' }
];

function formatStudioTime(milliseconds) {
  return formatDuration(Math.max(0, Number(milliseconds) || 0) / 1000);
}

function defaultStudioProject(mediaPath = '') {
  return {
    version: 1,
    mediaPath,
    durationMs: 0,
    language: state.options.studio.language || 'auto',
    segments: [],
    clips: [],
    clipPaddingMs: 150,
    captionStyle: { fontSize: 24, color: '#FFFFFF', outline: 2, position: 'bottom' },
    output: {
      directory: state.settings?.lastOutputDir || state.settings?.outputDir || '',
      videoFormat: 'mp4',
      audioFormat: 'mp3',
      burnCaptions: true,
      exportCaptions: 'srt',
      ratios: ['original'],
      framing: 'fill'
    }
  };
}

function studioRatioDefinitions() {
  return Array.isArray(state.status?.studioRatios) && state.status.studioRatios.length
    ? state.status.studioRatios
    : STUDIO_RATIOS;
}

function studioRatioDefinition(id) {
  return studioRatioDefinitions().find((ratio) => ratio.id === id) || STUDIO_RATIOS[0];
}

function studioFramingDefinitions() {
  return Array.isArray(state.status?.studioFramingModes) && state.status.studioFramingModes.length
    ? state.status.studioFramingModes.map((id) => STUDIO_FRAMING_MODES.find((mode) => mode.id === id) || { id, label: id, description: '' })
    : STUDIO_FRAMING_MODES;
}

function studioMediaCategory() {
  const file = state.files.studio[0];
  return file?.category || 'video';
}

function studioSelectedSegments() {
  const project = state.studio.project;
  if (!project || !state.studio.selectedIds.length) return [];
  const selected = new Set(state.studio.selectedIds);
  return project.segments.filter((segment) => selected.has(segment.id));
}

function studioSelectedRange() {
  const selected = studioSelectedSegments();
  if (!selected.length) return null;
  return {
    startMs: Math.min(...selected.map((segment) => segment.startMs)),
    endMs: Math.max(...selected.map((segment) => segment.endMs))
  };
}

function studioCaptionOverlayStyle(project) {
  const style = project?.captionStyle || defaultStudioProject().captionStyle;
  const color = /^#[0-9a-f]{6}$/i.test(String(style.color || '')) ? style.color : '#FFFFFF';
  const outline = Math.max(0, Math.min(4, Number(style.outline) || 0));
  const shadows = outline > 0
    ? Array.from({ length: 8 }, (_value, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        return `${Math.cos(angle) * outline}px ${Math.sin(angle) * outline}px 0 #000`;
      }).join(', ')
    : 'none';
  return `color:${escapeHtml(color)};font-size:${Math.max(14, Math.round(Number(style.fontSize || 24) * 0.75))}px;text-shadow:${shadows};`;
}

function studioClipExcerpt(project, clip) {
  const text = project.segments
    .filter((segment) => segment.endMs > clip.startMs && segment.startMs < clip.endMs)
    .map((segment) => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 170 ? `${text.slice(0, 167)}...` : text || 'No transcript text overlaps this range.';
}

function updateStudioClipExcerpts() {
  const project = state.studio.project;
  if (!project) return;
  document.querySelectorAll('[data-studio-clip-excerpt]').forEach((element) => {
    const clip = project.clips.find((entry) => entry.id === element.dataset.studioClipExcerpt);
    if (clip) element.textContent = studioClipExcerpt(project, clip);
  });
}

function renderStudio() {
  const file = state.files.studio[0];
  const project = state.studio.project;
  const category = studioMediaCategory();
  const recovery = state.studio.recovery;
  const recoveryBanner = recovery ? `<div class="studio-recovery-banner">
    <div>${icon('clock')}<div><strong>Unsaved Studio session available</strong><span>${escapeHtml(recovery.savedAt ? `Saved ${relativeTime(recovery.savedAt)}` : 'Recovery draft')}</span></div></div>
    <div class="action-buttons"><button class="secondary-button" data-action="studio-restore-recovery">Restore</button><button class="ghost-button" data-action="studio-discard-recovery">Discard</button></div>
  </div>` : '';

  if (!project) {
    return `<div class="studio-shell studio-shell-empty">
      ${recoveryBanner}
      <section class="studio-welcome">
        <div class="studio-welcome-copy">
          <span class="studio-kicker">Transcript-first editing</span>
          <h2>Turn spoken words into finished clips.</h2>
          <p>Load one audio or video file, build a timed transcript locally, then select the lines worth keeping. Every clip, caption, and render stays on this PC.</p>
          ${renderDropzone('studio', 'Drop audio or video to begin', 'MP3, WAV, MP4, MKV, MOV, WebM and more')}
          <div class="studio-welcome-actions"><button class="ghost-button" data-action="studio-open-project">${icon('upload')} Open an existing .ofstudio project</button></div>
        </div>
        <div class="studio-welcome-steps">
          <div class="studio-welcome-step"><span>01</span><div><strong>Build the transcript</strong><p>Transcribe with local Whisper or import SRT/VTT.</p></div></div>
          <div class="studio-welcome-step"><span>02</span><div><strong>Select the good parts</strong><p>Click a line, then Shift-click to extend the range.</p></div></div>
          <div class="studio-welcome-step"><span>03</span><div><strong>Render a clip queue</strong><p>Reorder, style captions, and export every clip in one run.</p></div></div>
        </div>
      </section>
    </div>`;
  }

  return `<div class="studio-shell">
    ${recoveryBanner}
    ${renderStudioProjectBar(project, file, category)}
    <div class="studio-workspace">
      <div class="studio-editor">
        ${renderStudioMediaPanel(project, file, category)}
        ${renderStudioTranscriptPanel(project)}
      </div>
      <aside class="studio-inspector">${renderStudioInspector(project, category)}</aside>
    </div>
  </div>`;
}

function renderStudioMediaPanel(project, file, category) {
  const missing = Boolean(state.studio.mediaError);
  const matchVideo = category === 'audio' ? state.studio.matchVideo : null;
  const mediaUrl = state.studio.mediaUrl;
  const previewRatio = studioRatioDefinition(state.studio.previewRatio);
  const framing = project?.output?.framing || 'fill';
  const frameStyle = previewRatio.width ? `aspect-ratio:${previewRatio.width} / ${previewRatio.height};` : '';
  const mediaElement = file && mediaUrl
    ? category === 'audio'
      ? `<audio id="studio-media" class="studio-audio" src="${escapeHtml(mediaUrl)}" controls preload="metadata"></audio>`
      : `<video id="studio-media" class="studio-video studio-video-foreground" src="${escapeHtml(mediaUrl)}" controls preload="metadata"></video>`
    : '';
  const backdrop = category === 'video' && mediaElement
    ? `<video id="studio-media-backdrop" class="studio-video studio-video-backdrop" src="${escapeHtml(mediaUrl)}" muted aria-hidden="true" preload="metadata"></video>`
    : '';
  const ratioChips = category === 'video' ? `<div class="studio-preview-toolbar">
      <span>Preview aspect</span>
      <div class="studio-ratio-chips">${studioRatioDefinitions().map((ratio) => `<button class="${state.studio.previewRatio === ratio.id ? 'active' : ''}" data-action="studio-preview-ratio" data-ratio="${escapeHtml(ratio.id)}">${escapeHtml(ratio.shortLabel || ratio.label)}</button>`).join('')}</div>
      <span class="studio-framing-current">${escapeHtml(studioFramingDefinitions().find((mode) => mode.id === framing)?.label || framing)}</span>
    </div>` : '';
  return `<section class="studio-preview-panel">
    <div class="studio-panel-heading">
      <div><span class="studio-kicker">Preview</span><h2>${file ? escapeHtml(file.name) : 'Project media'}</h2></div>
      <div class="studio-heading-actions">
        <span class="status-pill ${missing ? 'failed' : 'succeeded'}">${missing ? 'Media missing' : category === 'video' ? 'Video' : 'Audio only'}</span>
        <button class="ghost-button" data-action="studio-replace-media">${icon('folder')} Replace</button>
      </div>
    </div>
    ${!missing && category === 'audio' ? `<div class="studio-source-note">${icon(matchVideo ? 'film' : 'music')}<div><strong>Audio-only source</strong><span>${matchVideo ? `A matching video is available as ${escapeHtml(matchVideo.name)}. Switching keeps this transcript and clip queue.` : 'Preview and exports contain audio plus caption sidecars. Start from a video file to render video clips.'}</span></div>${matchVideo ? `<button class="secondary-button" data-action="studio-use-match-video">Use video</button>` : ''}</div>` : ''}
    ${missing ? `<div class="studio-media-warning">${icon('alert')}<div><strong>Project media is missing</strong><span>Relink the original file before previewing or rendering.</span></div><button class="secondary-button" data-action="studio-relink-media">Relink media</button></div>` : ''}
    ${ratioChips}
    <div class="studio-media-stage ${category}">
      <div class="studio-media-frame framing-${escapeHtml(framing)}" data-studio-frame style="${frameStyle}">
        ${backdrop}
        ${mediaElement || `<div class="studio-media-placeholder">${icon(category === 'audio' ? 'music' : 'film')}<span>Media preview unavailable</span></div>`}
        <div id="studio-caption-overlay" class="studio-caption-overlay ${escapeHtml(project?.captionStyle?.position || 'bottom')}" style="${studioCaptionOverlayStyle(project)}"></div>
      </div>
    </div>
    <div class="studio-preview-meta"><span id="studio-time-readout">0:00 / ${project?.durationMs ? formatStudioTime(project.durationMs) : '--:--'}</span><span>Click a transcript time to seek. Shift-click selects a range.</span></div>
  </section>`;
}

function renderStudioTranscriptPanel(project) {
  const job = state.jobs.get(state.studio.transcriptionJobId);
  const busy = state.studio.busy || ['queued', 'running', 'cancelling'].includes(job?.status);
  const ready = Boolean(state.status?.tools?.speech?.available);
  const progress = Number(job?.progress) || 0;
  const segments = project.segments;
  const selectedRange = studioSelectedRange();
  const selected = studioSelectedSegments();
  const selectedCount = state.studio.selectedIds.length;
  const allSelected = segments.length > 0 && selectedCount === segments.length;
  return `<section class="studio-transcript-panel">
    <div class="studio-panel-heading">
      <div><span class="studio-kicker">Transcript</span><h2>${segments.length ? `${segments.length} timed lines` : 'No transcript yet'}</h2></div>
      <span class="status-pill ${busy ? 'running' : segments.length ? 'succeeded' : ''}">${busy ? 'Transcribing' : segments.length ? 'Ready to edit' : 'Waiting'}</span>
    </div>
    <div class="studio-transcript-tools">
      <div class="studio-transcript-actions">
        <button class="primary-button" data-action="studio-transcribe" ${busy || !ready || state.studio.mediaError ? 'disabled' : ''}>${icon('mic')} ${segments.length ? 'Transcribe again' : 'Transcribe locally'}</button>
        <button class="secondary-button" data-action="studio-import-transcript" ${busy ? 'disabled' : ''}>${icon('upload')} Import transcript</button>
        <button class="ghost-button" data-action="studio-export-transcript" ${segments.length ? '' : 'disabled'}>${icon('file')} Export</button>
      </div>
      <div class="studio-compact-fields">
        <label class="studio-compact-field"><span>Language</span><select data-studio-language>${selectOptions(SPEECH_LANGUAGES, project.language)}</select></label>
        ${segments.length ? `<label class="studio-compact-field"><span>Export as</span><select data-studio-export-format>${selectOptions([{ value: 'srt', label: 'SRT' }, { value: 'vtt', label: 'VTT' }], state.options.studio.exportFormat)}</select></label>` : ''}
      </div>
    </div>
    ${busy ? `<div class="studio-job-progress"><div class="job-progress-wrap"><div class="job-progress"><span style="width:${progress}%"></span></div><span class="job-percent">${progress}%</span></div><span>${escapeHtml(job?.message || 'Starting local transcription...')}</span></div>` : ''}
    ${segments.length ? `
      <div class="studio-transcript-filter">
        <div class="studio-search-row"><span class="nav-icon">${icon('info')}</span><input data-studio-search value="${escapeHtml(state.studio.search)}" placeholder="Search transcript" spellcheck="false"></div>
        <span class="studio-selection-count">${selectedCount ? `${selectedCount} selected` : 'Shift-click to select a range'}</span>
        <button class="ghost-button studio-select-all-button" data-action="studio-select-all" title="${allSelected ? 'Clear the transcript selection' : 'Select every transcript line'}">${allSelected ? 'Clear all' : 'Select all'}</button>
      </div>
      ${selectedRange ? `<div class="studio-selection-bar"><div><strong>${selected.length} line${selected.length === 1 ? '' : 's'} selected</strong><span>${formatStudioTime(selectedRange.startMs)} - ${formatStudioTime(selectedRange.endMs)}</span></div><button class="primary-button" data-action="studio-add-clip" ${state.studio.mediaError ? 'disabled' : ''}>${icon('plus')} Add to queue</button></div>` : ''}
      <div class="studio-segment-list" id="studio-segment-list">${segments.map((segment, index) => renderStudioSegment(segment, index)).join('')}</div>
    ` : `<div class="studio-transcript-empty">${icon('file')}<div><strong>${busy ? 'Whisper is preparing the transcript.' : 'Start with a transcript.'}</strong><span>${busy ? 'Progress and the first lines will appear here.' : 'Transcribe locally or import an SRT/VTT file, then select lines to turn into clips.'}</span></div></div>`}
  </section>`;
}

function renderStudioSegment(segment, index) {
  const selected = state.studio.selectedIds.includes(segment.id);
  return `<div class="studio-segment ${selected ? 'selected' : ''}" data-studio-row="${escapeHtml(segment.id)}">
    <button class="studio-select ${selected ? 'selected' : ''}" data-action="studio-select-segment" data-id="${escapeHtml(segment.id)}" title="Select this line; Shift-click to extend">${selected ? icon('check') : String(index + 1)}</button>
    <div class="studio-segment-copy"><div class="studio-segment-meta"><button data-action="studio-select-segment" data-id="${escapeHtml(segment.id)}">${formatStudioTime(segment.startMs)}</button><span>${formatStudioTime(segment.endMs)}</span></div><textarea rows="${Math.min(6, Math.max(2, String(segment.text).split('\n').length))}" data-studio-segment="${escapeHtml(segment.id)}" spellcheck="false">${escapeHtml(segment.text)}</textarea></div>
  </div>`;
}

function renderStudioProjectBar(project, file, category) {
  const mediaName = file?.name || baseName(project.mediaPath) || 'Project media';
  const projectName = state.studio.projectPath ? baseName(state.studio.projectPath) : 'Untitled project';
  return `<section class="studio-projectbar">
    <div class="studio-project-identity">
      <div class="studio-project-icon">${icon('captions')}</div>
      <div class="studio-project-copy"><strong>${escapeHtml(mediaName)}</strong><div class="studio-project-meta"><span>${escapeHtml(projectName)}</span><span class="studio-meta-dot">/</span><span data-studio-save-state class="${state.studio.dirty ? 'studio-unsaved' : ''}">${state.studio.dirty ? 'Unsaved changes' : 'Saved'}</span><span class="studio-format-chip">${escapeHtml(category === 'video' ? 'Video project' : 'Audio project')}</span></div></div>
    </div>
    <div class="studio-project-actions">
      <button class="ghost-button" data-action="studio-open-project">${icon('upload')} Open</button>
      <button class="ghost-button" data-action="studio-save-project-as">Save as</button>
      <button class="secondary-button" data-action="studio-save-project">${icon('check')} Save project</button>
      <button class="ghost-button" data-action="studio-new-project" ${file ? '' : 'disabled'}>${icon('refresh')} Start over</button>
    </div>
  </section>`;
}

function renderStudioSettingsPanel(project, category) {
  const video = category === 'video';
  const formats = video ? STUDIO_VIDEO_FORMATS : STUDIO_AUDIO_FORMATS;
  const selectedFormat = video ? project.output.videoFormat : project.output.audioFormat;
  const selectedRatios = video && Array.isArray(project.output.ratios) && project.output.ratios.length ? project.output.ratios : ['original'];
  const framing = project.output.framing || 'fill';
  const presets = [
    { id: 'source', label: 'Source', ratios: ['original'] },
    { id: 'longform', label: 'Long-form', ratios: ['landscape'] },
    { id: 'shorts', label: 'Shorts', ratios: ['portrait'] },
    { id: 'square', label: 'Square', ratios: ['square'] },
    { id: 'social', label: 'Social pack', ratios: ['landscape', 'portrait', 'square'] }
  ];
  const activePreset = presets.find((preset) => preset.ratios.slice().sort().join(',') === selectedRatios.slice().sort().join(','));
  const style = project.captionStyle;
  return `<div class="studio-inspector-section">
    <div class="studio-inspector-heading"><div><h2>Output settings</h2><p>Choose the format, caption delivery, and breathing room around each selected range.</p></div></div>
    <div class="studio-settings-block">
      <div class="field full"><label>Output folder</label><div class="studio-path-picker"><span title="${escapeHtml(project.output.directory)}">${escapeHtml(project.output.directory || 'No folder selected')}</span><button class="ghost-button" data-action="studio-choose-output">${icon('folder')} Change</button></div></div>
      <div class="form-grid studio-settings-grid">
        <div class="field"><label>Clip format</label><select data-studio-output="outputFormat">${selectOptions(formats, selectedFormat)}</select></div>
        <div class="field"><label>Padding</label><select data-studio-output="clipPaddingMs">${selectOptions([
          { value: '0', label: 'None' }, { value: '150', label: '150 ms' }, { value: '300', label: '300 ms' }, { value: '500', label: '500 ms' }
        ], String(project.clipPaddingMs))}</select></div>
        <div class="field"><label>Caption files</label><select data-studio-output="exportCaptions">${selectOptions([
          { value: 'srt', label: 'SRT sidecar' }, { value: 'vtt', label: 'VTT sidecar' }, { value: 'both', label: 'SRT + VTT' }, { value: 'none', label: 'No caption files' }
        ], project.output.exportCaptions)}</select></div>
        ${video ? `<div class="field"><label>Burn into video</label><label class="check-pill studio-check"><input type="checkbox" data-studio-output="burnCaptions" ${project.output.burnCaptions ? 'checked' : ''}><span>Visible captions</span></label></div>` : `<div class="field"><label>Caption delivery</label><div class="field-note">Audio clips use sidecar captions only.</div></div>`}
      </div>
      ${video ? `<div class="studio-creator-block">
        <div class="studio-style-head"><strong>Creator presets</strong><span>${activePreset ? escapeHtml(activePreset.label) : `${selectedRatios.length} formats selected`}</span></div>
        <div class="studio-preset-row">${presets.map((preset) => `<button class="${activePreset?.id === preset.id ? 'active' : ''}" data-action="studio-ratio-preset" data-ratios="${preset.ratios.join(',')}">${escapeHtml(preset.label)}</button>`).join('')}</div>
        <div class="studio-ratio-options">${studioRatioDefinitions().map((ratio) => `<label class="studio-ratio-option ${selectedRatios.includes(ratio.id) ? 'selected' : ''}"><input type="checkbox" data-studio-output="ratio" data-ratio="${escapeHtml(ratio.id)}" ${selectedRatios.includes(ratio.id) ? 'checked' : ''}><span>${icon(ratio.id === 'original' ? 'film' : ratio.id === 'portrait' || ratio.id === 'portrait45' ? 'captions' : 'frames')}<strong>${escapeHtml(ratio.shortLabel || ratio.label)}</strong><small>${ratio.width ? `${ratio.width}×${ratio.height}` : 'Source size'}</small></span></label>`).join('')}</div>
        <div class="studio-framing-options"><span>Framing</span><div>${studioFramingDefinitions().map((mode) => `<button class="${framing === mode.id ? 'active' : ''}" data-action="studio-framing" data-framing="${escapeHtml(mode.id)}" title="${escapeHtml(mode.description || '')}">${escapeHtml(mode.label)}</button>`).join('')}</div></div>
      </div>` : ''}
      ${video ? `<div class="studio-style-block"><div class="studio-style-head"><strong>Caption style</strong><span>Updates the preview live</span></div><div class="form-grid studio-style-grid">
        <div class="field"><label>Font size</label><input type="number" min="16" max="48" step="1" value="${Number(style.fontSize) || 24}" data-studio-style="fontSize"></div>
        <div class="field"><label>Text color</label><input type="color" value="${escapeHtml(style.color || '#FFFFFF')}" data-studio-style="color"></div>
        <div class="field"><label>Outline</label><input type="number" min="0" max="4" step="1" value="${Number(style.outline) || 0}" data-studio-style="outline"></div>
        <div class="field"><label>Position</label><select data-studio-style="position">${selectOptions([
          { value: 'bottom', label: 'Bottom' }, { value: 'center', label: 'Center' }, { value: 'top', label: 'Top' }
        ], style.position)}</select></div>
      </div></div>` : ''}
    </div>
  </div>`;
}

function renderStudioClipPanel(project, category) {
  return `<div class="studio-inspector-section">
    <div class="studio-inspector-heading"><div><h2>Clip queue</h2><p>${project.clips.length ? 'Preview or reorder clips before rendering. Outputs follow this order.' : 'Select transcript lines, then use Add to queue.'}</p></div></div>
    ${project.clips.length ? `<div class="studio-clip-list">${project.clips.map((clip, index) => `<div class="studio-clip-row">
      <div class="studio-clip-index">${String(index + 1).padStart(2, '0')}</div>
      <div class="studio-clip-body">
        <div class="studio-clip-top"><input value="${escapeHtml(clip.label)}" data-studio-clip-label="${escapeHtml(clip.id)}" maxlength="120" aria-label="Clip name"><span class="studio-time-chip">${formatStudioTime(clip.startMs)}-${formatStudioTime(clip.endMs)}</span></div>
        <p data-studio-clip-excerpt="${escapeHtml(clip.id)}">${escapeHtml(studioClipExcerpt(project, clip))}</p>
        <div class="studio-clip-actions"><button data-action="studio-preview-clip" data-id="${escapeHtml(clip.id)}">${icon('play')} Preview</button><button data-action="studio-move-clip" data-id="${escapeHtml(clip.id)}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>Up</button><button data-action="studio-move-clip" data-id="${escapeHtml(clip.id)}" data-dir="1" ${index === project.clips.length - 1 ? 'disabled' : ''}>Down</button><button class="danger-text" data-action="studio-remove-clip" data-id="${escapeHtml(clip.id)}">Remove</button></div>
      </div>
    </div>`).join('')}</div>` : `<div class="studio-clip-empty">${icon('scissors')}<div><strong>No clips queued</strong><span>Select one or more transcript lines to add the first clip.</span></div></div>`}
    <div class="studio-queue-note">${category === 'video' ? 'Video is re-encoded for frame-accurate cuts.' : 'Audio clips use the selected audio format.'} Caption sidecars are timed relative to each clip.</div>
  </div>`;
}

function renderStudioInspector(project, category) {
  const tab = state.studio.inspectorTab === 'output' ? 'output' : 'clips';
  const clipCount = project.clips.length;
  const ratioCount = category === 'video' ? Math.max(1, project.output.ratios?.length || 1) : 1;
  const outputCount = clipCount * ratioCount;
  const missing = Boolean(state.studio.mediaError);
  return `<div class="studio-inspector-tabs" role="tablist" aria-label="Studio inspector">
    <button class="${tab === 'clips' ? 'active' : ''}" data-action="studio-inspector-tab" data-tab="clips" role="tab" aria-selected="${tab === 'clips'}">${icon('scissors')} Clips <span>${clipCount}</span></button>
    <button class="${tab === 'output' ? 'active' : ''}" data-action="studio-inspector-tab" data-tab="output" role="tab" aria-selected="${tab === 'output'}">${icon('captions')} Output</button>
  </div>
  <div class="studio-inspector-content">${tab === 'clips' ? renderStudioClipPanel(project, category) : renderStudioSettingsPanel(project, category)}</div>
  <div class="studio-inspector-footer">
    <div class="studio-render-summary"><strong>${clipCount ? `${clipCount} clip${clipCount === 1 ? '' : 's'}` : 'No clips queued'}</strong><span data-studio-output-summary>${studioOutputSummary(project, category)}</span></div>
    <button class="primary-button studio-render-button" data-action="studio-render-clips" ${clipCount && !missing ? '' : 'disabled'}>${icon('play')} Render ${outputCount || 0} file${outputCount === 1 ? '' : 's'}</button>
  </div>`;
}

function studioOutputSummary(project, category) {
  const format = (category === 'video' ? project.output.videoFormat : project.output.audioFormat).toUpperCase();
  const captionLabels = { none: 'No sidecars', srt: 'SRT', vtt: 'VTT', both: 'SRT + VTT' };
  const captionMode = captionLabels[project.output.exportCaptions] || 'SRT';
  const ratios = category === 'video' && Array.isArray(project.output.ratios) && project.output.ratios.length ? project.output.ratios : ['original'];
  const ratioLabel = ratios.length === 1
    ? (studioRatioDefinition(ratios[0]).shortLabel || studioRatioDefinition(ratios[0]).label)
    : `${ratios.length} aspects`;
  const count = project.clips.length * ratios.length;
  return `${format} · ${ratioLabel} · ${category === 'video' && project.output.burnCaptions ? `${captionMode} + burned in` : captionMode} · ${count} file${count === 1 ? '' : 's'}`;
}

function updateStudioOutputSummary(project = state.studio.project) {
  const summary = document.querySelector('[data-studio-output-summary]');
  if (!summary || !project) return;
  summary.textContent = studioOutputSummary(project, studioMediaCategory());
}

function applyStudioPreviewFrame() {
  const project = state.studio.project;
  const frame = document.querySelector('[data-studio-frame]');
  if (!project || !frame) return;
  const ratio = studioRatioDefinition(state.studio.previewRatio);
  const framing = project.output.framing || 'fill';
  const stage = frame.closest('.studio-media-stage');
  const media = document.getElementById('studio-media');
  const naturalWidth = Number(media?.videoWidth) || 0;
  const naturalHeight = Number(media?.videoHeight) || 0;
  const sourceWidth = Number(ratio.width) || naturalWidth || 16;
  const sourceHeight = Number(ratio.height) || naturalHeight || 9;
  const audio = Boolean(stage?.classList.contains('audio'));
  frame.style.aspectRatio = audio ? '' : `${sourceWidth} / ${sourceHeight}`;
  if (audio || !stage) {
    frame.style.width = '';
    frame.style.height = '';
  } else {
    const stageStyle = getComputedStyle(stage);
    const horizontalPadding = (Number.parseFloat(stageStyle.paddingLeft) || 0) + (Number.parseFloat(stageStyle.paddingRight) || 0);
    const verticalPadding = (Number.parseFloat(stageStyle.paddingTop) || 0) + (Number.parseFloat(stageStyle.paddingBottom) || 0);
    const fitted = fitPreviewFrame(
      stage.clientWidth - horizontalPadding,
      stage.clientHeight - verticalPadding,
      sourceWidth,
      sourceHeight
    );
    frame.style.width = fitted ? `${fitted.width}px` : '';
    frame.style.height = fitted ? `${fitted.height}px` : '';
  }
  for (const mode of STUDIO_FRAMING_MODES) frame.classList.remove(`framing-${mode.id}`);
  frame.classList.add(`framing-${framing}`);
  const backdrop = document.getElementById('studio-media-backdrop');
  if (backdrop && media) {
    try {
      backdrop.currentTime = Number(media.currentTime) || 0;
      backdrop.playbackRate = media.playbackRate;
      if (media.paused) backdrop.pause();
      else backdrop.play().catch(() => {});
    } catch { /* the backdrop is optional preview decoration */ }
  }
  document.querySelectorAll('[data-action="studio-preview-ratio"]').forEach((button) => {
    button.classList.toggle('active', button.dataset.ratio === ratio.id);
  });
  document.querySelectorAll('[data-action="studio-framing"]').forEach((button) => {
    button.classList.toggle('active', button.dataset.framing === framing);
  });
  const current = document.querySelector('.studio-framing-current');
  if (current) current.textContent = studioFramingDefinitions().find((mode) => mode.id === framing)?.label || framing;
}

function setStudioPreviewRatio(id) {
  const ratio = studioRatioDefinition(id);
  state.studio.previewRatio = ratio.id;
  applyStudioPreviewFrame();
}

function setStudioFraming(id) {
  const project = state.studio.project;
  const mode = studioFramingDefinitions().find((entry) => entry.id === id);
  if (!project || !mode) return;
  project.output.framing = mode.id;
  markStudioDirty();
  applyStudioPreviewFrame();
  updateStudioOutputSummary(project);
}

function applyStudioRatioPreset(value) {
  const project = state.studio.project;
  if (!project) return;
  const available = new Set(studioRatioDefinitions().map((ratio) => ratio.id));
  const ratios = String(value || '').split(',').map((entry) => entry.trim()).filter((entry) => available.has(entry));
  if (!ratios.length) return;
  project.output.ratios = [...new Set(ratios)];
  if (!ratios.includes(state.studio.previewRatio)) state.studio.previewRatio = ratios[0];
  markStudioDirty();
  render();
}

function renderGif() {
  const options = state.options.gif;
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Source videos</h2><p>Create short, palette-optimized GIFs from any video clip.</p></div><span class="status-pill">${state.files.gif.length ? `${state.files.gif.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('gif', 'Drop videos for GIFs', 'MP4, MKV, MOV, WebM and more')}
          ${renderFileList('gif')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>GIF settings</h2><p>Shorter, narrower GIFs are much smaller and load faster.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Start time</label><input value="${escapeHtml(options.start)}" placeholder="00:00:00" data-tool="gif" data-option="start"></div>
            <div class="field"><label>Duration <span>seconds</span></label><input type="number" min="0.5" step="0.5" value="${escapeHtml(options.duration)}" data-tool="gif" data-option="duration"></div>
            <div class="field"><label>Frame rate</label><input type="number" min="1" max="30" step="1" value="${escapeHtml(options.fps)}" data-tool="gif" data-option="fps"></div>
            <div class="field"><label>Width <span>pixels</span></label><input type="number" min="120" max="1920" step="10" value="${escapeHtml(options.width)}" data-tool="gif" data-option="width"></div>
          </div>
          ${renderStartBar('gif', 'Create GIFs', 'The GIF is generated locally with an optimized color palette.', state.files.gif.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('gif')}
  </div>`;
}

function renderPdf() {
  const options = state.options.pdf;
  const needsPages = ['split', 'extract', 'reorder'].includes(options.operation);
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>PDF files</h2><p>All PDF work happens locally. Encrypted PDFs are rejected.</p></div><span class="status-pill">${state.files.pdf.length ? `${state.files.pdf.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('pdf', 'Drop PDFs', 'Merge, split, extract, reorder, or rotate')}
          ${renderFileList('pdf')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>PDF action</h2><p>${options.operation === 'merge' ? 'Every selected PDF is combined in order.' : 'Each selected PDF is processed separately.'}</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Operation</label><select data-tool="pdf" data-option="operation" data-rerender="true">${selectOptions([
              { value: 'merge', label: 'Merge PDFs' }, { value: 'split', label: 'Split into ranges' }, { value: 'extract', label: 'Extract pages' }, { value: 'reorder', label: 'Reorder pages' }, { value: 'rotate', label: 'Rotate all pages' }
            ], options.operation)}</select></div>
            ${needsPages ? `<div class="field"><label>Page selection</label><input value="${escapeHtml(options.pages)}" placeholder="1-3,5,8-10" data-tool="pdf" data-option="pages"><div class="field-note">Use commas for multiple pages or ranges.</div></div>` : ''}
            ${options.operation === 'rotate' ? `<div class="field"><label>Rotation</label><select data-tool="pdf" data-option="rotation">${selectOptions([{ value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '90° counter-clockwise' }], options.rotation)}</select></div>` : ''}
          </div>
          ${renderStartBar('pdf', options.operation === 'merge' ? 'Merge PDFs' : 'Process PDFs', options.operation === 'merge' && state.files.pdf.length < 2 ? 'Choose at least two PDFs to merge.' : 'Each PDF is processed separately.', state.files.pdf.length === 0 || (options.operation === 'merge' && state.files.pdf.length < 2))}
        </div>
      </div>
    </div>
    ${renderGuide('pdf')}
  </div>`;
}

function renderArchive() {
  const options = state.options.archive;
  const creating = options.operation !== 'extract';
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>${creating ? 'Files to pack' : 'Archives to extract'}</h2><p>${creating ? 'Selected files are stored together in one archive.' : 'Each archive is extracted into a new folder.'}</p></div><span class="status-pill">${state.files.archive.length ? `${state.files.archive.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('archive', creating ? 'Drop files' : 'Drop archives', creating ? 'ZIP, 7Z, TAR, TAR.GZ, or GZ output' : 'ZIP, 7Z, TAR, GZ, RAR, ISO and more')}
          ${renderFileList('archive')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Archive settings</h2><p>7-Zip runs locally and preserves folder structure.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Operation</label><select data-tool="archive" data-option="operation" data-rerender="true">${selectOptions([{ value: 'create', label: 'Create archive' }, { value: 'extract', label: 'Extract archive' }], options.operation)}</select></div>
            ${creating ? `<div class="field"><label>Archive format</label><select data-tool="archive" data-option="archiveFormat">${selectOptions([
              { value: 'zip', label: 'ZIP' }, { value: '7z', label: '7Z' }, { value: 'tar', label: 'TAR' }, { value: 'tar.gz', label: 'TAR.GZ' }, { value: 'gz', label: 'GZ · single file' }
            ], options.archiveFormat)}</select></div>` : ''}
            ${creating ? `<div class="field full"><label>Archive name <span>optional</span></label><input value="${escapeHtml(options.archiveName)}" placeholder="Defaults to the first file's name" data-tool="archive" data-option="archiveName"></div>` : ''}
          </div>
          ${renderStartBar('archive', creating ? 'Create archive' : 'Extract archives', creating ? 'One archive is created from this batch.' : 'Each archive gets its own extraction folder.', state.files.archive.length === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('archive')}
  </div>`;
}

function renderEncryptor() {
  const decrypting = state.options.encryptor.mode === 'decrypt';
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>${decrypting ? 'Encrypted files' : 'Files to encrypt'}</h2><p>${decrypting ? 'Choose OmniForge .ofenc files and restore their original contents.' : 'Every selected file is encrypted into its own .ofenc file.'}</p></div><span class="status-pill">${state.files.encryptor.length ? `${state.files.encryptor.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('encryptor', decrypting ? 'Drop .ofenc files' : 'Drop files to encrypt', decrypting ? 'Only files created by OmniForge are supported' : 'Any file type, including media, documents, and archives')}
          ${renderFileList('encryptor')}
        </div>
      </div>
      ${renderEncryptorSettings(decrypting)}
    </div>
    ${renderGuide('encryptor')}
  </div>`;
}

function renderEncryptorSettings(decrypting) {
  return `<div class="panel">
    <div class="panel-head"><div><h2>Encryption settings</h2><p>AES-256-GCM protects the contents and verifies that nothing was changed.</p></div><span class="status-pill">${icon('shield')} Local only</span></div>
    <div class="panel-body">
      <div class="field full" style="margin-bottom:14px">
        <label>Mode</label>
        <div class="segmented">
          <label><input type="radio" name="encryptor-mode" value="encrypt" data-tool="encryptor" data-option="mode" data-rerender="true" ${decrypting ? '' : 'checked'}><span>Encrypt files</span></label>
          <label><input type="radio" name="encryptor-mode" value="decrypt" data-tool="encryptor" data-option="mode" data-rerender="true" ${decrypting ? 'checked' : ''}><span>Decrypt files</span></label>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Password</label><input type="password" value="${escapeHtml(state.options.encryptor.password)}" data-tool="encryptor" data-option="password" maxlength="1024" autocomplete="${decrypting ? 'current-password' : 'new-password'}" spellcheck="false" placeholder="${decrypting ? 'Enter the file password' : 'At least 8 characters'}"><div class="field-note">${decrypting ? 'The password is only held in memory while the job runs.' : 'Use a long, unique password. It cannot be recovered.'}</div></div>
        ${decrypting ? '' : `<div class="field"><label>Confirm password</label><input type="password" value="${escapeHtml(state.options.encryptor.confirm)}" data-tool="encryptor" data-option="confirm" maxlength="1024" autocomplete="new-password" spellcheck="false" placeholder="Repeat the password"><div class="field-note">Both passwords must match before encryption starts.</div></div>`}
      </div>
      <div class="legal-note">${icon('alert')} OmniForge does not store or transmit passwords. If you lose the password, the encrypted file cannot be recovered.</div>
      ${renderStartBar('encryptor', decrypting ? 'Decrypt files' : 'Encrypt files', decrypting ? 'Original file names are restored from authenticated metadata.' : 'Each file becomes a separate .ofenc file in the output folder.', state.files.encryptor.length === 0)}
    </div>
  </div>`;
}

function renderChecksum() {
  const options = state.options.checksum;
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Files to verify</h2><p>Checksums are streamed from disk and never uploaded.</p></div><span class="status-pill">${state.files.checksum.length ? `${state.files.checksum.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('checksum', 'Drop files to hash', 'Any file type, including archives and media')}
          ${renderFileList('checksum')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Algorithms</h2><p>Select one or more digests to calculate together.</p></div></div>
        <div class="panel-body">
          <div class="check-row">
            ${[['md5', 'MD5'], ['sha1', 'SHA-1'], ['sha256', 'SHA-256']].map(([value, label]) => `<label class="check-pill"><input type="checkbox" value="${value}" data-tool="checksum" data-algorithm="${value}" ${options.algorithms.includes(value) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
          </div>
          ${renderStartBar('checksum', 'Calculate checksums', 'No output folder is needed.', state.files.checksum.length === 0)}
        </div>
      </div>
      ${renderResults('checksum')}
    </div>
    ${renderGuide('checksum')}
  </div>`;
}

function renderInfo() {
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Media to inspect</h2><p>Read container, codec, resolution, duration, and bitrate information.</p></div><span class="status-pill">${state.files.info.length ? `${state.files.info.length} ready` : 'No files'}</span></div>
        <div class="panel-body">
          ${renderDropzone('info', 'Drop media or any file', 'Video and audio give the richest results')}
          ${renderFileList('info')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Inspection</h2><p>FFprobe reads the file directly and returns a technical summary.</p></div></div>
        <div class="panel-body">
          ${renderStartBar('info', 'Inspect files', 'No output folder is needed.', state.files.info.length === 0)}
        </div>
      </div>
      ${renderResults('info')}
    </div>
    ${renderGuide('info')}
  </div>`;
}

function renderMetadata() {
  const count = state.files.metadata.length;
  const status = count ? `${count} ready` : 'No files';
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Media to clean</h2><p>Remove identifying metadata without changing the underlying image or media streams.</p></div><span class="status-pill">${escapeHtml(status)}</span></div>
        <div class="panel-body">
          ${renderDropzone('metadata', 'Drop media to clean', 'JPEG, PNG, WebP, audio, and video')}
          ${renderFileList('metadata')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Metadata removal</h2><p>JPEG EXIF/XMP/IPTC/comments, PNG text chunks, WebP EXIF/XMP, and media tags/chapters are removed.</p></div></div>
        <div class="panel-body">
          <div class="legal-note">${icon('alert')} Image data, ICC color profiles, animation, and media streams are preserved. Cleaned files are written as copies with a _clean suffix.</div>
          ${renderStartBar('metadata', 'Remove metadata', 'Choose an output folder for the cleaned copies.', count === 0)}
        </div>
      </div>
    </div>
    ${renderGuide('metadata')}
  </div>`;
}

function renderShred() {
  const options = state.options.shred;
  const passOptions = selectOptions([
    { value: '1', label: '1 pass', hint: 'Fastest' },
    { value: '3', label: '3 passes', hint: 'Recommended' },
    { value: '7', label: '7 passes', hint: 'Most thorough' }
  ], options.passes);
  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Files to destroy</h2><p>These files will be overwritten and removed. There is no undo.</p></div><span class="status-pill">Destructive</span></div>
        <div class="panel-body">
          ${renderDropzone('shred', 'Drop files to securely delete', 'Directories and symbolic links are rejected')}
          ${renderFileList('shred')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Overwrite passes</h2><p>More passes take longer and cannot guarantee removal from every storage technology.</p></div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="field"><label>Passes</label><select data-tool="shred" data-option="passes">${passOptions}</select></div>
          </div>
          <label class="check-pill" style="margin-top:14px"><input type="checkbox" data-tool="shred" data-option="acknowledged" ${options.acknowledged ? 'checked' : ''}><span>I understand SSD wear leveling, backups, cloud copies, and snapshots may retain copies.</span></label>
          <div class="legal-note">${icon('alert')} Secure Delete overwrites each file with random data, flushes every pass, truncates it, renames it randomly, and deletes it. Cancelling may leave a partially overwritten file.</div>
          ${renderStartBar('shred', 'Securely delete files', 'No output folder is needed. This action cannot be undone.', state.files.shred.length === 0 || !options.acknowledged)}
        </div>
      </div>
    </div>
    ${renderGuide('shred')}
  </div>`;
}

function renderResults(tool) {
  const results = state.results.filter((result) => result.tool === tool).slice(0, 8);
  if (!results.length) return '';
  return `<div class="panel result-panel">
    <div class="panel-head"><div><h2>${tool === 'checksum' ? 'Checksum results' : 'Inspection results'}</h2><p>${results.length} recent result${results.length === 1 ? '' : 's'}.</p></div><button class="ghost-button" data-action="clear-results" data-tool="${tool}">Clear</button></div>
    <div class="panel-body">${results.map((result) => tool === 'checksum' ? checksumResultCard(result) : infoResultCard(result)).join('')}</div>
  </div>`;
}

function checksumResultCard(result) {
  const rows = (result.data?.results || []).map((entry) => {
    const values = Object.entries(entry.values || {}).map(([algorithm, digest]) => `<div class="hash-row"><span class="hash-label">${escapeHtml(algorithm)}</span><span class="hash-value" title="${escapeHtml(digest)}">${escapeHtml(digest)}</span><button class="copy-button" data-action="copy-text" data-value="${escapeHtml(digest)}">Copy</button></div>`).join('');
    return `<div class="result-card"><div class="result-card-head"><strong>${escapeHtml(entry.fileName)}</strong><span>${formatBytes(entry.size)}</span></div>${values}</div>`;
  }).join('');
  return `<div class="result-list">${rows}</div>`;
}

function infoResultCard(result) {
  return (result.data?.results || []).map((entry) => `<div class="result-card" style="margin-bottom:9px">
    <div class="result-card-head"><strong>${escapeHtml(entry.fileName)}</strong><span>${formatBytes(entry.size)} · ${escapeHtml(entry.format)}</span></div>
    <div class="info-grid">
      <div class="info-cell"><span>Duration</span><strong>${entry.duration ? formatDuration(entry.duration) : '—'}</strong></div>
      <div class="info-cell"><span>Bitrate</span><strong>${entry.bitrate ? `${(entry.bitrate / 1000).toFixed(0)} kbps` : '—'}</strong></div>
      <div class="info-cell"><span>Container</span><strong>${escapeHtml(entry.format)}</strong></div>
      ${entry.video ? `<div class="info-cell"><span>Video</span><strong>${escapeHtml(entry.video.codec)}</strong></div><div class="info-cell"><span>Resolution</span><strong>${entry.video.width || '?'} × ${entry.video.height || '?'}</strong></div><div class="info-cell"><span>Frame rate</span><strong>${escapeHtml(entry.video.fps || '—')}</strong></div>` : ''}
      ${entry.audio ? `<div class="info-cell"><span>Audio</span><strong>${escapeHtml(entry.audio.codec)}</strong></div><div class="info-cell"><span>Channels</span><strong>${entry.audio.channels || '—'}</strong></div><div class="info-cell"><span>Sample rate</span><strong>${entry.audio.sampleRate ? `${entry.audio.sampleRate} Hz` : '—'}</strong></div>` : ''}
    </div>
  </div>`).join('');
}

function renderSettings() {
  const tools = state.status?.tools || {};
  const concurrency = configuredConcurrency();
  const notifyOnFailure = state.settings?.notifyOnFailure !== false;
  const toolRows = [
    ['ffmpeg', 'FFmpeg', 'Media conversion engine'],
    ['ffprobe', 'FFprobe', 'Media inspection engine'],
    ['ytDlp', 'yt-dlp', 'YouTube extraction engine'],
    ['deno', 'Deno', 'JavaScript runtime for YouTube'],
    ['sevenZip', '7-Zip', 'Archive engine'],
    ['speech', 'Whisper', 'Local speech-to-text engine']
  ];
    const appVersion = state.status?.appVersion || 'Unknown';
    const updateInfo = state.updateInfo;
    const latestUpdate = updateInfo?.latest;
    const latestSource = latestUpdate?.source || updateInfo?.source || 'none';
    const progress = state.updateProgress;
    const downloading = state.updateDownloading || ['downloading', 'verifying'].includes(progress?.phase);
    const progressPercent = Number.isFinite(progress?.percent) ? Math.max(0, Math.min(100, progress.percent)) : null;
    const publishedHash = latestUpdate?.sha256 || latestUpdate?.hash?.expected || null;
    const githubError = updateInfo?.github?.status === 'unavailable' ? updateInfo.github.error : null;
    const noPublishedRelease = updateInfo?.github?.status === 'no-release';
    const releaseDate = latestUpdate?.publishedAt ? new Date(latestUpdate.publishedAt).toLocaleDateString() : null;
    const updateHash = latestUpdate?.hash || null;
    const hashBlocked = updateHash?.status === 'mismatch' || updateHash?.status === 'malformed';
    const hashLabel = updateHash?.status === 'valid' ? 'SHA-256 verified' : updateHash?.status === 'missing' ? 'No .sha256 sidecar' : updateHash?.status ? 'Hash verification failed' : 'Hash pending';
    const updateFolder = state.settings?.updateFolder || 'No update folder selected';
    let updateTitle = 'Not checked yet';
    let updateText = 'Check GitHub Releases for the newest OmniForge build.';
    let updateTone = '';
    let updateIcon = 'refresh';
    if (state.updateChecking) {
      updateTitle = 'Checking for updates…';
      updateText = 'Looking for the newest OmniForge GitHub release.';
      updateTone = 'checking';
      updateIcon = 'refresh';
    } else if (downloading) {
      const percentText = progressPercent === null ? formatBytes(progress?.receivedBytes || 0) : `${progressPercent}%`;
      updateTitle = progress?.phase === 'verifying' ? `Verifying OmniForge ${progress.version}...` : `Downloading OmniForge ${progress?.version || ''}...`;
      updateText = progress?.phase === 'verifying'
        ? 'Checking the downloaded installer against the published SHA-256 hash.'
        : `${percentText}${progress?.totalBytes ? ` of ${formatBytes(progress.totalBytes)}` : ''}`;
      updateTone = 'checking';
      updateIcon = 'download';
    } else if (updateInfo?.newer && latestUpdate) {
      updateTitle = `Version ${latestUpdate.version} is available`;
      const sourceText = latestSource === 'github'
        ? `GitHub release${releaseDate ? ` from ${releaseDate}` : ''} - ${formatBytes(latestUpdate.size || 0)} - SHA-256 published`
        : `Offline installer - ${formatBytes(latestUpdate.size || 0)} - ${hashLabel}`;
      updateText = `${sourceText}${githubError ? ' GitHub could not be checked.' : ''}`;
      updateTone = 'available';
      updateIcon = 'download';
    } else if (githubError) {
      updateTitle = 'GitHub could not be checked';
      updateText = `${githubError} Use an offline installer below.`;
      updateTone = 'missing';
      updateIcon = 'alert';
    } else if (noPublishedRelease) {
      updateTitle = 'No published GitHub release';
      updateText = 'Publish a vX.Y.Z release with the installer and .sha256 asset, or use an offline installer below.';
      updateTone = 'missing';
      updateIcon = 'info';
    } else if (updateInfo && !updateInfo.exists) {
      updateTitle = 'Update folder not found';
      updateText = 'Choose a folder that contains OmniForge installers.';
      updateTone = 'missing';
      updateIcon = 'folder';
    } else if (updateInfo?.latest) {
      updateTitle = 'OmniForge is up to date';
      updateText = `Version ${updateInfo.currentVersion} is the newest published build.`;
      updateTone = 'current';
      updateIcon = 'check';
    } else if (updateInfo) {
      updateTitle = 'No updates found';
      updateText = 'Use an offline installer below if you already downloaded a newer build.';
      updateTone = 'current';
      updateIcon = 'info';
    }  return `<div class="tool-layout">
    <div style="display:grid;gap:14px">
      <div class="panel">
        <div class="panel-head"><div><h2>Bundled engines</h2><p>These tools ship with OmniForge and run locally.</p></div><button class="secondary-button" data-action="refresh-status">${icon('refresh')} Refresh</button></div>
        <div class="panel-body">
          <div class="engine-grid">
            ${toolRows.map(([key, name, description]) => {
              const tool = tools[key] || {};
              return `<div class="engine-item"><span class="nav-icon">${icon(key === 'sevenZip' ? 'archive' : key === 'deno' ? 'braces' : key === 'ytDlp' ? 'download' : key === 'ffprobe' ? 'info' : key === 'speech' ? 'mic' : 'film')}</span><div class="engine-item-copy"><strong>${name}</strong><span title="${escapeHtml(tool.version || description)}">${escapeHtml(tool.version || description)}</span></div><span class="status-pill ${tool.available ? 'succeeded' : 'failed'}">${tool.available ? 'ready' : 'missing'}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Output behavior</h2><p>OmniForge asks where to save each job by remembering only your last folder.</p></div></div>
        <div class="panel-body">
          <div class="settings-block">
            <div class="settings-row"><div class="settings-row-copy"><strong>Output location</strong><span>Choose each time a batch starts. The last folder is used as the default.</span></div><span class="settings-value">${escapeHtml(state.settings?.lastOutputDir || 'No folder chosen yet')}</span></div>
            <div class="settings-row"><div class="settings-row-copy"><strong>Parallel jobs</strong><span>Run up to three local jobs at once. Lowering this limit lets active jobs finish without cancelling them.</span></div><select class="settings-select" data-setting="jobConcurrency" aria-label="Parallel jobs">${selectOptions([{ value: '1', label: '1 job' }, { value: '2', label: '2 jobs' }, { value: '3', label: '3 jobs' }], concurrency)}</select></div>
            <div class="settings-row"><div class="settings-row-copy"><strong>Failure notifications</strong><span>Show a Windows notification when a background job fails. Successful jobs stay quiet.</span></div><label class="check-pill"><input type="checkbox" data-setting="notifyOnFailure" ${notifyOnFailure ? 'checked' : ''}><span>Enabled</span></label></div>
            <div class="settings-row"><div class="settings-row-copy"><strong>History</strong><span>The last 50 finished jobs are remembered on this PC.</span></div><span class="settings-value">${state.history.length} saved</span></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Tool recipes</h2><p>Save frequently used option combinations and apply them from any tool or the command palette.</p></div><span class="status-pill" data-recipe-count>${savedRecipes().length}</span></div>
        <div class="panel-body">
          <div class="recipe-manager">${recipeRowsMarkup(savedRecipes())}</div>
          <div class="legal-note">${icon('shield')} Recipes only store tool options. URLs, output folders, passwords, file lists, and Studio project data are never saved.</div>
        </div>
      </div>
              <div class="panel">
          <div class="panel-head"><div><h2>Application updates</h2><p>Install a newer build without uninstalling OmniForge.</p></div><span class="status-pill">v${escapeHtml(appVersion)}</span></div>
          <div class="panel-body">
            <div class="settings-row">
              <div class="settings-row-copy"><strong>GitHub Releases</strong><span>Checks the public OmniForge release feed. Downloads are verified before they can run.</span></div>
              <div class="action-buttons">
                ${latestUpdate?.releaseUrl ? `<button class="secondary-button" data-action="open-update-release">${icon('link')} Release notes</button>` : ''}
                <button class="secondary-button" data-action="check-updates" ${state.updateChecking ? 'disabled' : ''}>${icon('refresh')} Check now</button>
              </div>
            </div>
            <div class="update-status-card ${updateTone}">
              <div class="update-status-icon">${icon(updateIcon, updateIcon === 'refresh' && state.updateChecking ? 'spin' : '')}</div>
              <div class="update-status-copy"><strong>${escapeHtml(updateTitle)}</strong><span>${escapeHtml(updateText)}</span></div>
              ${downloading ? `<button class="primary-button" disabled>${icon('refresh', 'spin')} ${progressPercent === null ? 'Downloading' : `${progressPercent}%`}</button>` : updateInfo?.newer && latestUpdate ? (latestSource === 'github' && !(latestUpdate.path && latestUpdate.hash?.status === 'valid') ? `<button class="primary-button" data-action="download-update" data-version="${escapeHtml(latestUpdate.version)}">${icon('download')} Download</button>` : `<button class="primary-button" data-action="install-update" data-path="${escapeHtml(latestUpdate.path)}" data-version="${escapeHtml(latestUpdate.version)}" ${hashBlocked ? 'disabled' : ''}>${icon('download')} ${hashBlocked ? 'Hash mismatch' : 'Install'}</button>`) : `<button class="secondary-button" data-action="check-updates" ${state.updateChecking ? 'disabled' : ''}>${icon('refresh')} Check now</button>`}
            </div>
            ${downloading || progress?.phase === 'ready' ? `<div class="update-progress">
              <div class="update-progress-head"><span>${progress?.phase === 'verifying' ? 'Verifying SHA-256' : progress?.phase === 'ready' ? 'Verified and ready' : 'Downloading installer'}</span><span>${progressPercent === null ? formatBytes(progress?.receivedBytes || 0) : `${progressPercent}%`}</span></div>
              <div class="update-progress-track"><span style="width:${progressPercent === null ? 8 : progressPercent}%"></span></div>
              <div class="update-progress-meta">${formatBytes(progress?.receivedBytes || 0)}${progress?.totalBytes ? ` of ${formatBytes(progress.totalBytes)}` : ''}${progress?.actualHash ? ` - SHA-256 ${escapeHtml(progress.actualHash)}` : ''}</div>
            </div>` : ''}
            ${publishedHash ? `<div class="update-hash-row"><span>SHA-256</span><code title="${escapeHtml(publishedHash)}">${escapeHtml(publishedHash)}</code><button class="copy-button" data-action="copy-text" data-value="${escapeHtml(publishedHash)}">Copy</button></div>` : ''}
            <div class="update-offline">
              <div class="update-offline-head"><strong>Offline installer</strong><span>Use this if GitHub is unavailable or you downloaded a setup file elsewhere.</span></div>
              <div class="settings-row">
                <div class="settings-row-copy"><strong>Update folder</strong><span>Place newer OmniForge-Setup-x.y.z.exe files in this folder.</span></div>
                <div class="action-buttons">
                  <button class="secondary-button" data-action="open-update-folder">${icon('folder')} Open</button>
                  <button class="secondary-button" data-action="choose-update-folder">${icon('folder')} Change</button>
                </div>
              </div>
              <div class="settings-value update-folder-path">${escapeHtml(updateFolder)}</div>
              <div class="update-dropzone" id="update-dropzone" data-action="choose-update-installer" role="button" tabindex="0" aria-label="Drop an OmniForge installer to update">
                <div class="update-dropzone-icon">${icon('upload')}</div>
                <div class="update-dropzone-copy">
                  <strong>Drop a newer installer here</strong>
                  <span>OmniForge checks the version and adjacent .sha256 sidecar, confirms, then opens the installer.</span>
                </div>
                <span class="update-dropzone-badge">.exe</span>
              </div>
            </div>
            <div class="legal-note">${icon('alert')} This release is unsigned, so Windows SmartScreen may warn. Confirm the SHA-256 hash before running the installer. GitHub downloads fail closed when the hash is missing or mismatched, and OmniForge never installs an update without confirmation.</div>
          </div>
        </div><div class="panel">
        <div class="panel-head"><div><h2>YouTube engine</h2><p>YouTube changes often. Update yt-dlp if downloads stop working.</p></div></div>
        <div class="panel-body">
          <div class="settings-row">
            <div class="settings-row-copy"><strong>Update yt-dlp</strong><span>Downloads the latest nightly build to the app's writable runtime folder. Requires internet.</span></div>
            <button class="secondary-button" data-action="update-ytdlp">${icon('refresh')} Check for updates</button>
          </div>
          <div class="legal-note">${icon('alert')} Download only content you own or have permission to download. Respect YouTube's terms and local copyright law.</div>
        </div>
      </div>
    </div>
    <aside class="panel side-panel">
      <div class="tool-icon side-icon" style="--icon-color: var(--cyan)">${icon('harddrive')}</div>
      <h3>OmniForge ${escapeHtml(state.status?.appVersion || 'Unknown')}</h3>
      <p>Windows ${escapeHtml(state.status?.arch || '')} · Electron desktop app · Local-first by design.</p>
      <div class="side-list">
        <button class="secondary-button" data-action="open-tools" style="width:100%">${icon('folder')} Open tools folder</button>
        <button class="secondary-button" data-action="open-history" style="width:100%">${icon('queue')} Open job queue</button>
      </div>
    </aside>
  </div>`;
}

function updateEngineStatus() {
  if (!state.status) return;
  const tools = state.status.tools || {};
  const allReady = Object.values(tools).every((tool) => tool.available);
  const engineCard = document.getElementById('engine-card');
  engineCard.classList.toggle('degraded', !allReady);
  document.getElementById('engine-title').textContent = allReady ? 'All engines ready' : 'Setup needed';
  const ffmpegVersion = String(tools.ffmpeg?.version || '').replace(/^ffmpeg version\s*/i, '').split(' ')[0];
  document.getElementById('engine-subtitle').textContent = allReady ? `FFmpeg ${ffmpegVersion || ''} / Whisper local` : 'Open settings to review';
  const pip = document.querySelector('[data-view="youtube"] .nav-pip');
  if (pip) pip.classList.toggle('hidden', Boolean(tools.ytDlp?.available));
}

async function refreshStatus(showMessage = false) {
  try {
    state.status = await api.getSystemStatus();
    state.settings = state.status.settings;
    state.history = await api.getHistory();
    mergeHistoryJobs(state.history);
    applyJobSnapshots(await api.listJobs());
    updateEngineStatus();
    if (showMessage) showToast('Engine status refreshed.', 'success');
    render();
  } catch (error) {
    showToast(`Could not refresh engine status: ${error.message}`, 'error');
  }
}

async function addPaths(tool, paths, fileObjects = []) {
  if (!paths.length) return;
  if (tool === 'studio' && state.files.studio.length > 0) {
    showToast('Remove the current Studio media before choosing another file.', 'error');
    return;
  }
  const metadata = await api.getFileMetadata(paths);
  const allowed = ALLOWED_CATEGORIES[tool];
  let skipped = 0;
  const existing = new Set(state.files[tool].map((file) => file.path.toLowerCase()));
  const byName = new Map(fileObjects.map((file) => [file.name, file]));
  for (const meta of metadata) {
    if (!meta.path || !meta.isFile) { skipped += 1; continue; }
    const name = meta.name || meta.path.split(/[\\/]/).pop();
    const ext = extensionFor(name);
    const category = categoryFor(ext, name);
    if (allowed && !allowed.includes(category)) { skipped += 1; continue; }
    if (tool === 'encryptor') {
      const wantsEncrypted = state.options.encryptor.mode === 'decrypt';
      if ((ext === 'ofenc') !== wantsEncrypted) { skipped += 1; continue; }
    }
    if (existing.has(meta.path.toLowerCase())) continue;
    const dropped = byName.get(name);
    state.files[tool].push({
      path: meta.path,
      name,
      ext,
      category,
      size: Number(dropped?.size) || Number(meta.size) || 0
    });
    existing.add(meta.path.toLowerCase());
    if (tool === 'studio') break;
  }
  if (skipped) showToast(`${skipped} file${skipped === 1 ? ' was' : 's were'} skipped because the type does not fit this tool.`, 'error');
  if (tool === 'studio' && paths.length > 1) showToast('Only one Studio media file can be added per project.', 'error');
  if (tool === 'join' && state.files.join.length > 0) {
    const joinCategory = state.files.join[0].category;
    const currentCategory = formatInfo(state.options.join.outputFormat)?.category;
    if (joinCategory === 'audio' && currentCategory !== 'audio') state.options.join.outputFormat = 'mp3';
    if (joinCategory === 'video' && currentCategory !== 'video') state.options.join.outputFormat = 'mp4';
  }
  if (tool === 'convert' && state.view === 'home') {
    state.view = 'convert';
    state.resetScroll = true;
    closeQueue();
  }
  if (tool === 'studio') {
    await loadStudioMedia(state.files.studio[0], true);
    return;
  }
  render();
}

async function pickFiles(tool) {
  try {
    const paths = await api.chooseFiles();
    if (paths.length) await addPaths(tool, paths);
  } catch (error) {
    showToast(`Could not open the file picker: ${error.message}`, 'error');
  }
}

function removeFile(tool, index) {
  if (!state.files[tool]) return;
  if (tool === 'studio' && !studioDiscardConfirmation()) return;
  state.files[tool].splice(index, 1);
  if (tool === 'studio') {
    state.studio.project = null;
    state.studio.projectPath = null;
    state.studio.matchVideo = null;
    state.studio.dirty = false;
    state.studio.mediaUrl = '';
    state.studio.mediaError = '';
    resetStudioSelection();
    clearStudioRecovery().catch(() => {});
  }
  render();
}

function moveFile(tool, index, direction) {
  const files = state.files[tool];
  if (!files || index < 0 || index >= files.length) return;
  const next = index + Number(direction);
  if (next < 0 || next >= files.length) return;
  const [file] = files.splice(index, 1);
  files.splice(next, 0, file);
  render();
}

function makeSpec(tool, inputPaths, outputDirectory, options, label) {
  return { tool, inputPaths, outputDirectory, options, label };
}

function batchSpecs(tool, outputDirectory) {
  const files = state.files[tool];
  const options = { ...state.options[tool] };
  if (tool === 'youtube') {
    return [makeSpec('youtube', [], outputDirectory, {
      url: options.url.trim(),
      mode: options.mode,
      quality: options.quality,
      audioFormat: options.audioFormat,
      title: state.ytMeta?.title || 'YouTube download'
    }, state.ytMeta?.title || 'YouTube download')];
  }
  if (tool === 'join') {
    return [makeSpec('join', files.map((file) => file.path), outputDirectory, { ...options }, options.joinName || 'Joined media')];
  }
  if (tool === 'pdf') {
    if (options.operation === 'merge') {
      return [makeSpec('pdf', files.map((file) => file.path), outputDirectory, { ...options }, `Merge ${files.length} PDFs`)];
    }
    return files.map((file) => makeSpec('pdf', [file.path], outputDirectory, { ...options }, `${file.name} · ${options.operation}`));
  }
  if (tool === 'archive') {
    if (options.operation === 'create') {
      return [makeSpec('archive', files.map((file) => file.path), outputDirectory, { ...options }, `Create ${options.archiveFormat.toUpperCase()} archive`)];
    }
    return files.map((file) => makeSpec('archive', [file.path], outputDirectory, { ...options }, file.name));
  }
  if (tool === 'encryptor') {
    return files.map((file) => makeSpec('encryptor', [file.path], outputDirectory, { ...options }, `${file.name} · ${options.mode === 'decrypt' ? 'Decrypt' : 'Encrypt'}`));
  }
  return files.map((file) => makeSpec(tool, [file.path], outputDirectory, { ...options }, file.name));
}

function cloneStudioProject() {
  return state.studio.project ? JSON.parse(JSON.stringify(state.studio.project)) : null;
}

function studioBaseName(filePath) {
  const name = baseName(filePath);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function resetStudioSelection() {
  state.studio.selectionAnchor = null;
  state.studio.selectedIds = [];
  state.studio.auditionEndMs = 0;
}

function markStudioDirty() {
  if (!state.studio.project) return;
  state.studio.dirty = true;
  const saveState = document.querySelector('[data-studio-save-state]');
  if (saveState) {
    saveState.textContent = 'Unsaved changes';
    saveState.classList.add('studio-unsaved');
  }
  scheduleStudioRecovery();
}

function scheduleStudioRecovery() {
  if (state.studio.recoveryTimer) clearTimeout(state.studio.recoveryTimer);
  state.studio.recoveryTimer = setTimeout(() => {
    state.studio.recoveryTimer = null;
    persistStudioRecovery().catch(() => {});
  }, 600);
}

async function persistStudioRecovery() {
  const project = cloneStudioProject();
  if (!project?.mediaPath || !state.studio.dirty) return;
  await api.saveStudioRecovery({ project, projectPath: state.studio.projectPath });
}

async function clearStudioRecovery(silent = true) {
  if (state.studio.recoveryTimer) {
    clearTimeout(state.studio.recoveryTimer);
    state.studio.recoveryTimer = null;
  }
  try {
    await api.clearStudioRecovery();
    state.studio.recovery = null;
  } catch (error) {
    if (!silent) showToast(error.message || String(error), 'error');
  }
}

function studioDiscardConfirmation() {
  if (!state.studio.dirty) return true;
  return window.confirm('Discard unsaved Transcript Clip Studio changes?');
}

async function applyStudioProject(project, projectPath = null, options = {}) {
  if (!project) return;
  state.studio.project = JSON.parse(JSON.stringify(project));
  state.studio.projectPath = projectPath || null;
  state.studio.dirty = options.dirty === true;
  state.studio.matchVideo = null;
  state.studio.mediaUrl = '';
  state.studio.mediaError = '';
  state.studio.pendingSeekMs = 0;
  state.studio.inspectorTab = 'clips';
  const ratios = Array.isArray(project.output?.ratios) && project.output.ratios.length ? project.output.ratios : ['original'];
  state.studio.previewRatio = ratios.includes('original') ? 'original' : ratios[0];
  state.options.studio.language = project.language || 'auto';
  resetStudioSelection();
  state.studio.search = '';

  const metadata = await api.getFileMetadata([project.mediaPath]);
  const meta = metadata[0];
  const name = meta?.name || baseName(project.mediaPath);
  const ext = extensionFor(name);
  const category = categoryFor(ext, name);
  state.files.studio = [{
    path: project.mediaPath,
    name,
    ext,
    category,
    size: Number(meta?.size) || 0
  }];

  if (meta?.isFile && !options.mediaMissing) {
    try {
      const media = await api.getStudioMediaUrl(project.mediaPath);
      state.studio.mediaUrl = media.url;
      state.studio.project.mediaPath = media.path;
      state.studio.matchVideo = media.matchVideo || null;
    } catch (error) {
      state.studio.mediaError = error.message || 'Media could not be loaded.';
    }
  } else {
    state.studio.mediaError = 'The project media file could not be found. Relink it to continue.';
  }
  if (state.studio.dirty) scheduleStudioRecovery();
  render();
}

async function loadStudioMedia(file, createProject = false) {
  if (!file) return;
  if (!createProject && !studioDiscardConfirmation()) return;
  const project = defaultStudioProject(file.path);
  project.language = state.options.studio.language || 'auto';
  state.studio.project = project;
  state.studio.projectPath = null;
  state.studio.matchVideo = null;
  state.studio.mediaUrl = '';
  state.studio.mediaError = '';
  state.studio.pendingSeekMs = 0;
  state.studio.inspectorTab = 'clips';
  state.studio.previewRatio = 'original';
  resetStudioSelection();
  state.studio.search = '';
  try {
    const media = await api.getStudioMediaUrl(file.path);
    state.studio.mediaUrl = media.url;
    state.studio.project.mediaPath = media.path;
    state.studio.matchVideo = media.matchVideo || null;
    state.studio.dirty = true;
    scheduleStudioRecovery();
  } catch (error) {
    state.studio.mediaError = error.message || 'Media could not be loaded.';
    state.studio.dirty = false;
  }
  render();
}

async function newStudioProject() {
  const file = state.files.studio[0];
  if (!file) return;
  if (!studioDiscardConfirmation()) return;
  await loadStudioMedia(file, true);
  showToast('Started a new Studio project from this media file.', 'success');
}

async function replaceStudioMedia() {
  if (!studioDiscardConfirmation()) return;
  try {
    const paths = await api.chooseFiles();
    if (!paths.length) return;
    await clearStudioRecovery();
    state.files.studio = [];
    await addPaths('studio', paths);
  } catch (error) {
    showToast(`Could not replace the Studio media: ${error.message}`, 'error', 7000);
  }
}

async function openStudioProject() {
  if (!studioDiscardConfirmation()) return;
  try {
    const result = await api.openStudioProject();
    if (result.canceled) return;
    await applyStudioProject(result.project, result.projectPath, { dirty: false, mediaMissing: result.mediaMissing });
    showToast(result.mediaMissing ? 'Project opened, but its media needs relinking.' : 'Studio project opened.', result.mediaMissing ? 'error' : 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function saveStudioProject(saveAs = false) {
  const project = cloneStudioProject();
  if (!project) return;
  try {
    const result = await api.saveStudioProject(project, {
      projectPath: state.studio.projectPath,
      saveAs
    });
    if (result.canceled) return;
    state.studio.project = result.project;
    state.studio.projectPath = result.projectPath;
    state.studio.dirty = false;
    await clearStudioRecovery();
    render();
    showToast('Studio project saved.', 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function relinkStudioMedia() {
  try {
    const paths = await api.chooseFiles();
    if (!paths.length) return;
    const metadata = await api.getFileMetadata([paths[0]]);
    const meta = metadata[0];
    if (!meta?.isFile) throw new Error('Choose an existing audio or video file.');
    const ext = extensionFor(meta.name);
    const category = categoryFor(ext, meta.name);
    if (!['audio', 'video'].includes(category)) throw new Error('Choose an audio or video file.');
    state.files.studio = [{ path: meta.path, name: meta.name, ext, category, size: Number(meta.size) || 0 }];
    state.studio.project.mediaPath = meta.path;
    state.studio.project.durationMs = 0;
    const media = await api.getStudioMediaUrl(meta.path);
    state.studio.mediaUrl = media.url;
    state.studio.matchVideo = media.matchVideo || null;
    state.studio.mediaError = '';
    markStudioDirty();
    render();
    showToast('Studio media relinked.', 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function useStudioMatchVideo() {
  const match = state.studio.matchVideo;
  if (!match) return;
  try {
    const media = await api.getStudioMediaUrl(match.path);
    const metadata = await api.getFileMetadata([media.path]);
    const meta = metadata[0];
    const name = meta?.name || baseName(media.path);
    const ext = extensionFor(name);
    state.files.studio = [{ path: media.path, name, ext, category: media.category, size: Number(meta?.size) || 0 }];
    state.studio.project.mediaPath = media.path;
    state.studio.project.durationMs = 0;
    state.studio.mediaUrl = media.url;
    state.studio.mediaError = '';
    state.studio.matchVideo = media.matchVideo || null;
    state.studio.pendingSeekMs = 0;
    markStudioDirty();
    render();
    showToast('Switched to the matching video. Transcript and clips were kept.', 'success', 5000);
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function restoreStudioRecovery() {
  const recovery = state.studio.recovery;
  if (!recovery || !studioDiscardConfirmation()) return;
  await applyStudioProject(recovery.project, recovery.projectPath, { dirty: true });
  state.studio.recovery = null;
  scheduleStudioRecovery();
  showToast('Unsaved Studio session restored.', 'success');
}

async function discardStudioRecovery() {
  await clearStudioRecovery(false);
  render();
  showToast('Studio recovery draft discarded.', 'success');
}

async function ensureStudioOutputDirectory() {
  const project = state.studio.project;
  if (!project) return null;
  if (project.output.directory) return project.output.directory;
  const directory = await api.chooseOutputFolder();
  if (!directory) return null;
  project.output.directory = directory;
  state.settings = await api.getSettings();
  markStudioDirty();
  return directory;
}

async function chooseStudioOutputDirectory() {
  if (!state.studio.project) return;
  const directory = await api.chooseOutputFolder();
  if (!directory) return;
  state.studio.project.output.directory = directory;
  state.settings = await api.getSettings();
  markStudioDirty();
  render();
}

async function importStudioTranscript() {
  if (!state.studio.project) return;
  try {
    const result = await api.chooseStudioTranscript();
    if (result.canceled) return;
    state.studio.project.segments = result.segments;
    resetStudioSelection();
    markStudioDirty();
    render();
    showToast(`Imported ${result.segments.length} transcript lines.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function exportStudioTranscript() {
  const project = state.studio.project;
  if (!project?.segments.length) return;
  try {
    const result = await api.exportStudioTranscript({
      segments: project.segments,
      format: state.options.studio.exportFormat || 'srt',
      mediaPath: project.mediaPath,
      directory: project.output.directory
    });
    if (!result.canceled) showToast('Transcript exported.', 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function startStudioTranscription() {
  const project = state.studio.project;
  if (!project || state.studio.busy) return;
  if (state.studio.mediaError) {
    showToast('Relink the media file before transcribing.', 'error');
    return;
  }
  if (!state.status?.tools?.speech?.available) {
    showToast('The local Whisper engine is unavailable.', 'error');
    return;
  }
  try {
    const outputDirectory = await ensureStudioOutputDirectory();
    if (!outputDirectory) return;
    const base = studioBaseName(project.mediaPath);
    const spec = makeSpec('transcribe', [project.mediaPath], outputDirectory, {
      language: project.language,
      outputFormat: 'srt',
      baseName: `${base}_studio`
    }, `${baseName(project.mediaPath)} · Studio transcript`);
    state.studio.busy = true;
    state.studio.transcriptionJobId = null;
    render();
    const job = await api.startJob(spec);
    state.studio.transcriptionJobId = job.id;
    state.jobs.set(job.id, job);
    updateQueueBadge();
    render();
    showToast('Studio transcription queued.', 'success');
  } catch (error) {
    state.studio.busy = false;
    state.studio.transcriptionJobId = null;
    render();
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function completeStudioTranscription(job) {
  const project = state.studio.project;
  const mediaPath = job.spec?.inputPaths?.[0] || '';
  state.studio.busy = false;
  state.studio.transcriptionJobId = null;
  if (job.status !== 'succeeded') {
    if (state.view === 'studio') render();
    if (job.status === 'failed') showToast(job.error || 'Studio transcription failed.', 'error', 7000);
    else if (job.status === 'cancelled') showToast('Studio transcription cancelled.', 'info', 4000);
    return;
  }
  if (!project || project.mediaPath !== mediaPath) {
    if (state.view === 'studio') render();
    return;
  }
  const transcriptPath = job.outputPaths?.[0];
  if (!transcriptPath) {
    showToast('Whisper finished without returning a transcript.', 'error');
    if (state.view === 'studio') render();
    return;
  }
  try {
    const result = await api.readStudioTranscript(transcriptPath);
    project.segments = result.segments;
    resetStudioSelection();
    markStudioDirty();
    if (state.view === 'studio') render();
    showToast(`Studio transcript ready: ${result.segments.length} lines.`, 'success', 5000);
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

function selectStudioSegment(id, extend) {
  const project = state.studio.project;
  if (!project) return;
  const index = project.segments.findIndex((segment) => segment.id === id);
  if (index === -1) return;
  const anchorIndex = project.segments.findIndex((segment) => segment.id === state.studio.selectionAnchor);
  if (!extend || anchorIndex === -1) {
    state.studio.selectedIds = [id];
    state.studio.selectionAnchor = id;
  } else {
    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    state.studio.selectedIds = project.segments.slice(start, end + 1).map((segment) => segment.id);
  }
  state.studio.pendingSeekMs = project.segments[index].startMs;
  render();
}

function toggleStudioSelectAll() {
  const project = state.studio.project;
  if (!project?.segments.length) return;
  const allIds = project.segments.map((segment) => segment.id);
  const nextSelection = toggleAllSelection(allIds, state.studio.selectedIds);
  if (!nextSelection.length) {
    resetStudioSelection();
  } else {
    state.studio.selectedIds = nextSelection;
    state.studio.selectionAnchor = nextSelection[0];
    state.studio.pendingSeekMs = project.segments[0].startMs;
  }
  render();
}

function setStudioInspectorTab(tab) {
  const next = tab === 'output' ? 'output' : 'clips';
  if (state.studio.inspectorTab === next) return;
  const media = document.getElementById('studio-media');
  if (media) state.studio.pendingSeekMs = Math.round((Number(media.currentTime) || 0) * 1000);
  state.studio.inspectorTab = next;
  state.resetScroll = false;
  render();
}

function addStudioClip() {
  const project = state.studio.project;
  const range = studioSelectedRange();
  if (!project || !range) return;
  const padding = Math.max(0, Number(project.clipPaddingMs) || 0);
  const maxEnd = project.durationMs > 0 ? project.durationMs : range.endMs + padding;
  const startMs = Math.max(0, Math.round(range.startMs - padding));
  const endMs = Math.min(maxEnd, Math.round(range.endMs + padding));
  if (endMs <= startMs) {
    showToast('That selected range is too short to render.', 'error');
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() || `clip-${Date.now()}-${project.clips.length}`;
  project.clips.push({
    id,
    label: `Clip ${String(project.clips.length + 1).padStart(2, '0')}`,
    startMs,
    endMs
  });
  state.studio.inspectorTab = 'clips';
  markStudioDirty();
  render();
  showToast('Range added to the clip list.', 'success', 2600);
}

function removeStudioClip(id) {
  const project = state.studio.project;
  if (!project) return;
  project.clips = project.clips.filter((clip) => clip.id !== id);
  markStudioDirty();
  render();
}

function moveStudioClip(id, direction) {
  const project = state.studio.project;
  if (!project) return;
  const index = project.clips.findIndex((clip) => clip.id === id);
  const target = index + Number(direction);
  if (index === -1 || target < 0 || target >= project.clips.length) return;
  const [clip] = project.clips.splice(index, 1);
  project.clips.splice(target, 0, clip);
  markStudioDirty();
  render();
}

function previewStudioClip(id) {
  const project = state.studio.project;
  const clip = project?.clips.find((entry) => entry.id === id);
  if (!clip || state.studio.mediaError) return;
  state.studio.auditionEndMs = clip.endMs;
  seekStudio(clip.startMs, true);
}

async function renderStudioClips() {
  const project = state.studio.project;
  if (!project || !project.clips.length || state.studio.mediaError) return;
  if (state.starting) return;
  state.starting = true;
  try {
    const outputDirectory = await ensureStudioOutputDirectory();
    if (!outputDirectory) return;
    const category = studioMediaCategory();
    const outputCount = project.clips.length * (category === 'video' ? Math.max(1, project.output.ratios?.length || 1) : 1);
    const spec = makeSpec('studio', [project.mediaPath], outputDirectory, {
      durationMs: project.durationMs,
      outputFormat: category === 'video' ? project.output.videoFormat : project.output.audioFormat,
      quality: 'high',
      burnCaptions: project.output.burnCaptions,
      exportCaptions: project.output.exportCaptions,
      captionStyle: project.captionStyle,
      ratios: project.output.ratios,
      framing: project.output.framing,
      clips: project.clips,
      segments: project.segments
    }, `Transcript Clip Studio · ${outputCount} file${outputCount === 1 ? '' : 's'}`);
    const job = await api.startJob(spec);
    state.jobs.set(job.id, job);
    openQueue();
    updateQueueBadge();
    renderQueue();
    showToast(`${outputCount} Studio file${outputCount === 1 ? '' : 's'} queued.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  } finally {
    state.starting = false;
  }
}

function seekStudio(milliseconds, play = false) {
  const media = document.getElementById('studio-media');
  const target = Math.max(0, Number(milliseconds) || 0) / 1000;
  if (!media) {
    state.studio.pendingSeekMs = Math.round(target * 1000);
    return;
  }
  const applySeek = () => {
    try { media.currentTime = target; } catch { /* metadata may still be loading */ }
    updateStudioPreview();
    if (play) media.play().catch(() => {});
  };
  if (media.readyState === 0) media.addEventListener('loadedmetadata', applySeek, { once: true });
  else applySeek();
}

function refreshStudioCaptionOverlay() {
  const project = state.studio.project;
  const overlay = document.getElementById('studio-caption-overlay');
  if (!project || !overlay) return;
  overlay.className = `studio-caption-overlay ${project.captionStyle.position || 'bottom'}`;
  overlay.setAttribute('style', studioCaptionOverlayStyle(project));
}

function updateStudioPreview() {
  const media = document.getElementById('studio-media');
  const project = state.studio.project;
  if (!media || !project) return;
  const currentMs = Math.max(0, (Number(media.currentTime) || 0) * 1000);
  const readout = document.getElementById('studio-time-readout');
  if (readout) readout.textContent = `${formatStudioTime(currentMs)} / ${project.durationMs ? formatStudioTime(project.durationMs) : formatStudioTime((Number(media.duration) || 0) * 1000)}`;
  const active = project.segments.find((segment) => currentMs >= segment.startMs && currentMs < segment.endMs);
  const overlay = document.getElementById('studio-caption-overlay');
  if (overlay) {
    overlay.textContent = active?.text || '';
    overlay.classList.toggle('visible', Boolean(active?.text));
  }
  if (state.studio.auditionEndMs && currentMs >= state.studio.auditionEndMs) {
    state.studio.auditionEndMs = 0;
    media.pause();
  }
}

function bindStudioPreview() {
  const media = document.getElementById('studio-media');
  const backdrop = document.getElementById('studio-media-backdrop');
  const project = state.studio.project;
  if (!media || !project) return;
  const syncBackdrop = () => {
    if (!backdrop) return;
    try {
      if (Math.abs((Number(backdrop.currentTime) || 0) - (Number(media.currentTime) || 0)) > 0.08) {
        backdrop.currentTime = Number(media.currentTime) || 0;
      }
      backdrop.playbackRate = media.playbackRate;
      if (media.paused) backdrop.pause();
      else backdrop.play().catch(() => {});
    } catch { /* the hidden backdrop can lag without blocking playback */ }
  };
  const onMetadata = () => {
    const durationMs = Math.round((Number(media.duration) || 0) * 1000);
    if (durationMs > 0 && Math.abs(durationMs - Number(project.durationMs || 0)) > 250) {
      project.durationMs = durationMs;
      markStudioDirty();
    }
    if (state.studio.pendingSeekMs) {
      const target = state.studio.pendingSeekMs;
      state.studio.pendingSeekMs = 0;
      try { media.currentTime = target / 1000; } catch { /* ignore invalid seek */ }
    }
    updateStudioPreview();
    applyStudioPreviewFrame();
    syncBackdrop();
  };
  media.addEventListener('loadedmetadata', onMetadata);
  if (media.readyState >= 1) onMetadata();
  media.addEventListener('timeupdate', updateStudioPreview);
  media.addEventListener('timeupdate', syncBackdrop);
  media.addEventListener('play', syncBackdrop);
  media.addEventListener('pause', syncBackdrop);
  media.addEventListener('seeking', syncBackdrop);
  media.addEventListener('ratechange', syncBackdrop);
  media.addEventListener('ended', () => { state.studio.auditionEndMs = 0; });
  media.addEventListener('error', () => {
    if (!state.studio.mediaError) {
      state.studio.mediaError = 'The media preview could not be loaded. Try relinking the file.';
      showToast(state.studio.mediaError, 'error', 7000);
    }
  });
  applyStudioPreviewFrame();
  const stage = document.querySelector('.studio-media-stage');
  if (stage && typeof ResizeObserver === 'function') {
    state.studio.previewObserver = new ResizeObserver(() => applyStudioPreviewFrame());
    state.studio.previewObserver.observe(stage);
  }
}

function filterStudioSegments(query) {
  const project = state.studio.project;
  if (!project) return;
  state.studio.search = String(query || '');
  const needle = state.studio.search.trim().toLowerCase();
  document.querySelectorAll('[data-studio-row]').forEach((row) => {
    const segment = project.segments.find((entry) => entry.id === row.dataset.studioRow);
    row.hidden = Boolean(needle && !String(segment?.text || '').toLowerCase().includes(needle));
  });
}

function updateStudioControl(target) {
  const project = state.studio.project;
  if (!project) return false;
  if (target.hasAttribute('data-studio-search')) {
    filterStudioSegments(target.value);
    return true;
  }
  if (target.hasAttribute('data-studio-export-format')) {
    state.options.studio.exportFormat = target.value === 'vtt' ? 'vtt' : 'srt';
    return true;
  }
  if (target.hasAttribute('data-studio-language')) {
    project.language = target.value;
    state.options.studio.language = project.language;
    markStudioDirty();
    return true;
  }
  if (target.hasAttribute('data-studio-clip-label')) {
    const clip = project.clips.find((entry) => entry.id === target.dataset.studioClipLabel);
    if (clip) {
      clip.label = String(target.value || '').slice(0, 120);
      markStudioDirty();
    }
    return true;
  }
  if (target.hasAttribute('data-studio-segment')) {
    const segment = project.segments.find((entry) => entry.id === target.dataset.studioSegment);
    if (segment) {
      segment.text = String(target.value || '');
      markStudioDirty();
      updateStudioPreview();
      updateStudioClipExcerpts();
    }
    return true;
  }
  if (target.hasAttribute('data-studio-output')) {
    const field = target.dataset.studioOutput;
    const category = studioMediaCategory();
    if (field === 'outputFormat') {
      if (category === 'video') project.output.videoFormat = target.value;
      else project.output.audioFormat = target.value;
    } else if (field === 'clipPaddingMs') {
      project.clipPaddingMs = Math.max(0, Math.min(2000, Number(target.value) || 0));
    } else if (field === 'burnCaptions') {
      project.output.burnCaptions = Boolean(target.checked);
    } else if (field === 'exportCaptions') {
      project.output.exportCaptions = target.value;
    } else if (field === 'ratio') {
      const ratio = String(target.dataset.ratio || '');
      const current = Array.isArray(project.output.ratios) ? project.output.ratios.slice() : [];
      if (target.checked && ratio && !current.includes(ratio)) current.push(ratio);
      if (!target.checked) {
        const next = current.filter((entry) => entry !== ratio);
        if (!next.length) {
          target.checked = true;
          showToast('Keep at least one output aspect ratio selected.', 'error');
          return true;
        }
        project.output.ratios = next;
      } else {
        project.output.ratios = current;
      }
      target.closest('.studio-ratio-option')?.classList.toggle('selected', target.checked);
    }
    markStudioDirty();
    updateStudioOutputSummary(project);
    return true;
  }
  if (target.hasAttribute('data-studio-style')) {
    const field = target.dataset.studioStyle;
    if (field === 'fontSize') project.captionStyle.fontSize = Math.max(16, Math.min(48, Number(target.value) || 24));
    if (field === 'outline') project.captionStyle.outline = Math.max(0, Math.min(4, Number(target.value) || 0));
    if (field === 'color' && /^#[0-9a-f]{6}$/i.test(target.value)) project.captionStyle.color = target.value.toUpperCase();
    if (field === 'position') project.captionStyle.position = target.value;
    markStudioDirty();
    refreshStudioCaptionOverlay();
    return true;
  }
  return false;
}

async function startTool(tool) {
  if (state.starting) return;
  const files = state.files[tool] || [];
  const options = state.options[tool] || {};
  if (tool === 'youtube') {
    if (!options.url.trim()) { showToast('Paste a YouTube link first.', 'error'); return; }
  } else if (!files.length) {
    showToast('Choose at least one file first.', 'error'); return;
  }
  if (tool === 'pdf' && options.operation === 'merge' && files.length < 2) {
    showToast('Choose at least two PDFs to merge.', 'error'); return;
  }
  if (tool === 'join' && files.length < 2) {
    showToast('Choose at least two files to join.', 'error'); return;
  }
  if (tool === 'join' && new Set(files.map((file) => file.category)).size > 1) {
    showToast('Choose either video files or audio files for one join job.', 'error'); return;
  }
  if (tool === 'checksum' && (!options.algorithms || options.algorithms.length === 0)) {
    showToast('Choose at least one checksum algorithm.', 'error'); return;
  }
  if (tool === 'shred' && options.acknowledged !== true) {
    showToast('Confirm the secure deletion warning first.', 'error'); return;
  }
  if (tool === 'encryptor') {
    if (!options.password) { showToast('Enter a password first.', 'error'); return; }
    if (options.mode === 'encrypt' && options.password.length < 8) {
      showToast('Use a password with at least 8 characters.', 'error'); return;
    }
    if (options.mode === 'encrypt' && options.password !== options.confirm) {
      showToast('The password confirmation does not match.', 'error'); return;
    }
  }

  state.starting = true;
  try {
    let outputDirectory = null;
    if (!['checksum', 'info', 'shred'].includes(tool)) {
      outputDirectory = await api.chooseOutputFolder();
      if (!outputDirectory) return;
      state.settings = await api.getSettings();
    }
    const specs = batchSpecs(tool, outputDirectory);
    if (!specs.length) {
      showToast('Nothing was queued.', 'error');
      return;
    }
    for (const spec of specs) {
      const job = await api.startJob(spec);
      state.jobs.set(job.id, job);
    }
    if (tool === 'encryptor') {
      state.options.encryptor.password = '';
      state.options.encryptor.confirm = '';
      render();
    }
    if (tool === 'shred') {
      state.files.shred = [];
      state.options.shred.acknowledged = false;
      render();
    }
    openQueue();
    updateQueueBadge();
    renderQueue();
    showToast(`${specs.length} job${specs.length === 1 ? '' : 's'} queued.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error');
  } finally {
    state.starting = false;
  }
}

async function fetchYouTube() {
  const url = state.options.youtube.url.trim();
  if (!url) { showToast('Paste a YouTube link first.', 'error'); return; }
  state.ytLoading = true;
  render();
  try {
    state.ytMeta = await api.probeYouTube(url);
    state.ytLoading = false;
    showToast('Video details loaded.', 'success');
  } catch (error) {
    state.ytMeta = null;
    state.ytLoading = false;
    showToast(error.message || String(error), 'error', 7000);
  }
  render();
}

function updateOption(target) {
  const tool = target.dataset.tool;
  const option = target.dataset.option;
  if (!tool || !option || !state.options[tool]) return;
  if (target.type === 'radio') {
    if (target.checked) state.options[tool][option] = target.value;
  } else if (target.type === 'checkbox') {
    if (target.dataset.algorithm) {
      const set = new Set(state.options.checksum.algorithms);
      if (target.checked) set.add(target.dataset.algorithm); else set.delete(target.dataset.algorithm);
      state.options.checksum.algorithms = [...set];
    } else {
      state.options[tool][option] = target.checked;
      if (tool === 'shred' && option === 'acknowledged') render();
    }
  } else {
    state.options[tool][option] = target.value;
  }
}

function handleViewChange(event) {
  const target = event.target.closest('[data-option], [data-algorithm], [data-studio-output], [data-studio-style], [data-studio-language], [data-studio-export-format], [data-setting]');
  if (!target) return;
  if (target.dataset.setting) {
    updateQueueSetting(target);
    return;
  }
  if (updateStudioControl(target)) {
    if (target.dataset.rerender === 'true') render();
    return;
  }
  const previousEncryptorMode = state.options.encryptor.mode;
  updateOption(target);
  if (target.dataset.tool === 'encryptor' && target.dataset.option === 'mode' && state.options.encryptor.mode !== previousEncryptorMode) {
    syncEncryptorFiles();
  }
  if (target.dataset.rerender === 'true') render();
}

async function updateQueueSetting(target) {
  const key = target.dataset.setting;
  if (!['jobConcurrency', 'notifyOnFailure'].includes(key)) return;
  const value = key === 'jobConcurrency' ? Number(target.value) : target.checked;
  const previous = state.settings;
  state.settings = { ...state.settings, [key]: value };
  updateQueueBadge();
  renderQueue();
  try {
    state.settings = await api.saveSettings({ [key]: value });
    updateQueueBadge();
    if (key === 'jobConcurrency') showToast(`Running up to ${value} job${value === 1 ? '' : 's'} at once.`, 'success');
  } catch (error) {
    state.settings = previous;
    updateQueueBadge();
    renderQueue();
    if (state.view === 'settings') render();
    showToast(error.message || String(error), 'error', 7000);
  }
}

function syncEncryptorFiles() {
  const decrypting = state.options.encryptor.mode === 'decrypt';
  const before = state.files.encryptor.length;
  state.files.encryptor = state.files.encryptor.filter((file) => (file.ext === 'ofenc') === decrypting);
  const removed = before - state.files.encryptor.length;
  if (removed) {
    showToast(`${removed} incompatible file${removed === 1 ? ' was' : 's were'} removed from the encryptor.`, 'error');
  }
}

function handleViewInput(event) {
  const studioTarget = event.target.closest('[data-studio-search], [data-studio-segment], [data-studio-clip-label], [data-studio-output], [data-studio-style], [data-studio-language], [data-studio-export-format]');
  if (studioTarget) {
    updateStudioControl(studioTarget);
    return;
  }
  const target = event.target.closest('[data-option]');
  if (!target) return;
  updateOption(target);
  if (target.dataset.tool === 'youtube' && target.dataset.option === 'url') {
    const button = document.querySelector('[data-action="start-tool"][data-tool="youtube"]');
    if (button) button.disabled = !target.value.trim();
  }
}

function dropCategoryLabel(category) {
  return {
    video: 'Video files', audio: 'Audio files', image: 'Images', data: 'Structured data',
    pdf: 'PDF documents', archive: 'Archives', encrypted: 'Encrypted files', mixed: 'Mixed file types'
  }[category] || 'Files';
}

function closeSmartDropPicker() {
  state.dropPicker = null;
  const overlay = $('#smart-drop-overlay');
  if (overlay) overlay.hidden = true;
}

function renderSmartDropPicker() {
  const picker = state.dropPicker;
  const overlay = $('#smart-drop-overlay');
  const content = $('#smart-drop-content');
  if (!picker || !overlay || !content) return;
  const totalSize = picker.files.reduce((total, file) => total + (Number(file?.size) || 0), 0);
  content.innerHTML = `<div class="smart-drop-head">
      <span class="eyebrow">Smart drop</span>
      <h2 id="smart-drop-title">Choose what to do with these files</h2>
      <p>${picker.paths.length} ${dropCategoryLabel(picker.category).toLowerCase()} detected. Compatible tools are suggested first; nothing is added until you confirm.</p>
    </div>
    <div class="smart-drop-files">${picker.names.slice(0, 6).map((name) => `<span title="${escapeHtml(name)}">${icon('file')}${escapeHtml(name)}</span>`).join('')}${picker.names.length > 6 ? `<span>+${picker.names.length - 6} more</span>` : ''}${totalSize ? `<b>${formatBytes(totalSize)}</b>` : ''}</div>
    <div class="smart-drop-tools" role="radiogroup" aria-label="Compatible tools">
      ${picker.suggestions.map((suggestion, index) => `<label class="smart-drop-tool ${picker.selected === suggestion.tool ? 'selected' : ''}">
        <input type="radio" name="smart-drop-tool" value="${escapeHtml(suggestion.tool)}" ${picker.selected === suggestion.tool ? 'checked' : ''}>
        <span class="smart-drop-tool-icon" style="--icon-color:${TOOL_COLORS[suggestion.tool] || 'var(--muted)'}">${icon(TOOL_ICONS[suggestion.tool] || 'file')}</span>
        <span class="smart-drop-tool-copy"><strong>${escapeHtml(recipeToolLabel(suggestion.tool))}</strong><span>${escapeHtml(suggestion.reason || '')}</span></span>
        ${suggestion.recommended || index === 0 ? '<span class="smart-drop-recommended">Suggested</span>' : ''}
      </label>`).join('')}
    </div>
    <div class="smart-drop-actions"><button class="ghost-button" data-action="smart-drop-cancel">Cancel</button><button class="primary-button" data-action="smart-drop-confirm">${icon('plus')} Add to ${escapeHtml(recipeToolLabel(picker.selected))}</button></div>`;
  overlay.hidden = false;
}

function showSmartDropPicker(paths, files) {
  if (!paths.length) {
    showToast('Could not read the dropped file paths.', 'error');
    return;
  }
  const names = paths.map((filePath, index) => files[index]?.name || baseName(filePath));
  const detected = suggestDropTools(names, state.status?.inputExtensions);
  let suggestions = detected.suggestions.slice();
  const encryptedOnly = names.length > 0 && names.every((name) => extensionFor(name) === 'ofenc');
  if (encryptedOnly) {
    suggestions = [{ tool: 'encryptor', reason: 'Decrypt OmniForge .ofenc files', recommended: true }, ...suggestions.filter((entry) => entry.tool !== 'encryptor')];
  }
  if (!suggestions.length) {
    suggestions = [
      { tool: 'checksum', reason: 'Hash the files without changing them', recommended: true },
      { tool: 'archive', reason: 'Pack the files into an archive' },
      { tool: 'encryptor', reason: 'Encrypt the files locally' }
    ];
  }
  state.dropPicker = {
    paths,
    files,
    names,
    category: encryptedOnly ? 'encrypted' : detected.category,
    suggestions,
    selected: suggestions[0].tool
  };
  hideDropOverlay();
  renderSmartDropPicker();
}

async function confirmSmartDrop() {
  const picker = state.dropPicker;
  if (!picker) return;
  const tool = picker.selected;
  closeSmartDropPicker();
  try {
    if (tool === 'encryptor') {
      const decrypting = picker.names.every((name) => extensionFor(name) === 'ofenc');
      state.options.encryptor.mode = decrypting ? 'decrypt' : 'encrypt';
      state.options.encryptor.password = '';
      state.options.encryptor.confirm = '';
      syncEncryptorFiles();
    }
    if (state.view !== tool) navigate(tool);
    await addPaths(tool, picker.paths, picker.files);
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

function showDropOverlay() {
  const overlay = $('#drop-overlay');
  if (!overlay || state.dropPicker) return;
  state.draggingFiles = true;
  overlay.hidden = false;
}

function eventHasFiles(event) {
  return Boolean(event.dataTransfer?.files?.length) || [...(event.dataTransfer?.types || [])].includes('Files');
}

function hideDropOverlay() {
  state.draggingFiles = false;
  const overlay = $('#drop-overlay');
  if (overlay) overlay.hidden = true;
}

function handleDrop(event) {
  const updateZone = event.target.closest('.update-dropzone');
  if (updateZone) {
    event.preventDefault();
    updateZone.classList.remove('drag-over');
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    if (files.length > 1) {
      showToast('Drop one OmniForge installer at a time.', 'error');
      return;
    }
    const filePath = api.getPathForFile(files[0]);
    if (!filePath) {
      showToast('Could not read the dropped installer path.', 'error');
      return;
    }
    handleInstallerFile(filePath);
    return;
  }
  const zone = event.target.closest('.dropzone');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('drag-over');
  const files = [...(event.dataTransfer?.files || [])];
  if (!files.length) return;
  const paths = [];
  for (const file of files) {
    const filePath = api.getPathForFile(file);
    if (filePath) paths.push(filePath);
  }
  if (!paths.length) {
    showToast('Could not read the dropped file paths.', 'error');
    return;
  }
  addPaths(zone.dataset.tool, paths, files);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast('Copied to clipboard.', 'success', 2200);
  } catch {
    showToast('Could not copy to clipboard.', 'error');
  }
}

function clearResults(tool) {
  state.results = state.results.filter((result) => result.tool !== tool);
  render();
}

function openQueue() {
  state.queueOpen = true;
  queueDrawer.classList.add('open');
  queueOverlay.classList.add('open');
  queueDrawer.setAttribute('aria-hidden', 'false');
  queueOverlay.setAttribute('aria-hidden', 'false');
  renderQueue();
}

function closeQueue() {
  state.queueOpen = false;
  queueDrawer.classList.remove('open');
  queueOverlay.classList.remove('open');
  queueDrawer.setAttribute('aria-hidden', 'true');
  queueOverlay.setAttribute('aria-hidden', 'true');
}

function isActiveJob(job) {
  return ['queued', 'paused', 'running', 'cancelling'].includes(job.status);
}

function isFinishedJob(job) {
  return ['succeeded', 'failed', 'cancelled'].includes(job.status);
}

function jobCounts(jobs = [...state.jobs.values()]) {
  return {
    total: jobs.length,
    active: jobs.filter(isActiveJob).length,
    finished: jobs.filter(isFinishedJob).length
  };
}

function configuredConcurrency() {
  const value = Number(state.settings?.jobConcurrency);
  return [1, 2, 3].includes(value) ? value : 2;
}

function updateQueueBadge() {
  const counts = jobCounts();
  const badge = document.getElementById('queue-badge');
  if (badge) {
    badge.textContent = String(counts.active || counts.total);
    badge.classList.toggle('hidden', counts.total === 0);
  }
  const summary = document.getElementById('queue-summary');
  if (summary) {
    const slots = configuredConcurrency();
    const label = `${slots} job slot${slots === 1 ? '' : 's'}`;
    summary.textContent = counts.total ? `Local processing · ${label}` : `${label} available`;
  }
}

function baseName(filePath) {
  return String(filePath || '').split(/[\\/]/).filter(Boolean).pop() || filePath;
}

function applyJobSnapshots(jobs) {
  for (const job of jobs || []) state.jobs.set(job.id, job);
}

function mergeHistoryJobs(history) {
  for (const entry of history || []) {
    if (!isFinishedJob(entry) || state.jobs.has(entry.id)) continue;
    state.jobs.set(entry.id, {
      ...entry,
      outputPaths: entry.outputPaths || [],
      data: null,
      error: entry.error || null,
      createdAt: entry.createdAt || entry.startedAt || entry.completedAt
    });
  }
}

async function refreshJobs() {
  try {
    applyJobSnapshots(await api.listJobs());
    renderQueue();
    updateQueueBadge();
  } catch { /* the queue preview remains usable */ }
}

async function resumeJob(job) {
  let password;
  const options = {};
  if (job.tool === 'encryptor') {
    password = window.prompt('Enter the password to resume this encryption job:') || '';
    if (!password) return;
  }
  if (job.tool === 'shred') {
    const confirmed = window.confirm('Resume secure deletion?\n\nSSD wear leveling, backups, cloud copies, and snapshots may retain copies.');
    if (!confirmed) return;
    options.acknowledged = true;
  }
  try {
    const updated = await api.resumeJob(job.id, password, options);
    state.jobs.set(updated.id, updated);
    await refreshJobs();
    showToast(`${job.label} resumed.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function retryJob(job) {
  if (!job.spec) {
    showToast('This history entry is too old to retry.', 'error');
    return;
  }
  const options = {};
  if (job.tool === 'encryptor') {
    options.password = window.prompt('Enter the password to retry this encryption job:') || '';
    if (!options.password) return;
  }
  if (job.tool === 'shred') {
    const confirmed = window.confirm('Retry secure deletion?\n\nSSD wear leveling, backups, cloud copies, and snapshots may retain copies.');
    if (!confirmed) return;
    options.acknowledged = true;
  }
  try {
    const next = await api.retryJob(job.id, options);
    state.jobs.set(next.id, next);
    await refreshJobs();
    openQueue();
    showToast(`${job.label} queued again.`, 'success');
  } catch (error) {
    showToast(error.message || String(error), 'error', 7000);
  }
}

async function moveJob(job, direction) {
  try {
    const result = await api.moveJob(job.id, direction);
    if (!result.moved) {
      if (result.reason) showToast(result.reason, 'error');
      return;
    }
    applyJobSnapshots(result.jobs);
    renderQueue();
  } catch (error) {
    showToast(error.message || String(error), 'error');
  }
}

function renderQueue() {
  const list = document.getElementById('queue-list');
  if (!list) return;
  const allJobs = [...state.jobs.values()];
  const counts = jobCounts(allJobs);
  const statusRank = { running: 0, cancelling: 0, paused: 1, queued: 1 };
  const sorted = allJobs.sort((a, b) => {
    const rank = (statusRank[a.status] ?? 2) - (statusRank[b.status] ?? 2);
    if (rank) return rank;
    if (Number.isFinite(a.queuePosition) && Number.isFinite(b.queuePosition)) return a.queuePosition - b.queuePosition;
    return new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime();
  });
  const filtered = sorted.filter((job) => state.queueFilter === 'active' ? isActiveJob(job) : state.queueFilter === 'finished' ? isFinishedJob(job) : true);

  const meta = document.getElementById('queue-header-meta');
  if (meta) meta.textContent = counts.total === 0 ? 'No jobs yet' : `${counts.active} active · ${counts.finished} finished`;
  const allCount = document.getElementById('queue-count-all');
  const activeCount = document.getElementById('queue-count-active');
  const finishedCount = document.getElementById('queue-count-finished');
  if (allCount) allCount.textContent = String(counts.total);
  if (activeCount) activeCount.textContent = String(counts.active);
  if (finishedCount) finishedCount.textContent = String(counts.finished);
  document.querySelectorAll('[data-queue-filter]').forEach((button) => button.classList.toggle('active', button.dataset.queueFilter === state.queueFilter));
  const clearButton = document.getElementById('clear-finished');
  if (clearButton) clearButton.disabled = counts.finished === 0;

  if (!filtered.length) {
    const empty = state.queueFilter === 'active'
      ? ['Nothing active right now', 'Queued and running jobs will appear here.', 'clock']
      : state.queueFilter === 'finished'
        ? ['No finished jobs yet', 'Completed, cancelled, and failed jobs will appear here.', 'check']
        : ['Your queue is clear', 'Start a conversion, download, or file tool to see live progress here.', 'queue'];
    list.innerHTML = `<div class="queue-empty"><div class="queue-empty-icon"><span class="nav-icon">${icon(empty[2])}</span></div><strong>${empty[0]}</strong><span>${empty[1]}</span></div>`;
    updateQueueBadge();
    return;
  }

  list.innerHTML = filtered.map((job) => {
    const cancellable = ['queued', 'paused', 'running'].includes(job.status);
    const hasProgress = ['queued', 'paused', 'running', 'cancelling'].includes(job.status);
    const progress = Math.max(0, Math.min(100, Math.round(Number(job.progress) || 0)));
    const toolColor = TOOL_COLORS[job.tool] || 'var(--lime)';
    const speed = formatJobSpeed(job.speed);
    const eta = formatJobEta(job.etaMs);
    const metrics = [speed ? `<span>${escapeHtml(speed)}</span>` : '', eta ? `<span>~${escapeHtml(eta)} left</span>` : ''].filter(Boolean).join('');
    const outputs = (job.outputPaths || []).map((outputPath) => `<div class="job-output"><span class="nav-icon">${icon('file')}</span><span class="name" title="${escapeHtml(outputPath)}">${escapeHtml(baseName(outputPath))}</span><button data-action="open-output" data-path="${escapeHtml(outputPath)}">Open</button><button data-action="reveal-output" data-path="${escapeHtml(outputPath)}">Show</button></div>`).join('');
    return `<div class="job-card ${escapeHtml(job.status)}">
      <div class="job-top">
        <span class="tool-icon" style="--icon-color:${toolColor}">${icon(toolIcon(job.tool))}</span>
        <div class="job-copy">
          <div class="job-name" title="${escapeHtml(job.label)}">${escapeHtml(job.label)}</div>
          <div class="job-message">${escapeHtml(job.message || '')}</div>
        </div>
        <span class="status-pill ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
      </div>
      ${hasProgress ? `<div class="job-progress-wrap"><div class="job-progress"><span style="width:${progress}%"></span></div><span class="job-percent">${progress}%</span></div>` : ''}
      ${metrics ? `<div class="job-metrics">${metrics}</div>` : ''}
      ${job.error ? `<div class="job-error">${escapeHtml(job.error)}</div>` : ''}
      ${outputs ? `<div class="job-outputs">${outputs}</div>` : ''}
      <div class="job-actions">
        ${cancellable ? `<button class="job-action-danger" data-action="cancel-job" data-job="${escapeHtml(job.id)}">Cancel</button>` : ''}
        ${job.status === 'paused' ? `<button data-action="resume-job" data-job="${escapeHtml(job.id)}">Resume</button>` : ''}
        ${['queued', 'paused'].includes(job.status) ? `<button data-action="move-job" data-job="${escapeHtml(job.id)}" data-dir="-1">Move up</button><button data-action="move-job" data-job="${escapeHtml(job.id)}" data-dir="1">Move down</button>` : ''}
        ${job.status === 'failed' && job.spec ? `<button data-action="retry-job" data-job="${escapeHtml(job.id)}">Retry</button>` : ''}
        ${job.status === 'succeeded' && job.data ? `<button data-action="view-results" data-tool="${escapeHtml(job.tool)}">View results</button>` : ''}
        ${job.status === 'succeeded' && job.spec?.outputDirectory ? `<button data-action="open-output" data-path="${escapeHtml(job.spec.outputDirectory)}">Open output folder</button>` : ''}
      </div>
    </div>`;
  }).join('');
  updateQueueBadge();
}

function handleJobUpdate(job) {
  const previous = state.jobs.get(job.id);
  const studioTranscriptId = state.studio.transcriptionJobId;
  const isStudioTranscriptJob = Boolean(studioTranscriptId && job.id === studioTranscriptId);
  state.jobs.set(job.id, job);
  updateQueueBadge();
  if (state.queueOpen) renderQueue();

  if (previous?.status === job.status) return;
  if (job.status === 'succeeded') {
    if (isStudioTranscriptJob) {
      completeStudioTranscription(job).catch((error) => showToast(error.message || String(error), 'error', 7000));
      api.getHistory().then((history) => {
        state.history = history;
        if (state.view === 'home') render();
      }).catch(() => {});
      return;
    }
    if (job.data && !state.results.some((result) => result.jobId === job.id)) {
      state.results.unshift({ jobId: job.id, tool: job.tool, data: job.data, label: job.label, completedAt: job.completedAt });
    }
    if (job.tool === 'transcribe' && job.spec?.options?.dictation && job.data?.transcriptText !== undefined) {
      state.dictation.lastTranscript = {
        text: job.data.transcriptText,
        path: job.data.transcriptPath || job.outputPaths?.[0] || '',
        format: job.data.format || 'txt',
        label: job.label
      };
      state.dictation.error = '';
      if (state.view === 'dictation') render();
      showToast('Dictation transcript is ready.', 'success', 5000);
    } else {
      showToast(job.data ? `${job.label}: results ready.` : `${job.label}: finished.`, 'success');
    }
    api.getHistory().then((history) => {
      state.history = history;
      if (state.view === 'home') render();
    }).catch(() => {});
    if (state.view === job.tool && ['checksum', 'info'].includes(job.tool)) render();
  } else if (job.status === 'failed') {
    if (isStudioTranscriptJob) {
      completeStudioTranscription(job).catch((error) => showToast(error.message || String(error), 'error', 7000));
      api.getHistory().then((history) => {
        state.history = history;
        if (state.view === 'home') render();
      }).catch(() => {});
      return;
    }
    if (job.tool === 'transcribe' && job.spec?.options?.dictation) {
      state.dictation.error = job.error || 'Dictation failed.';
      if (state.view === 'dictation') render();
    }
    showToast(`${job.label}: ${job.error || 'Job failed'}`, 'error', 7500);
  } else if (job.status === 'cancelled' && isStudioTranscriptJob) {
    completeStudioTranscription(job).catch(() => {});
  }
}

async function openOutput(targetPath) {
  const result = await api.openPath(targetPath);
  if (!result.ok) showToast(result.error || 'Could not open that path.', 'error');
}

async function revealOutput(targetPath) {
  const result = await api.revealPath(targetPath);
  if (!result.ok) showToast(result.error || 'Could not reveal that path.', 'error');
}

async function updateYtdlp(button) {
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('refresh', 'spin')} Updating…`;
  }
  try {
    const result = await api.updateYouTubeEngine();
    showToast(`yt-dlp updated${result.version ? ` to ${result.version}` : ''}.`, 'success', 6000);
    await refreshStatus();
  } catch (error) {
    showToast(`Update failed: ${error.message}`, 'error', 8000);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('refresh')} Check for updates`;
    }
  }
}

async function checkForUpdates(showMessage = true) {
  state.updateChecking = true;
  state.updateProgress = null;
  state.updateDownloading = false;
  if (state.view === 'settings') render();
  try {
    state.updateInfo = await api.checkForUpdates();
    state.updateChecking = false;
    if (state.view === 'settings') render();
    if (showMessage) {
      if (state.updateInfo.newer) showToast(`OmniForge ${state.updateInfo.latest.version} is available.`, 'success', 6000);
      else if (state.updateInfo.github?.status === 'unavailable') showToast(`GitHub check failed: ${state.updateInfo.github.error}`, 'error', 8000);
      else if (state.updateInfo.github?.status === 'no-release') showToast('No published OmniForge GitHub release was found.', 'info', 7000);
      else showToast('OmniForge is up to date.', 'info');
    }
    return state.updateInfo;
  } catch (error) {
    state.updateChecking = false;
    if (state.view === 'settings') render();
    showToast(`Update check failed: ${error.message}`, 'error', 7000);
    return null;
  }
}

async function autoCheckForUpdates() {
  try {
    const info = await api.checkForUpdates();
    state.updateInfo = info;
    if (info.newer) showToast(`OmniForge ${info.latest.version} is available in Settings.`, 'success', 7000);
    if (state.view === 'settings') render();
  } catch {
    // Automatic checks are intentionally silent.
  }
}

async function downloadUpdate(version) {
  if (!version || state.updateDownloading) return;
  state.updateDownloading = true;
  state.updateProgress = {
    phase: 'downloading',
    version,
    receivedBytes: 0,
    totalBytes: state.updateInfo?.latest?.size || null,
    percent: 0
  };
  if (state.view === 'settings') render();
  try {
    const info = await api.downloadUpdate(version);
    state.updateDownloading = false;
    state.updateProgress = {
      phase: 'ready',
      version,
      receivedBytes: info.size,
      totalBytes: info.size,
      percent: 100,
      actualHash: info.actualHash
    };
    state.updateInfo = {
      ...(state.updateInfo || {}),
      latest: {
        ...(state.updateInfo?.latest || {}),
        path: info.path,
        size: info.size,
        source: 'github',
        hash: info.hash,
        hashStatus: info.hashStatus,
        expectedHash: info.expectedHash,
        actualHash: info.actualHash
      }
    };
    if (state.view === 'settings') render();
    const confirmed = window.confirm(`OmniForge ${version} downloaded and SHA-256 verified.\n\nSHA-256: ${info.actualHash}\n\nInstall now? OmniForge will close and open the Windows installer.`);
    if (!confirmed) {
      showToast('Download verified. Choose Install when you are ready.', 'info', 6000);
      return;
    }
    await api.installUpdate(info.path, { allowMissingHash: false });
    showToast(`Opening the OmniForge ${version} installer.`, 'success', 5000);
  } catch (error) {
    state.updateDownloading = false;
    state.updateProgress = { phase: 'error', version, error: error.message };
    if (state.view === 'settings') render();
    showToast(`Update download failed: ${error.message}`, 'error', 9000);
  }
}

async function openUpdateRelease() {
  try {
    await api.openUpdateRelease();
  } catch (error) {
    showToast(`Could not open release notes: ${error.message}`, 'error', 7000);
  }
}

async function chooseUpdateFolder() {
  try {
    const result = await api.chooseUpdateFolder();
    if (!result) return;
    state.settings = await api.getSettings();
    state.updateInfo = result;
    render();
    showToast('Update folder saved.', 'success');
  } catch (error) {
    showToast(`Could not change the update folder: ${error.message}`, 'error');
  }
}

async function installUpdate(installerPath, version) {
  if (!installerPath) return;
  let info = state.updateInfo?.latest;
  if (!info || info.path !== installerPath || !info.hash) {
    try {
      info = await api.describeUpdateInstaller(installerPath);
    } catch (error) {
      showToast(`Could not verify the installer: ${error.message}`, 'error', 8000);
      return;
    }
  }
  const hash = info.hash || {};
  if (hash.status === 'mismatch' || hash.status === 'malformed') {
    showToast('Installer verification failed. The installer was not opened.', 'error', 8000);
    return;
  }
  let allowMissingHash = false;
  if (hash.status === 'missing') {
    allowMissingHash = window.confirm(`This installer has no SHA-256 sidecar.\n\nActual SHA-256:\n${hash.actual}\n\nOnly continue if you trust this file and its source.`);
    if (!allowMissingHash) return;
  }
  const verifiedText = hash.status === 'valid' ? `\n\nSHA-256 verified: ${hash.actual}` : '';
  const confirmed = window.confirm(`Install OmniForge ${version || info.version || ''}?${verifiedText}\n\nOmniForge will close and open the installer.`);
  if (!confirmed) return;
  try {
    await api.installUpdate(installerPath, { allowMissingHash });
    showToast(`Opening the OmniForge ${version || ''} installer.`, 'success', 5000);
  } catch (error) {
    showToast(`Update failed: ${error.message}`, 'error', 8000);
  }
}

function applyInstallerCandidate(info) {
  if (!info?.newer) return;
  state.updateInfo = {
    ...(state.updateInfo || {}),
    folder: state.settings?.updateFolder || null,
    exists: true,
    currentVersion: info.currentVersion,
    latest: { ...info, source: 'local' },
    newer: true,
    source: 'local',
    candidates: [info]
  };
  if (state.view === 'settings') render();
}

async function handleInstallerFile(filePath) {
  if (!filePath) {
    showToast('No installer path was provided.', 'error');
    return;
  }
  if (!/\.exe$/i.test(filePath)) {
    showToast('Drop the OmniForge setup .exe file.', 'error');
    return;
  }
  if (state.updateChecking) return;
  state.updateChecking = true;
  if (state.view === 'settings') render();
  try {
    const info = await api.describeUpdateInstaller(filePath);
    state.updateChecking = false;
    if (!info.newer) {
      if (state.view === 'settings') render();
      showToast(`Version ${info.version} is not newer than ${info.currentVersion}.`, 'error', 7000);
      return;
    }
    applyInstallerCandidate(info);
    showToast(`OmniForge ${info.version} found. Starting update...`, 'success', 3500);
    await installUpdate(info.path, info.version);
  } catch (error) {
    state.updateChecking = false;
    if (state.view === 'settings') render();
    showToast(`Could not use that installer: ${error.message || error}`, 'error', 8000);
  }
}

async function chooseUpdateInstaller() {
  try {
    const info = await api.chooseUpdateInstaller();
    if (!info) return;
    if (!info.newer) {
      showToast(`Version ${info.version} is not newer than ${info.currentVersion}.`, 'error', 6000);
      return;
    }
    applyInstallerCandidate(info);
    await installUpdate(info.path, info.version);
  } catch (error) {
    showToast(error.message, 'error', 7000);
  }
}

function microphoneErrorMessage(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was denied. Allow microphone access for OmniForge in Windows Settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No microphone was found. Connect one and try again.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The microphone is busy in another app. Close it and try again.';
  return `Could not start recording: ${error?.message || error}`;
}

async function startDictation() {
  const dictation = state.dictation;
  if (dictation.recording || dictation.busy) return;
  if (!state.status?.tools?.speech?.available) {
    showToast('The Whisper speech engine is not ready. Open Settings to check it.', 'error');
    return;
  }
  dictation.error = '';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is not available in this build.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not available in this build.');
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    dictation.stream = stream;
    dictation.recorder = recorder;
    dictation.chunks = [];
    dictation.elapsed = 0;
    dictation.startedAt = Date.now();
    dictation.recording = true;
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) dictation.chunks.push(event.data);
    });
    recorder.addEventListener('error', (event) => {
      dictation.error = `Recording failed: ${event.error?.message || 'unknown error'}`;
      stopDictation().catch(() => {});
    });
    recorder.start(250);
    dictation.timer = setInterval(() => {
      if (!dictation.recording) return;
      dictation.elapsed = Math.floor((Date.now() - dictation.startedAt) / 1000);
      const timer = document.getElementById('dictation-timer');
      if (timer) timer.textContent = formatDuration(dictation.elapsed);
      if (dictation.elapsed >= 30 * 60) stopDictation().catch(() => {});
    }, 250);
    render();
    showToast('Recording started.', 'success', 2200);
  } catch (error) {
    dictation.recording = false;
    try { dictation.stream?.getTracks().forEach((track) => track.stop()); } catch { /* already stopped */ }
    dictation.stream = null;
    dictation.recorder = null;
    if (dictation.timer) { clearInterval(dictation.timer); dictation.timer = null; }
    dictation.error = microphoneErrorMessage(error);
    render();
    showToast(dictation.error, 'error', 8000);
  }
}

async function stopDictation() {
  const dictation = state.dictation;
  if (!dictation.recording || !dictation.recorder) return;
  dictation.recording = false;
  dictation.busy = true;
  if (dictation.timer) { clearInterval(dictation.timer); dictation.timer = null; }
  dictation.elapsed = Math.max(dictation.elapsed, Math.floor((Date.now() - dictation.startedAt) / 1000));
  const recorder = dictation.recorder;
  const stopped = new Promise((resolve) => {
    if (recorder.state === 'inactive') { resolve(); return; }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    recorder.addEventListener('stop', finish, { once: true });
    setTimeout(finish, 3000);
  });
  try { recorder.stop(); } catch { /* recorder may already be stopping */ }
  await stopped;
  try { dictation.stream?.getTracks().forEach((track) => track.stop()); } catch { /* already stopped */ }
  dictation.stream = null;
  dictation.recorder = null;
  const mimeType = recorder.mimeType || 'audio/webm';
  const blob = new Blob(dictation.chunks, { type: mimeType });
  dictation.chunks = [];
  render();
  if (!blob.size) {
    dictation.busy = false;
    dictation.error = 'No audio was captured. Try recording a little longer.';
    render();
    showToast(dictation.error, 'error', 6000);
    return;
  }
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const saved = await api.saveDictationRecording(bytes, mimeType);
    dictation.recordingPath = saved.path;
    dictation.busy = false;
    render();
    await transcribeDictation(saved.path);
  } catch (error) {
    dictation.busy = false;
    dictation.error = `Could not save the recording: ${error.message || error}`;
    render();
    showToast(dictation.error, 'error', 8000);
  }
}

async function transcribeDictation(recordingPath) {
  const dictation = state.dictation;
  const options = state.options.dictation;
  try {
    const outputDirectory = await api.chooseOutputFolder();
    if (!outputDirectory) {
      dictation.error = 'Transcription was cancelled. The audio recording is still in the temp folder.';
      render();
      return;
    }
    state.settings = await api.getSettings();
    const stamp = new Date().toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).replace(/[\\/:*?"<>|,]/g, '-');
    const spec = makeSpec('transcribe', [recordingPath], outputDirectory, {
      language: options.language,
      outputFormat: options.outputFormat,
      dictation: true,
      baseName: `Dictation ${stamp}`
    }, 'Dictation');
    const job = await api.startJob(spec);
    state.jobs.set(job.id, job);
    dictation.busy = false;
    dictation.error = '';
    render();
    openQueue();
    updateQueueBadge();
    renderQueue();
    showToast('Dictation queued for local transcription.', 'success');
  } catch (error) {
    dictation.busy = false;
    dictation.error = error.message || String(error);
    render();
    showToast(dictation.error, 'error', 8000);
  }
}

function handleAction(actionTarget, event) {
  const action = actionTarget.dataset.action;
  const tool = actionTarget.dataset.tool;
  switch (action) {
    case 'pick-files': pickFiles(tool); break;
    case 'remove-file': removeFile(tool, Number(actionTarget.dataset.index)); break;
    case 'move-file': moveFile(tool, Number(actionTarget.dataset.index), Number(actionTarget.dataset.dir)); break;
    case 'clear-files':
      if (tool === 'studio' && !studioDiscardConfirmation()) break;
      state.files[tool] = [];
      if (tool === 'studio') {
        state.studio.project = null;
        state.studio.projectPath = null;
        state.studio.matchVideo = null;
        state.studio.dirty = false;
        state.studio.mediaUrl = '';
        state.studio.mediaError = '';
        resetStudioSelection();
        clearStudioRecovery().catch(() => {});
      }
      render();
      break;
    case 'start-tool': startTool(tool); break;
    case 'yt-fetch': fetchYouTube(); break;
    case 'start-dictation': startDictation(); break;
    case 'stop-dictation': stopDictation(); break;
    case 'copy-dictation': copyText(state.dictation.lastTranscript?.text || ''); break;
    case 'copy-text': copyText(actionTarget.dataset.value || ''); break;
    case 'studio-open-project': openStudioProject(); break;
    case 'studio-save-project': saveStudioProject(false); break;
    case 'studio-save-project-as': saveStudioProject(true); break;
    case 'studio-new-project': newStudioProject(); break;
    case 'studio-replace-media': replaceStudioMedia(); break;
    case 'studio-restore-recovery': restoreStudioRecovery(); break;
    case 'studio-discard-recovery': discardStudioRecovery(); break;
    case 'studio-relink-media': relinkStudioMedia(); break;
    case 'studio-use-match-video': useStudioMatchVideo(); break;
    case 'studio-choose-output': chooseStudioOutputDirectory(); break;
    case 'studio-transcribe': startStudioTranscription(); break;
    case 'studio-import-transcript': importStudioTranscript(); break;
    case 'studio-export-transcript': exportStudioTranscript(); break;
    case 'studio-select-segment': selectStudioSegment(actionTarget.dataset.id, Boolean(event?.shiftKey)); break;
    case 'studio-select-all': toggleStudioSelectAll(); break;
    case 'studio-add-clip': addStudioClip(); break;
    case 'studio-remove-clip': removeStudioClip(actionTarget.dataset.id); break;
    case 'studio-move-clip': moveStudioClip(actionTarget.dataset.id, Number(actionTarget.dataset.dir)); break;
    case 'studio-preview-clip': previewStudioClip(actionTarget.dataset.id); break;
    case 'studio-preview-ratio': setStudioPreviewRatio(actionTarget.dataset.ratio); break;
    case 'studio-framing': setStudioFraming(actionTarget.dataset.framing); break;
    case 'studio-ratio-preset': applyStudioRatioPreset(actionTarget.dataset.ratios); break;
    case 'studio-render-clips': renderStudioClips(); break;
    case 'studio-inspector-tab': setStudioInspectorTab(actionTarget.dataset.tab); break;
    case 'recipe-apply': applyRecipe(actionTarget.dataset.id); break;
    case 'recipe-delete': deleteRecipe(actionTarget.dataset.id); break;
    case 'recipe-save-current': saveCurrentRecipe(); break;
    case 'recipe-popover-close': closeRecipesPopover(); break;
    case 'smart-drop-cancel': closeSmartDropPicker(); break;
    case 'smart-drop-confirm': confirmSmartDrop(); break;
    case 'clear-results': clearResults(tool); break;
    case 'refresh-status': refreshStatus(true); break;
    case 'update-ytdlp': updateYtdlp(actionTarget); break;
    case 'check-updates': checkForUpdates(true); break;
    case 'download-update': downloadUpdate(actionTarget.dataset.version); break;
    case 'open-update-release': openUpdateRelease(); break;
    case 'choose-update-folder': chooseUpdateFolder(); break;
    case 'choose-update-installer': chooseUpdateInstaller(); break;
    case 'install-update': installUpdate(actionTarget.dataset.path, actionTarget.dataset.version); break;
    case 'open-update-folder': {
      const folder = state.settings?.updateFolder;
      if (folder) openOutput(folder);
      else showToast('No update folder has been selected.', 'error');
      break;
    }
    case 'open-tools':
      if (state.status?.toolsDir) openOutput(state.status.toolsDir);
      else showToast('Tools folder is unavailable.', 'error');
      break;
    case 'open-history': openQueue(); break;
    case 'cancel-job': api.cancelJob(actionTarget.dataset.job).then((result) => {
      if (!result.cancelled) showToast(result.reason || 'Could not cancel this job.', 'error');
    }).catch((error) => showToast(error.message, 'error')); break;
    case 'resume-job': {
      const job = state.jobs.get(actionTarget.dataset.job);
      if (job) resumeJob(job);
      break;
    }
    case 'retry-job': {
      const job = state.jobs.get(actionTarget.dataset.job);
      if (job) retryJob(job);
      break;
    }
    case 'move-job': {
      const job = state.jobs.get(actionTarget.dataset.job);
      if (job) moveJob(job, Number(actionTarget.dataset.dir));
      break;
    }
    case 'open-output': openOutput(actionTarget.dataset.path); break;
    case 'reveal-output': revealOutput(actionTarget.dataset.path); break;
    case 'view-results': navigate(tool); break;
    default: break;
  }
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (state.recipesPopoverOpen && !event.target.closest('#recipe-popover, #recipes-button')) closeRecipesPopover();
    const viewTarget = event.target.closest('[data-view]');
    if (viewTarget) {
      event.preventDefault();
      navigate(viewTarget.dataset.view);
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget) {
      event.preventDefault();
      handleAction(actionTarget, event);
    }
  });

  viewEl.addEventListener('change', handleViewChange);
  viewEl.addEventListener('input', handleViewInput);
  viewEl.addEventListener('dragover', (event) => {
    const zone = event.target.closest('.dropzone, .update-dropzone');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('drag-over');
  });
  viewEl.addEventListener('dragleave', (event) => {
    const zone = event.target.closest('.dropzone, .update-dropzone');
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drag-over');
  });
  viewEl.addEventListener('drop', handleDrop);
  viewEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const zone = event.target.closest('.update-dropzone');
    if (!zone) return;
    event.preventDefault();
    chooseUpdateInstaller();
  });
  document.addEventListener('dragenter', (event) => {
    if (!eventHasFiles(event)) return;
    if (event.target.closest('.dropzone, .update-dropzone')) {
      fileDragDepth = 0;
      hideDropOverlay();
      return;
    }
    fileDragDepth += 1;
    showDropOverlay();
  });
  document.addEventListener('dragover', (event) => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (event.target.closest('.dropzone, .update-dropzone')) hideDropOverlay();
    else showDropOverlay();
  });
  document.addEventListener('dragleave', (event) => {
    if (!eventHasFiles(event)) return;
    if (!event.relatedTarget) {
      fileDragDepth = 0;
      hideDropOverlay();
      return;
    }
    fileDragDepth = Math.max(0, fileDragDepth - 1);
    if (!fileDragDepth) hideDropOverlay();
  });
  document.addEventListener('drop', (event) => {
    const zone = event.target.closest('.dropzone, .update-dropzone');
    fileDragDepth = 0;
    hideDropOverlay();
    if (zone) {
      event.preventDefault();
      return;
    }
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    const files = [...(event.dataTransfer?.files || [])];
    const paths = [];
    const fileObjects = [];
    for (const file of files) {
      const filePath = api.getPathForFile(file);
      if (filePath) {
        paths.push(filePath);
        fileObjects.push(file);
      }
    }
    showSmartDropPicker(paths, fileObjects);
  });

  document.getElementById('queue-button').addEventListener('click', openQueue);
  document.getElementById('command-button').addEventListener('click', openCommandPalette);
  document.getElementById('recipes-button').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleRecipesPopover();
  });
  const commandOverlay = document.getElementById('command-overlay');
  const commandInput = document.getElementById('command-input');
  const commandResults = document.getElementById('command-results');
  commandOverlay.addEventListener('click', (event) => { if (event.target === commandOverlay) closeCommandPalette(); });
  commandInput.addEventListener('input', () => {
    state.command.query = commandInput.value;
    state.command.index = 0;
    renderCommandResults();
  });
  commandResults.addEventListener('click', (event) => {
    const result = event.target.closest('[data-command-index]');
    if (result) executeCommand(Number(result.dataset.commandIndex));
  });
  const smartDropOverlay = document.getElementById('smart-drop-overlay');
  smartDropOverlay.addEventListener('click', (event) => { if (event.target === smartDropOverlay) closeSmartDropPicker(); });
  smartDropOverlay.addEventListener('change', (event) => {
    const choice = event.target.closest('input[name="smart-drop-tool"]');
    if (!choice || !state.dropPicker) return;
    state.dropPicker.selected = choice.value;
    renderSmartDropPicker();
  });
  window.addEventListener('resize', () => { if (state.recipesPopoverOpen) positionRecipesPopover(); });
  queueOverlay.addEventListener('click', closeQueue);
  document.querySelectorAll('[data-queue-filter]').forEach((button) => button.addEventListener('click', () => {
    state.queueFilter = button.dataset.queueFilter;
    renderQueue();
  }));
  document.getElementById('clear-finished').addEventListener('click', () => {
    for (const [id, job] of state.jobs.entries()) {
      if (['succeeded', 'failed', 'cancelled'].includes(job.status)) state.jobs.delete(id);
    }
    renderQueue();
    updateQueueBadge();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (state.command.open) closeCommandPalette();
      else openCommandPalette();
      return;
    }
    if (state.command.open) {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveCommandSelection(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveCommandSelection(-1); return; }
      if (event.key === 'Enter') { event.preventDefault(); executeCommand(); return; }
      if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }
    }
    if (event.key !== 'Escape') return;
    if (state.command.open) closeCommandPalette();
    else if (state.dropPicker) closeSmartDropPicker();
    else if (state.recipesPopoverOpen) closeRecipesPopover();
    else if (state.queueOpen) closeQueue();
  });
}

async function init() {
  setStaticIcons();
  window.addEventListener('beforeunload', () => {
    try { state.dictation.stream?.getTracks().forEach((track) => track.stop()); } catch { /* app is closing */ }
    if (state.dictation.timer) clearInterval(state.dictation.timer);
    if (state.studio.recoveryTimer) clearTimeout(state.studio.recoveryTimer);
  });
  state.starting = false;
  bindEvents();
  api.onJobUpdate(handleJobUpdate);
  api.onOpenQueue?.(() => openQueue());
  api.onUpdateProgress?.((progress) => {
    state.updateProgress = progress;
    if (['downloading', 'verifying'].includes(progress?.phase)) state.updateDownloading = true;
    if (['ready', 'error'].includes(progress?.phase)) state.updateDownloading = false;
    if (state.view === 'settings') render();
  });
  viewEl.innerHTML = `<div class="empty-state"><div class="tool-icon" style="--icon-color:var(--lime)">${icon('sparkle')}</div><h3>Starting OmniForge…</h3><p>Checking the bundled engines.</p></div>`;
  try {
    const [status, history, pendingJobs] = await Promise.all([api.getSystemStatus(), api.getHistory(), api.listJobs()]);
    state.status = status;
    state.settings = status.settings;
    updateRecipeBadge();
    state.history = history;
    mergeHistoryJobs(history);
    applyJobSnapshots(pendingJobs);
    updateEngineStatus();
    renderQueue();
    render();
    api.getStudioRecovery().then((recovery) => {
      if (!recovery) return;
      state.studio.recovery = recovery;
      if (state.view === 'studio') render();
      showToast('An unsaved Studio session is available to restore.', 'info', 6500);
    }).catch(() => {});
    autoCheckForUpdates();
  } catch (error) {
    viewEl.innerHTML = `<div class="empty-state"><div class="tool-icon" style="--icon-color:var(--danger)">${icon('alert')}</div><h3>OmniForge could not start</h3><p>${escapeHtml(error.message || String(error))}</p></div>`;
    showToast('The app could not load its engine status.', 'error', 8000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
