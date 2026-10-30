# OmniForge

OmniForge is a local-first Windows desktop app for downloading permitted YouTube videos, converting media and data files, compressing and trimming clips, extracting audio, transcribing speech, recording dictation, building GIFs, editing PDFs, working with archives, encrypting files, calculating checksums, and inspecting media.

Everything runs on your PC. FFmpeg, FFprobe, yt-dlp, Deno, 7-Zip, and whisper.cpp with the multilingual base model are bundled with the app, so conversion, speech, and file tools do not require an internet connection. YouTube downloads naturally do.

## Features

- Single-video YouTube downloads as MP4 video or MP3/M4A/WAV/FLAC/Opus audio
- Video output: MP4, MKV, WebM, MOV, AVI, GIF
- Audio output: MP3, WAV, FLAC, M4A, OGG, Opus
- Image output: PNG, JPG, WebP, AVIF, BMP, TIFF, ICO
- Data conversion: CSV, TSV, JSON, YAML, XML
- Persistent parallel queue with 1-3 configurable job slots, live speed/ETA, aggregate taskbar progress, cancellation, recovery, reordering, retry, and job history
- Compress by quality preset or approximate target file size
- Trim video/audio and extract audio
- Join multiple video or audio files into one result
- Normalize audio loudness for consistent volume
- Extract a PNG/JPG frame at an exact timestamp or a series at a chosen interval
- Palette-optimized GIF creation
- PDF merge, split, extract, reorder, and rotate
- ZIP, 7Z, TAR, TAR.GZ, and GZ creation and extraction
- Password-based file encryption and decryption with AES-256-GCM (`.ofenc`)
- MD5, SHA-1, and SHA-256 checksums
- Metadata stripping for JPEG, PNG, WebP, audio, and video without re-encoding media streams
- Random-data secure deletion with 1, 3, or 7 overwrite passes
- FFprobe media inspection
- Audio and video to text with local whisper.cpp transcription (TXT or timestamped SRT)
- Transcript Clip Studio: transcribe or import SRT/VTT, select individual lines or all subtitles at once, and render multiple captioned clips in a three-pane preview, transcript, and clip workspace
- Studio creator presets for 16:9, 9:16 Shorts, 1:1 square, and 4:5 portrait output, with Fill, Fit, and Blur framing and multi-ratio export
- Editable `.ofstudio` projects with explicit save/open, automatic recovery drafts, and clip-relative caption files
- Saved tool recipes for reusable option presets, plus a `Ctrl+K` command palette for tools, recipes, and actions
- Smart drag-and-drop anywhere in the window with file-type detection and a confirm-first compatible-tool chooser
- Microphone dictation with an in-app recording timer and transcript preview
- GitHub Releases update discovery with SHA-256 verification, plus an offline installer fallback
- Choose an output folder for every batch

## Installation

Download the newest `OmniForge-Setup-1.5.0.exe` from [GitHub Releases](https://github.com/gerg182/OmniForge/releases/latest), then verify it before running:

```powershell
Get-FileHash .\OmniForge-Setup-1.5.0.exe -Algorithm SHA256
Get-Content .\OmniForge-Setup-1.5.0.exe.sha256
```

The hashes must match. The current installer is unsigned, so Windows SmartScreen may warn. Only continue when the installer came from this repository and its SHA-256 matches. OmniForge requires Windows 10/11 x64 and installs per user; administrator access is not required.

## Development

Requirements: Windows 10/11 x64 and Node.js 20 or newer.

```powershell
npm ci
npm run prepare:tools
npm start
```

Run the test suite:

```powershell
npm test
```

Build the Windows installer:

```powershell
npm run dist
```

The installer and its `OmniForge-Setup-1.5.0.exe.sha256` sidecar are written to `dist/`. Release builds are produced by the tag-driven GitHub Actions workflow after the version is synchronized in `package.json`, `package-lock.json`, this README, and `CHANGELOG.md`.

## Transcript Clip Studio

1. Open **Transcript Clip Studio**, then choose one audio or video file and an output folder.
2. Transcribe locally with whisper.cpp or import an existing SRT/VTT transcript.
3. Edit transcript text if needed, click a line, then Shift-click another line to select a contiguous range, or use **Select all** to choose every subtitle. Add as many clips as you need and arrange them in the clip list.
4. Choose the clip format, creator aspect ratios, Fill/Fit/Blur framing, caption sidecars, and optional burned-in caption style, then render the ordered clip queue.

Video clips support MP4, MKV, WebM, and MOV with optional burned captions. The preview can switch between the source ratio, 16:9 landscape, 9:16 Shorts, 1:1 square, and 4:5 portrait; selected ratios render as separate files with matching suffixes. Fill crops to the frame, Fit preserves the whole image with letterboxing, and Blur adds a synchronized blurred backdrop. Audio clips support MP3, WAV, FLAC, M4A, OGG, and Opus; audio always uses SRT/VTT sidecars. Sidecar timing is relative to each clip. Caption style controls font size, text color, outline, and top/center/bottom placement. All Studio processing stays local.

Projects are saved as `.ofstudio` files containing the media reference, editable transcript, clips, caption style, and output settings. Unsaved changes are periodically copied to a recovery draft and offered for restore after a restart. Project media can be relinked if it moves. Audio-only projects identify a same-name video in the same folder and can switch to it without rebuilding the transcript.

## Recipes, Palette, and Smart Drop

Use **Recipes** in the top bar to save the current tool options, apply a preset, or manage saved recipes in Settings. Recipes never store passwords, URLs, output folders, file lists, recordings, or Studio project data.

Press `Ctrl+K` to search every tool, saved recipe, and common action from one keyboard-driven palette. Drag files onto any empty part of the OmniForge window to open the smart-drop chooser: OmniForge detects the file type, suggests compatible tools, and waits for confirmation before adding anything. `.ofenc` files preselect the decrypt flow. Existing tool dropzones continue to accept files directly.

## Queue and Notifications

Open **Settings -> Output behavior** to run 1, 2, or 3 jobs at once; the default is 2. Raising the limit starts queued jobs immediately, while lowering it lets active jobs finish without cancelling them. Running jobs show their current speed and estimated time when the engine provides enough progress data, and the Windows taskbar displays aggregate progress across active jobs.

Failure notifications are enabled by default and can be disabled in the same settings panel. OmniForge shows one Windows notification when a background job fails; click it to focus the app and open the job queue. Successful jobs do not produce notifications.

## Updates

Open **Settings -> Application updates** and choose **Check now**. OmniForge reads the latest published GitHub Release for this repository, requires the exact `OmniForge-Setup-X.Y.Z.exe` and matching `.sha256` asset, streams download progress, and verifies SHA-256 before offering **Install**. Missing or mismatched hashes block GitHub-driven installation. Updates always require explicit confirmation and never install silently. Use **View release notes** to open the GitHub release page.

If GitHub is unavailable, use the offline fallback: drag a newer installer onto the update drop zone, point OmniForge at a local update folder, or browse for the installer. Offline installers must still use the versioned filename. A malformed or mismatched sidecar blocks installation. If a sidecar is missing, OmniForge displays the computed hash and requires explicit confirmation; GitHub-driven downloads never allow this fallback.

The sidecar format is `<sha256>  <filename>`. SHA-256 verifies file integrity and transfer integrity, not publisher identity or code signing. Windows SmartScreen may warn because the current build is unsigned.

Unfinished queue jobs are stored in `%APPDATA%\omniforge\queue.json`. Jobs interrupted by shutdown become failed history entries, while pending jobs return paused and require a manual resume. Passwords, confirmation fields, and transient speed/ETA samples are never written to disk.

## Privacy and Security

OmniForge does not include telemetry or analytics. User media is processed locally and is not uploaded. Network access is used only for GitHub release checks and downloads, optional yt-dlp engine updates, and the YouTube downloads users request. Passwords are held in memory while a job runs and are not saved in queue history. Report vulnerabilities through GitHub private vulnerability reporting as described in [SECURITY.md](SECURITY.md).

## Contributing

Focused fixes, tests, documentation updates, and feature proposals are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, validation, versioning, and pull request requirements. Run `npm test` before opening a pull request.

## License

OmniForge is released under the [MIT License](LICENSE). Bundled third-party tools retain their own licenses; see [tools/THIRD_PARTY_NOTICES.md](tools/THIRD_PARTY_NOTICES.md).

## Credits

OmniForge has been developed with substantial AI development assistance from:

- [OpenAI Codex](https://openai.com/codex/), OpenAI's AI coding agent.
- DeepSeek V4.1 Flash 1017.

Third-party software and model credits are listed in [tools/THIRD_PARTY_NOTICES.md](tools/THIRD_PARTY_NOTICES.md).

## Notes

- YouTube downloads are limited to public, single-video URLs in this version.
- Playlists, subtitles, live streams, browser cookies, age-restricted/member content, and DRM bypass are not supported.
- Encrypted PDFs and password-protected archives are not supported.
- OmniForge `.ofenc` files require the original password. Passwords are held only in memory while a job runs and are never stored or uploaded.
- Metadata stripping supports JPEG/PNG/WebP images plus audio/video containers handled by FFmpeg. PDF and Office metadata are not included in this release.
- Secure Delete overwrites, truncates, renames, and removes each file. SSD wear leveling, snapshots, backups, cloud sync, and journaling may retain copies; this tool cannot guarantee physical erasure.
- Office document conversion is not included.
- Download only content you own or have permission to download. Respect YouTube's terms and applicable copyright law.
- Speech recognition uses the bundled `ggml-base.bin` multilingual model and runs entirely offline. Long recordings take longer to transcribe; the queue reports progress.
- Bundled third-party licenses and notices are in `tools/THIRD_PARTY_NOTICES.md`.
