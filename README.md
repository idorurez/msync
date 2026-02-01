# msync

A desktop application for synchronizing music metadata between a local folder and an Android device via ADB.

## Features

### Two-Pane Interface
- **Left pane**: Local music files from your computer
- **Right pane**: Music files from your connected Android device
- Browse and navigate folder structures on both sides

### Metadata Display & Editing
- View metadata: Title, Artist, Album, Rating (0-5 stars), Last Updated
- Click on rating stars to edit ratings directly
- Bulk edit metadata for multiple selected files (right-click → Edit Metadata)
- Changes are written directly to the audio file's embedded metadata tags

### Bidirectional Sync
- Single "Sync Metadata" button compares files by filename
- Automatically determines which version is newer based on modification timestamps
- Syncs metadata in the appropriate direction (local → Android or Android → local)
- Shows match statistics before syncing

### Supported Audio Formats
- MP3
- FLAC
- M4A (AAC)
- OGG (Vorbis)
- WAV
- AIFF
- WMA

### Additional Features
- **Double-click to play**: Opens files with your system's default audio player
- **Drag and drop**: Select files for operations
- **Context menu**: Right-click for Select All, Deselect All, Edit Metadata, Delete
- **Theme system**: Multiple built-in color themes (Dark, Light, Midnight, Nord, Dracula, Forest, Sunset)
- **Custom header background**: Add your own background image to the header bar
- **Persistent settings**: Remembers your last folder paths and preferences

## Requirements

### System Requirements
- Windows (tested), macOS, or Linux
- Node.js 18+

### For Android Sync
- **ADB (Android Debug Bridge)** must be installed
  - Windows: `winget install Google.PlatformTools`
  - macOS: `brew install android-platform-tools`
  - Linux: `sudo apt install adb` (Debian/Ubuntu)
- **USB Debugging** must be enabled on your Android device:
  1. Go to Settings → About Phone
  2. Tap "Build Number" 7 times to enable Developer Options
  3. Go to Settings → Developer Options
  4. Enable "USB Debugging"
- Connect your device via USB and authorize the connection when prompted

## Installation

```bash
# Clone the repository
git clone https://github.com/idorurez/msync.git
cd msync

# Install dependencies
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```
This starts the Vite dev server and Electron together with hot-reload.

### Production Build
```bash
npm run build
```
This creates a distributable application in the `dist` folder.

## How to Use

1. **Start the app** with `npm run dev`

2. **Select a local folder**:
   - Click "Browse" in the left pane
   - Navigate to your music folder
   - The app will scan for audio files

3. **Connect your Android device**:
   - Connect via USB with debugging enabled
   - The app will auto-detect the device
   - Enter the path to your music folder (default: `/sdcard/Music`)
   - Press Enter or click "Go" to scan

4. **Edit metadata**:
   - Click on rating stars to change ratings
   - Right-click selected files → "Edit Metadata" for bulk edits
   - Changes are saved immediately to the files

5. **Sync metadata**:
   - Click "Sync Metadata" in the header
   - The app refreshes both sides and compares timestamps
   - Files with matching names are synced (newer metadata wins)
   - Confirm the sync when prompted

6. **Customize appearance**:
   - Click the gear icon (⚙) to customize the header background
   - Click the theme dropdown to change color schemes

## Common Android Music Paths

- `/sdcard/Music`
- `/storage/emulated/0/Music`
- `/sdcard/Download`
- `/storage/emulated/0/Download`

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron 28
- **Build**: Vite with vite-plugin-electron
- **Metadata Reading**: music-metadata
- **Metadata Writing**: node-taglib-sharp
- **Android Communication**: @devicefarmer/adbkit

## Project Structure

```
msync/
├── electron/           # Electron main process
│   ├── main.ts        # Window creation, IPC handlers
│   ├── preload.ts     # Context bridge for renderer
│   ├── adb.ts         # Android device communication
│   └── metadata.ts    # Audio metadata read/write
├── src/               # React renderer process
│   ├── App.tsx        # Main application component
│   ├── components/    # UI components
│   ├── themes.ts      # Theme definitions
│   └── types/         # TypeScript types
├── img/               # Custom header background images
└── package.json
```

## Troubleshooting

### "No Android device connected"
- Ensure USB debugging is enabled on your device
- Check that ADB is installed: run `adb devices` in terminal
- Try unplugging and reconnecting the USB cable
- Accept the USB debugging prompt on your phone

### "No audio files found" on Android
- Verify the folder path is correct
- Try alternative paths like `/storage/emulated/0/Music`
- Ensure the folder contains supported audio formats

### Ratings not persisting
- For MP3 files, ratings are stored in POPM (Popularimeter) frames
- For FLAC/OGG, ratings are stored in Vorbis comments
- Some players may store ratings in their own database instead of the file

## License

MIT
