export interface MusicFile {
  id: string;
  path: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  rating: number; // 0-5 stars
  lastMetadataUpdate: Date | null;
  format: AudioFormat;
  size: number;
}

export type AudioFormat = 'mp3' | 'flac' | 'm4a' | 'ogg' | 'wav' | 'aiff' | 'wma';

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  isExpanded: boolean;
}

export interface DeviceInfo {
  id: string;
  model: string;
  connected: boolean;
}

export interface SyncDirection {
  from: 'local' | 'android';
  to: 'local' | 'android';
}

export interface SyncProgress {
  current: number;
  total: number;
  currentFile: string;
  status: 'idle' | 'syncing' | 'complete' | 'error';
  error?: string;
}

export interface AppState {
  localPath: string | null;
  androidPath: string;
  selectedLocalFiles: Set<string>;
  selectedAndroidFiles: Set<string>;
  device: DeviceInfo | null;
  syncProgress: SyncProgress;
}

// IPC API types
export interface ElectronAPI {
  // Local file operations
  selectFolder: () => Promise<string | null>;
  scanLocalFolder: (path: string) => Promise<MusicFile[]>;
  getLocalFolderTree: (path: string) => Promise<FolderNode>;
  readLocalMetadata: (filePath: string) => Promise<MusicFile>;
  writeLocalMetadata: (filePath: string, metadata: Partial<MusicFile>) => Promise<void>;
  deleteLocalFiles: (filePaths: string[]) => Promise<void>;
  playLocalFile: (filePath: string) => Promise<void>;

  // ADB operations
  connectDevice: () => Promise<DeviceInfo | null>;
  disconnectDevice: () => void;
  scanAndroidFolder: (path: string) => Promise<MusicFile[]>;
  getAndroidFolderTree: (path: string) => Promise<FolderNode>;
  pullFile: (androidPath: string, localPath: string) => Promise<void>;
  pushFile: (localPath: string, androidPath: string) => Promise<void>;
  deleteAndroidFiles: (filePaths: string[]) => Promise<void>;
  updateAndroidMetadata: (filePath: string, metadata: Partial<MusicFile>) => Promise<void>;
  playAndroidFile: (filePath: string) => Promise<void>;

  // Sync operations
  syncMetadata: (
    sourceFiles: string[],
    targetFiles: string[],
    direction: SyncDirection
  ) => Promise<void>;

  // Events
  onDeviceConnected: (callback: (device: DeviceInfo) => void) => void;
  onDeviceDisconnected: (callback: () => void) => void;
  onSyncProgress: (callback: (progress: SyncProgress) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
