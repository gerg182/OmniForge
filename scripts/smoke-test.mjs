import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packaged = process.argv.includes('--packaged');
const executable = packaged
  ? path.join(root, 'dist', 'win-unpacked', 'OmniForge.exe')
  : path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

if (!fs.existsSync(executable)) {
  console.error(`Smoke-test executable not found: ${executable}`);
  process.exit(1);
}

const args = packaged ? ['--smoke-test'] : [root, '--smoke-test'];
const child = spawn(executable, args, {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

const timeout = setTimeout(() => {
  console.error('Smoke test timed out after 45 seconds.');
  child.kill();
  process.exitCode = 1;
}, 45000);

child.on('error', (error) => {
  clearTimeout(timeout);
  console.error(`Could not start smoke test: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  if (signal) {
    console.error(`Smoke test exited after signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
