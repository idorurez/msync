import { useState, useEffect } from 'react';
import type { MusicFile } from '../types';
import { RatingStars } from './RatingStars';

interface InfoPanelProps {
  file: MusicFile | null;
  source: 'local' | 'android';
  onClose: () => void;
  onRatingChange: (filePath: string, rating: number) => void;
  onMetadataEdit: (file: MusicFile) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleString();
}

function detectSource(file: MusicFile): string {
  const filename = file.filename.toLowerCase();
  
  // YouTube download patterns
  // - 11 char video IDs often at end: "Song Name [dQw4w9WgXcQ].mp3"
  // - Or just the ID: "dQw4w9WgXcQ.mp3"
  const ytIdPattern = /[\[\(]?[a-zA-Z0-9_-]{11}[\]\)]?\.(mp3|m4a|webm|opus)$/i;
  const ytBracketPattern = /\[[a-zA-Z0-9_-]{11}\]/;
  
  if (ytIdPattern.test(filename) || ytBracketPattern.test(filename)) {
    return 'YouTube (likely)';
  }
  
  // Check for common yt-dlp naming patterns
  if (filename.includes(' - topic') || filename.includes('official audio') || filename.includes('official video')) {
    return 'YouTube (likely)';
  }
  
  // Long hex-like strings often indicate downloaded content
  const hexPattern = /[a-f0-9]{16,}/i;
  if (hexPattern.test(filename)) {
    return 'Downloaded (unknown)';
  }
  
  return 'Local/Unknown';
}

function suggestMetadataFix(file: MusicFile): { artist?: string; title?: string } | null {
  const filename = file.filename;
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Clean up YouTube-style suffixes
  let cleanName = nameWithoutExt
    .replace(/\s*[\[\(][a-zA-Z0-9_-]{11}[\]\)]\s*$/, '') // Remove [videoId] or (videoId)
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*\[Official.*?\]/gi, '')
    .replace(/\s*\(Audio\)/gi, '')
    .replace(/\s*\(Lyrics\)/gi, '')
    .replace(/\s*\(Music Video\)/gi, '')
    .replace(/\s*\(HD\)/gi, '')
    .replace(/\s*\(HQ\)/gi, '')
    .trim();
  
  // Try "Artist - Title" pattern
  const dashMatch = cleanName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const [, artist, title] = dashMatch;
    // Only suggest if current metadata is empty or matches filename
    if (!file.artist || file.artist === nameWithoutExt || !file.title || file.title === nameWithoutExt) {
      return { artist: artist.trim(), title: title.trim() };
    }
  }
  
  return null;
}

export function InfoPanel({ file, source, onClose, onRatingChange, onMetadataEdit }: InfoPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (file) {
      // Trigger slide-in animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [file]);
  
  if (!file) return null;
  
  const detectedSource = detectSource(file);
  const suggestion = suggestMetadataFix(file);
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for animation
  };
  
  return (
    <div 
      className={`
        fixed right-0 top-0 bottom-0 w-80 bg-theme-secondary border-l border-theme
        shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out
        ${isVisible ? 'translate-x-0' : 'translate-x-full'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme bg-theme-tertiary">
        <h2 className="font-tech font-semibold text-theme-primary truncate flex-1 mr-2">
          Song Info
        </h2>
        <button
          onClick={handleClose}
          className="text-theme-muted hover:text-theme-primary transition-colors text-xl leading-none"
        >
          ✕
        </button>
      </div>
      
      {/* Album Art Placeholder */}
      <div className="px-4 py-4 flex justify-center">
        <div className="w-48 h-48 bg-theme-tertiary rounded-lg flex items-center justify-center border border-theme">
          <span className="text-6xl opacity-30">🎵</span>
        </div>
      </div>
      
      {/* Metadata */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {/* Title */}
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Title</label>
          <p className="text-theme-primary font-medium truncate" title={file.title}>
            {file.title || <span className="italic text-theme-muted">No title</span>}
          </p>
        </div>
        
        {/* Artist */}
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Artist</label>
          <p className="text-theme-primary truncate" title={file.artist}>
            {file.artist || <span className="italic text-theme-muted">Unknown artist</span>}
          </p>
        </div>
        
        {/* Album */}
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Album</label>
          <p className="text-theme-primary truncate" title={file.album}>
            {file.album || <span className="italic text-theme-muted">Unknown album</span>}
          </p>
        </div>
        
        {/* Rating */}
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Rating</label>
          <div className="mt-1">
            <RatingStars 
              rating={file.rating} 
              onChange={(rating) => onRatingChange(file.path, rating)}
              size="lg"
              editable
            />
          </div>
        </div>
        
        <hr className="border-theme" />
        
        {/* File Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Format</label>
            <p className="text-theme-primary uppercase">{file.format}</p>
          </div>
          <div>
            <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Size</label>
            <p className="text-theme-primary">{formatFileSize(file.size)}</p>
          </div>
          <div>
            <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Location</label>
            <p className="text-theme-primary capitalize">{source}</p>
          </div>
          <div>
            <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Source</label>
            <p className="text-theme-primary text-xs">{detectedSource}</p>
          </div>
        </div>
        
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Last Modified</label>
          <p className="text-theme-primary text-sm">{formatDate(file.lastMetadataUpdate)}</p>
        </div>
        
        <div>
          <label className="text-xs text-theme-muted font-tech uppercase tracking-wide">Filename</label>
          <p className="text-theme-primary text-xs break-all opacity-75">{file.filename}</p>
        </div>
        
        {/* Metadata Fix Suggestion */}
        {suggestion && (
          <div className="mt-4 p-3 bg-theme-accent/10 rounded-lg border border-theme-accent/30">
            <p className="text-xs text-theme-accent font-tech uppercase tracking-wide mb-2">
              💡 Suggested Fix
            </p>
            <p className="text-sm text-theme-primary">
              <span className="text-theme-muted">Artist:</span> {suggestion.artist}
            </p>
            <p className="text-sm text-theme-primary">
              <span className="text-theme-muted">Title:</span> {suggestion.title}
            </p>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="px-4 py-3 border-t border-theme bg-theme-tertiary space-y-2">
        <button
          onClick={() => onMetadataEdit(file)}
          className="w-full px-4 py-2 bg-theme-accent hover:bg-theme-accent-hover rounded-theme font-tech text-sm transition-colors"
        >
          Edit Metadata
        </button>
      </div>
    </div>
  );
}
