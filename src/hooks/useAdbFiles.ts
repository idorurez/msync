import { useState, useCallback, useEffect } from 'react';
import type { MusicFile, FolderNode, DeviceInfo } from '../types';

export function useAdbFiles() {
  const [files, setFiles] = useState<MusicFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [currentPath, setCurrentPath] = useState('/sdcard/Music');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up device event listeners
  useEffect(() => {
    window.electronAPI.onDeviceConnected((deviceInfo) => {
      setDevice(deviceInfo);
      setError(null);
    });

    window.electronAPI.onDeviceDisconnected(() => {
      setDevice(null);
      setFiles([]);
      setFolderTree(null);
    });

    // Try to connect on mount
    window.electronAPI.connectDevice().then(setDevice);
  }, []);

  const connect = useCallback(async () => {
    try {
      const deviceInfo = await window.electronAPI.connectDevice();
      setDevice(deviceInfo);
      return deviceInfo;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect device');
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    window.electronAPI.disconnectDevice();
    setDevice(null);
    setFiles([]);
    setFolderTree(null);
  }, []);

  const scanFolder = useCallback(async (path: string) => {
    if (!device) {
      setError('No device connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scannedFiles = await window.electronAPI.scanAndroidFolder(path);
      setFiles(scannedFiles);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan folder');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [device]);

  const loadFolderTree = useCallback(async (path: string) => {
    if (!device) {
      setError('No device connected');
      return null;
    }

    try {
      const tree = await window.electronAPI.getAndroidFolderTree(path);
      setFolderTree(tree);
      return tree;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder tree');
      return null;
    }
  }, [device]);

  const refresh = useCallback(() => {
    if (currentPath) {
      scanFolder(currentPath);
    }
  }, [currentPath, scanFolder]);

  const changePath = useCallback((path: string) => {
    setCurrentPath(path);
    scanFolder(path);
  }, [scanFolder]);

  return {
    files,
    folderTree,
    currentPath,
    device,
    loading,
    error,
    connect,
    disconnect,
    scanFolder,
    loadFolderTree,
    refresh,
    changePath
  };
}
