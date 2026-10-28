# OmniForge

OmniForge is a local-first Windows desktop app for downloading permitted YouTube videos, converting media and data files, compressing and trimming clips, extracting audio, transcribing speech, recording dictation, building GIFs, editing PDFs, working with archives, encrypting files, calculating checksums, and inspecting media.

Everything runs on your PC. FFmpeg, FFprobe, yt-dlp, Deno, 7-Zip, and whisper.cpp with the multilingual base model are bundled with the app, so conversion, speech, and file tools do not require an internet connection. YouTube downloads naturally do.

## Features

- Single-video YouTube downloads as MP4 video or MP3/M4A/WAV/FLAC/Opus audio
- Video output: MP4, MKV, WebM, MOV, AVI, GIF
- Audio output: MP3, WAV, FLAC, M4A, OGG, Opus
- Image output: PNG, JPG, WebP, AVIF, BMP, TIFF, ICO
- Data conversion: CSV, TSV, JSON, YAML, XML
- Batch queue with progress, cancellation, and job history
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
- FFprobe media inspection
- Audio and video to text with local whisper.cpp transcription (TXT or timestamped SRT)
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

The installer is written to `dist/`.

## Updates

Open **Settings -> Application updates**. The fastest path is to drag a newer `OmniForge-Setup-x.y.z.exe` onto the update drop zone: OmniForge checks the version, asks for confirmation, then closes, runs the installer silently, and restarts. You can also put installers in the update folder and press **Check now**, or click the drop zone to browse for an installer anywhere on the PC. You do not need to uninstall the old version first.

Updates must use the electron-builder artifact name so the version can be read from the filename.

## Notes

- YouTube downloads are limited to public, single-video URLs in this version.
- Playlists, subtitles, live streams, browser cookies, age-restricted/member content, and DRM bypass are not supported.
- Encrypted PDFs and password-protected archives are not supported.
- OmniForge `.ofenc` files require the original password. Passwords are held only in memory while a job runs and are never stored or uploaded.
- Office document conversion is not included.
- Download only content you own or have permission to download. Respect YouTube's terms and applicable copyright law.
- Speech recognition uses the bundled `ggml-base.bin` multilingual model and runs entirely offline. Long recordings take longer to transcribe; the queue reports progress.
- Bundled third-party licenses and notices are in `tools/THIRD_PARTY_NOTICES.md`.
