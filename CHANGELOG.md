# Changelog

All notable changes to OmniForge are documented here.

## 1.8.5 - 2026-11-18

### Changed

- Rewrote interface labels, tool descriptions, settings copy, and update messages so they say more directly what each action does.
- Renamed tools for clarity: Convert Files, Join Files, Normalize Volume, GIF Maker, Extract Frames, Clip from Transcript, Transcribe Audio, PDF Tools, Encrypt / Decrypt, File Checksums, Inspect Media, Remove Metadata, and Shred Files.
- Replaced "engine" with "tools" in status and readiness messages.

## 1.8.4 - 2026-11-18

### Added

- Added a persistent update warning in the app shell when a newer OmniForge version is available. It switches to a ready-to-install message after the installer is downloaded and SHA-256 verified, and links to the App updates section.

### Changed

- Remove Audio now uses the same standard video format list as the other media tools, with MP4, MKV, WebM, MOV, and AVI options plus a Match source default.
- The global Legal details button now opens the Legal & acceptable use section in Settings instead of only opening the Settings page.
- The offline installer picker now opens in the configured update folder.

### Fixed

- A failed installer launch keeps the verified installer ready instead of reporting a download failure.
- Changing the update folder clears stale download state so the warning banner does not claim an unverified build is ready.

## 1.8.3 - 2026-11-18

### Added

- Added a **Remove Audio** tool that saves a silent copy of a video. The picture is copied without re-encoding, the audio track is dropped, and each result keeps the source container or is written as MP4 or MKV.
- Added project skills that document the OmniForge interface style and the end-to-end tool pipeline for future changes.

## 1.8.2 - 2026-11-16

### Added

- Added an **Add Audio** tool that puts an audio track such as an MP3 on a video and replaces the video's existing audio. The audio is cut to the video's length and padded with silence when it is shorter; the video stream is copied without re-encoding.

## 1.8.1 - 2026-11-16

### Changed

- Reworked the interface into a warm light paper theme with cream surfaces, ink text, a subtle paper grain, and soft layered shadows.
- Replaced the app icon with a cream tile showing an ink anvil draped with a clay cloth, and synced the window, build, and installer icons.

## 1.8.0 - 2026-11-16

### Changed

- Refreshed the interface with a flat, monochrome theme: neutral palette, tighter spacing, flat panels, and neutral tool icons.
- Simplified the top bar to icon-only actions and grouped Settings with the job queue; the saved-recipe count now hides when empty.
- Tool cards now use a three-column grid instead of four.
- Replaced the app icon with a monochrome anvil mark and synced the window, build, and installer icons.

### Removed

- Removed ambient background effects, gradient accents, glows, and decorative entrance animations.

## 1.7.0 - 2026-11-01

### Added

- Added creator presets for long-form, Shorts, square, portrait, and multi-format exports.
- Added a simultaneous orientation preview board, 60-second Shorts duration guidance, and preview-only safe-zone guides.
- Studio projects now remember the selected creator preset and safe-zone preference.

### Changed

- Manual ratio or framing changes switch the project to the Custom preset.

## 1.6.4 - 2026-11-01

### Added

- Added privacy-safe diagnostics with copyable support reports and local log access.
- Added development and packaged startup smoke tests.

### Fixed

- Jobs now fail when reported outputs are missing or empty instead of incorrectly succeeding.
- OmniForge recovers from one renderer crash and reports a clear error if recovery fails.
- Existing installs now acknowledge the legal notice once per app version.

## 1.6.3 - 2026-10-31

### Added

- Added a polished motion pass across the app: staggered tool cards, ambient background movement, animated hero accents, button sheen, dropzone feedback, queue entrance, live-job pulses, update confirmation motion, and smoother title and toast transitions.
- Added installer cleanup after upgrades. The exact installer used for an update and older app-managed installers are removed after the new version starts, with locked files retried on the next launch.

### Changed

- Update downloads now show accurate byte totals, speed, ETA, and separate SHA-256 verification progress.
- Settings now lives in the sidebar engine-status card for easier access.

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
