---
name: OmniForge Tool Pipeline
description: Use when adding, renaming, or extending an OmniForge tool or tab end-to-end, covering the renderer view, job spec, FFmpeg/main operation, queue integration, tests, docs, and versioning.
---

# Adding a tool to OmniForge

A tool is a renderer view plus a job `spec`, a main-process operation, and a
queue entry. The renderer only collects inputs; all file work happens in the
main process. Follow this checklist in order and keep every layer's word for
the tool the same lowercase id (for example `removeaudio`).

## 1. Describe the job in the main process

**`src/main/constants.js`**

- Add the id to `TOOL_LABELS`. `job-manager.js` builds its whitelist from
  `Object.keys(TOOL_LABELS)`, so the tool cannot be queued without this entry.
- Reuse `OUTPUT_FORMATS` / `INPUT_EXTENSIONS` instead of new format lists when
  the tool works on media.

**`src/main/media-args.js`** (FFmpeg tools only)

- Add a focused builder next to `buildAddAudioArgs` / `buildMediaArgs`. Return a
  flat argument array, put the output path last, and throw on unsupported
  formats.
- Derive the container from the output extension rather than duplicating
  format lists.

```js
function buildExampleArgs({ input, output }) {
  return ['-i', input, '-map', '0:v:0', '-c', 'copy', '-an', output];
}
```

**`src/main/operations.js`**

- Import the builder, write `executeExample(spec, ctx, deps)`, wire it into the
  `executeJob` switch, and export it.
- `assertInputs(spec)` first, then validate the tool-specific shape.
- Resolve files with `deps.tools.paths()`; never hard-code a path under `tools/`.
- Use `ensureDir(spec.outputDirectory)` and `uniquePath(dir, base, ext)` so
  existing files are never overwritten. Suffix names (`_no_audio`, `_trimmed`)
  describe the transform.
- Report progress through `runFfmpeg(ctx, deps, args, { duration, progressBase,
  progressSpan, message })`. Batch tools split 0-100 across inputs.
- Throw when the expected file is missing or empty; `output-validation.js` also
  fails jobs that report missing or zero-byte outputs, so never fake a path.
- Use `ctx.signal` via `runFfmpeg`/`runProcess` so cancellation works.

Batch skeleton:

```js
async function executeExample(spec, ctx, deps) {
  assertInputs(spec);
  const outputs = [];
  const total = spec.inputPaths.length;
  for (let index = 0; index < total; index += 1) {
    const filePath = spec.inputPaths[index];
    const outputDirectory = await ensureDir(spec.outputDirectory);
    const outputPath = uniquePath(outputDirectory, `${baseNameWithoutExtension(filePath)}_example`, 'mp4');
    const duration = await getMediaDuration(deps.tools.paths().ffprobe, filePath);
    const args = buildExampleArgs({ input: filePath, output: outputPath });
    await runFfmpeg(ctx, deps, args, {
      duration,
      progressBase: Math.round((index / total) * 100),
      progressSpan: Math.round(100 / total),
      message: `Processing ${path.basename(filePath)}`
    });
    if (!fs.existsSync(outputPath)) throw new Error('The job finished without creating an output file.');
    outputs.push(outputPath);
  }
  return { outputPaths: outputs };
}
```

## 2. Add the renderer tab

`src/renderer/app.js`

- `ICONS`: one 24×24 stroke icon.
- `VIEW_META`: `[eyebrow, title]`. This drives the page header and the command
  palette automatically.
- `TOOL_ICONS` and `TOOL_COLORS`: reuse an existing palette color when possible.
- `ALLOWED_CATEGORIES`: `['video']`, `['audio', 'video']`, or `null` for
  anything. Files outside the list are rejected at drop time with a toast.
- `GUIDES`: icon, title, one-paragraph explanation, and three `[step, detail]`
  pairs. Write it as the right-hand explainer, not marketing.
- `state.files[tool]` and `state.options[tool]`: seed defaults in the `state`
  literal.
- `render()` switch: `case 'tool': html = renderTool(); break;`
- Write `renderTool()` using the standard panel layout (see the
  `omniforge-ui-style` skill).
- `batchSpecs()` only needs an entry when the tool is not one-file-in /
  one-file-out. Multi-input single jobs (or one job per file) need a branch.
  Otherwise the default `files.map(...)` behavior is correct.
- `startTool()`: add validation only for rules the UI cannot express by
  disabling the button (pairing, minimum counts, acknowledgements).
- `addPaths()`: only special-case role-based inputs (like Add Audio, which
  accepts one video and one audio). Ordinary tools just use
  `ALLOWED_CATEGORIES`.

`src/renderer/index.html`

- Add a `.nav-item` button with `data-view="tool"` and its `data-icon` in the
  right sidebar group. Icons are hydrated from `ICONS` on boot.

Optional polish:

- Home tool card in `renderHome()` via `toolCard(...)` if the tool deserves a
  front-page slot.
- Smart-drop suggestion in `SUGGESTIONS` inside `src/renderer/workflow.mjs`.
- Recipe support in `RECIPE_TOOLS` (`src/main/recipes.js`) when the options are
  safe to persist. Never include passwords, acknowledgements, URLs, or paths.

## 3. Tests

- Unit test the argument builder in `test/unit.test.js` (or the nearest
  existing suite): assert codec/map flags, sanitizing, and the final output
  path.
- Integration test in `test/integration.test.js` or `test/extra-tools.test.js`
  when FFmpeg is involved: generate the input with FFmpeg, run `executeJob`
  with a fake `ctx` and real `deps.tools.paths()`, then assert the file exists,
  is non-empty, and has the expected streams with `ffprobe`.
- Run `node --check` on each changed JS file, then `npm test`. Integration
  tests need `npm run prepare:tools` (the bundled `tools/` folder).

## 4. Docs and release

- `README.md`: add a feature bullet in the user's words; if the version is
  bumped, update every `OmniForge-Setup-X.Y.Z.exe` reference.
- `CHANGELOG.md`: new version section at the top with the change under
  `### Added` / `### Changed` / `### Fixed`.
- Bump the version in `package.json` and both top-level entries of
  `package-lock.json` together. New feature = MINOR, fix = PATCH.
- Do not commit `dist/`, installers, or downloaded tool binaries.
- Commit in the repo's imperative style, for example
  `Add audio removal tool for 1.9.0`.

## Invariants

- Renderer sends `{ tool, inputPaths, outputDirectory, options, label }`;
  the job manager validates and stores that exact shape.
- Options must be JSON-serializable, small, and free of secrets.
- Every output path must exist on disk when the operation returns.
- Tools must be cancellable and must never leave a partially written file
  reported as success.
- Use 2-space indentation, semicolons, single quotes, `async`/`await`, and
  CommonJS in `src/main`.
