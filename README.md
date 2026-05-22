# Sharpify

Sharpify is a minimalist desktop app for compressing images locally with `sharp`. The app uses a Tauri shell, a React frontend, and a bundled Node runtime that executes the Sharp processor offline.

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
