import { contextBridge, ipcRenderer } from 'electron';
import type { MusicFile, SyncDirection, DeviceInfo, SyncProgress, ScanProgress, FolderNode, LibraryRoot } from '../src/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Local file operations
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('select-folder'),

  selectImage: (): Promise<string | null> =>
    ipcRenderer.invoke('select-image'),

  selectFile: (): Promise<string | null> =>
    ipcRenderer.invoke('select-file'),

  listImages: (folderPath: string): Promise<Array<{ name: string; path: string }>> =>
    ipcRenderer.invoke('list-images', folderPath),

  getAppPath: (): Promise<string> =>
    ipcRenderer.invoke('get-app-path'),

  scanLocalFolder: (path: string): Promise<MusicFile[]> =>
    ipcRenderer.invoke('scan-local-folder', path),

  getLocalFolderTree: (path: string): Promise<FolderNode> =>
    ipcRenderer.invoke('get-local-folder-tree', path),

  readLocalMetadata: (filePath: string): Promise<MusicFile> =>
    ipcRenderer.invoke('read-local-metadata', filePath),

  writeLocalMetadata: (filePath: string, metadata: Partial<MusicFile>): Promise<void> =>
    ipcRenderer.invoke('write-local-metadata', filePath, metadata),

  renameLocalFile: (filePath: string, newFilename: string): Promise<string> =>
    ipcRenderer.invoke('rename-local-file', filePath, newFilename),

  deleteLocalFiles: (filePaths: string[]): Promise<void> =>
    ipcRenderer.invoke('delete-local-files', filePaths),

  moveLocalFiles: (filePaths: string[], targetDir: string): Promise<string[]> =>
    ipcRenderer.invoke('move-local-files', filePaths, targetDir),

  createLocalFolder: (parentPath: string, folderName: string): Promise<string> =>
    ipcRenderer.invoke('create-local-folder', parentPath, folderName),

  renameLocalFolder: (oldPath: string, newName: string): Promise<string> =>
    ipcRenderer.invoke('rename-local-folder', oldPath, newName),

  deleteLocalFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('delete-local-folder', folderPath),

  playLocalFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('play-local-file', filePath),

  // ADB operations
  connectDevice: (): Promise<DeviceInfo | null> =>
    ipcRenderer.invoke('connect-device'),

  disconnectDevice: (): void => {
    ipcRenderer.invoke('disconnect-device');
  },

  scanAndroidFolder: (path: string): Promise<MusicFile[]> =>
    ipcRenderer.invoke('scan-android-folder', path),

  getAndroidFolderTree: (path: string): Promise<FolderNode> =>
    ipcRenderer.invoke('get-android-folder-tree', path),

  pullFile: (androidPath: string, localPath: string): Promise<void> =>
    ipcRenderer.invoke('pull-file', androidPath, localPath),

  pushFile: (localPath: string, androidPath: string): Promise<void> =>
    ipcRenderer.invoke('push-file', localPath, androidPath),

  renameAndroidFile: (filePath: string, newFilename: string): Promise<string> =>
    ipcRenderer.invoke('rename-android-file', filePath, newFilename),

  deleteAndroidFiles: (filePaths: string[]): Promise<void> =>
    ipcRenderer.invoke('delete-android-files', filePaths),

  updateAndroidMetadata: (filePath: string, metadata: Partial<MusicFile>): Promise<void> =>
    ipcRenderer.invoke('update-android-metadata', filePath, metadata),

  playAndroidFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('play-android-file', filePath),

  // Sync operations
  syncMetadata: (
    sourceFiles: string[],
    targetFiles: string[],
    direction: SyncDirection
  ): Promise<void> =>
    ipcRenderer.invoke('sync-metadata', sourceFiles, targetFiles, direction),

  // Album art operations
  writeAlbumArt: (filePath: string, imageUrl: string): Promise<void> =>
    ipcRenderer.invoke('write-album-art', filePath, imageUrl),

  writeAndroidAlbumArt: (filePath: string, imageUrl: string): Promise<void> =>
    ipcRenderer.invoke('write-android-album-art', filePath, imageUrl),

  // yt-dlp operations
  downloadWithYtdlp: (
    url: string,
    outputPath: string,
    ytdlpPath: string,
    ffmpegPath?: string
  ): Promise<{ success: boolean; fileCount?: number; error?: string }> =>
    ipcRenderer.invoke('download-with-ytdlp', url, outputPath, ytdlpPath, ffmpegPath),

  // Database operations
  scanLocalFolderIncremental: (path: string): Promise<MusicFile[]> =>
    ipcRenderer.invoke('scan-local-folder-incremental', path),

  scanAndroidFolderIncremental: (path: string): Promise<MusicFile[]> =>
    ipcRenderer.invoke('scan-android-folder-incremental', path),

  dbGetLibraryRoots: (source?: 'local' | 'android'): Promise<LibraryRoot[]> =>
    ipcRenderer.invoke('db-get-library-roots', source),

  dbAddLibraryRoot: (path: string, source: 'local' | 'android'): Promise<LibraryRoot> =>
    ipcRenderer.invoke('db-add-library-root', path, source),

  dbRemoveLibraryRoot: (path: string): Promise<void> =>
    ipcRenderer.invoke('db-remove-library-root', path),

  dbFindMatches: (): Promise<Array<{ local: MusicFile; android: MusicFile }>> =>
    ipcRenderer.invoke('db-find-matches'),

  // Events
  onDeviceConnected: (callback: (device: DeviceInfo) => void): void => {
    ipcRenderer.on('device-connected', (_, device) => callback(device));
  },

  onDeviceDisconnected: (callback: () => void): void => {
    ipcRenderer.on('device-disconnected', () => callback());
  },

  onSyncProgress: (callback: (progress: SyncProgress) => void): void => {
    ipcRenderer.on('sync-progress', (_, progress) => callback(progress));
  },

  onScanProgress: (callback: (progress: ScanProgress) => void): void => {
    ipcRenderer.on('scan-progress', (_, progress) => callback(progress));
  }
});
