# Changelog

All notable changes to OmniForge are documented here.

## 1.5.1 - 2026-10-30

### Fixed

- Restored live YouTube download speed and progress updates. yt-dlp print mode had suppressed progress output, leaving large downloads stuck at 1% in the UI.

## 1.5.0 - 2026-10-30

### Added

- GitHub Releases update discovery with streamed download progress.
- Fail-closed SHA-256 verification for GitHub-downloaded installers.
- Release notes access and a verified-installer confirmation flow in Settings.
- Offline installer fallback for unavailable networks.
- Public release workflows, community templates, and security documentation.
- Reproducible pinned tool downloads with checksum verification.
- A manual release-workflow trigger for rebuilding an existing version tag.
- Primary DeepSeek V4.1 Flash 1017 development credit and additional OpenAI Codex assistance in the project documentation.

### Changed

- Refreshed FFmpeg, FFprobe, and 7-Zip to current stable builds.
- Removed the developer-specific default update folder.
- Updated the app version and release metadata to 1.5.0.

### Security

- Unsigned builds disclose the Windows SmartScreen warning and require explicit installation confirmation.
- GitHub updates reject missing, malformed, mismatched, or incorrectly named hash sidecars.
- CI uses explicit test discovery so the suite runs correctly on Node.js 20 and newer.

## 1.4.0 - 2026-10-29

- Added configurable parallel job queue execution and aggregate taskbar progress.
- Added queue recovery, reordering, retry, speed, and ETA reporting.
