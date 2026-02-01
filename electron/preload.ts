import { contextBridge, ipcRenderer } from 'electron';
import type { MusicFile, SyncDirection, DeviceInfo, SyncProgress, FolderNode } from '../src/types';

contextBridge.exposeInMainWorld('electronAPI', {
  // Local file operations
  selectFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('select-folder'),

  selectImage: (): Promise<string | null> =>
    ipcRenderer.invoke('select-image'),

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

  deleteLocalFiles: (filePaths: string[]): Promise<void> =>
    ipcRenderer.invoke('delete-local-files', filePaths),

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

  // Events
  onDeviceConnected: (callback: (device: DeviceInfo) => void): void => {
    ipcRenderer.on('device-connected', (_, device) => callback(device));
  },

  onDeviceDisconnected: (callback: () => void): void => {
    ipcRenderer.on('device-disconnected', () => callback());
  },

  onSyncProgress: (callback: (progress: SyncProgress) => void): void => {
    ipcRenderer.on('sync-progress', (_, progress) => callback(progress));
  }
});
