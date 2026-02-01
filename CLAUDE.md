# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development (starts Vite + Electron via vite-plugin-electron)
npm.cmd run dev

# Build for production
npm.cmd run build

# Note: Use npm.cmd instead of npm on Windows due to PowerShell execution policy
```

## Architecture Overview

msync is an Electron desktop app that syncs music metadata between a local folder and an Android device via ADB.

### Process Architecture

**Main Process** (`electron/`)
- `main.ts` - Window creation, IPC handlers for all operations
- `adb.ts` - AdbManager class wrapping @devicefarmer/adbkit for Android communication
- `metadata.ts` - Read/write music metadata using music-metadata (read) and node-taglib-sharp (write)
- `preload.ts` - Exposes `window.electronAPI` to renderer via contextBridge

**Renderer Process** (`src/`)
- `App.tsx` - Main component with sync logic, file state, device connection
- `components/` - Pane, FileTable, FolderTree, RatingStars, ThemeSelector
- `themes.ts` + `ThemeContext.tsx` - CSS variable-based theming system
- `types/index.ts` - Shared TypeScript types including ElectronAPI interface

### IPC Communication Flow

```
Renderer (React) → window.electronAPI.* → ipcRenderer.invoke → Main Process IPC handlers
Main Process events → ipcRenderer.on → Renderer callbacks (device-connected, sync-progress)
```

### Key Patterns

**ADB Import Workaround**: adbkit requires CommonJS require():
```typescript
const AdbModule = require('@devicefarmer/adbkit');
const Adb = AdbModule.Adb;
```

**Rating Normalization**: music-metadata returns 0-1 ratings, converted to 0-5 stars. POPM frames use 0-255 scale.

**Android Metadata Updates**: Pull file to temp → modify locally → push back to device.

**Sync Logic**: Matches songs by filename (case-insensitive), compares `lastMetadataUpdate` timestamps, syncs newer metadata bidirectionally.

### Supported Formats

MP3, FLAC, M4A, OGG, WAV, AIFF, WMA

### External Dependencies

- ADB must be installed (auto-detected from common paths or PATH)
- Android device must have USB debugging enabled
