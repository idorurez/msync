import { useState, useCallback } from 'react';
import type { MusicFile } from '../types';

interface AlbumArtModalProps {
  files: MusicFile[];
  source: 'local' | 'android';
  onClose: () => void;
}

interface ArtResult {
  url: string;
  thumb: string;
  collectionName: string;
  artistName: string;
}

interface GroupState {
  key: string;
  artist: string;
  album: string;
  files: MusicFile[];
  results: ArtResult[];
  selectedUrl: string | null;
  status: 'idle' | 'searching' | 'done' | 'error' | 'applying' | 'applied';
  error?: string;
}

function getGroupKey(file: MusicFile): string {
  return `${file.artist || ''}:::${file.album || ''}`;
}

function buildArtUrl(thumb: string): string {
  return thumb.replace(/\d+x\d+bb/, '600x600bb');
}

export function AlbumArtModal({ files, source, onClose }: AlbumArtModalProps) {
  const [groups, setGroups] = useState<GroupState[]>(() => {
    const map = new Map<string, GroupState>();
    for (const file of files) {
      const key = getGroupKey(file);
      if (!map.has(key)) {
        map.set(key, {
          key,
          artist: file.artist || 'Unknown Artist',
          album: file.album || 'Unknown Album',
          files: [],
          results: [],
          selectedUrl: null,
          status: 'idle',
        });
      }
      map.get(key)!.files.push(file);
    }
    return Array.from(map.values());
  });

  const updateGroup = useCallback((key: string, update: Partial<GroupState>) => {
    setGroups(prev => prev.map(g => g.key === key ? { ...g, ...update } : g));
  }, []);

  const searchArt = useCallback(async (group: GroupState) => {
    updateGroup(group.key, { status: 'searching', error: undefined, results: [] });

    const query = [group.artist, group.album]
      .filter(s => s && s !== 'Unknown Artist' && s !== 'Unknown Album')
      .join(' ');

    if (!query) {
      updateGroup(group.key, { status: 'error', error: 'No artist/album info to search' });
      return;
    }

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=5&media=music`;
      const res = await fetch(url);
      const data = await res.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: ArtResult[] = (data.results || []).map((r: any) => ({
        thumb: r.artworkUrl100 || '',
        url: buildArtUrl(r.artworkUrl100 || ''),
        collectionName: r.collectionName || '',
        artistName: r.artistName || '',
      })).filter((r: ArtResult) => r.thumb);

      updateGroup(group.key, {
        status: 'done',
        results,
        selectedUrl: results.length > 0 ? results[0].url : null,
      });
    } catch (err) {
      updateGroup(group.key, { status: 'error', error: String(err) });
    }
  }, [updateGroup]);

  const applyArt = useCallback(async (group: GroupState) => {
    if (!group.selectedUrl) return;
    updateGroup(group.key, { status: 'applying' });

    const api = source === 'local'
      ? window.electronAPI.writeAlbumArt
      : window.electronAPI.writeAndroidAlbumArt;

    let failed = 0;
    for (const file of group.files) {
      try {
        await api(file.path, group.selectedUrl);
      } catch {
        failed++;
      }
    }

    updateGroup(group.key, {
      status: 'applied',
      error: failed > 0 ? `${failed} file(s) failed` : undefined,
    });
  }, [source, updateGroup]);

  const searchAll = () => {
    for (const group of groups) {
      if (group.status === 'idle' || group.status === 'error') {
        searchArt(group);
      }
    }
  };

  const applyAll = async () => {
    for (const group of groups) {
      if (group.selectedUrl && group.status === 'done') {
        await applyArt(group);
      }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const anyReady = groups.some(g => g.selectedUrl && g.status === 'done');

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content font-tech" style={{ maxWidth: '640px', width: '90vw' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">
              Find Album Art
            </h2>
            <p className="text-[10px] text-theme-muted mt-0.5">
              {files.length} file(s) · {groups.length} group(s) · {source}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary text-lg"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-theme">
          <button
            onClick={searchAll}
            className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
          >
            Search All
          </button>
          <button
            onClick={applyAll}
            disabled={!anyReady}
            className={`px-3 py-1.5 text-xs rounded-theme transition-colors ${
              anyReady
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                : 'bg-theme-tertiary text-theme-muted cursor-not-allowed'
            }`}
          >
            Apply All Selected
          </button>
          <p className="text-[10px] text-theme-muted ml-1">
            Select a thumbnail, then click Apply.
          </p>
        </div>

        {/* Groups */}
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {groups.map((group) => (
            <div key={group.key} className="border-b border-theme px-4 py-3">
              {/* Group header row */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs font-semibold text-theme-primary">{group.artist}</div>
                  <div className="text-[10px] text-theme-muted">
                    {group.album} · {group.files.length} file(s)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {group.status === 'applied' && (
                    <span className="text-[10px] text-green-400">✓ Applied</span>
                  )}
                  {group.error && (
                    <span className="text-[10px] text-red-400">{group.error}</span>
                  )}
                  {group.status === 'searching' && (
                    <span className="text-[10px] text-theme-muted animate-pulse">Searching...</span>
                  )}
                  {group.status === 'applying' && (
                    <span className="text-[10px] text-theme-muted animate-pulse">Applying...</span>
                  )}
                  {(group.status === 'idle' || group.status === 'error' || group.status === 'done' || group.status === 'applied') && (
                    <button
                      onClick={() => searchArt(group)}
                      className="px-2 py-1 text-[10px] bg-theme-tertiary hover:bg-theme-hover rounded transition-colors"
                    >
                      {group.status === 'done' || group.status === 'applied' ? 'Re-search' : 'Search'}
                    </button>
                  )}
                  {group.selectedUrl && group.status === 'done' && (
                    <button
                      onClick={() => applyArt(group)}
                      className="px-2 py-1 text-[10px] bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>

              {/* Art thumbnails */}
              {group.results.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {group.results.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => updateGroup(group.key, { selectedUrl: result.url })}
                      className={`relative rounded overflow-hidden border-2 transition-all ${
                        group.selectedUrl === result.url
                          ? 'border-purple-500 ring-2 ring-purple-500/50'
                          : 'border-theme hover:border-purple-400'
                      }`}
                      title={`${result.artistName} — ${result.collectionName}`}
                    >
                      <img
                        src={result.thumb}
                        alt={result.collectionName}
                        className="w-16 h-16 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {group.status === 'done' && group.results.length === 0 && (
                <p className="text-[10px] text-theme-muted">No results found</p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-theme">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-theme-tertiary hover:bg-theme-hover rounded-theme transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
