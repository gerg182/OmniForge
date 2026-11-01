'use strict';

const fs = require('fs');
const path = require('path');

function validateOutputPaths(outputPaths) {
  const paths = Array.isArray(outputPaths) ? outputPaths : [];

  for (const value of paths) {
    const filePath = String(value || '').trim();
    if (!filePath) throw new Error('A job reported an output without a file path.');

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      throw new Error(`Expected output was not created: ${path.basename(filePath) || filePath}.`);
    }

    if (stat.isDirectory()) continue;
    if (!stat.isFile()) {
      throw new Error(`Expected output is not a file or directory: ${path.basename(filePath) || filePath}.`);
    }
    if (stat.size === 0) {
      try { fs.rmSync(filePath, { force: true }); } catch { /* the empty output may be locked */ }
      throw new Error(`Output file is empty and was removed: ${path.basename(filePath) || filePath}.`);
    }
  }

  return paths;
}

module.exports = { validateOutputPaths };
