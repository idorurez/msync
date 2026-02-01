import { useState } from 'react';
import type { FolderNode } from '../types';

interface FolderTreeProps {
  node: FolderNode;
  onSelect: (path: string) => void;
  isAndroid?: boolean;
  depth?: number;
}

export function FolderTree({ node, onSelect, isAndroid = false, depth = 0 }: FolderTreeProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [children, setChildren] = useState<FolderNode[]>(node.children);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (!isExpanded && children.length === 0) {
      // Load children on demand
      setIsLoading(true);
      try {
        const tree = isAndroid
          ? await window.electronAPI.getAndroidFolderTree(node.path)
          : await window.electronAPI.getLocalFolderTree(node.path);
        setChildren(tree.children);
      } catch (error) {
        console.error('Error loading folder:', error);
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const handleSelect = () => {
    onSelect(node.path);
  };

  const hasChildren = children.length > 0 || !isExpanded;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-gray-800 rounded cursor-pointer group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={handleToggle}
          className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white"
        >
          {isLoading ? (
            <span className="animate-spin">⟳</span>
          ) : hasChildren ? (
            isExpanded ? '▼' : '▶'
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Folder icon */}
        <span className="text-yellow-500">📁</span>

        {/* Folder name */}
        <span
          className="flex-1 truncate"
          onClick={handleSelect}
          title={node.path}
        >
          {node.name}
        </span>

        {/* Select button */}
        <button
          onClick={handleSelect}
          className="hidden group-hover:block px-2 py-0.5 text-xs bg-blue-600 hover:bg-blue-700 rounded"
        >
          Open
        </button>
      </div>

      {/* Children */}
      {isExpanded && (
        <div>
          {children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              onSelect={onSelect}
              isAndroid={isAndroid}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
