import type { MusicFile } from '../types';
import { RatingStars } from './RatingStars';

interface InfoPanelProps {
  file: MusicFile | null;
  source: 'local' | 'android';
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
  return new Date(date).toLocaleDateString();
}

function detectSource(file: MusicFile): string {
  const filename = file.filename.toLowerCase();
  
  // YouTube download patterns
  const ytIdPattern = /[\[\(]?[a-zA-Z0-9_-]{11}[\]\)]?\.(mp3|m4a|webm|opus)$/i;
  const ytBracketPattern = /\[[a-zA-Z0-9_-]{11}\]/;
  
  if (ytIdPattern.test(filename) || ytBracketPattern.test(filename)) {
    return 'YouTube';
  }
  
  if (filename.includes(' - topic') || filename.includes('official audio') || filename.includes('official video')) {
    return 'YouTube';
  }
  
  const hexPattern = /[a-f0-9]{16,}/i;
  if (hexPattern.test(filename)) {
    return 'Downloaded';
  }
  
  return 'Local';
}

function suggestMetadataFix(file: MusicFile): { artist?: string; title?: string } | null {
  const filename = file.filename;
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  let cleanName = nameWithoutExt
    .replace(/\s*[\[\(][a-zA-Z0-9_-]{11}[\]\)]\s*$/, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*\[Official.*?\]/gi, '')
    .replace(/\s*\(Audio\)/gi, '')
    .replace(/\s*\(Lyrics\)/gi, '')
    .replace(/\s*\(Music Video\)/gi, '')
    .replace(/\s*\(HD\)/gi, '')
    .replace(/\s*\(HQ\)/gi, '')
    .trim();
  
  const dashMatch = cleanName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const [, artist, title] = dashMatch;
    if (!file.artist || file.artist === nameWithoutExt || !file.title || file.title === nameWithoutExt) {
      return { artist: artist.trim(), title: title.trim() };
    }
  }
  
  return null;
}

export function InfoPanel({ file, source, onRatingChange, onMetadataEdit }: InfoPanelProps) {
  return (
    <div className="w-64 bg-theme-secondary border-r border-theme flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-theme bg-theme-tertiary shrink-0">
        <h2 className="font-tech font-semibold text-theme-primary text-xs uppercase tracking-wide">
          Song Info
        </h2>
      </div>
      
      {!file ? (
        <div className="flex-1 flex items-center justify-center text-theme-muted font-tech text-xs p-4 text-center">
          <div>
            <span className="text-4xl opacity-30 block mb-2">🎵</span>
            Select a song to<br />view details
          </div>
        </div>
      ) : (
        <>
          {/* Album Art Placeholder */}
          <div className="px-3 py-3 flex justify-center shrink-0">
            <div className="w-36 h-36 bg-theme-tertiary rounded-lg flex items-center justify-center border border-theme">
              <span className="text-5xl opacity-30">🎵</span>
            </div>
          </div>
          
          {/* Metadata - scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {/* Title */}
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase tracking-wide">Title</label>
              <p className="text-theme-primary text-sm font-medium truncate" title={file.title}>
                {file.title || <span className="italic text-theme-muted">No title</span>}
              </p>
            </div>
            
            {/* Artist */}
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase tracking-wide">Artist</label>
              <p className="text-theme-primary text-sm truncate" title={file.artist}>
                {file.artist || <span className="italic text-theme-muted">Unknown</span>}
              </p>
            </div>
            
            {/* Album */}
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase tracking-wide">Album</label>
              <p className="text-theme-primary text-sm truncate" title={file.album}>
                {file.album || <span className="italic text-theme-muted">Unknown</span>}
              </p>
            </div>
            
            {/* Rating */}
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase tracking-wide">Rating</label>
              <div className="mt-0.5">
                <RatingStars 
                  rating={file.rating} 
                  onChange={(rating) => onRatingChange(file.path, rating)}
                  size="md"
                  editable
                />
              </div>
            </div>
            
            <hr className="border-theme my-2" />
            
            {/* File Info - compact grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-theme-muted font-tech uppercase">Format</label>
                <p className="text-theme-primary uppercase">{file.format}</p>
              </div>
              <div>
                <label className="text-[10px] text-theme-muted font-tech uppercase">Bitrate</label>
                <p className="text-theme-primary">{file.bitrate ? `${file.bitrate} kbps` : '—'}</p>
              </div>
              <div>
                <label className="text-[10px] text-theme-muted font-tech uppercase">Size</label>
                <p className="text-theme-primary">{formatFileSize(file.size)}</p>
              </div>
              <div>
                <label className="text-[10px] text-theme-muted font-tech uppercase">Location</label>
                <p className="text-theme-primary capitalize">{source}</p>
              </div>
              <div>
                <label className="text-[10px] text-theme-muted font-tech uppercase">Source</label>
                <p className="text-theme-primary">{detectSource(file)}</p>
              </div>
            </div>
            
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase">Modified</label>
              <p className="text-theme-primary text-xs">{formatDate(file.lastMetadataUpdate)}</p>
            </div>
            
            <div>
              <label className="text-[10px] text-theme-muted font-tech uppercase">Filename</label>
              <p className="text-theme-primary text-[10px] break-all opacity-75 leading-tight">{file.filename}</p>
            </div>
            
            {/* Metadata Fix Suggestion */}
            {suggestMetadataFix(file) && (
              <div className="mt-2 p-2 bg-theme-accent/10 rounded border border-theme-accent/30">
                <p className="text-[10px] text-theme-accent font-tech uppercase mb-1">
                  💡 Suggested Fix
                </p>
                <p className="text-xs text-theme-primary">
                  <span className="text-theme-muted">Artist:</span> {suggestMetadataFix(file)?.artist}
                </p>
                <p className="text-xs text-theme-primary">
                  <span className="text-theme-muted">Title:</span> {suggestMetadataFix(file)?.title}
                </p>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="px-3 py-2 border-t border-theme bg-theme-tertiary shrink-0">
            <button
              onClick={() => onMetadataEdit(file)}
              className="w-full px-3 py-1.5 bg-theme-accent hover:bg-theme-accent-hover rounded-theme font-tech text-xs transition-colors"
            >
              Edit Metadata
            </button>
          </div>
        </>
      )}
    </div>
  );
}
