# Sharpify

![Sharpify Banner](.github/banner.webp)

Sharpify is a minimalist desktop app for compressing images locally with `sharp`. The app uses a Tauri shell, a React frontend, and a bundled Node runtime that executes the Sharp processor offline.

## Install

### Homebrew (macOS)

```bash
brew tap 0franco/sharpify
brew install --cask sharpify
```

### Direct download

Grab the latest macOS release artifact from GitHub Releases.

## Features

- Drag and drop or select multiple image files
- Batch-wide output controls for format, quality, resize, fit, metadata, and filename suffix
- Local export to a user-chosen output folder
- Per-file status and compression results
- Cross-platform Tauri packaging scaffold for macOS, Windows, and Linux

## Development

```bash
npm install
npm run tauri:dev
```

## Verification

```bash
npm run test
npm run build
```

## Release automation

- Pull requests run `npm run test` plus a macOS packaging build check.
- Pushing a `v*` tag builds macOS release artifacts for Apple Silicon and Intel, publishes them to GitHub Releases, and updates the `0franco/homebrew-sharpify` tap cask.
