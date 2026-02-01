import { useState, useMemo, useCallback } from 'react';
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
  isDropTarget?: boolean;
}

type SortKey = 'title' | 'artist' | 'album' | 'rating' | 'lastMetadataUpdate';
type SortOrder = 'asc' | 'desc';

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

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist);
          break;
        case 'album':
          comparison = a.album.localeCompare(b.album);
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'lastMetadataUpdate':
          const aTime = a.lastMetadataUpdate?.getTime() || 0;
          const bTime = b.lastMetadataUpdate?.getTime() || 0;
          comparison = aTime - bTime;
          break;
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
      newSelection.clear();
      newSelection.add(file.path);
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

  const handleSelectAllFromMenu = useCallback(() => {
    onSelectFiles(new Set(files.map(f => f.path)));
    closeContextMenu();
  }, [files, onSelectFiles, closeContextMenu]);

  const handleDeselectAll = useCallback(() => {
    onSelectFiles(new Set());
    closeContextMenu();
  }, [onSelectFiles, closeContextMenu]);

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
      } catch (error) {
        console.error('Error parsing dropped files:', error);
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

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (files.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full text-gray-500 ${
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
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-500 pointer-events-none z-10 flex items-center justify-center">
          <span className="bg-blue-600 px-4 py-2 rounded text-white">Drop to add files</span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-800 text-left">
          <tr>
            <th className="p-2 w-8">
              <input
                type="checkbox"
                checked={selectedFiles.size === files.length && files.length > 0}
                onChange={handleSelectAll}
                className="rounded bg-gray-700 border-gray-600"
              />
            </th>
            <th
              className="p-2 cursor-pointer hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('title')}
            >
              Title <SortIcon column="title" />
            </th>
            <th
              className="p-2 cursor-pointer hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('artist')}
            >
              Artist <SortIcon column="artist" />
            </th>
            <th
              className="p-2 cursor-pointer hover:bg-gray-700 transition-colors"
              onClick={() => handleSort('album')}
            >
              Album <SortIcon column="album" />
            </th>
            <th
              className="p-2 cursor-pointer hover:bg-gray-700 transition-colors w-32"
              onClick={() => handleSort('rating')}
            >
              Rating <SortIcon column="rating" />
            </th>
            <th
              className="p-2 cursor-pointer hover:bg-gray-700 transition-colors w-32"
              onClick={() => handleSort('lastMetadataUpdate')}
            >
              Last Update <SortIcon column="lastMetadataUpdate" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file) => (
            <tr
              key={file.path}
              onClick={(e) => handleSelectFile(file, e)}
              onDoubleClick={() => onPlayFile?.(file.path)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              draggable
              onDragStart={(e) => handleDragStart(e, file)}
              className={`cursor-pointer border-b border-gray-800 transition-colors ${
                selectedFiles.has(file.path)
                  ? 'bg-blue-900 bg-opacity-50 hover:bg-blue-800'
                  : 'hover:bg-gray-800'
              }`}
            >
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => {}}
                  className="rounded bg-gray-700 border-gray-600"
                />
              </td>
              <td className="p-2 truncate max-w-xs" title={file.title}>
                {file.title}
              </td>
              <td className="p-2 truncate max-w-xs text-gray-400" title={file.artist}>
                {file.artist || '-'}
              </td>
              <td className="p-2 truncate max-w-xs text-gray-400" title={file.album}>
                {file.album || '-'}
              </td>
              <td className="p-2">
                <RatingStars
                  rating={file.rating}
                  editable={!!onRatingChange}
                  onChange={(rating) => onRatingChange?.(file.path, rating)}
                />
              </td>
              <td className="p-2 text-gray-400">
                {formatDate(file.lastMetadataUpdate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg py-1 z-50 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2"
            onClick={handleSelectAllFromMenu}
          >
            Select All
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2"
            onClick={handleDeselectAll}
          >
            Deselect All
          </button>
          <div className="border-t border-gray-700 my-1"></div>
          {onDeleteFiles && (
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-700 text-red-400 flex items-center gap-2"
              onClick={handleDelete}
            >
              Delete ({selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
