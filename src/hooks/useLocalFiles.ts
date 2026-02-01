import { useState, useCallback } from 'react';
import type { MusicFile, FolderNode } from '../types';

export function useLocalFiles() {
  const [files, setFiles] = useState<MusicFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFolder = useCallback(async () => {
    try {
      const path = await window.electronAPI.selectFolder();
      if (path) {
        setCurrentPath(path);
        return path;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select folder');
      return null;
    }
  }, []);

  const scanFolder = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const scannedFiles = await window.electronAPI.scanLocalFolder(path);
      setFiles(scannedFiles);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan folder');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolderTree = useCallback(async (path: string) => {
    try {
      const tree = await window.electronAPI.getLocalFolderTree(path);
      setFolderTree(tree);
      return tree;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder tree');
      return null;
    }
  }, []);

  const refresh = useCallback(() => {
    if (currentPath) {
      scanFolder(currentPath);
    }
  }, [currentPath, scanFolder]);

  return {
    files,
    folderTree,
    currentPath,
    loading,
    error,
    selectFolder,
    scanFolder,
    loadFolderTree,
    refresh
  };
}
