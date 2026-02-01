import { useState, useRef } from 'react';
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
  onBulkEdit?: (files: MusicFile[]) => void;
  loading: boolean;
  isAndroid?: boolean;
  deviceConnected?: boolean;
  error?: string | null;
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
  onBulkEdit,
  loading,
  isAndroid = false,
  deviceConnected = true,
  error = null
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
    } catch {
      // Failed to load tree
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
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-b border-gray-700">
        <h2 className="font-tech font-semibold text-white text-xs uppercase tracking-wider">{title}</h2>
        <div className="flex items-center gap-1">
          {!isAndroid && (
            <button
              onClick={onSelectFolder}
              className="px-2 py-0.5 text-xs font-tech bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Browse
            </button>
          )}
          {path && (
            <>
              <button
                onClick={handleLoadTree}
                className="px-2 py-0.5 text-xs font-tech bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                title="Browse folders"
              >
                Folders
              </button>
              <button
                onClick={onRefresh}
                className="px-2 py-0.5 text-xs font-tech bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                disabled={loading}
              >
                {loading ? '...' : 'Refresh'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Path bar */}
      {(path || isAndroid) && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-850 border-b border-gray-700">
          {isAndroid ? (
            <input
              type="text"
              value={path || ''}
              onChange={(e) => onPathChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && path) {
                  onRefresh();
                }
              }}
              placeholder="/sdcard/Music"
              className="flex-1 bg-transparent text-xs font-tech text-gray-300 outline-none placeholder-gray-600"
            />
          ) : (
            <span className="flex-1 text-xs font-tech text-gray-400 truncate">
              {path}
            </span>
          )}
          {path && (
            <button
              onClick={onRefresh}
              className="text-[10px] text-gray-500 hover:text-gray-300 font-tech"
              title="Press Enter or click to refresh"
            >
              Go
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {!path && !isAndroid ? (
          <div className="flex items-center justify-center h-full text-gray-500 font-tech">
            <div className="text-center">
              <p className="mb-2 text-xs">No folder selected</p>
              <button
                onClick={onSelectFolder}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors text-white font-tech"
              >
                Select Folder
              </button>
            </div>
          </div>
        ) : isAndroid && !deviceConnected ? (
          <div className="flex items-center justify-center h-full text-gray-500 font-tech">
            <div className="text-center">
              <p className="mb-1 text-xs">No Android device connected</p>
              <p className="text-[10px]">Connect a device with USB debugging enabled</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-gray-500 font-tech">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
              <p className="text-xs">Scanning...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-gray-500 font-tech">
            <div className="text-center max-w-xs">
              <p className="mb-2 text-xs text-red-400">{error}</p>
              {isAndroid && (
                <div className="text-[10px] text-gray-500 space-y-1">
                  <p>Try these paths:</p>
                  <p className="text-gray-400">/sdcard/Music</p>
                  <p className="text-gray-400">/storage/emulated/0/Music</p>
                  <p className="text-gray-400">/sdcard/Download</p>
                </div>
              )}
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
              onBulkEdit={onBulkEdit}
              isDropTarget={!!onDropFiles}
            />

            {/* Folder tree overlay */}
            {showTree && folderTree && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-95 z-10 font-tech">
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-xs uppercase tracking-wide">Select Folder</h3>
                    <button
                      onClick={() => setShowTree(false)}
                      className="text-gray-400 hover:text-white text-xs"
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
