# Changelog

All notable changes to OmniForge are documented here.

## 1.5.0 - 2026-10-30

### Added

- GitHub Releases update discovery with streamed download progress.
- Fail-closed SHA-256 verification for GitHub-downloaded installers.
- Release notes access and a verified-installer confirmation flow in Settings.
- Offline installer fallback for unavailable networks.
- Public release workflows, community templates, and security documentation.
- Reproducible pinned tool downloads with checksum verification.

### Changed

- Refreshed FFmpeg, FFprobe, and 7-Zip to current stable builds.
- Removed the developer-specific default update folder.
- Updated the app version and release metadata to 1.5.0.

### Security

- Unsigned builds disclose the Windows SmartScreen warning and require explicit installation confirmation.
- GitHub updates reject missing, malformed, mismatched, or incorrectly named hash sidecars.

## 1.4.0 - 2026-10-29

- Added configurable parallel job queue execution and aggregate taskbar progress.
- Added queue recovery, reordering, retry, speed, and ETA reporting.
