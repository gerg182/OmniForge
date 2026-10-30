# OmniForge

OmniForge is a local-first Windows desktop app for downloading permitted YouTube videos, converting media and data files, compressing and trimming clips, extracting audio, transcribing speech, recording dictation, building GIFs, editing PDFs, working with archives, encrypting files, calculating checksums, and inspecting media.

Everything runs on your PC. FFmpeg, FFprobe, yt-dlp, Deno, 7-Zip, and whisper.cpp with the multilingual base model are bundled with the app, so conversion, speech, and file tools do not require an internet connection. YouTube downloads naturally do.

## Features

- Single-video YouTube downloads as MP4 video or MP3/M4A/WAV/FLAC/Opus audio
- Video output: MP4, MKV, WebM, MOV, AVI, GIF
- Audio output: MP3, WAV, FLAC, M4A, OGG, Opus
- Image output: PNG, JPG, WebP, AVIF, BMP, TIFF, ICO
- Data conversion: CSV, TSV, JSON, YAML, XML
- Persistent batch queue with progress, cancellation, recovery, reordering, retry, and job history
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
- Transcript Clip Studio: transcribe or import SRT/VTT, select transcript ranges, and render multiple captioned clips in a three-pane preview, transcript, and clip workspace
- Studio creator presets for 16:9, 9:16 Shorts, 1:1 square, and 4:5 portrait output, with Fill, Fit, and Blur framing and multi-ratio export
- Editable `.ofstudio` projects with explicit save/open, automatic recovery drafts, and clip-relative caption files
- Saved tool recipes for reusable option presets, plus a `Ctrl+K` command palette for tools, recipes, and actions
- Smart drag-and-drop anywhere in the window with file-type detection and a confirm-first compatible-tool chooser
- Microphone dictation with an in-app recording timer and transcript preview
- In-app updates from a local update folder or a selected OmniForge installer
- Choose an output folder for every batch

## Development

Requirements: Windows 10/11 x64 and Node.js 20 or newer.

```powershell
cmd /c "npm install"
node scripts/prepare-tools.mjs
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

The installer and its `OmniForge-Setup-1.3.0.exe.sha256` sidecar are written to `dist/`.

## Transcript Clip Studio

1. Open **Transcript Clip Studio**, then choose one audio or video file and an output folder.
2. Transcribe locally with whisper.cpp or import an existing SRT/VTT transcript.
3. Edit transcript text if needed, click a line, then Shift-click another line to select a contiguous range. Add as many clips as you need and arrange them in the clip list.
4. Choose the clip format, creator aspect ratios, Fill/Fit/Blur framing, caption sidecars, and optional burned-in caption style, then render the ordered clip queue.

Video clips support MP4, MKV, WebM, and MOV with optional burned captions. The preview can switch between the source ratio, 16:9 landscape, 9:16 Shorts, 1:1 square, and 4:5 portrait; selected ratios render as separate files with matching suffixes. Fill crops to the frame, Fit preserves the whole image with letterboxing, and Blur adds a synchronized blurred backdrop. Audio clips support MP3, WAV, FLAC, M4A, OGG, and Opus; audio always uses SRT/VTT sidecars. Sidecar timing is relative to each clip. Caption style controls font size, text color, outline, and top/center/bottom placement. All Studio processing stays local.

Projects are saved as `.ofstudio` files containing the media reference, editable transcript, clips, caption style, and output settings. Unsaved changes are periodically copied to a recovery draft and offered for restore after a restart. Project media can be relinked if it moves. Audio-only projects identify a same-name video in the same folder and can switch to it without rebuilding the transcript.

## Recipes, Palette, and Smart Drop

Use **Recipes** in the top bar to save the current tool options, apply a preset, or manage saved recipes in Settings. Recipes never store passwords, URLs, output folders, file lists, recordings, or Studio project data.

Press `Ctrl+K` to search every tool, saved recipe, and common action from one keyboard-driven palette. Drag files onto any empty part of the OmniForge window to open the smart-drop chooser: OmniForge detects the file type, suggests compatible tools, and waits for confirmation before adding anything. `.ofenc` files preselect the decrypt flow. Existing tool dropzones continue to accept files directly.

## Updates

Open **Settings -> Application updates**. The fastest path is to drag a newer `OmniForge-Setup-x.y.z.exe` onto the update drop zone: OmniForge checks the version and adjacent `.sha256` sidecar, asks for confirmation, closes, and opens the Windows installer. Finish setup to reopen OmniForge. You can also put installers in the update folder and press **Check now**, or click the drop zone to browse for an installer anywhere on the PC. You do not need to uninstall the old version first.

Updates must use the electron-builder artifact name so the version can be read from the filename.

The sidecar format is `<sha256>  <filename>`. A mismatched or malformed sidecar blocks installation. A missing sidecar shows the computed SHA-256 and requires explicit confirmation. SHA-256 verifies file integrity, not publisher identity or code signing.

Unfinished queue jobs are stored in `%APPDATA%\omniforge\queue.json`. Jobs interrupted by shutdown become failed history entries, while pending jobs return paused and require a manual resume. Passwords and confirmation fields are never written to disk.

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
