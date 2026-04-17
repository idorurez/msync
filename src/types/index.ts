export interface MusicFile {
  id: string;
  path: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  rating: number; // 0-5 stars
  lastMetadataUpdate: Date | null;
  format: AudioFormat;
  size: number;
  bitrate?: number; // kbps
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

// Database types
export interface LibraryRoot {
  id: number;
  path: string;
  source: 'local' | 'android';
  added_at: number;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  currentFile: string;
}

// IPC API types
export interface ElectronAPI {
  // Local file operations
  selectFolder: () => Promise<string | null>;
  selectImage: () => Promise<string | null>;
  selectFile: () => Promise<string | null>;
  listImages: (folderPath: string) => Promise<Array<{ name: string; path: string }>>;
  getAppPath: () => Promise<string>;
  scanLocalFolder: (path: string) => Promise<MusicFile[]>;
  getLocalFolderTree: (path: string) => Promise<FolderNode>;
  readLocalMetadata: (filePath: string) => Promise<MusicFile>;
  writeLocalMetadata: (filePath: string, metadata: Partial<MusicFile>) => Promise<void>;
  renameLocalFile: (filePath: string, newFilename: string) => Promise<string>;
  deleteLocalFiles: (filePaths: string[]) => Promise<void>;
  moveLocalFiles: (filePaths: string[], targetDir: string) => Promise<string[]>;
  createLocalFolder: (parentPath: string, folderName: string) => Promise<string>;
  renameLocalFolder: (oldPath: string, newName: string) => Promise<string>;
  deleteLocalFolder: (folderPath: string) => Promise<void>;
  playLocalFile: (filePath: string) => Promise<void>;

  // ADB operations
  connectDevice: () => Promise<DeviceInfo | null>;
  disconnectDevice: () => void;
  scanAndroidFolder: (path: string) => Promise<MusicFile[]>;
  getAndroidFolderTree: (path: string) => Promise<FolderNode>;
  pullFile: (androidPath: string, localPath: string) => Promise<void>;
  pushFile: (localPath: string, androidPath: string) => Promise<void>;
  renameAndroidFile: (filePath: string, newFilename: string) => Promise<string>;
  deleteAndroidFiles: (filePaths: string[]) => Promise<void>;
  updateAndroidMetadata: (filePath: string, metadata: Partial<MusicFile>) => Promise<void>;
  playAndroidFile: (filePath: string) => Promise<void>;

  // Sync operations
  syncMetadata: (
    sourceFiles: string[],
    targetFiles: string[],
    direction: SyncDirection
  ) => Promise<void>;

  // Album art operations
  writeAlbumArt: (filePath: string, imageUrl: string) => Promise<void>;
  writeAndroidAlbumArt: (filePath: string, imageUrl: string) => Promise<void>;

  // yt-dlp operations
  downloadWithYtdlp: (
    url: string,
    outputPath: string,
    ytdlpPath: string,
    ffmpegPath?: string
  ) => Promise<{ success: boolean; fileCount?: number; error?: string }>;

  // Database operations
  scanLocalFolderIncremental: (path: string) => Promise<MusicFile[]>;
  scanAndroidFolderIncremental: (path: string) => Promise<MusicFile[]>;
  dbGetLibraryRoots: (source?: 'local' | 'android') => Promise<LibraryRoot[]>;
  dbAddLibraryRoot: (path: string, source: 'local' | 'android') => Promise<LibraryRoot>;
  dbRemoveLibraryRoot: (path: string) => Promise<void>;
  dbFindMatches: () => Promise<Array<{ local: MusicFile; android: MusicFile }>>;

  // Events
  onDeviceConnected: (callback: (device: DeviceInfo) => void) => void;
  onDeviceDisconnected: (callback: () => void) => void;
  onSyncProgress: (callback: (progress: SyncProgress) => void) => void;
  onScanProgress: (callback: (progress: ScanProgress) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
