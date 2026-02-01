import { useState, useEffect } from 'react';

interface SettingsModalProps {
  customHeaderBg?: string;
  onSave: (settings: { customHeaderBg?: string }) => void;
  onClose: () => void;
}

export function SettingsModal({ customHeaderBg, onSave, onClose }: SettingsModalProps) {
  const [headerBg, setHeaderBg] = useState(customHeaderBg || '');
  const [availableImages, setAvailableImages] = useState<Array<{ name: string; path: string }>>([]);
  const [imgFolderPath, setImgFolderPath] = useState('');

  // Load images from img folder on mount
  useEffect(() => {
    const loadImgFolder = async () => {
      try {
        const appPath = await window.electronAPI.getAppPath();
        const possiblePaths = [
          appPath.replace('dist-electron', 'img'),
          `${appPath}/img`,
          `${appPath}/../img`,
        ];

        for (const imgPath of possiblePaths) {
          try {
            const images = await window.electronAPI.listImages(imgPath);
            if (images.length > 0) {
              setImgFolderPath(imgPath);
              setAvailableImages(images);
              break;
            }
          } catch {
            // Try next path
          }
        }
      } catch {
        // Failed to load images
      }
    };
    loadImgFolder();
  }, []);

  const handleSelectImage = async () => {
    const imagePath = await window.electronAPI.selectImage();
    if (imagePath) {
      setHeaderBg(imagePath);
    }
  };

  const handleSave = () => {
    onSave({
      customHeaderBg: headerBg || undefined
    });
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getImageUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    return `file:///${path.replace(/\\/g, '/')}`;
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content font-tech">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">
            Customize Header
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
          {/* Header Background */}
          <div className="space-y-2">
            <label className="text-xs text-theme-secondary uppercase tracking-wide block">
              Header Background
            </label>

            {/* Available images from img folder */}
            {availableImages.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-theme-muted">From img folder:</span>
                <div className="flex flex-wrap gap-2">
                  {availableImages.map((img) => (
                    <button
                      key={img.path}
                      onClick={() => setHeaderBg(img.path)}
                      className={`w-16 h-10 rounded border-2 overflow-hidden transition-all ${
                        headerBg === img.path ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-theme hover:border-theme-light'
                      }`}
                      title={img.name}
                    >
                      <img
                        src={getImageUrl(img.path)}
                        alt={img.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={headerBg}
                onChange={(e) => setHeaderBg(e.target.value)}
                placeholder="Image path or URL..."
                className="flex-1 px-2 py-1.5 text-xs bg-theme-primary border border-theme rounded-theme text-theme-primary"
              />
              <button
                onClick={handleSelectImage}
                className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
              >
                Browse
              </button>
            </div>

            {headerBg && (
              <button
                onClick={() => setHeaderBg('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                × Clear background
              </button>
            )}

            {/* Preview */}
            {headerBg && (
              <div className="relative h-14 rounded-theme overflow-hidden border border-theme">
                <img
                  src={getImageUrl(headerBg)}
                  alt="Preview"
                  className="w-full h-full object-cover opacity-70"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).alt = 'Failed to load image';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/60" />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-white drop-shadow-lg font-fancy">
                  msync
                </span>
              </div>
            )}

            <p className="text-[10px] text-theme-muted">
              Tip: Place images in the "img" folder next to the app.
              {imgFolderPath && <span className="block mt-0.5 opacity-70">Path: {imgFolderPath}</span>}
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
