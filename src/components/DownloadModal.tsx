import { useState } from 'react';

interface DownloadModalProps {
  ytdlpPath: string;
  ffmpegPath?: string;
  outputPath: string;
  onClose: () => void;
  onDownloadComplete: () => void;
}

interface DownloadProgress {
  status: 'idle' | 'downloading' | 'processing' | 'complete' | 'error';
  message: string;
  current?: number;
  total?: number;
}

export function DownloadModal({ ytdlpPath, ffmpegPath, outputPath, onClose, onDownloadComplete }: DownloadModalProps) {
  const [url, setUrl] = useState('');
  const [downloadPath, setDownloadPath] = useState(outputPath);
  const [progress, setProgress] = useState<DownloadProgress>({ status: 'idle', message: '' });

  const handleBrowsePath = async () => {
    const selected = await window.electronAPI.selectFolder();
    if (selected) setDownloadPath(selected);
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setProgress({ status: 'error', message: 'Please enter a YouTube URL' });
      return;
    }

    if (!ytdlpPath) {
      setProgress({ status: 'error', message: 'yt-dlp path not configured. Go to Settings to set it.' });
      return;
    }

    if (!downloadPath) {
      setProgress({ status: 'error', message: 'No output folder selected.' });
      return;
    }

    setProgress({ status: 'downloading', message: 'Starting download...' });

    try {
      const result = await window.electronAPI.downloadWithYtdlp(url.trim(), downloadPath, ytdlpPath, ffmpegPath);

      if (result.success) {
        setProgress({
          status: 'complete',
          message: `Downloaded ${result.fileCount || 1} file(s) successfully!`
        });
        onDownloadComplete();
      } else {
        setProgress({ status: 'error', message: result.error || 'Download failed' });
      }
    } catch (error) {
      setProgress({ status: 'error', message: String(error) });
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && progress.status !== 'downloading') {
      onClose();
    }
  };

  const isDownloading = progress.status === 'downloading' || progress.status === 'processing';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content font-tech" style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-primary flex items-center gap-2">
            <span>📥</span> Download from YouTube
          </h2>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className={`text-lg ${isDownloading ? 'text-theme-muted cursor-not-allowed' : 'text-theme-muted hover:text-theme-primary'}`}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              YouTube URL or Playlist Link
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or playlist URL"
              disabled={isDownloading}
              className="w-full px-3 py-2 text-sm bg-theme-primary border border-theme rounded-theme text-theme-primary disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isDownloading) {
                  handleDownload();
                }
              }}
            />
            <p className="text-[10px] text-theme-muted">
              Supports single videos, playlists, and channels. Downloads highest quality audio as MP3.
            </p>
          </div>

          {/* Output Path */}
          <div className="space-y-1">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              Download To
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={downloadPath}
                onChange={(e) => setDownloadPath(e.target.value)}
                placeholder="Select a folder..."
                disabled={isDownloading}
                className="flex-1 px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary font-mono disabled:opacity-50"
              />
              <button
                onClick={handleBrowsePath}
                disabled={isDownloading}
                className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Progress */}
          {progress.status !== 'idle' && (
            <div className={`p-3 rounded-theme ${
              progress.status === 'error' ? 'bg-red-900/20 border border-red-500/30' :
              progress.status === 'complete' ? 'bg-green-900/20 border border-green-500/30' :
              'bg-blue-900/20 border border-blue-500/30'
            }`}>
              <div className="flex items-center gap-2">
                {isDownloading && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                {progress.status === 'complete' && <span>✅</span>}
                {progress.status === 'error' && <span>❌</span>}
                <p className={`text-sm ${
                  progress.status === 'error' ? 'text-red-400' :
                  progress.status === 'complete' ? 'text-green-400' :
                  'text-blue-400'
                }`}>
                  {progress.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme">
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2 text-sm bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {progress.status === 'complete' ? 'Done' : 'Cancel'}
          </button>
          {progress.status !== 'complete' && (
            <button
              onClick={handleDownload}
              disabled={isDownloading || !url.trim() || !downloadPath}
              className="px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-theme transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Download
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
