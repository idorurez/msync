import { useState, useCallback, useRef, useEffect } from 'react';
import type { FolderNode } from '../types';

interface FolderTreeProps {
  node: FolderNode;
  onSelect: (path: string) => void;
  selectedPath?: string | null;
  isAndroid?: boolean;
  depth?: number;
  onDrop?: (filePaths: string[], targetFolder: string) => void;
  onContextMenu?: (event: React.MouseEvent, folderPath: string) => void;
  onRenameFolder?: (oldPath: string, newName: string) => void;
  renamingPath?: string | null;
  renamingValue?: string;
  onRenamingValueChange?: (value: string) => void;
  onRenamingCommit?: () => void;
  onRenamingCancel?: () => void;
}

export function FolderTree({
  node,
  onSelect,
  selectedPath,
  isAndroid = false,
  depth = 0,
  onDrop,
  onContextMenu,
  onRenameFolder,
  renamingPath,
  renamingValue,
  onRenamingValueChange,
  onRenamingCommit,
  onRenamingCancel,
}: FolderTreeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [children, setChildren] = useState<FolderNode[]>(node.children);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Update children when node changes (e.g., tree refreshed)
  useEffect(() => {
    setChildren(node.children);
  }, [node.children]);

  // Focus rename input when this node is being renamed
  useEffect(() => {
    if (renamingPath === node.path && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath, node.path]);

  const handleToggle = async () => {
    if (!isExpanded && children.length === 0) {
      setIsLoading(true);
      try {
        const tree = isAndroid
          ? await window.electronAPI.getAndroidFolderTree(node.path)
          : await window.electronAPI.getLocalFolderTree(node.path);
        setChildren(tree.children);
      } catch {
        // Failed to load folder
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleClick = () => {
    onSelect(node.path);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, node.path);
    }
  }, [onContextMenu, node.path]);

  // Drop target handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (onDrop) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  }, [onDrop]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (onDrop) {
      try {
        const data = e.dataTransfer.getData('application/json');
        const droppedFiles = JSON.parse(data) as Array<{ path: string }>;
        const filePaths = droppedFiles.map(f => f.path);
        onDrop(filePaths, node.path);
      } catch {
        // Drop failed
      }
    }
  }, [onDrop, node.path]);

  const isSelected = selectedPath === node.path;
  const hasChildren = children.length > 0 || !isExpanded;
  const isRenaming = renamingPath === node.path;

  return (
    <div className="select-none font-tech text-xs">
      <div
        className={`flex items-center gap-0.5 py-0.5 px-1 rounded cursor-pointer transition-colors ${
          isDragOver
            ? 'bg-blue-700 bg-opacity-60'
            : isSelected
              ? 'bg-blue-900 bg-opacity-70 text-white'
              : 'hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-white text-[10px]"
        >
          {isLoading ? (
            <span className="animate-spin">&#x27F3;</span>
          ) : hasChildren ? (
            isExpanded ? '\u25BC' : '\u25B6'
          ) : (
            <span className="w-2" />
          )}
        </button>

        {/* Folder icon */}
        <span className="text-yellow-500 text-xs">&#x1F4C1;</span>

        {/* Folder name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renamingValue || ''}
            onChange={(e) => onRenamingValueChange?.(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                onRenamingCommit?.();
              } else if (e.key === 'Escape') {
                onRenamingCancel?.();
              }
            }}
            onBlur={() => onRenamingCommit?.()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-gray-900 text-white text-xs px-1 py-0 rounded border border-blue-400 focus:outline-none min-w-0"
          />
        ) : (
          <span
            className="flex-1 truncate"
            title={node.path}
          >
            {node.name}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <div>
          {children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              onSelect={onSelect}
              selectedPath={selectedPath}
              isAndroid={isAndroid}
              depth={depth + 1}
              onDrop={onDrop}
              onContextMenu={onContextMenu}
              onRenameFolder={onRenameFolder}
              renamingPath={renamingPath}
              renamingValue={renamingValue}
              onRenamingValueChange={onRenamingValueChange}
              onRenamingCommit={onRenamingCommit}
              onRenamingCancel={onRenamingCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
