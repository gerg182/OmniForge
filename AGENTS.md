# Repository Guidelines

## Project Structure & Module Organization
OmniForge is a local-first Electron desktop app for media conversion, YouTube downloads, file tools, and offline speech transcription.

- `src/main/` - Electron main process: IPC, job queue, converters, file tools, speech, and updates.
- `src/preload.js` - narrow `window.omniforge` bridge exposed to the renderer.
- `src/renderer/` - vanilla HTML/CSS/JavaScript UI (`app.js`, `index.html`, `styles.css`).
- `test/` - Node test files plus `fixtures/jfk.wav`.
- `scripts/prepare-tools.mjs` - prepares bundled FFmpeg, yt-dlp, Deno, 7-Zip, whisper.cpp, and the speech model.
- `scripts/tools-lock.json` - pinned third-party versions, URLs, and SHA-256 checksums.
- `.github/workflows/` - Windows CI and tag-driven draft release automation.
- `tools/` - bundled binaries/models (mostly ignored); `assets/` and `build/` hold icon resources.

## Build, Test, and Development Commands
- `npm ci` - install the lockfile-exact dependencies.
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

## Versioning
- OmniForge uses Semantic Versioning: `MAJOR.MINOR.PATCH`.
- Increment `MAJOR` for incompatible changes, `MINOR` for backward-compatible features, and `PATCH` for backward-compatible fixes.
- Keep the version synchronized in `package.json`, `package-lock.json`, the README installer filename, and the built application metadata.
- Update `CHANGELOG.md` for every release, and keep its top version aligned with `package.json`.
- Use `vX.Y.Z` only for Git release tags. Do not prefix the package version with `v`.
- Name installers and update artifacts exactly `OmniForge-Setup-X.Y.Z.exe`; keep adjacent `.blockmap` and `.sha256` files on the same version.
- Build the release installer from the tagged or committed release state, then verify the embedded file and product versions before publishing.

## Testing Guidelines
- Tests use Node's built-in `node:test` runner, with files named `test/*.test.js`.
- Use descriptive `test(...)` names.
- Integration tests call bundled FFmpeg, 7-Zip, PDF, and whisper.cpp; run `npm run prepare:tools` first.
- Run `npm test` before every commit. No coverage threshold is enforced.
- GitHub Actions runs `npm ci`, restores the pinned tool cache, prepares the tools, syntax-checks changed entry points, and runs `npm test`.

## Commit & Pull Request Guidelines
- Write concise, imperative commit subjects such as `Add drag-and-drop installer updates`.
- After completing and validating a task that changed files, create focused commit(s) and push them to the current upstream branch unless the user explicitly says not to commit or push. Never rewrite history or force-push as part of this workflow.
- Keep commits focused. Do not commit `node_modules/`, `dist/`, or large `tools/` binaries.
- Pull requests should include a summary, `npm test` results, version impact, and screenshots for UI changes.
- Update `README.md` for user-facing changes and keep `package.json`/`package-lock.json` versions synchronized.

## Updates & Release Workflow

- `src/main/github-updates.js` checks `https://api.github.com/repos/gerg182/OmniForge/releases/latest` and requires a published `vX.Y.Z` release with exactly one `OmniForge-Setup-X.Y.Z.exe` and one matching `.exe.sha256`.
- GitHub downloads must stream to a temporary file, verify the published SHA-256, and delete incomplete or mismatched files. Never weaken fail-closed hash verification or install an update without explicit confirmation.
- The local update folder and selected-installer flow are offline fallbacks. Keep their validation behavior compatible with GitHub-driven updates.
- Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`. The tag must equal `v` plus the synchronized `package.json` version.
- The release workflow can also be started manually from the Actions tab for an existing tag; use this when a tag was pushed before Actions was enabled.
- The release workflow runs tests, builds the installer, verifies the embedded file/product versions and sidecar hash, and creates a draft GitHub Release. The repository owner must review and publish that draft.
- GitHub-driven updates from the installed app only work after the repository is public and the release is published. Repository visibility is changed manually in GitHub settings.
- Optional code signing is supplied through the `CSC_LINK` and `CSC_KEY_PASSWORD` Actions secrets. Never commit certificates or signing passwords.
- Do not commit `dist/`, installer artifacts, downloaded `tools/*.exe`, `tools/*.dll`, `tools/*.bin`, or `tools/manifest.json`.

## Architecture & Configuration Notes
- `src/main/job-manager.js` runs a bounded parallel queue (1-3 slots, default 2) and streams progress through `ctx.report`.
- Resolve bundled executables through `ToolsManager.paths()`; never hard-code absolute tool paths.
- Speech and dictation run locally through whisper.cpp; microphone access is limited to the main window.
- In-app installs work only in packaged builds; installers must be named `OmniForge-Setup-x.y.z.exe`.
