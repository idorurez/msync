import { useState } from 'react';

interface SettingsModalProps {
  ytdlpPath?: string;
  ffmpegPath?: string;
  downloadPath?: string;
  onSave: (settings: {
    ytdlpPath?: string;
    ffmpegPath?: string;
  }) => void;
  onClose: () => void;
}

export function SettingsModal({
  ytdlpPath, ffmpegPath, downloadPath,
  onSave, onClose
}: SettingsModalProps) {
  const [ytdlp, setYtdlp] = useState(ytdlpPath || '');
  const [ffmpeg, setFfmpeg] = useState(ffmpegPath || '');

  const handleBrowseYtdlp = async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) setYtdlp(filePath);
  };

  const handleBrowseFfmpeg = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) setFfmpeg(folderPath);
  };

  const handleSave = () => {
    onSave({
      ytdlpPath: ytdlp || undefined,
      ffmpegPath: ffmpeg || undefined,
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content font-tech" style={{ maxWidth: '550px', maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary text-lg"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* yt-dlp Path */}
          <div className="space-y-2">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              yt-dlp Path
            </label>
            <p className="text-[10px] text-theme-muted">
              Path to yt-dlp executable for downloading from YouTube. Required for YouTube download features.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytdlp}
                onChange={(e) => setYtdlp(e.target.value)}
                placeholder="C:\path\to\yt-dlp.exe"
                className="flex-1 px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary font-mono"
              />
              <button
                onClick={handleBrowseYtdlp}
                className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
              >
                Browse
              </button>
            </div>
            {ytdlp && (
              <button
                onClick={() => setYtdlp('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                × Clear path
              </button>
            )}
            <p className="text-[10px] text-theme-muted">
              Download yt-dlp from:{' '}
              <a
                href="https://github.com/yt-dlp/yt-dlp/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                github.com/yt-dlp/yt-dlp
              </a>
            </p>
          </div>

          {/* ffmpeg Path */}
          <div className="space-y-2">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              ffmpeg Location
            </label>
            <p className="text-[10px] text-theme-muted">
              Path to the folder containing ffmpeg binaries. Required for audio conversion and thumbnail embedding.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={ffmpeg}
                onChange={(e) => setFfmpeg(e.target.value)}
                placeholder="C:\path\to\ffmpeg\bin"
                className="flex-1 px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary font-mono"
              />
              <button
                onClick={handleBrowseFfmpeg}
                className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
              >
                Browse
              </button>
            </div>
            {ffmpeg && (
              <button
                onClick={() => setFfmpeg('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                × Clear path
              </button>
            )}
          </div>

          {/* Download location */}
          <div className="space-y-1">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              Download Location
            </label>
            <p className="text-[10px] text-theme-muted">
              YouTube downloads go to the currently selected local folder.
            </p>
            <p className="text-xs text-theme-primary font-mono bg-theme-tertiary px-2 py-1.5 rounded truncate">
              {downloadPath || 'No local folder selected'}
            </p>
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
            className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-theme transition-colors text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
