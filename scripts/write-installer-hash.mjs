import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const distDirectory = path.join(root, 'dist');
const installerPath = path.join(distDirectory, `OmniForge-Setup-${packageJson.version}.exe`);

if (!fs.existsSync(installerPath)) {
  throw new Error(`Installer not found: ${installerPath}`);
}

const hash = crypto.createHash('sha256');
await new Promise((resolve, reject) => {
  const stream = createReadStream(installerPath);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', resolve);
});

const fileName = path.basename(installerPath);
const sidecarPath = `${installerPath}.sha256`;
fs.writeFileSync(sidecarPath, `${hash.digest('hex')}  ${fileName}\n`, 'utf8');
console.log(`Wrote ${sidecarPath}`);
