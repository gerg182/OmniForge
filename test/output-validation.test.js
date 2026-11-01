'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateOutputPaths } = require('../src/main/output-validation');

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omniforge-output-validation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('output validation accepts non-empty files and directory outputs', (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, 'result.txt');
  const folderOutput = path.join(directory, 'frames');
  fs.writeFileSync(file, 'result', 'utf8');
  fs.mkdirSync(folderOutput);

  assert.deepEqual(validateOutputPaths([file, folderOutput]), [file, folderOutput]);
  assert.deepEqual(validateOutputPaths([]), []);
});

test('output validation removes empty files and reports a useful error', (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, 'empty.mp4');
  fs.writeFileSync(file, '', 'utf8');

  assert.throws(
    () => validateOutputPaths([file]),
    /Output file is empty and was removed: empty\.mp4/
  );
  assert.equal(fs.existsSync(file), false);
});

test('output validation rejects missing and blank output paths', (t) => {
  const directory = temporaryDirectory(t);
  const missing = path.join(directory, 'missing.mp4');

  assert.throws(() => validateOutputPaths([missing]), /Expected output was not created: missing\.mp4/);
  assert.throws(() => validateOutputPaths(['']), /without a file path/);
});
