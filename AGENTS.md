# Repository Guidelines

## Project Structure & Module Organization
OmniForge is a local-first Electron desktop app for media conversion, YouTube downloads, file tools, and offline speech transcription.

- `src/main/` - Electron main process: IPC, job queue, converters, file tools, speech, and updates.
- `src/preload.js` - narrow `window.omniforge` bridge exposed to the renderer.
- `src/renderer/` - vanilla HTML/CSS/JavaScript UI (`app.js`, `index.html`, `styles.css`).
- `test/` - Node test files plus `fixtures/jfk.wav`.
- `scripts/prepare-tools.mjs` - prepares bundled FFmpeg, yt-dlp, Deno, 7-Zip, whisper.cpp, and the speech model.
- `tools/` - bundled binaries/models (mostly ignored); `assets/` and `build/` hold icon resources.

## Build, Test, and Development Commands
- `npm install` - install dependencies.
- `npm start` or `npm run dev` - run the Electron app locally.
- `npm test` - run the complete Node test suite.
- `npm run prepare:tools` - refresh bundled tools; add `-- --force` to re-download them.
- `npm run pack` - create an unpacked app in `dist/`.
- `npm run dist` - build the Windows NSIS installer in `dist/`.

Requires Windows x64 and Node.js 20 or newer.

## Coding Style & Naming Conventions
- Use CommonJS in the main process and preload; use browser JavaScript in the renderer.
- Use 2-space indentation, semicolons, single quotes, and `async`/`await`.
- Use `camelCase` for variables/functions, `PascalCase` for classes, and kebab-case for filenames.
- Use lowercase tool IDs and colon-separated IPC channels (`job:start`).
- No linter or formatter is configured. Match surrounding code and run `node --check <file>` on changed JavaScript.

## Testing Guidelines
- Tests use Node's built-in `node:test` runner, with files named `test/*.test.js`.
- Use descriptive `test(...)` names.
- Integration tests call bundled FFmpeg, 7-Zip, PDF, and whisper.cpp; run `npm run prepare:tools` first.
- Run `npm test` before every commit. No coverage threshold is enforced.

## Commit & Pull Request Guidelines
- Write concise, imperative commit subjects such as `Add drag-and-drop installer updates`.
- After completing and validating a task that changed files, create focused commit(s) and push them to the current upstream branch unless the user explicitly says not to commit or push. Never rewrite history or force-push as part of this workflow.
- Keep commits focused. Do not commit `node_modules/`, `dist/`, or large `tools/` binaries.
- Pull requests should include a summary, `npm test` results, version impact, and screenshots for UI changes.
- Update `README.md` for user-facing changes and keep `package.json`/`package-lock.json` versions synchronized.

## Architecture & Configuration Notes
- `src/main/job-manager.js` runs one job at a time and streams progress through `ctx.report`.
- Resolve bundled executables through `ToolsManager.paths()`; never hard-code absolute tool paths.
- Speech and dictation run locally through whisper.cpp; microphone access is limited to the main window.
- In-app installs work only in packaged builds; installers must be named `OmniForge-Setup-x.y.z.exe`.
