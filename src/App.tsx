import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pane } from './components/Pane';
import { LocalPane } from './components/LocalPane';
import { ThemeSelector } from './components/ThemeSelector';
import { BulkEditModal } from './components/BulkEditModal';
import { SettingsModal } from './components/SettingsModal';
import { InfoPanel } from './components/InfoPanel';
import { DownloadModal } from './components/DownloadModal';
import { AlbumArtModal } from './components/AlbumArtModal';
import msyncLogoUrl from './assets/msync_logo.png';
import type { MusicFile, DeviceInfo, SyncProgress } from './types';

const STORAGE_KEY = 'msync_settings';

interface AppSettings {
  localPath: string | null;
  androidPath: string;
  ytdlpPath?: string;
  ffmpegPath?: string;
}

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Use defaults
  }
  return { localPath: null, androidPath: '/sdcard/Music' };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Save failed
  }
}

function App() {
  const settings = useRef(loadSettings());
  const deviceRef = useRef<DeviceInfo | null>(null);

  // Local state
  const [localPath, setLocalPath] = useState<string | null>(settings.current.localPath);
  const [localFiles, setLocalFiles] = useState<MusicFile[]>([]);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState<Set<string>>(new Set());
  const [localLoading, setLocalLoading] = useState(false);

  // Android state
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [androidPath, setAndroidPath] = useState(settings.current.androidPath || '/sdcard/Music');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [androidFiles, setAndroidFiles] = useState<MusicFile[]>([]);
  const [selectedAndroidFiles, setSelectedAndroidFiles] = useState<Set<string>>(new Set());
  const [androidLoading, setAndroidLoading] = useState(false);
  const [androidError, setAndroidError] = useState<string | null>(null);

  // yt-dlp / ffmpeg settings
  const [ytdlpPath, setYtdlpPath] = useState<string | undefined>(settings.current.ytdlpPath);
  const [ffmpegPath, setFfmpegPath] = useState<string | undefined>(settings.current.ffmpegPath);

  // Processed logo URL (checkerboard background stripped via canvas)
  const [processedLogoUrl, setProcessedLogoUrl] = useState<string>(msyncLogoUrl);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 10) continue; // already transparent
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max > 0 ? (max - min) / max : 0;
        const warmBias = r - b; // gold has high R, low B → large positive warm bias
        // Remove achromatic (gray/white) pixels. Preserve warm-tinted edge pixels
        // that are part of the gold calligraphy anti-aliasing.
        if (sat < 0.15 && warmBias < 20 && max > 40) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => {
        if (blob) setProcessedLogoUrl(URL.createObjectURL(blob));
      }, 'image/png');
    };
    img.src = msyncLogoUrl;
  }, []);

  // Bulk edit modal state
  const [bulkEditFiles, setBulkEditFiles] = useState<MusicFile[] | null>(null);
  const [bulkEditSource, setBulkEditSource] = useState<'local' | 'android' | null>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);

  // Download modal state
  const [showDownload, setShowDownload] = useState(false);

  // Info panel state
  const [infoFile, setInfoFile] = useState<MusicFile | null>(null);
  const [infoSource, setInfoSource] = useState<'local' | 'android'>('local');

  // Sync state
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });

  // Undo history for metadata fixes
  type MetadataUndoEntry = {
    source: 'local' | 'android';
    changes: Array<{
      path: string;
      original: { title: string; artist: string };
      fixed: { title: string; artist: string };
    }>;
    timestamp: number;
  };
  const [undoStack, setUndoStack] = useState<MetadataUndoEntry[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastFixCount, setLastFixCount] = useState(0);

  // Album art state
  const [showAlbumArt, setShowAlbumArt] = useState(false);
  const [albumArtFiles, setAlbumArtFiles] = useState<MusicFile[]>([]);
  const [albumArtSource, setAlbumArtSource] = useState<'local' | 'android'>('local');

  // Load local files (uses incremental scan with DB cache)
  const loadLocalFiles = useCallback(async (path: string) => {
    setLocalLoading(true);
    setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
    try {
      const files = await window.electronAPI.scanLocalFolderIncremental(path);
      setLocalFiles(files);
      setSelectedLocalFiles(new Set());
    } catch {
      // Load failed, fall back to regular scan
      try {
        const files = await window.electronAPI.scanLocalFolder(path);
        setLocalFiles(files);
        setSelectedLocalFiles(new Set());
      } catch {
        // Both failed
      }
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // Load Android files
  const loadAndroidFiles = useCallback(async (path: string | undefined, dev?: DeviceInfo | null) => {
    const currentDevice = dev ?? deviceRef.current;
    if (!currentDevice) return;
    if (!path) {
      return;
    }

    setAndroidLoading(true);
    setAndroidError(null);
    setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
    try {
      const files = await window.electronAPI.scanAndroidFolder(path);
      setAndroidFiles(files);
      setSelectedAndroidFiles(new Set());
      if (files.length === 0) {
        setAndroidError(`No audio files found in ${path}`);
      }
    } catch (error) {
      setAndroidError(`Failed to scan: ${error}`);
      setAndroidFiles([]);
    } finally {
      setAndroidLoading(false);
    }
  }, []);

  // Set up event listeners and load saved paths
  useEffect(() => {
    window.electronAPI.onDeviceConnected((deviceInfo) => {
      setDevice(deviceInfo);
      deviceRef.current = deviceInfo;
      // Auto-load Android files when device connects
      loadAndroidFiles(androidPath, deviceInfo);
    });

    window.electronAPI.onDeviceDisconnected(() => {
      setDevice(null);
      deviceRef.current = null;
      setAndroidFiles([]);
    });

    window.electronAPI.onSyncProgress((progress) => {
      setSyncProgress(progress);
    });

    // Try to connect on startup
    window.electronAPI.connectDevice()
      .then((deviceInfo) => {
        setDevice(deviceInfo);
        deviceRef.current = deviceInfo;
        if (deviceInfo) {
          loadAndroidFiles(androidPath, deviceInfo);
        }
      })
      .catch(err => setConnectionError(String(err)));

    // Load saved local folder
    if (settings.current.localPath) {
      loadLocalFiles(settings.current.localPath);
    }
  }, []);

  // Save settings when paths change
  useEffect(() => {
    saveSettings({ localPath, androidPath, ytdlpPath, ffmpegPath });
  }, [localPath, androidPath, ytdlpPath, ffmpegPath]);

  const handleRetryConnect = async () => {
    setConnectionError(null);
    try {
      const deviceInfo = await window.electronAPI.connectDevice();
      setDevice(deviceInfo);
      deviceRef.current = deviceInfo;
      if (deviceInfo) {
        loadAndroidFiles(androidPath, deviceInfo);
      } else {
        setConnectionError('No device found. Make sure USB debugging is enabled.');
      }
    } catch (err) {
      setConnectionError(String(err));
    }
  };

  // Select local folder
  const handleSelectLocalFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) {
      setLocalPath(path);
      loadLocalFiles(path);
    }
  };

  // Refresh handlers
  const handleRefreshLocal = () => {
    if (localPath) loadLocalFiles(localPath);
  };

  const handleRefreshAndroid = () => {
    loadAndroidFiles(androidPath);
  };

  // Rename handlers
  const handleRenameLocalFile = async (filePath: string, newFilename: string) => {
    try {
      await window.electronAPI.renameLocalFile(filePath, newFilename);
      if (localPath) loadLocalFiles(localPath);
    } catch (error) {
      alert('Error renaming file: ' + error);
    }
  };

  const handleRenameAndroidFile = async (filePath: string, newFilename: string) => {
    try {
      await window.electronAPI.renameAndroidFile(filePath, newFilename);
      loadAndroidFiles(androidPath);
    } catch (error) {
      alert('Error renaming file: ' + error);
    }
  };

  // Delete handlers
  const handleDeleteLocalFiles = async (paths: string[]) => {
    if (!confirm(`Delete ${paths.length} file(s) permanently?`)) return;
    try {
      await window.electronAPI.deleteLocalFiles(paths);
      setSelectedLocalFiles(new Set());
      if (localPath) loadLocalFiles(localPath);
    } catch (error) {
      alert('Error deleting files: ' + error);
    }
  };

  const handleDeleteAndroidFiles = async (paths: string[]) => {
    if (!confirm(`Delete ${paths.length} file(s) from Android device?`)) return;
    try {
      await window.electronAPI.deleteAndroidFiles(paths);
      setSelectedAndroidFiles(new Set());
      loadAndroidFiles(androidPath);
    } catch (error) {
      alert('Error deleting files: ' + error);
    }
  };

  // Move files handler
  const handleMoveLocalFiles = async (filePaths: string[], targetDir: string) => {
    try {
      await window.electronAPI.moveLocalFiles(filePaths, targetDir);
      setSelectedLocalFiles(new Set());
      if (localPath) loadLocalFiles(localPath);
    } catch (error) {
      alert('Error moving files: ' + error);
    }
  };

  // Rating change handlers
  const handleLocalRatingChange = async (filePath: string, rating: number) => {
    try {
      await window.electronAPI.writeLocalMetadata(filePath, { rating });
      // Update local state with new rating and current time as lastMetadataUpdate
      const now = new Date();
      setLocalFiles(files =>
        files.map(f => f.path === filePath ? { ...f, rating, lastMetadataUpdate: now } : f)
      );
    } catch (error) {
      alert('Error updating rating: ' + error);
    }
  };

  const handleAndroidRatingChange = async (filePath: string, rating: number) => {
    // For Android files, we need to pull, update metadata, and push back
    const file = androidFiles.find(f => f.path === filePath);
    if (!file) return;

    // Update UI optimistically with new rating and current time
    const now = new Date();
    setAndroidFiles(files =>
      files.map(f => f.path === filePath ? { ...f, rating, lastMetadataUpdate: now } : f)
    );

    try {
      await window.electronAPI.updateAndroidMetadata(filePath, { rating });
    } catch (error) {
      // Revert optimistic update on error
      setAndroidFiles(files =>
        files.map(f => f.path === filePath ? { ...f, rating: file.rating, lastMetadataUpdate: file.lastMetadataUpdate } : f)
      );
      alert('Error updating rating: ' + error);
    }
  };

  // Play handlers
  const handlePlayLocalFile = async (filePath: string) => {
    try {
      await window.electronAPI.playLocalFile(filePath);
    } catch {
      // Play failed
    }
  };

  const handlePlayAndroidFile = async (filePath: string) => {
    try {
      await window.electronAPI.playAndroidFile(filePath);
    } catch (error) {
      alert('Error playing file: ' + error);
    }
  };

  // Bulk edit handlers
  const handleBulkEditLocal = (files: MusicFile[]) => {
    setBulkEditFiles(files);
    setBulkEditSource('local');
  };

  const handleBulkEditAndroid = (files: MusicFile[]) => {
    setBulkEditFiles(files);
    setBulkEditSource('android');
  };

  const handleBulkEditSave = async (updates: Partial<MusicFile>) => {
    if (!bulkEditFiles || !bulkEditSource) return;

    for (const file of bulkEditFiles) {
      try {
        if (bulkEditSource === 'local') {
          await window.electronAPI.writeLocalMetadata(file.path, updates);
        } else {
          await window.electronAPI.updateAndroidMetadata(file.path, updates);
        }
      } catch {
        // Update failed
      }
    }

    // Refresh the appropriate file list
    if (bulkEditSource === 'local' && localPath) {
      loadLocalFiles(localPath);
    } else if (bulkEditSource === 'android') {
      loadAndroidFiles(androidPath);
    }

    setBulkEditFiles(null);
    setBulkEditSource(null);
  };

  const handleBulkEditClose = () => {
    setBulkEditFiles(null);
    setBulkEditSource(null);
  };

  // Info panel handlers
  const handleShowInfoLocal = (file: MusicFile) => {
    setInfoFile(file);
    setInfoSource('local');
  };

  const handleShowInfoAndroid = (file: MusicFile) => {
    setInfoFile(file);
    setInfoSource('android');
  };

  // No longer needed - kept handlers for context menu "Show Info" option
  // Update info panel when selection changes
  useEffect(() => {
    // Prefer local selection, then android
    if (selectedLocalFiles.size === 1) {
      const selectedPath = Array.from(selectedLocalFiles)[0];
      const file = localFiles.find(f => f.path === selectedPath);
      if (file) {
        setInfoFile(file);
        setInfoSource('local');
      }
    } else if (selectedAndroidFiles.size === 1) {
      const selectedPath = Array.from(selectedAndroidFiles)[0];
      const file = androidFiles.find(f => f.path === selectedPath);
      if (file) {
        setInfoFile(file);
        setInfoSource('android');
      }
    } else if (selectedLocalFiles.size === 0 && selectedAndroidFiles.size === 0) {
      setInfoFile(null);
    }
    // If multiple files selected, keep showing the last single selection or clear
  }, [selectedLocalFiles, selectedAndroidFiles, localFiles, androidFiles]);

  const handleInfoMetadataEdit = (file: MusicFile) => {
    // Open bulk edit modal for single file
    setBulkEditFiles([file]);
    setBulkEditSource(infoSource);
    setInfoFile(null);
  };

  // Fix metadata from filename - parse "Artist - Title" patterns
  const parseFilenameForMetadata = (filename: string): { artist?: string; title?: string } | null => {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Clean up YouTube-style suffixes
    let cleanName = nameWithoutExt
      .replace(/\s*[\[\(][a-zA-Z0-9_-]{11}[\]\)]\s*$/, '') // Remove [videoId]
      .replace(/\s*\(Official.*?\)/gi, '')
      .replace(/\s*\[Official.*?\]/gi, '')
      .replace(/\s*\(Audio\)/gi, '')
      .replace(/\s*\(Lyrics\)/gi, '')
      .replace(/\s*\(Music Video\)/gi, '')
      .replace(/\s*\(HD\)/gi, '')
      .replace(/\s*\(HQ\)/gi, '')
      .replace(/\s*\(Live.*?\)/gi, '')
      .replace(/\s*\[.*?Remaster.*?\]/gi, '')
      .trim();
    
    // Try "Artist - Title" pattern
    const dashMatch = cleanName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
    }
    
    return null;
  };

  const handleFixMetadataLocal = async (files: MusicFile[]) => {
    const changes: MetadataUndoEntry['changes'] = [];
    
    for (const file of files) {
      const parsed = parseFilenameForMetadata(file.filename);
      if (parsed && (parsed.artist || parsed.title)) {
        changes.push({
          path: file.path,
          original: { title: file.title, artist: file.artist },
          fixed: { title: parsed.title || file.title, artist: parsed.artist || file.artist }
        });
      }
    }

    if (changes.length === 0) {
      alert('No files could be fixed. Make sure filenames follow "Artist - Title" format.');
      return;
    }

    const confirmMsg = `Fix metadata for ${changes.length} file(s)?\n\nExample:\n"${changes[0].original.title}" → "${changes[0].fixed.title}"\nArtist: "${changes[0].fixed.artist}"`;
    if (!confirm(confirmMsg)) return;

    // Apply changes
    for (const change of changes) {
      try {
        await window.electronAPI.writeLocalMetadata(change.path, {
          title: change.fixed.title,
          artist: change.fixed.artist
        });
      } catch (error) {
        alert(`Failed to update ${change.path}:\n${error}`);
        return;
      }
    }

    // Save to undo stack
    setUndoStack(prev => [...prev, {
      source: 'local',
      changes,
      timestamp: Date.now()
    }]);
    setLastFixCount(changes.length);
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 8000);

    // Refresh
    if (localPath) loadLocalFiles(localPath);
  };

  const handleFixMetadataAndroid = async (files: MusicFile[]) => {
    const changes: MetadataUndoEntry['changes'] = [];
    
    for (const file of files) {
      const parsed = parseFilenameForMetadata(file.filename);
      if (parsed && (parsed.artist || parsed.title)) {
        changes.push({
          path: file.path,
          original: { title: file.title, artist: file.artist },
          fixed: { title: parsed.title || file.title, artist: parsed.artist || file.artist }
        });
      }
    }

    if (changes.length === 0) {
      alert('No files could be fixed. Make sure filenames follow "Artist - Title" format.');
      return;
    }

    const confirmMsg = `Fix metadata for ${changes.length} file(s) on Android?\n\nExample:\n"${changes[0].original.title}" → "${changes[0].fixed.title}"\nArtist: "${changes[0].fixed.artist}"`;
    if (!confirm(confirmMsg)) return;

    // Apply changes
    for (const change of changes) {
      try {
        await window.electronAPI.updateAndroidMetadata(change.path, {
          title: change.fixed.title,
          artist: change.fixed.artist
        });
      } catch (error) {
        alert(`Failed to update ${change.path}:\n${error}`);
        return;
      }
    }

    // Save to undo stack
    setUndoStack(prev => [...prev, {
      source: 'android',
      changes,
      timestamp: Date.now()
    }]);
    setLastFixCount(changes.length);
    setShowUndoToast(true);
    setTimeout(() => setShowUndoToast(false), 8000);

    // Refresh
    loadAndroidFiles(androidPath);
  };

  const handleUndoLastFix = async () => {
    const lastUndo = undoStack[undoStack.length - 1];
    if (!lastUndo) return;

    const confirmMsg = `Undo metadata changes for ${lastUndo.changes.length} file(s)?`;
    if (!confirm(confirmMsg)) return;

    // Revert changes
    for (const change of lastUndo.changes) {
      try {
        if (lastUndo.source === 'local') {
          await window.electronAPI.writeLocalMetadata(change.path, {
            title: change.original.title,
            artist: change.original.artist
          });
        } else {
          await window.electronAPI.updateAndroidMetadata(change.path, {
            title: change.original.title,
            artist: change.original.artist
          });
        }
      } catch (error) {
        console.error('Failed to undo:', change.path, error);
      }
    }

    // Remove from undo stack
    setUndoStack(prev => prev.slice(0, -1));
    setShowUndoToast(false);

    // Refresh
    if (lastUndo.source === 'local' && localPath) {
      loadLocalFiles(localPath);
    } else {
      loadAndroidFiles(androidPath);
    }
  };

  // Settings handlers
  const handleSettingsSave = (newSettings: {
    ytdlpPath?: string;
    ffmpegPath?: string;
  }) => {
    setYtdlpPath(newSettings.ytdlpPath);
    setFfmpegPath(newSettings.ffmpegPath);
  };

  // Album art handlers
  const handleAlbumArtLocal = (files: MusicFile[]) => {
    setAlbumArtFiles(files);
    setAlbumArtSource('local');
    setShowAlbumArt(true);
  };

  const handleAlbumArtAndroid = (files: MusicFile[]) => {
    setAlbumArtFiles(files);
    setAlbumArtSource('android');
    setShowAlbumArt(true);
  };

  // Drop handlers
  const handleDropOnAndroid = async (droppedFiles: MusicFile[]) => {
    if (!device) {
      alert('No Android device connected');
      return;
    }
    for (const file of droppedFiles) {
      const destPath = androidPath.replace(/\/+$/, '') + '/' + file.filename;
      try {
        await window.electronAPI.pushFile(file.path, destPath);
      } catch (error) {
        alert(`Error copying ${file.filename}: ${error}`);
        return;
      }
    }
    loadAndroidFiles(androidPath);
  };

  const handleDropOnLocal = async (droppedFiles: MusicFile[]) => {
    if (!localPath) return;
    const sep = localPath.includes('\\') ? '\\' : '/';
    for (const file of droppedFiles) {
      const destPath = localPath.replace(/[/\\]+$/, '') + sep + file.filename;
      try {
        await window.electronAPI.pullFile(file.path, destPath);
      } catch (error) {
        alert(`Error copying ${file.filename}: ${error}`);
        return;
      }
    }
    loadLocalFiles(localPath);
  };

  // Find matching songs between local and Android by filename
  const findMatchingSongs = useCallback(() => {
    const matches: Array<{
      local: MusicFile;
      android: MusicFile;
      direction: 'toAndroid' | 'toLocal' | 'same';
    }> = [];

    // Build index of Android files by filename (lowercase for case-insensitive matching)
    const androidIndex = new Map<string, MusicFile>();
    for (const file of androidFiles) {
      androidIndex.set(file.filename.toLowerCase(), file);
    }

    // Find matches in local files
    for (const localFile of localFiles) {
      const androidFile = androidIndex.get(localFile.filename.toLowerCase());
      if (androidFile) {
        const localTime = localFile.lastMetadataUpdate?.getTime() || 0;
        const androidTime = androidFile.lastMetadataUpdate?.getTime() || 0;

        let direction: 'toAndroid' | 'toLocal' | 'same';
        if (localTime > androidTime) {
          direction = 'toAndroid';
        } else if (androidTime > localTime) {
          direction = 'toLocal';
        } else {
          direction = 'same';
        }

        matches.push({ local: localFile, android: androidFile, direction });
      }
    }

    return matches;
  }, [localFiles, androidFiles]);

  // Refresh both sides and get fresh file lists
  const refreshBothSides = async (): Promise<{ local: MusicFile[]; android: MusicFile[] } | null> => {
    setSyncProgress({ current: 0, total: 0, currentFile: 'Refreshing...', status: 'syncing' });

    try {
      let freshLocalFiles: MusicFile[] = [];
      if (localPath) {
        freshLocalFiles = await window.electronAPI.scanLocalFolder(localPath);
        setLocalFiles(freshLocalFiles);
      }

      let freshAndroidFiles: MusicFile[] = [];
      if (deviceRef.current) {
        freshAndroidFiles = await window.electronAPI.scanAndroidFolder(androidPath);
        setAndroidFiles(freshAndroidFiles);
      }

      return { local: freshLocalFiles, android: freshAndroidFiles };
    } catch (error) {
      setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'error', error: String(error) });
      return null;
    }
  };

  // Find matching songs from provided file lists
  const findMatches = (local: MusicFile[], android: MusicFile[]) => {
    const matches: Array<{
      local: MusicFile;
      android: MusicFile;
      direction: 'toAndroid' | 'toLocal' | 'same';
    }> = [];

    const androidIndex = new Map<string, MusicFile>();
    for (const file of android) {
      androidIndex.set(file.filename.toLowerCase(), file);
    }

    for (const localFile of local) {
      const androidFile = androidIndex.get(localFile.filename.toLowerCase());
      if (androidFile) {
        const localTime = localFile.lastMetadataUpdate?.getTime() || 0;
        const androidTime = androidFile.lastMetadataUpdate?.getTime() || 0;

        let direction: 'toAndroid' | 'toLocal' | 'same';
        if (localTime > androidTime) {
          direction = 'toAndroid';
        } else if (androidTime > localTime) {
          direction = 'toLocal';
        } else {
          direction = 'same';
        }

        matches.push({ local: localFile, android: androidFile, direction });
      }
    }

    return matches;
  };

  // Single sync button - refreshes first, then auto-matches and syncs newer metadata
  const handleSync = async () => {
    // First refresh both sides to get latest metadata
    const freshFiles = await refreshBothSides();
    if (!freshFiles) return;

    const matches = findMatches(freshFiles.local, freshFiles.android);
    const toSync = matches.filter(m => m.direction !== 'same');

    if (matches.length === 0) {
      setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
      alert('No matching songs found between local and Android folders');
      return;
    }

    if (toSync.length === 0) {
      setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'complete' });
      alert(`Found ${matches.length} matching songs - all metadata is already in sync!`);
      return;
    }

    const confirmMsg = `Found ${matches.length} matching songs.\n${toSync.length} need syncing:\n` +
      `- ${toSync.filter(m => m.direction === 'toAndroid').length} will update Android (local is newer)\n` +
      `- ${toSync.filter(m => m.direction === 'toLocal').length} will update Local (Android is newer)\n\nProceed?`;

    if (!confirm(confirmMsg)) {
      setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
      return;
    }

    // Perform sync
    const total = toSync.length;
    for (let i = 0; i < toSync.length; i++) {
      const pair = toSync[i];
      setSyncProgress({
        current: i + 1,
        total,
        currentFile: pair.local.filename,
        status: 'syncing'
      });

      try {
        if (pair.direction === 'toAndroid') {
          await window.electronAPI.syncMetadata(
            [pair.local.path],
            [pair.android.path],
            { from: 'local', to: 'android' }
          );
        } else {
          await window.electronAPI.syncMetadata(
            [pair.android.path],
            [pair.local.path],
            { from: 'android', to: 'local' }
          );
        }
      } catch (error) {
        setSyncProgress({
          current: i + 1,
          total,
          currentFile: pair.local.filename,
          status: 'error',
          error: String(error)
        });
        return;
      }
    }

    // Final refresh to show updated state (keep syncing status until done)
    setSyncProgress({
      current: total,
      total,
      currentFile: 'Refreshing...',
      status: 'syncing'
    });

    // Await the refresh so matchStats recalculates with fresh data
    const refreshPromises: Promise<void>[] = [];
    if (localPath) {
      refreshPromises.push(
        window.electronAPI.scanLocalFolder(localPath).then(files => {
          setLocalFiles(files);
          setSelectedLocalFiles(new Set());
        })
      );
    }
    if (deviceRef.current) {
      refreshPromises.push(
        window.electronAPI.scanAndroidFolder(androidPath).then(files => {
          setAndroidFiles(files);
          setSelectedAndroidFiles(new Set());
        })
      );
    }
    await Promise.all(refreshPromises);

    setSyncProgress({
      current: total,
      total,
      currentFile: '',
      status: 'complete'
    });
  };

  // Calculate matching stats for UI
  const matchStats = useMemo(() => {
    if (localFiles.length === 0 || androidFiles.length === 0) {
      return { total: 0, needsSync: 0, toAndroid: 0, toLocal: 0 };
    }
    const matches = findMatchingSongs();
    const toSync = matches.filter(m => m.direction !== 'same');
    return {
      total: matches.length,
      needsSync: toSync.length,
      toAndroid: toSync.filter(m => m.direction === 'toAndroid').length,
      toLocal: toSync.filter(m => m.direction === 'toLocal').length
    };
  }, [findMatchingSongs, localFiles.length, androidFiles.length]);

  const canSync = device && localFiles.length > 0 && androidFiles.length > 0;
  const hasPendingSync = !!(canSync && matchStats.needsSync > 0 && syncProgress.status === 'idle');

  return (
    <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 header-floral border-b border-theme relative z-10">
        <img
          src={processedLogoUrl}
          alt="msync"
          className="absolute pointer-events-none select-none"
          style={{
            width: '18%',
            height: 'auto',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            opacity: 0.9,
          }}
        />
        {/* Flex spacer - keeps buttons on the right */}
        <div className="flex-1 relative z-10" />

        <div className="flex items-center gap-3 relative z-10">
          {/* Sync button in header */}
          <button
            onClick={handleSync}
            disabled={!canSync || syncProgress.status === 'syncing'}
            className={`
              relative flex items-center gap-1.5 px-4 py-1.5 rounded-theme font-tech font-semibold text-sm transition-all
              ${canSync && syncProgress.status !== 'syncing'
                ? hasPendingSync
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white shadow-[0_0_18px_rgba(167,139,250,0.7)] ring-2 ring-purple-300 ring-offset-1 ring-offset-transparent'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg'
                : 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              }
            `}
            title="Sync metadata between local and Android (newer wins)"
          >
            {hasPendingSync && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
              </span>
            )}
            <span className="text-base">⇄</span>
            <span>
              {syncProgress.status === 'syncing'
                ? 'Syncing...'
                : hasPendingSync
                  ? `Sync (${matchStats.needsSync})`
                  : 'Sync Metadata'
              }
            </span>
          </button>

          {/* Download button */}
          <button
            onClick={() => setShowDownload(true)}
            disabled={!localPath}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-theme font-tech font-semibold text-sm transition-all
              ${localPath
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg'
                : 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              }
            `}
            title={localPath ? 'Download from YouTube' : 'Select a local folder first'}
          >
            <span className="text-base">📥</span>
            <span>YouTube</span>
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="px-2 py-1 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme font-tech transition-colors"
            title="Customize header"
          >
            ⚙
          </button>
          <ThemeSelector />
          {device ? (
            <span className="flex items-center gap-1.5 text-theme-success font-tech text-sm">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }}></span>
              {device.model}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-theme-muted font-tech text-sm">
                <span className="w-1.5 h-1.5 bg-theme-tertiary rounded-full"></span>
                No device
              </span>
              <button
                onClick={handleRetryConnect}
                className="px-2 py-0.5 text-xs bg-theme-accent bg-theme-accent-hover rounded-theme font-tech"
              >
                Retry
              </button>
              {connectionError && (
                <span className="text-theme-error text-xs max-w-32 truncate font-tech" title={connectionError}>
                  {connectionError}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content - z-[11] ensures panels paint over any logo overflow from the header */}
      <div className="flex-1 flex overflow-hidden relative z-[11]">
        {/* Info Panel - Left sidebar */}
        <InfoPanel
          file={infoFile}
          source={infoSource}
          onRatingChange={infoSource === 'local' ? handleLocalRatingChange : handleAndroidRatingChange}
          onMetadataEdit={handleInfoMetadataEdit}
        />

        {/* Local files pane */}
        <LocalPane
          path={localPath}
          files={localFiles}
          selectedFiles={selectedLocalFiles}
          onSelectFiles={setSelectedLocalFiles}
          onSelectFolder={handleSelectLocalFolder}
          onRefresh={handleRefreshLocal}
          onDeleteFiles={handleDeleteLocalFiles}
          onDropFiles={handleDropOnLocal}
          onRatingChange={handleLocalRatingChange}
          onPlayFile={handlePlayLocalFile}
          onBulkEdit={handleBulkEditLocal}
          onShowInfo={handleShowInfoLocal}
          onFixMetadata={handleFixMetadataLocal}
          onFetchAlbumArt={handleAlbumArtLocal}
          onRenameFile={handleRenameLocalFile}
          onMoveFiles={handleMoveLocalFiles}
          loading={localLoading}
        />

        {/* Center divider - thin */}
        <div className="flex flex-col items-center justify-center w-1 bg-theme-tertiary">
          {/* Sync status indicator */}
          {syncProgress.status === 'syncing' && (
            <div className="absolute bg-theme-secondary px-2 py-1 rounded text-xs text-theme-muted font-tech whitespace-nowrap z-20">
              {syncProgress.currentFile || 'Refreshing...'}
              {syncProgress.total > 0 && ` ${syncProgress.current}/${syncProgress.total}`}
            </div>
          )}
        </div>

        {/* Right pane - Android files */}
        <Pane
          title="Android"
          path={androidPath}
          files={androidFiles}
          selectedFiles={selectedAndroidFiles}
          onSelectFiles={setSelectedAndroidFiles}
          onPathChange={(path) => {
            setAndroidPath(path);
          }}
          onRefresh={handleRefreshAndroid}
          onDeleteFiles={handleDeleteAndroidFiles}
          onDropFiles={handleDropOnAndroid}
          onRatingChange={handleAndroidRatingChange}
          onPlayFile={handlePlayAndroidFile}
          onBulkEdit={handleBulkEditAndroid}
          onShowInfo={handleShowInfoAndroid}
          onFixMetadata={handleFixMetadataAndroid}
          onFetchAlbumArt={handleAlbumArtAndroid}
          onRenameFile={handleRenameAndroidFile}
          loading={androidLoading}
          isAndroid
          deviceConnected={!!device}
          error={androidError}
        />
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-3 py-1 bg-theme-secondary border-t border-theme text-xs font-tech text-theme-muted">
        <span>
          Local: {selectedLocalFiles.size}/{localFiles.length}
          {matchStats.total > 0 && syncProgress.status === 'idle' && (
            <span className="ml-2 text-theme-muted">
              ({matchStats.total} matches{matchStats.needsSync > 0 && <span className="text-theme-warning"> • {matchStats.needsSync} pending</span>})
            </span>
          )}
        </span>
        <span>
          {syncProgress.status === 'syncing' && (
            <span className="text-theme-accent mr-2">
              Syncing: {syncProgress.currentFile || '...'} {syncProgress.total > 0 && `${syncProgress.current}/${syncProgress.total}`}
            </span>
          )}
          {syncProgress.status === 'complete' && (
            <span className="text-theme-success mr-2">Sync complete</span>
          )}
          {syncProgress.status === 'error' && (
            <span className="text-theme-error mr-2">Sync failed</span>
          )}
          Android: {selectedAndroidFiles.size}/{androidFiles.length}
        </span>
      </footer>

      {/* Undo Toast */}
      {showUndoToast && undoStack.length > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl font-tech text-sm">
            <span className="text-green-400">✓ Fixed {lastFixCount} file(s)</span>
            <button
              onClick={handleUndoLastFix}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-semibold transition-colors"
            >
              Undo
            </button>
            <button
              onClick={() => setShowUndoToast(false)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {bulkEditFiles && (
        <BulkEditModal
          files={bulkEditFiles}
          onSave={handleBulkEditSave}
          onClose={handleBulkEditClose}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          ytdlpPath={ytdlpPath}
          ffmpegPath={ffmpegPath}
          downloadPath={localPath || undefined}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Album Art Modal */}
      {showAlbumArt && albumArtFiles.length > 0 && (
        <AlbumArtModal
          files={albumArtFiles}
          source={albumArtSource}
          onClose={() => setShowAlbumArt(false)}
        />
      )}

      {/* Download Modal */}
      {showDownload && localPath && (
        <DownloadModal
          ytdlpPath={ytdlpPath || ''}
          ffmpegPath={ffmpegPath}
          outputPath={localPath}
          onClose={() => setShowDownload(false)}
          onDownloadComplete={() => {
            // Refresh local files after download
            loadLocalFiles(localPath);
          }}
        />
      )}
    </div>
  );
}

export default App;
