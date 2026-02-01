import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pane } from './components/Pane';
import { ThemeSelector } from './components/ThemeSelector';
import type { MusicFile, DeviceInfo, SyncProgress } from './types';

const STORAGE_KEY = 'msync_settings';

function loadSettings(): { localPath: string | null; androidPath: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return { localPath: null, androidPath: '/sdcard/Music' };
}

function saveSettings(localPath: string | null, androidPath: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ localPath, androidPath }));
  } catch (e) {
    console.error('Error saving settings:', e);
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
  const [androidPath, setAndroidPath] = useState(settings.current.androidPath);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [androidFiles, setAndroidFiles] = useState<MusicFile[]>([]);
  const [selectedAndroidFiles, setSelectedAndroidFiles] = useState<Set<string>>(new Set());
  const [androidLoading, setAndroidLoading] = useState(false);

  // Sync state
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    currentFile: '',
    status: 'idle'
  });

  // Load local files
  const loadLocalFiles = useCallback(async (path: string) => {
    setLocalLoading(true);
    setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
    try {
      const files = await window.electronAPI.scanLocalFolder(path);
      setLocalFiles(files);
      setSelectedLocalFiles(new Set());
    } catch (error) {
      console.error('Error loading local files:', error);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // Load Android files
  const loadAndroidFiles = useCallback(async (path: string, dev?: DeviceInfo | null) => {
    const currentDevice = dev ?? deviceRef.current;
    if (!currentDevice) return;

    setAndroidLoading(true);
    setSyncProgress({ current: 0, total: 0, currentFile: '', status: 'idle' });
    try {
      const files = await window.electronAPI.scanAndroidFolder(path);
      setAndroidFiles(files);
      setSelectedAndroidFiles(new Set());
    } catch (error) {
      console.error('Error loading Android files:', error);
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
    saveSettings(localPath, androidPath);
  }, [localPath, androidPath]);

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

  // Delete handlers
  const handleDeleteLocalFiles = async (paths: string[]) => {
    if (!confirm(`Delete ${paths.length} file(s) permanently?`)) return;
    try {
      await window.electronAPI.deleteLocalFiles(paths);
      setSelectedLocalFiles(new Set());
      if (localPath) loadLocalFiles(localPath);
    } catch (error) {
      console.error('Error deleting local files:', error);
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
      console.error('Error deleting Android files:', error);
      alert('Error deleting files: ' + error);
    }
  };

  // Rating change handlers
  const handleLocalRatingChange = async (filePath: string, rating: number) => {
    try {
      await window.electronAPI.writeLocalMetadata(filePath, { rating });
      // Update local state
      setLocalFiles(files =>
        files.map(f => f.path === filePath ? { ...f, rating } : f)
      );
    } catch (error) {
      console.error('Error updating rating:', error);
      alert('Error updating rating: ' + error);
    }
  };

  const handleAndroidRatingChange = async (filePath: string, rating: number) => {
    // For Android files, we need to pull, update metadata, and push back
    const file = androidFiles.find(f => f.path === filePath);
    if (!file) return;

    // Update UI optimistically
    setAndroidFiles(files =>
      files.map(f => f.path === filePath ? { ...f, rating } : f)
    );

    try {
      // Use the sync mechanism to update the rating
      // Create a temporary approach: pull file, write rating, push back
      await window.electronAPI.updateAndroidMetadata(filePath, { rating });
    } catch (error) {
      console.error('Error updating Android rating:', error);
      // Revert optimistic update on error
      setAndroidFiles(files =>
        files.map(f => f.path === filePath ? { ...f, rating: file.rating } : f)
      );
      alert('Error updating rating: ' + error);
    }
  };

  // Play handlers
  const handlePlayLocalFile = async (filePath: string) => {
    try {
      await window.electronAPI.playLocalFile(filePath);
    } catch (error) {
      console.error('Error playing file:', error);
    }
  };

  const handlePlayAndroidFile = async (filePath: string) => {
    try {
      await window.electronAPI.playAndroidFile(filePath);
    } catch (error) {
      console.error('Error playing Android file:', error);
      alert('Error playing file: ' + error);
    }
  };

  // Drop handlers
  const handleDropOnAndroid = async (droppedFiles: MusicFile[]) => {
    if (!device) {
      alert('No Android device connected');
      return;
    }
    setSelectedLocalFiles(new Set(droppedFiles.map(f => f.path)));
  };

  const handleDropOnLocal = async (droppedFiles: MusicFile[]) => {
    setSelectedAndroidFiles(new Set(droppedFiles.map(f => f.path)));
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
      // Refresh local files
      let freshLocalFiles: MusicFile[] = [];
      if (localPath) {
        freshLocalFiles = await window.electronAPI.scanLocalFolder(localPath);
        setLocalFiles(freshLocalFiles);
      }

      // Refresh Android files
      let freshAndroidFiles: MusicFile[] = [];
      if (deviceRef.current) {
        freshAndroidFiles = await window.electronAPI.scanAndroidFolder(androidPath);
        setAndroidFiles(freshAndroidFiles);
      }

      return { local: freshLocalFiles, android: freshAndroidFiles };
    } catch (error) {
      console.error('Error refreshing:', error);
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
        console.error('Sync error:', error);
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

    setSyncProgress({
      current: total,
      total,
      currentFile: '',
      status: 'complete'
    });

    // Final refresh to show updated state
    if (localPath) loadLocalFiles(localPath);
    loadAndroidFiles(androidPath);
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

  return (
    <div className="h-screen flex flex-col bg-theme-primary text-theme-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-theme-secondary border-b border-theme">
        <h1 className="text-xl font-semibold text-theme-primary">msync</h1>
        <div className="flex items-center gap-4">
          <ThemeSelector />
          {device ? (
            <span className="flex items-center gap-2 text-theme-success">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--success)' }}></span>
              {device.model}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 text-theme-muted">
                <span className="w-2 h-2 bg-theme-tertiary rounded-full"></span>
                No device
              </span>
              <button
                onClick={handleRetryConnect}
                className="px-2 py-1 text-xs bg-theme-accent bg-theme-accent-hover rounded-theme"
              >
                Retry
              </button>
              {connectionError && (
                <span className="text-theme-error text-xs max-w-xs truncate" title={connectionError}>
                  {connectionError}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane - Local files */}
        <Pane
          title="Source (Local)"
          path={localPath}
          files={localFiles}
          selectedFiles={selectedLocalFiles}
          onSelectFiles={setSelectedLocalFiles}
          onSelectFolder={handleSelectLocalFolder}
          onPathChange={(path) => {
            setLocalPath(path);
            loadLocalFiles(path);
          }}
          onRefresh={handleRefreshLocal}
          onDeleteFiles={handleDeleteLocalFiles}
          onDropFiles={handleDropOnLocal}
          onRatingChange={handleLocalRatingChange}
          onPlayFile={handlePlayLocalFile}
          loading={localLoading}
        />

        {/* Center - Sync controls */}
        <div className="flex flex-col items-center justify-center gap-3 px-6 bg-theme-secondary border-x border-theme min-w-48">
          <button
            onClick={handleSync}
            disabled={!canSync || syncProgress.status === 'syncing'}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-theme font-medium transition-all
              ${canSync && syncProgress.status !== 'syncing'
                ? 'bg-theme-accent bg-theme-accent-hover text-theme-primary'
                : 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              }
            `}
            title="Refresh both sides and sync metadata (newer wins)"
          >
            <span className="text-xl">⇄</span>
            <span>Sync</span>
          </button>

          {/* Match stats */}
          {canSync && syncProgress.status === 'idle' && (
            <div className="text-xs text-theme-muted text-center space-y-1">
              <div>{matchStats.total} matching songs</div>
              {matchStats.needsSync > 0 ? (
                <>
                  <div className="text-theme-warning">{matchStats.needsSync} may need sync</div>
                </>
              ) : matchStats.total > 0 ? (
                <div className="text-theme-success">All in sync</div>
              ) : null}
            </div>
          )}

          {syncProgress.status === 'syncing' && (
            <div className="text-sm text-theme-muted text-center">
              <div className="truncate max-w-36">{syncProgress.currentFile || 'Refreshing...'}</div>
              {syncProgress.total > 0 && (
                <div>{syncProgress.current}/{syncProgress.total}</div>
              )}
            </div>
          )}

          {syncProgress.status === 'complete' && (
            <div className="text-sm text-theme-success">Sync complete</div>
          )}

          {syncProgress.status === 'error' && (
            <div className="text-sm text-theme-error">Sync failed</div>
          )}

          <p className="text-xs text-theme-muted text-center max-w-36">
            Refreshes both sides, then syncs newer metadata
          </p>
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
            loadAndroidFiles(path);
          }}
          onRefresh={handleRefreshAndroid}
          onDeleteFiles={handleDeleteAndroidFiles}
          onDropFiles={handleDropOnAndroid}
          onRatingChange={handleAndroidRatingChange}
          onPlayFile={handlePlayAndroidFile}
          loading={androidLoading}
          isAndroid
          deviceConnected={!!device}
        />
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-4 py-2 bg-theme-secondary border-t border-theme text-sm text-theme-muted">
        <span>
          Local: {selectedLocalFiles.size} selected of {localFiles.length} files
        </span>
        <span>
          Android: {selectedAndroidFiles.size} selected of {androidFiles.length} files
        </span>
      </footer>
    </div>
  );
}

export default App;
