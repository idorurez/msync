import { useState } from 'react';
import { RatingStars } from './RatingStars';
import type { MusicFile } from '../types';

interface BulkEditModalProps {
  files: MusicFile[];
  onSave: (updates: Partial<MusicFile>) => void;
  onClose: () => void;
}

export function BulkEditModal({ files, onSave, onClose }: BulkEditModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [rating, setRating] = useState<number | null>(null);

  const [applyTitle, setApplyTitle] = useState(false);
  const [applyArtist, setApplyArtist] = useState(false);
  const [applyAlbum, setApplyAlbum] = useState(false);
  const [applyRating, setApplyRating] = useState(false);

  const handleSave = () => {
    const updates: Partial<MusicFile> = {};

    if (applyTitle && title.trim()) {
      updates.title = title.trim();
    }
    if (applyArtist) {
      updates.artist = artist.trim();
    }
    if (applyAlbum) {
      updates.album = album.trim();
    }
    if (applyRating && rating !== null) {
      updates.rating = rating;
    }

    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content font-tech">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">
            Bulk Edit Metadata
          </h2>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary text-lg"
          >
            ×
          </button>
        </div>

        {/* File count */}
        <div className="px-4 py-2 bg-theme-tertiary text-xs text-theme-secondary">
          Editing {files.length} file{files.length !== 1 ? 's' : ''}
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="applyTitle"
                checked={applyTitle}
                onChange={(e) => setApplyTitle(e.target.checked)}
                className="w-3 h-3"
              />
              <label htmlFor="applyTitle" className="text-xs text-theme-secondary uppercase tracking-wide">
                Title
              </label>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!applyTitle}
              placeholder="Enter title..."
              className="w-full px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Artist */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="applyArtist"
                checked={applyArtist}
                onChange={(e) => setApplyArtist(e.target.checked)}
                className="w-3 h-3"
              />
              <label htmlFor="applyArtist" className="text-xs text-theme-secondary uppercase tracking-wide">
                Artist
              </label>
            </div>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={!applyArtist}
              placeholder="Enter artist..."
              className="w-full px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Album */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="applyAlbum"
                checked={applyAlbum}
                onChange={(e) => setApplyAlbum(e.target.checked)}
                className="w-3 h-3"
              />
              <label htmlFor="applyAlbum" className="text-xs text-theme-secondary uppercase tracking-wide">
                Album
              </label>
            </div>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              disabled={!applyAlbum}
              placeholder="Enter album..."
              className="w-full px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Rating */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="applyRating"
                checked={applyRating}
                onChange={(e) => setApplyRating(e.target.checked)}
                className="w-3 h-3"
              />
              <label htmlFor="applyRating" className="text-xs text-theme-secondary uppercase tracking-wide">
                Rating
              </label>
            </div>
            <div className={`${!applyRating ? 'opacity-50 pointer-events-none' : ''}`}>
              <RatingStars
                rating={rating ?? 0}
                editable={applyRating}
                onChange={setRating}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!applyTitle && !applyArtist && !applyAlbum && !applyRating}
            className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-theme transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            Apply to {files.length} file{files.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
