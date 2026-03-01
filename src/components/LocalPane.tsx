import { useState, useEffect, useCallback, useRef } from 'react';
import { FileTable } from './FileTable';
import { FolderTree } from './FolderTree';
import type { MusicFile, FolderNode } from '../types';

interface LocalPaneProps {
  path: string | null;
  files: MusicFile[];
  selectedFiles: Set<string>;
  onSelectFiles: (files: Set<string>) => void;
  onSelectFolder: () => void;
  onRefresh: () => void;
  onDeleteFiles?: (paths: string[]) => void;
  onDropFiles?: (files: MusicFile[]) => void;
  onRatingChange?: (filePath: string, rating: number) => void;
  onPlayFile?: (filePath: string) => void;
  onBulkEdit?: (files: MusicFile[]) => void;
  onShowInfo?: (file: MusicFile) => void;
  onFixMetadata?: (files: MusicFile[]) => void;
  onFetchAlbumArt?: (files: MusicFile[]) => void;
  onRenameFile?: (filePath: string, newFilename: string) => void;
  onMoveFiles?: (filePaths: string[], targetDir: string) => void;
  loading: boolean;
}

interface FolderContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folderPath: string;
}

export function LocalPane({
  path,
  files,
  selectedFiles,
  onSelectFiles,
  onSelectFolder,
  onRefresh,
  onDeleteFiles,
  onDropFiles,
  onRatingChange,
  onPlayFile,
  onBulkEdit,
  onShowInfo,
  onFixMetadata,
  onFetchAlbumArt,
  onRenameFile,
  onMoveFiles,
  loading,
}: LocalPaneProps) {
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [treeWidth, setTreeWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Folder context menu
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    folderPath: '',
  });

  // Inline rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  // Load folder tree when path changes
  useEffect(() => {
    if (path) {
      loadTree(path);
    } else {
      setFolderTree(null);
      setSelectedFolder(null);
    }
  }, [path]);

  const loadTree = async (treePath: string) => {
    try {
      const tree = await window.electronAPI.getLocalFolderTree(treePath);
      setFolderTree(tree);
    } catch {
      setFolderTree(null);
    }
  };

  // Handle folder selection in tree
  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
  };

  // Filter files by selected folder
  const getFilteredFiles = () => {
    let filtered = files;

    // Filter by selected folder
    if (selectedFolder && path && selectedFolder !== path) {
      filtered = filtered.filter((f) => {
        // Get the directory of the file using the OS separator
        const sep = f.path.includes('\\') ? '\\' : '/';
        const fileDir = f.path.substring(0, f.path.lastIndexOf(sep));
        return fileDir === selectedFolder;
      });
    }

    // Filter by search query
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      filtered = filtered.filter((f) => f.filename.toLowerCase().includes(q));
    }

    return filtered;
  };

  // Resize handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        const maxWidth = containerRect.width * 0.5;
        setTreeWidth(Math.max(120, Math.min(newWidth, maxWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Handle dropping files on a folder in the tree
  const handleTreeDrop = useCallback(async (filePaths: string[], targetFolder: string) => {
    if (onMoveFiles) {
      onMoveFiles(filePaths, targetFolder);
    }
  }, [onMoveFiles]);

  // Folder context menu handlers
  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderPath: string) => {
    setFolderContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      folderPath,
    });
  }, []);

  const closeFolderContextMenu = useCallback(() => {
    setFolderContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleNewFolder = useCallback(async () => {
    const parentPath = folderContextMenu.folderPath;
    closeFolderContextMenu();
    const name = prompt('New folder name:');
    if (!name) return;
    try {
      await window.electronAPI.createLocalFolder(parentPath, name);
      if (path) loadTree(path);
    } catch (error) {
      alert('Error creating folder: ' + error);
    }
  }, [folderContextMenu.folderPath, closeFolderContextMenu, path]);

  const handleDeleteFolder = useCallback(async () => {
    const folderPath = folderContextMenu.folderPath;
    closeFolderContextMenu();
    if (folderPath === path) {
      alert('Cannot delete the root folder.');
      return;
    }
    if (!confirm(`Delete folder and all its contents?\n\n${folderPath}`)) return;
    try {
      await window.electronAPI.deleteLocalFolder(folderPath);
      if (selectedFolder === folderPath) setSelectedFolder(null);
      if (path) {
        loadTree(path);
        onRefresh();
      }
    } catch (error) {
      alert('Error deleting folder: ' + error);
    }
  }, [folderContextMenu.folderPath, closeFolderContextMenu, path, selectedFolder, onRefresh]);

  const handleStartRename = useCallback(() => {
    const folderPath = folderContextMenu.folderPath;
    closeFolderContextMenu();
    // Extract just the folder name
    const sep = folderPath.includes('\\') ? '\\' : '/';
    const name = folderPath.substring(folderPath.lastIndexOf(sep) + 1);
    setRenamingPath(folderPath);
    setRenamingValue(name);
  }, [folderContextMenu.folderPath, closeFolderContextMenu]);

  const handleRenamingCommit = useCallback(async () => {
    if (renamingPath && renamingValue.trim()) {
      const sep = renamingPath.includes('\\') ? '\\' : '/';
      const oldName = renamingPath.substring(renamingPath.lastIndexOf(sep) + 1);
      if (renamingValue.trim() !== oldName) {
        try {
          await window.electronAPI.renameLocalFolder(renamingPath, renamingValue.trim());
          if (path) {
            loadTree(path);
            onRefresh();
          }
        } catch (error) {
          alert('Error renaming folder: ' + error);
        }
      }
    }
    setRenamingPath(null);
    setRenamingValue('');
  }, [renamingPath, renamingValue, path, onRefresh]);

  const handleRenamingCancel = useCallback(() => {
    setRenamingPath(null);
    setRenamingValue('');
  }, []);

  // Close folder context menu on click outside
  useEffect(() => {
    if (!folderContextMenu.visible) return;
    const handler = () => closeFolderContextMenu();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [folderContextMenu.visible, closeFolderContextMenu]);

  const filteredFiles = getFilteredFiles();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-900" ref={containerRef}>
      {/* Pane header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-b border-gray-700">
        <h2 className="font-tech font-semibold text-white text-xs uppercase tracking-wider">Source (Local)</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onSelectFolder}
            className="px-2 py-0.5 text-xs font-tech bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Browse
          </button>
          {path && (
            <button
              onClick={onRefresh}
              className="px-2 py-0.5 text-xs font-tech bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              disabled={loading}
            >
              {loading ? '...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Path bar */}
      {path && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-850 border-b border-gray-700">
          <span className="flex-1 text-xs font-tech text-gray-400 truncate">{path}</span>
        </div>
      )}

      {/* Filter bar */}
      {path && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-850 border-b border-gray-700">
          <span className="text-[10px] text-gray-500 font-tech">Filter:</span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="filename..."
            className="flex-1 bg-transparent text-xs font-tech text-gray-300 outline-none placeholder-gray-600"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="text-[10px] text-gray-500 hover:text-gray-300 font-tech leading-none"
              title="Clear filter"
            >
              &#x2715;
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative flex">
        {!path ? (
          <div className="flex items-center justify-center h-full w-full text-gray-500 font-tech">
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
        ) : loading ? (
          <div className="flex items-center justify-center h-full w-full text-gray-500 font-tech">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
              <p className="text-xs">Scanning...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Folder tree sidebar */}
            {folderTree && (
              <>
                <div
                  className="overflow-y-auto overflow-x-hidden border-r border-gray-700 flex-shrink-0"
                  style={{ width: treeWidth }}
                >
                  <div className="py-1">
                    {/* "All Files" option at top */}
                    <div
                      className={`flex items-center gap-1 py-0.5 px-2 cursor-pointer font-tech text-xs transition-colors ${
                        selectedFolder === null || selectedFolder === path
                          ? 'bg-blue-900 bg-opacity-70 text-white'
                          : 'hover:bg-gray-800 text-gray-400'
                      }`}
                      onClick={() => setSelectedFolder(null)}
                    >
                      <span className="text-[10px]">&#x1F4C2;</span>
                      <span className="truncate">All Files</span>
                      <span className="ml-auto text-[10px] text-gray-500">{files.length}</span>
                    </div>
                    <div className="border-b border-gray-700/50 my-0.5" />
                    <FolderTree
                      node={folderTree}
                      onSelect={handleFolderSelect}
                      selectedPath={selectedFolder}
                      onDrop={handleTreeDrop}
                      onContextMenu={handleFolderContextMenu}
                      renamingPath={renamingPath}
                      renamingValue={renamingValue}
                      onRenamingValueChange={setRenamingValue}
                      onRenamingCommit={handleRenamingCommit}
                      onRenamingCancel={handleRenamingCancel}
                    />
                  </div>
                </div>

                {/* Resize handle */}
                <div
                  className={`w-1 cursor-col-resize flex-shrink-0 transition-colors ${
                    isResizing ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onMouseDown={handleResizeStart}
                />
              </>
            )}

            {/* File table */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <FileTable
                files={filteredFiles}
                selectedFiles={selectedFiles}
                onSelectFiles={onSelectFiles}
                onDeleteFiles={onDeleteFiles}
                onDropFiles={onDropFiles}
                onRatingChange={onRatingChange}
                onPlayFile={onPlayFile}
                onBulkEdit={onBulkEdit}
                onShowInfo={onShowInfo}
                onFixMetadata={onFixMetadata}
                onFetchAlbumArt={onFetchAlbumArt}
                onRenameFile={onRenameFile}
                onMoveFiles={onMoveFiles}
                isDropTarget={!!onDropFiles}
              />
            </div>
          </>
        )}

        {/* Folder context menu */}
        {folderContextMenu.visible && (
          <div
            className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-0.5 z-50 min-w-32 font-tech text-xs"
            style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-2 py-1 text-left hover:bg-gray-700 text-green-400 flex items-center gap-1"
              onClick={handleNewFolder}
            >
              New Folder
            </button>
            <div className="border-t border-gray-700 my-0.5" />
            <button
              className="w-full px-2 py-1 text-left hover:bg-gray-700 text-yellow-400 flex items-center gap-1"
              onClick={handleStartRename}
            >
              Rename
            </button>
            {folderContextMenu.folderPath !== path && (
              <>
                <div className="border-t border-gray-700 my-0.5" />
                <button
                  className="w-full px-2 py-1 text-left hover:bg-gray-700 text-red-400 flex items-center gap-1"
                  onClick={handleDeleteFolder}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
