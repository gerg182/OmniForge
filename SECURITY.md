# Security Policy

## Supported Versions

Security fixes are provided for the newest published OmniForge release. Users should install the latest `OmniForge-Setup-X.Y.Z.exe` from GitHub Releases.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting from the repository Security tab and include:

- A description of the issue and its impact.
- Steps or a proof of concept to reproduce it.
- The affected version and Windows version.
- Any suggested mitigation.

Please allow time for confirmation and a fix before public disclosure.

## Update Trust

OmniForge checks the public GitHub Releases API for `gerg182/OmniForge`, requires the exact versioned installer and `.sha256` asset, verifies the downloaded file, and refuses missing or mismatched hashes. Updates are never installed silently.

The current public installer is unsigned. Windows SmartScreen may warn. SHA-256 verifies file integrity and transfer integrity, but it does not prove who published the file. Compare the hash shown by OmniForge with the hash on the GitHub release page before running the installer.

## Local Data

OmniForge processes files locally. Passwords, confirmation fields, recordings, and transient progress samples are not written to the project repository or uploaded by the application. Job history and settings are stored under the application user-data directory.

Do not include tokens, credentials, personal paths, or private media in bug reports.
