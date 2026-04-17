import { useState, useMemo, useCallback, useRef } from 'react';
import { RatingStars } from './RatingStars';
import type { MusicFile } from '../types';

interface FileTableProps {
  files: MusicFile[];
  selectedFiles: Set<string>;
  onSelectFiles: (files: Set<string>) => void;
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
  isDropTarget?: boolean;
}

type SortKey = 'filename' | 'title' | 'artist' | 'album' | 'genre' | 'format' | 'size' | 'bitrate' | 'rating' | 'lastMetadataUpdate';
type SortOrder = 'asc' | 'desc';

type ColumnKey = 'checkbox' | SortKey;

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  checkbox: 28,
  title: 180,
  artist: 120,
  album: 120,
  genre: 100,
  format: 50,
  bitrate: 48,
  size: 60,
  rating: 80,
  lastMetadataUpdate: 80,
  filename: 150,
};

const MIN_COL_WIDTH = 30;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  filePath: string | null;
}

export function FileTable({
  files,
  selectedFiles,
  onSelectFiles,
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
  isDropTarget = false
}: FileTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    filePath: null
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [isResizingColumn, setIsResizingColumn] = useState(false);
  const resizingCol = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);

  // Column resize: use a full-screen overlay to capture mouse events cleanly
  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: ColumnKey) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = { key: colKey, startX: e.clientX, startWidth: columnWidths[colKey] };
    setIsResizingColumn(true);
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: React.MouseEvent) => {
    if (!resizingCol.current) return;
    const delta = e.clientX - resizingCol.current.startX;
    const newWidth = Math.max(MIN_COL_WIDTH, resizingCol.current.startWidth + delta);
    setColumnWidths(prev => ({ ...prev, [resizingCol.current!.key]: newWidth }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingCol.current = null;
    setIsResizingColumn(false);
  }, []);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist);
          break;
        case 'album':
          comparison = a.album.localeCompare(b.album);
          break;
        case 'genre':
          comparison = a.genre.localeCompare(b.genre);
          break;
        case 'format':
          comparison = a.format.localeCompare(b.format);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'bitrate':
          comparison = (a.bitrate ?? 0) - (b.bitrate ?? 0);
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'lastMetadataUpdate': {
          const aTime = a.lastMetadataUpdate?.getTime() || 0;
          const bTime = b.lastMetadataUpdate?.getTime() || 0;
          comparison = aTime - bTime;
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [files, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      onSelectFiles(new Set());
    } else {
      onSelectFiles(new Set(files.map(f => f.path)));
    }
  };

  const handleSelectFile = (file: MusicFile, event: React.MouseEvent) => {
    const newSelection = new Set(selectedFiles);

    if (event.shiftKey && selectedFiles.size > 0) {
      const lastSelected = Array.from(selectedFiles).pop();
      const lastIndex = sortedFiles.findIndex(f => f.path === lastSelected);
      const currentIndex = sortedFiles.findIndex(f => f.path === file.path);

      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);

      for (let i = start; i <= end; i++) {
        newSelection.add(sortedFiles[i].path);
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (newSelection.has(file.path)) {
        newSelection.delete(file.path);
      } else {
        newSelection.add(file.path);
      }
    } else {
      if (newSelection.has(file.path) && newSelection.size === 1) {
        // Clicking the only selected file deselects it
        newSelection.clear();
      } else {
        newSelection.clear();
        newSelection.add(file.path);
      }
    }

    onSelectFiles(newSelection);
  };

  // Context menu handlers
  const handleContextMenu = useCallback((event: React.MouseEvent, file: MusicFile) => {
    event.preventDefault();

    // Select the file if not already selected
    if (!selectedFiles.has(file.path)) {
      onSelectFiles(new Set([file.path]));
    }

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      filePath: file.path
    });
  }, [selectedFiles, onSelectFiles]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const handleDelete = useCallback(() => {
    if (onDeleteFiles && selectedFiles.size > 0) {
      onDeleteFiles(Array.from(selectedFiles));
    }
    closeContextMenu();
  }, [onDeleteFiles, selectedFiles, closeContextMenu]);

  const handleBulkEdit = useCallback(() => {
    if (onBulkEdit && selectedFiles.size > 0) {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.path));
      onBulkEdit(selectedFileObjects);
    }
    closeContextMenu();
  }, [onBulkEdit, selectedFiles, files, closeContextMenu]);

  const handleShowInfo = useCallback(() => {
    if (onShowInfo && contextMenu.filePath) {
      const file = files.find(f => f.path === contextMenu.filePath);
      if (file) {
        onShowInfo(file);
      }
    }
    closeContextMenu();
  }, [onShowInfo, contextMenu.filePath, files, closeContextMenu]);

  const handleFixMetadata = useCallback(() => {
    if (onFixMetadata && selectedFiles.size > 0) {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.path));
      onFixMetadata(selectedFileObjects);
    }
    closeContextMenu();
  }, [onFixMetadata, selectedFiles, files, closeContextMenu]);

  const handleFetchAlbumArt = useCallback(() => {
    if (onFetchAlbumArt && selectedFiles.size > 0) {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.path));
      onFetchAlbumArt(selectedFileObjects);
    }
    closeContextMenu();
  }, [onFetchAlbumArt, selectedFiles, files, closeContextMenu]);

  const handleRenameFromMenu = useCallback(() => {
    if (contextMenu.filePath) {
      const file = files.find(f => f.path === contextMenu.filePath);
      if (file) {
        setRenamingPath(file.path);
        setRenamingValue(file.filename);
      }
    }
    closeContextMenu();
  }, [contextMenu.filePath, files, closeContextMenu]);

  const handleSelectAllFromMenu = useCallback(() => {
    onSelectFiles(new Set(files.map(f => f.path)));
    closeContextMenu();
  }, [files, onSelectFiles, closeContextMenu]);

  const handleDeselectAll = useCallback(() => {
    onSelectFiles(new Set());
    closeContextMenu();
  }, [onSelectFiles, closeContextMenu]);

  const handleMoveFiles = useCallback(async () => {
    if (onMoveFiles && selectedFiles.size > 0) {
      const targetDir = await window.electronAPI.selectFolder();
      if (targetDir) {
        onMoveFiles(Array.from(selectedFiles), targetDir);
      }
    }
    closeContextMenu();
  }, [onMoveFiles, selectedFiles, closeContextMenu]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: React.DragEvent, file: MusicFile) => {
    // If dragging a non-selected file, select only it
    if (!selectedFiles.has(file.path)) {
      onSelectFiles(new Set([file.path]));
    }

    // Get all selected files for dragging
    const draggedFiles = files.filter(f => selectedFiles.has(f.path) || f.path === file.path);

    event.dataTransfer.setData('application/json', JSON.stringify(draggedFiles));
    event.dataTransfer.effectAllowed = 'copy';
  }, [files, selectedFiles, onSelectFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (isDropTarget) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, [isDropTarget]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    if (onDropFiles) {
      try {
        const data = event.dataTransfer.getData('application/json');
        const droppedFiles = JSON.parse(data) as MusicFile[];
        onDropFiles(droppedFiles);
      } catch {
        // Drop failed
      }
    }
  }, [onDropFiles]);

  // Close context menu on click outside
  const handleTableClick = useCallback(() => {
    if (contextMenu.visible) {
      closeContextMenu();
    }
  }, [contextMenu.visible, closeContextMenu]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <span className="text-gray-600 ml-1">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString();
    } catch {
      return '-';
    }
  };

  if (files.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full text-gray-500 font-tech text-xs ${
          isDragOver ? 'bg-blue-900 bg-opacity-20 border-2 border-dashed border-blue-500' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver ? 'Drop files here' : 'No audio files found'}
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto relative ${
        isDragOver ? 'bg-blue-900 bg-opacity-20' : ''
      }`}
      onClick={handleTableClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-screen overlay during column resize to capture mouse events */}
      {isResizingColumn && (
        <div
          className="fixed inset-0 z-[9999] select-none"
          style={{ cursor: 'col-resize' }}
          onMouseMove={handleResizeMove}
          onMouseUp={handleResizeEnd}
        />
      )}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-500 pointer-events-none z-10 flex items-center justify-center">
          <span className="bg-blue-600 px-4 py-2 rounded text-white">Drop to add files</span>
        </div>
      )}

      <table className="w-full font-tech text-xs" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: columnWidths.checkbox }} />
          <col style={{ width: columnWidths.title }} />
          <col style={{ width: columnWidths.artist }} />
          <col style={{ width: columnWidths.album }} />
          <col style={{ width: columnWidths.genre }} />
          <col style={{ width: columnWidths.format }} />
          <col style={{ width: columnWidths.bitrate }} />
          <col style={{ width: columnWidths.size }} />
          <col style={{ width: columnWidths.rating }} />
          <col style={{ width: columnWidths.lastMetadataUpdate }} />
        </colgroup>
        <thead className="sticky top-0 bg-gray-800 text-left z-20">
          <tr>
            <th className="px-1 py-0.5">
              <input
                type="checkbox"
                checked={selectedFiles.size === files.length && files.length > 0}
                onChange={handleSelectAll}
                className="rounded bg-gray-700 border-gray-600 w-3 h-3"
              />
            </th>
            {([
              ['title', 'Title'],
              ['artist', 'Artist'],
              ['album', 'Album'],
              ['genre', 'Genre'],
              ['format', 'Fmt'],
              ['bitrate', 'Kbps'],
              ['size', 'Size'],
              ['rating', 'Rating'],
              ['lastMetadataUpdate', 'Updated'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <th
                key={key}
                className="px-1 py-0.5 cursor-pointer hover:bg-gray-700 transition-colors text-[10px] uppercase tracking-wide relative overflow-hidden"
                onClick={() => handleSort(key)}
              >
                <span className="truncate block pr-2">{label} <SortIcon column={key} /></span>
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/60 active:bg-blue-500 z-30"
                  onMouseDown={(e) => handleResizeStart(e, key)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file) => (
            <tr
              key={file.path}
              onClick={(e) => handleSelectFile(file, e)}
              onDoubleClick={() => onPlayFile?.(file.path)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              draggable={renamingPath !== file.path}
              onDragStart={(e) => handleDragStart(e, file)}
              className={`cursor-pointer border-b border-gray-800/50 transition-colors ${
                selectedFiles.has(file.path)
                  ? 'bg-blue-900 bg-opacity-50 hover:bg-blue-800'
                  : 'hover:bg-gray-800'
              }`}
            >
              <td className="px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => {}}
                  className="rounded bg-gray-700 border-gray-600 w-3 h-3"
                />
              </td>
              <td className="px-1 py-0.5 overflow-hidden" title={renamingPath === file.path ? file.filename : file.title}>
                {renamingPath === file.path ? (
                  <input
                    type="text"
                    value={renamingValue}
                    ref={(node) => { if (node && document.activeElement !== node) { node.focus(); node.select(); } }}
                    onChange={(e) => setRenamingValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        const trimmed = renamingValue.trim();
                        if (trimmed && trimmed !== file.filename) {
                          onRenameFile?.(file.path, trimmed);
                        }
                        setRenamingPath(null);
                      } else if (e.key === 'Escape') {
                        setRenamingPath(null);
                      }
                    }}
                    onBlur={() => {
                      const trimmed = renamingValue.trim();
                      if (trimmed && trimmed !== file.filename) {
                        onRenameFile?.(file.path, trimmed);
                      }
                      setRenamingPath(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full bg-gray-900 text-white text-xs px-1.5 py-0.5 rounded border border-blue-400 cursor-text focus:outline-none focus:border-blue-300"
                  />
                ) : (
                  <span className="truncate block">{file.title}</span>
                )}
              </td>
              <td className="px-1 py-0.5 truncate overflow-hidden text-gray-400" title={file.artist}>
                {file.artist || '-'}
              </td>
              <td className="px-1 py-0.5 truncate overflow-hidden text-gray-400" title={file.album}>
                {file.album || '-'}
              </td>
              <td className="px-1 py-0.5 truncate overflow-hidden text-gray-400" title={file.genre}>
                {file.genre || '-'}
              </td>
              <td className="px-1 py-0.5 text-gray-500 text-[10px] uppercase overflow-hidden truncate">
                {file.format}
              </td>
              <td className="px-1 py-0.5 text-gray-500 text-[10px] overflow-hidden truncate">
                {file.bitrate ?? '—'}
              </td>
              <td className="px-1 py-0.5 text-gray-500 text-[10px] overflow-hidden truncate">
                {formatSize(file.size)}
              </td>
              <td className="px-1 py-0.5 overflow-hidden">
                <RatingStars
                  rating={file.rating}
                  editable={!!onRatingChange}
                  onChange={(rating) => onRatingChange?.(file.path, rating)}
                  size="small"
                />
              </td>
              <td className="px-1 py-0.5 text-gray-400 text-[10px] overflow-hidden truncate">
                {formatDate(file.lastMetadataUpdate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-0.5 z-50 min-w-32 font-tech text-xs"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 320),
          }}
        >
          <button
            className="w-full px-2 py-1 text-left hover:bg-gray-700 flex items-center gap-1"
            onClick={handleSelectAllFromMenu}
          >
            Select All
          </button>
          <button
            className="w-full px-2 py-1 text-left hover:bg-gray-700 flex items-center gap-1"
            onClick={handleDeselectAll}
          >
            Deselect All
          </button>
          {onShowInfo && (
            <>
              <div className="border-t border-gray-700 my-0.5"></div>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-blue-400 flex items-center gap-1"
                onClick={handleShowInfo}
              >
                ℹ️ Show Info
              </button>
            </>
          )}
          {onBulkEdit && selectedFiles.size > 0 && (
            <>
              <div className="border-t border-gray-700 my-0.5"></div>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-purple-400 flex items-center gap-1"
                onClick={handleBulkEdit}
              >
                Edit Metadata ({selectedFiles.size})
              </button>
            </>
          )}
          {onFixMetadata && selectedFiles.size > 0 && (
            <>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-green-400 flex items-center gap-1"
                onClick={handleFixMetadata}
              >
                🔧 Fix from Filename ({selectedFiles.size})
              </button>
            </>
          )}
          {onFetchAlbumArt && selectedFiles.size > 0 && (
            <>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-blue-400 flex items-center gap-1"
                onClick={handleFetchAlbumArt}
              >
                🖼 Find Album Art ({selectedFiles.size})
              </button>
            </>
          )}
          {onRenameFile && contextMenu.filePath && (
            <>
              <div className="border-t border-gray-700 my-0.5"></div>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-yellow-400 flex items-center gap-1"
                onClick={handleRenameFromMenu}
              >
                ✏ Rename
              </button>
            </>
          )}
          {onMoveFiles && selectedFiles.size > 0 && (
            <>
              <div className="border-t border-gray-700 my-0.5"></div>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-cyan-400 flex items-center gap-1"
                onClick={handleMoveFiles}
              >
                Move to... ({selectedFiles.size})
              </button>
            </>
          )}
          {onDeleteFiles && (
            <>
              <div className="border-t border-gray-700 my-0.5"></div>
              <button
                className="w-full px-2 py-1 text-left hover:bg-gray-700 text-red-400 flex items-center gap-1"
                onClick={handleDelete}
              >
                Delete ({selectedFiles.size})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
