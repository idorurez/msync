import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { scanFolder, getFolderTree, readMetadata, writeMetadata } from './metadata';
import { AdbManager } from './adb';
import type { MusicFile, SyncDirection } from '../src/types';

let mainWindow: BrowserWindow | null = null;
let adbManager: AdbManager | null = null;

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

app.whenReady().then(() => {
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

ipcMain.handle('delete-local-files', async (_, filePaths: string[]) => {
  for (const filePath of filePaths) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Error deleting ${filePath}:`, error);
      throw error;
    }
  }
});

ipcMain.handle('play-local-file', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath);
  } catch (error) {
    console.error(`Error playing ${filePath}:`, error);
    throw error;
  }
});

ipcMain.handle('play-android-file', async (_, androidPath: string) => {
  if (!adbManager) throw new Error('No device connected');

  // Pull file to temp location and play it
  const tempPath = path.join(app.getPath('temp'), 'msync-play-' + path.basename(androidPath));

  try {
    await adbManager.pullFile(androidPath, tempPath);
    await shell.openPath(tempPath);
    // Note: temp file will be cleaned up on next play or app exit
  } catch (error) {
    console.error(`Error playing Android file ${androidPath}:`, error);
    throw error;
  }
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
