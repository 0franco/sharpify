# Sharpify

![Sharpify Banner](.github/banner.webp)

Sharpify is a minimalist desktop app for compressing images locally with `sharp`. The app uses a Tauri shell, a React frontend, and a bundled Node runtime that executes the Sharp processor offline.

## Install

### macOS — Homebrew

```bash
brew tap 0franco/sharpify
brew install --cask sharpify
```

> **Note:** macOS may show _"Sharpify is damaged and can't be opened"_ because the app is not yet notarized. Run this once to clear the quarantine flag:
> ```bash
> xattr -cr /Applications/Sharpify.app
> ```

### macOS — Direct download

Grab the latest `.zip` from [GitHub Releases](https://github.com/0franco/sharpify/releases), unzip, and drag `Sharpify.app` to `/Applications`.

### Linux — Direct download

Grab the latest `.deb` or `.AppImage` from [GitHub Releases](https://github.com/0franco/sharpify/releases).

```bash
# Debian / Ubuntu
sudo dpkg -i Sharpify_*_linux_x64.deb

# Any distro (AppImage)
chmod +x Sharpify_*_linux_x64.AppImage
./Sharpify_*_linux_x64.AppImage
```

### Windows — Build from source

Pre-built Windows binaries are not yet published. You can build locally:

**Prerequisites**

- [Node.js 20+](https://nodejs.org)
- [Rust (stable)](https://rustup.rs)
- [Microsoft C++ Build Tools](https://tauri.app/start/prerequisites/#windows)

**Build**

```bash
git clone https://github.com/0franco/sharpify.git
cd sharpify
npm install
npm run tauri:build
```

The installer will be in `src-tauri/target/release/bundle/nsis/` or `msi/`.

## Upgrade

### macOS — Homebrew

```bash
brew update && brew upgrade --cask sharpify
```

### macOS / Linux — Direct download

Download the latest release from [GitHub Releases](https://github.com/0franco/sharpify/releases) and replace the previous installation.

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

## 🤝 Contributing

Contribute! Please open an issue or submit a pull request.

<a href="https://www.buymeacoffee.com/travelingcode" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-red.png" alt="Buy Me A Coffee" height="41" width="174" style="border-radius:10px">
</a>