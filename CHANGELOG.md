# Changelog

All notable changes to OmniForge are documented here.

## 1.6.2 - 2026-10-31

### Changed

- Settings now has a dedicated System navigation group and an always-visible topbar shortcut, making settings and updates easier to find.
- Refined navigation, cards, panels, file rows, and Secure Delete guidance with restrained motion and reduced-motion support.
- Rewrote the Secure Delete SSD explanation in plain language so wear leveling, backups, cloud copies, and snapshots are easier to understand.

## 1.6.1 - 2026-10-31

### Fixed

- Installer downloads now update their progress in place instead of rebuilding the entire Settings view, eliminating the flashing that occurred while large updates downloaded.

### Changed

- Application updates now appear first in Settings with a highlighted panel, dedicated navigation entry, and an update-available badge.

## 1.6.0 - 2026-10-31

### Added

- Prominent legal and acceptable-use warnings throughout the app, including a required first-run agreement that locks the workspace until accepted and a separate acknowledgment before YouTube downloads begin.
- A full Legal & Acceptable Use notice covering copyright, YouTube terms, metadata removal, encryption, secure deletion, recording consent, third-party licenses, and codec-patent risks.

## 1.5.3 - 2026-10-31

### Fixed

- Tag-driven release builds now disable electron-builder's implicit GitHub publishing, preventing the workflow from failing when `GH_TOKEN` is not configured. The release workflow remains the only component that creates GitHub releases.

## 1.5.2 - 2026-10-31

### Fixed

- Restored live job updates in the queue. Progress, speed, completion, and failure messages now reach the renderer instead of being discarded by the main process.

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
