const DEFAULT_INPUT_EXTENSIONS = {
  video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp', 'ogv'],
  audio: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'alac', 'amr'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'tif', 'tiff', 'ico', 'svg', 'heic', 'heif', 'jxl', 'tga', 'ppm', 'pgm'],
  data: ['json', 'csv', 'tsv', 'yaml', 'yml', 'xml'],
  pdf: ['pdf'],
  archive: ['zip', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'rar', 'iso', 'cab'],
  encrypted: ['ofenc']
};

const SUGGESTIONS = {
  video: [
    ['convert', 'Change the container or codec'],
    ['compress', 'Reduce the file size'],
    ['trim', 'Keep a specific time range'],
    ['extract', 'Save the audio track'],
    ['gif', 'Create an animated GIF'],
    ['frames', 'Export still frames'],
    ['transcribe', 'Create a local transcript'],
    ['studio', 'Turn transcript lines into clips']
  ],
  audio: [
    ['convert', 'Change the audio format'],
    ['compress', 'Reduce the file size'],
    ['normalize', 'Even out the loudness'],
    ['trim', 'Keep a specific time range'],
    ['transcribe', 'Create a local transcript'],
    ['studio', 'Turn transcript lines into clips']
  ],
  image: [
    ['convert', 'Change the image format'],
    ['compress', 'Reduce the image size'],
    ['metadata', 'Remove embedded metadata']
  ],
  pdf: [['pdf', 'Merge, split, reorder, or rotate PDF pages']],
  archive: [['archive', 'Extract or archive files']],
  data: [['convert', 'Convert structured data formats']],
  encrypted: [['encryptor', 'Decrypt OmniForge .ofenc files']],
  mixed: [
    ['convert', 'Convert compatible files as one batch'],
    ['archive', 'Package the files together'],
    ['encryptor', 'Encrypt the files locally'],
    ['checksum', 'Calculate file checksums']
  ]
};

function extensionOf(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot + 1);
}

function categoryFor(name, inputExtensions = DEFAULT_INPUT_EXTENSIONS) {
  const ext = extensionOf(name);
  if (!ext) return 'unknown';
  for (const [category, extensions] of Object.entries(inputExtensions || DEFAULT_INPUT_EXTENSIONS)) {
    if (Array.isArray(extensions) && extensions.includes(ext)) return category;
  }
  return 'unknown';
}

export function suggestDropTools(fileNames, inputExtensions = DEFAULT_INPUT_EXTENSIONS) {
  const names = (Array.isArray(fileNames) ? fileNames : []).filter(Boolean);
  if (!names.length) return { category: 'unknown', suggestions: [] };
  const categories = [...new Set(names.map((name) => categoryFor(name, inputExtensions)))];
  if (categories.length === 1 && categories[0] !== 'unknown' && SUGGESTIONS[categories[0]]) {
    const category = categories[0];
    return {
      category,
      suggestions: (SUGGESTIONS[category] || []).map(([tool, reason], index) => ({ tool, reason, recommended: index === 0 }))
    };
  }
  const known = categories.filter((category) => category !== 'unknown');
  const category = known.length ? 'mixed' : 'unknown';
  return {
    category,
    suggestions: (SUGGESTIONS[category] || []).map(([tool, reason], index) => ({ tool, reason, recommended: index === 0 }))
  };
}

function commandScore(item, query) {
  const title = String(item.label || '').toLowerCase();
  const keywords = Array.isArray(item.keywords) ? item.keywords.join(' ').toLowerCase() : String(item.keywords || '').toLowerCase();
  if (!query) return 0;
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (keywords.includes(query)) return 3;
  return 99;
}

export function filterCommandItems(items, query, limit = 12) {
  const value = String(query || '').trim().toLowerCase();
  return (Array.isArray(items) ? items : [])
    .map((item, order) => ({ item, order, score: commandScore(item, value) }))
    .filter((entry) => entry.score < 99)
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.item);
}

export function fitPreviewFrame(containerWidth, containerHeight, width, height) {
  const availableWidth = Math.max(0, Number(containerWidth) || 0);
  const availableHeight = Math.max(0, Number(containerHeight) || 0);
  const sourceWidth = Math.max(0, Number(width) || 0);
  const sourceHeight = Math.max(0, Number(height) || 0);
  if (!availableWidth || !availableHeight || !sourceWidth || !sourceHeight) return null;
  const aspectRatio = sourceWidth / sourceHeight;
  let fittedWidth = availableWidth;
  let fittedHeight = fittedWidth / aspectRatio;
  if (fittedHeight > availableHeight) {
    fittedHeight = availableHeight;
    fittedWidth = fittedHeight * aspectRatio;
  }
  return {
    width: Math.max(1, Math.floor(fittedWidth)),
    height: Math.max(1, Math.floor(fittedHeight))
  };
}

export function toggleAllSelection(allIds, selectedIds) {
  const ids = [...new Set((Array.isArray(allIds) ? allIds : []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(String));
  return ids.every((id) => selected.has(id)) ? [] : ids;
}
