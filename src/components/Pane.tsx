import { useState } from 'react';
import { FileTable } from './FileTable';
import { FolderTree } from './FolderTree';
import type { MusicFile, FolderNode } from '../types';

interface PaneProps {
  title: string;
  path: string | null;
  files: MusicFile[];
  selectedFiles: Set<string>;
  onSelectFiles: (files: Set<string>) => void;
  onSelectFolder?: () => void;
  onPathChange?: (path: string) => void;
  onRefresh: () => void;
  onDeleteFiles?: (paths: string[]) => void;
  onDropFiles?: (files: MusicFile[]) => void;
  onRatingChange?: (filePath: string, rating: number) => void;
  onPlayFile?: (filePath: string) => void;
  loading: boolean;
  isAndroid?: boolean;
  deviceConnected?: boolean;
}

export function Pane({
  title,
  path,
  files,
  selectedFiles,
  onSelectFiles,
  onSelectFolder,
  onPathChange,
  onRefresh,
  onDeleteFiles,
  onDropFiles,
  onRatingChange,
  onPlayFile,
  loading,
  isAndroid = false,
  deviceConnected = true
}: PaneProps) {
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [showTree, setShowTree] = useState(false);

  const handleLoadTree = async () => {
    if (!path) return;

    try {
      const tree = isAndroid
        ? await window.electronAPI.getAndroidFolderTree(path)
        : await window.electronAPI.getLocalFolderTree(path);
      setFolderTree(tree);
      setShowTree(true);
    } catch (error) {
      console.error('Error loading folder tree:', error);
    }
  };

  const handleFolderSelect = (folderPath: string) => {
    if (onPathChange) {
      onPathChange(folderPath);
    }
    setShowTree(false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
      {/* Pane header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h2 className="font-medium text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {!isAndroid && (
            <button
              onClick={onSelectFolder}
              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Browse
            </button>
          )}
          {path && (
            <>
              <button
                onClick={handleLoadTree}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Browse folders"
              >
                Folders
              </button>
              <button
                onClick={onRefresh}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Path bar */}
      {path && (
        <div className="px-4 py-2 bg-gray-850 border-b border-gray-700 text-sm text-gray-400 truncate">
          {path}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {!path && !isAndroid ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="mb-2">No folder selected</p>
              <button
                onClick={onSelectFolder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-white"
              >
                Select Folder
              </button>
            </div>
          </div>
        ) : isAndroid && !deviceConnected ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="mb-2">No Android device connected</p>
              <p className="text-sm">Connect a device with USB debugging enabled</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Scanning files...</p>
            </div>
          </div>
        ) : (
          <>
            <FileTable
              files={files}
              selectedFiles={selectedFiles}
              onSelectFiles={onSelectFiles}
              onDeleteFiles={onDeleteFiles}
              onDropFiles={onDropFiles}
              onRatingChange={onRatingChange}
              onPlayFile={onPlayFile}
              isDropTarget={!!onDropFiles}
            />

            {/* Folder tree overlay */}
            {showTree && folderTree && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-95 z-10">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Select Folder</h3>
                    <button
                      onClick={() => setShowTree(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <FolderTree
                    node={folderTree}
                    onSelect={handleFolderSelect}
                    isAndroid={isAndroid}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
