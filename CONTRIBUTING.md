# Contributing to OmniForge

Thanks for helping improve OmniForge. Bug reports, focused fixes, documentation updates, and tested feature changes are welcome.

## Development Setup

Requirements: Windows 10/11 x64 or Linux x64, and Node.js 20 or newer.

```bash
npm ci
npm run prepare:tools
npm test
npm start
```

On Windows, `npm run prepare:tools` downloads the pinned FFmpeg, FFprobe, 7-Zip, yt-dlp, Deno, whisper.cpp, and speech-model artifacts, verifying every pinned SHA-256 checksum. On Linux it downloads only the speech model: the other tools are resolved from `PATH` (install `ffmpeg`, `7zip`, and, for YouTube, `yt-dlp` plus `deno`). The integration tests use those same resolved paths, so they run on both platforms once the tools are available.

Build the Windows installer with `npm run dist`; the output is written to `dist/` and must be named `OmniForge-Setup-X.Y.Z.exe`. Build the Linux AppImage with `npm run dist:linux`; the output is `dist/OmniForge-X.Y.Z.AppImage` plus `dist/linux-unpacked/`.

## Changes

- Keep changes focused and consistent with the existing CommonJS main-process and browser renderer code.
- Use 2-space indentation, semicolons, single quotes, and `async`/`await`.
- Add or update `test/*.test.js` tests for behavior changes.
- Run `npm test` and `node --check` on changed JavaScript before committing.
- Update user-facing documentation and the changelog for meaningful changes.
- Do not commit `node_modules/`, `dist/`, downloaded tool binaries, credentials, or personal paths.

## Versioning

OmniForge follows Semantic Versioning. Use `MAJOR` for incompatible changes, `MINOR` for backward-compatible features, and `PATCH` for backward-compatible fixes. Keep `package.json`, `package-lock.json`, the README installer name, installer metadata, and Git release tags synchronized.

## Pull Requests

Include a summary, the tests you ran, the version impact, and screenshots for UI changes. Link related issues where possible. By contributing, you agree that your changes are licensed under the repository's MIT License.

## Releases

Release tags use `vX.Y.Z`. The release workflow verifies that the tag matches `package.json`, builds the NSIS installer, checks the embedded version and SHA-256 sidecar, and creates a draft GitHub Release. The repository owner reviews the draft before publishing it.
