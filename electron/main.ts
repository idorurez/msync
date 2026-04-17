import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { scanFolder, getFolderTree, readMetadata, writeMetadata, incrementalScanFolder, dbRecordToMusicFile } from './metadata';
import { AdbManager } from './adb';
import { DatabaseManager } from './db';
import type { MusicFile, SyncDirection } from '../src/types';

let mainWindow: BrowserWindow | null = null;
let adbManager: AdbManager | null = null;
let db: DatabaseManager | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize database
  db = new DatabaseManager();
  await db.init();

  createWindow();
  adbManager = new AdbManager();

  // Set up device connection listeners
  adbManager.on('device-connected', (device) => {
    mainWindow?.webContents.send('device-connected', device);
  });

  adbManager.on('device-disconnected', () => {
    mainWindow?.webContents.send('device-disconnected');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers - Local file operations
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('list-images', async (_, folderPath: string) => {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return entries
      .filter(entry => entry.isFile() && imageExtensions.includes(path.extname(entry.name).toLowerCase()))
      .map(entry => ({
        name: entry.name,
        path: path.join(folderPath, entry.name)
      }));
  } catch {
    return [];
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('scan-local-folder', async (_, folderPath: string) => {
  return scanFolder(folderPath);
});

ipcMain.handle('get-local-folder-tree', async (_, folderPath: string) => {
  return getFolderTree(folderPath);
});

ipcMain.handle('read-local-metadata', async (_, filePath: string) => {
  return readMetadata(filePath);
});

ipcMain.handle('write-local-metadata', async (_, filePath: string, metadata: Partial<MusicFile>) => {
  return writeMetadata(filePath, metadata);
});

ipcMain.handle('rename-local-file', async (_, oldPath: string, newFilename: string) => {
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newFilename);
  fs.renameSync(oldPath, newPath);
  return newPath;
});

ipcMain.handle('delete-local-files', async (_, filePaths: string[]) => {
  for (const filePath of filePaths) {
    fs.unlinkSync(filePath);
  }
});

ipcMain.handle('move-local-files', async (_, filePaths: string[], targetDir: string) => {
  const results: string[] = [];
  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const destPath = path.join(targetDir, filename);
    if (fs.existsSync(destPath)) {
      throw new Error(`File already exists: ${destPath}`);
    }
    fs.renameSync(filePath, destPath);
    results.push(destPath);
  }
  return results;
});

ipcMain.handle('create-local-folder', async (_, parentPath: string, folderName: string) => {
  const fullPath = path.join(parentPath, folderName);
  fs.mkdirSync(fullPath, { recursive: true });
  return fullPath;
});

ipcMain.handle('rename-local-folder', async (_, oldPath: string, newName: string) => {
  const parentDir = path.dirname(oldPath);
  const newPath = path.join(parentDir, newName);
  fs.renameSync(oldPath, newPath);
  return newPath;
});

ipcMain.handle('delete-local-folder', async (_, folderPath: string) => {
  fs.rmSync(folderPath, { recursive: true });
});

ipcMain.handle('play-local-file', async (_, filePath: string) => {
  await shell.openPath(filePath);
});

ipcMain.handle('play-android-file', async (_, androidPath: string) => {
  if (!adbManager) throw new Error('No device connected');

  const tempPath = path.join(app.getPath('temp'), 'msync-play-' + path.basename(androidPath));
  await adbManager.pullFile(androidPath, tempPath);
  await shell.openPath(tempPath);
});

// IPC Handlers - ADB operations
ipcMain.handle('connect-device', async () => {
  if (!adbManager) return null;
  return adbManager.connect();
});

ipcMain.handle('disconnect-device', () => {
  adbManager?.disconnect();
});

ipcMain.handle('scan-android-folder', async (_, folderPath: string) => {
  if (!adbManager) return [];
  return adbManager.scanFolder(folderPath);
});

ipcMain.handle('get-android-folder-tree', async (_, folderPath: string) => {
  if (!adbManager) return null;
  return adbManager.getFolderTree(folderPath);
});

ipcMain.handle('pull-file', async (_, androidPath: string, localPath: string) => {
  if (!adbManager) throw new Error('No device connected');
  return adbManager.pullFile(androidPath, localPath);
});

ipcMain.handle('push-file', async (_, localPath: string, androidPath: string) => {
  if (!adbManager) throw new Error('No device connected');
  return adbManager.pushFile(localPath, androidPath);
});

ipcMain.handle('rename-android-file', async (_, oldPath: string, newFilename: string) => {
  if (!adbManager) throw new Error('No device connected');
  const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
  const newPath = dir + '/' + newFilename;
  await adbManager.renameFile(oldPath, newPath);
  return newPath;
});

ipcMain.handle('delete-android-files', async (_, filePaths: string[]) => {
  if (!adbManager) throw new Error('No device connected');
  return adbManager.deleteFiles(filePaths);
});

ipcMain.handle('update-android-metadata', async (_, filePath: string, metadata: Partial<MusicFile>) => {
  if (!adbManager) throw new Error('No device connected');

  // Pull file to temp location
  const tempPath = path.join(app.getPath('temp'), 'msync-' + path.basename(filePath));

  try {
    // Pull from Android
    await adbManager.pullFile(filePath, tempPath);

    // Update metadata locally
    await writeMetadata(tempPath, metadata);

    // Push back to Android
    await adbManager.pushFile(tempPath, filePath);

    // Clean up temp file
    require('fs').unlinkSync(tempPath);
  } catch (error) {
    // Clean up temp file on error
    try {
      require('fs').unlinkSync(tempPath);
    } catch {}
    throw error;
  }
});

// IPC Handlers - Sync operations
ipcMain.handle('sync-metadata', async (
  _,
  sourceFiles: string[],
  targetFiles: string[],
  direction: SyncDirection
) => {
  if (!adbManager) throw new Error('No device connected');

  const total = sourceFiles.length;

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourcePath = sourceFiles[i];
    const targetPath = targetFiles[i];

    mainWindow?.webContents.send('sync-progress', {
      current: i + 1,
      total,
      currentFile: path.basename(sourcePath),
      status: 'syncing'
    });

    try {
      if (direction.from === 'local' && direction.to === 'android') {
        // Read local metadata
        const metadata = await readMetadata(sourcePath);

        // Pull Android file to temp
        const tempPath = path.join(app.getPath('temp'), path.basename(targetPath));
        await adbManager.pullFile(targetPath, tempPath);

        // Write metadata to temp file
        await writeMetadata(tempPath, metadata);

        // Push back to Android
        await adbManager.pushFile(tempPath, targetPath);
      } else {
        // Pull Android file to temp
        const tempPath = path.join(app.getPath('temp'), path.basename(sourcePath));
        await adbManager.pullFile(sourcePath, tempPath);

        // Read metadata from temp file
        const metadata = await readMetadata(tempPath);

        // Write to local file
        await writeMetadata(targetPath, metadata);
      }
    } catch (error) {
      mainWindow?.webContents.send('sync-progress', {
        current: i + 1,
        total,
        currentFile: path.basename(sourcePath),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  mainWindow?.webContents.send('sync-progress', {
    current: total,
    total,
    currentFile: '',
    status: 'complete'
  });
});

// IPC Handler - select executable file
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe', 'bat', 'cmd'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC Handler - write album art to local file
ipcMain.handle('write-album-art', async (_, filePath: string, imageUrl: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const https = require('https');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const http = require('http');

  const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const client = imageUrl.startsWith('https') ? https : http;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.get(imageUrl, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

  const tempImagePath = path.join(app.getPath('temp'), `msync-art-${Date.now()}.jpg`);
  fs.writeFileSync(tempImagePath, imageBuffer);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TagLib = require('node-taglib-sharp');
    let file;
    try {
      file = TagLib.File.createFromPath(filePath);
    } catch {
      file = TagLib.File.createFromPath(filePath, undefined, 0);
    }
    const picture = TagLib.Picture.fromPath(tempImagePath);
    file.tag.pictures = [picture];
    file.save();
    file.dispose();
    fs.unlinkSync(tempImagePath);
  } catch (error) {
    try { fs.unlinkSync(tempImagePath); } catch { /* ignore */ }
    throw error;
  }
});

// IPC Handler - write album art to Android file
ipcMain.handle('write-android-album-art', async (_, filePath: string, imageUrl: string) => {
  if (!adbManager) throw new Error('No device connected');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const https = require('https');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const http = require('http');

  const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const client = imageUrl.startsWith('https') ? https : http;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.get(imageUrl, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });

  const tempImagePath = path.join(app.getPath('temp'), `msync-art-${Date.now()}.jpg`);
  const tempAudioPath = path.join(app.getPath('temp'), `msync-audio-${Date.now()}${path.extname(filePath)}`);
  fs.writeFileSync(tempImagePath, imageBuffer);

  try {
    await adbManager.pullFile(filePath, tempAudioPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TagLib = require('node-taglib-sharp');
    let file;
    try {
      file = TagLib.File.createFromPath(tempAudioPath);
    } catch {
      file = TagLib.File.createFromPath(tempAudioPath, undefined, 0);
    }
    const picture = TagLib.Picture.fromPath(tempImagePath);
    file.tag.pictures = [picture];
    file.save();
    file.dispose();
    await adbManager.pushFile(tempAudioPath, filePath);
    fs.unlinkSync(tempImagePath);
    fs.unlinkSync(tempAudioPath);
  } catch (error) {
    try { fs.unlinkSync(tempImagePath); } catch { /* ignore */ }
    try { fs.unlinkSync(tempAudioPath); } catch { /* ignore */ }
    throw error;
  }
});

// IPC Handler - yt-dlp download
ipcMain.handle('download-with-ytdlp', async (_, url: string, outputPath: string, ytdlpPath: string, ffmpegPath?: string) => {
  return new Promise((resolve) => {
    // Build yt-dlp arguments for highest quality audio
    const args = [
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-overwrites',
      '--embed-thumbnail',
      '--add-metadata',
      '--parse-metadata', 'title:%(title)s',
      '--parse-metadata', 'uploader:%(artist)s',
      '-o', path.join(outputPath, '%(title)s.%(ext)s'),
      '--no-playlist',
    ];

    if (ffmpegPath) {
      args.push('--ffmpeg-location', ffmpegPath);
    }

    // If URL looks like a playlist, enable playlist download
    if (url.includes('playlist') || url.includes('list=')) {
      const playlistIndex = args.indexOf('--no-playlist');
      if (playlistIndex > -1) {
        args.splice(playlistIndex, 1);
      }
      args.push('--yes-playlist');
    }

    let fileCount = 0;
    let lastError = '';

    const process = spawn(ytdlpPath, args, {
      windowsHide: true,
    });

    process.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      // Count downloaded files
      if (output.includes('[download] Destination:') || output.includes('[ExtractAudio] Destination:')) {
        fileCount++;
      }
      // Send progress updates
      mainWindow?.webContents.send('ytdlp-progress', { message: output.trim() });
    });

    process.stderr.on('data', (data: Buffer) => {
      lastError = data.toString();
      mainWindow?.webContents.send('ytdlp-progress', { message: lastError.trim(), isError: true });
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, fileCount: Math.max(1, fileCount) });
      } else {
        resolve({ success: false, error: lastError || `yt-dlp exited with code ${code}` });
      }
    });

    process.on('error', (err) => {
      resolve({ success: false, error: `Failed to start yt-dlp: ${err.message}` });
    });
  });
});

// IPC Handlers - Database / Incremental scan
ipcMain.handle('scan-local-folder-incremental', async (_, folderPath: string) => {
  if (!db) return scanFolder(folderPath);
  return incrementalScanFolder(folderPath, db, 'local', (scanned, total, file) => {
    mainWindow?.webContents.send('scan-progress', { scanned, total, currentFile: file });
  });
});

ipcMain.handle('scan-android-folder-incremental', async (_, folderPath: string) => {
  if (!adbManager) return [];
  // For Android, we still use the full scan since files are remote
  // but we cache results in DB
  const files = await adbManager.scanFolder(folderPath);
  if (db) {
    const dbRecords = files.map((f: MusicFile) => ({
      path: f.path,
      source: 'android' as const,
      filename: f.filename,
      filename_lower: f.filename.toLowerCase(),
      directory: f.path.substring(0, f.path.lastIndexOf('/')),
      format: f.format,
      size: f.size,
      mtime: f.lastMetadataUpdate?.getTime() ?? null,
      title: f.title,
      artist: f.artist,
      album: f.album,
      genre: f.genre,
      rating: f.rating,
      bitrate: f.bitrate ?? null
    }));
    db.batchUpsertFiles(dbRecords);
    db.removeStaleFiles(folderPath, 'android', new Set(files.map((f: MusicFile) => f.path)));
  }
  return files;
});

ipcMain.handle('db-get-library-roots', async (_, source?: 'local' | 'android') => {
  if (!db) return [];
  return db.getLibraryRoots(source);
});

ipcMain.handle('db-add-library-root', async (_, rootPath: string, source: 'local' | 'android') => {
  if (!db) throw new Error('Database not initialized');
  return db.addLibraryRoot(rootPath, source);
});

ipcMain.handle('db-remove-library-root', async (_, rootPath: string) => {
  if (!db) throw new Error('Database not initialized');
  db.removeLibraryRoot(rootPath);
});

ipcMain.handle('db-find-matches', async () => {
  if (!db) return [];
  const matches = db.findCrossSourceMatches();
  return matches.map(m => ({
    local: dbRecordToMusicFile(m.local),
    android: dbRecordToMusicFile(m.android)
  }));
});

