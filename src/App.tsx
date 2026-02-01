import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pane } from './components/Pane';
import { ThemeSelector } from './components/ThemeSelector';
import { BulkEditModal } from './components/BulkEditModal';
import { SettingsModal } from './components/SettingsModal';
import type { MusicFile, DeviceInfo, SyncProgress } from './types';

const STORAGE_KEY = 'msync_settings';

interface AppSettings {
  localPath: string | null;
  androidPath: string;
  customHeaderBg?: string;
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

  // Custom header settings
  const [customHeaderBg, setCustomHeaderBg] = useState<string | undefined>(settings.current.customHeaderBg);

  // Bulk edit modal state
  const [bulkEditFiles, setBulkEditFiles] = useState<MusicFile[] | null>(null);
  const [bulkEditSource, setBulkEditSource] = useState<'local' | 'android' | null>(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);

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
    } catch {
      // Load failed
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
    saveSettings({ localPath, androidPath, customHeaderBg });
  }, [localPath, androidPath, customHeaderBg]);

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

  // Settings handlers
  const handleSettingsSave = (newSettings: { customHeaderBg?: string }) => {
    setCustomHeaderBg(newSettings.customHeaderBg);
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
      <header className={`flex items-center justify-between px-4 py-2 header-floral border-b border-theme relative z-10 ${customHeaderBg ? 'has-custom-bg' : ''}`}>
        {customHeaderBg && (
          <>
            <div
              className="header-bg-image"
              style={{
                backgroundImage: `url(${customHeaderBg.startsWith('http') ? customHeaderBg : `file:///${customHeaderBg.replace(/\\/g, '/')}`})`
              }}
            />
            <div className="header-bg-overlay" />
          </>
        )}
        <h1
          className="text-3xl font-fancy text-white drop-shadow-lg tracking-wide relative z-10"
          style={{ textShadow: '0 0 20px rgba(167,139,250,0.5)' }}
        >
          msync
        </h1>

        <div className="flex items-center gap-3 relative z-10">
          {/* Sync button in header */}
          <button
            onClick={handleSync}
            disabled={!canSync || syncProgress.status === 'syncing'}
            className={`
              flex items-center gap-1.5 px-4 py-1.5 rounded-theme font-tech font-semibold text-sm transition-all
              ${canSync && syncProgress.status !== 'syncing'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg'
                : 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
              }
            `}
            title="Sync metadata between local and Android (newer wins)"
          >
            <span className="text-base">⇄</span>
            <span>{syncProgress.status === 'syncing' ? 'Syncing...' : 'Sync Metadata'}</span>
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
          onBulkEdit={handleBulkEditLocal}
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
          customHeaderBg={customHeaderBg}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
