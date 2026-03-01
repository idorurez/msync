import * as mm from 'music-metadata';
import * as fs from 'fs';
import * as path from 'path';
import type { MusicFile, FolderNode, AudioFormat } from '../src/types';
import type { DatabaseManager, DbFileRecord } from './db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TagLib = require('node-taglib-sharp');

const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aiff', '.wma'];

function getAudioFormat(filePath: string): AudioFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  const formatMap: Record<string, AudioFormat> = {
    '.mp3': 'mp3',
    '.flac': 'flac',
    '.m4a': 'm4a',
    '.ogg': 'ogg',
    '.wav': 'wav',
    '.aiff': 'aiff',
    '.wma': 'wma'
  };
  return formatMap[ext] || null;
}

function isSupportedAudio(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function parseRating(rating: number | undefined): number {
  if (rating === undefined || rating === null) return 0;

  // music-metadata returns ratings normalized to 0-1
  // But some sources might return 0-255 or 0-5
  if (rating <= 1) {
    // Normalized 0-1 scale, convert to 0-5
    return Math.round(rating * 5);
  } else if (rating <= 5) {
    // Already 0-5 scale
    return Math.round(rating);
  } else {
    // 0-255 scale (POPM), convert to 0-5
    return Math.round((rating / 255) * 5);
  }
}

function ratingTo255(rating: number): number {
  // Convert 0-5 stars to 0-255 for POPM
  // Use standard Windows Media Player mapping:
  // 1 star = 1, 2 stars = 64, 3 stars = 128, 4 stars = 196, 5 stars = 255
  const mapping = [0, 1, 64, 128, 196, 255];
  return mapping[Math.min(5, Math.max(0, Math.round(rating)))];
}

export async function readMetadata(filePath: string): Promise<MusicFile> {
  const stats = fs.statSync(filePath);
  const format = getAudioFormat(filePath);

  if (!format) {
    throw new Error(`Unsupported audio format: ${filePath}`);
  }

  try {
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common;

    // Try to get rating from various sources
    let rating = 0;
    if (common.rating && common.rating.length > 0) {
      rating = parseRating(common.rating[0].rating);
    }

    return {
      id: filePath,
      path: filePath,
      filename: path.basename(filePath),
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || '',
      album: common.album || '',
      rating,
      lastMetadataUpdate: stats.mtime,
      format,
      size: stats.size,
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : undefined
    };
  } catch {
    return {
      id: filePath,
      path: filePath,
      filename: path.basename(filePath),
      title: path.basename(filePath, path.extname(filePath)),
      artist: '',
      album: '',
      rating: 0,
      lastMetadataUpdate: stats.mtime,
      format,
      size: stats.size
    };
  }
}

export async function writeMetadata(filePath: string, metadata: Partial<MusicFile>): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    let file;
    try {
      file = TagLib.File.createFromPath(filePath);
    } catch {
      // Some files have non-standard headers; skip audio property scan and just access tags
      file = TagLib.File.createFromPath(filePath, undefined, 0);
    }

    if (metadata.title !== undefined) {
      file.tag.title = metadata.title;
    }

    if (metadata.artist !== undefined) {
      file.tag.performers = [metadata.artist];
    }

    if (metadata.album !== undefined) {
      file.tag.album = metadata.album;
    }

    // Handle rating
    if (metadata.rating !== undefined) {
      if (ext === '.mp3') {
        // For MP3, we need to write POPM frame
        try {
          const tagTypes = TagLib.TagTypes;
          if (tagTypes && tagTypes.Id3v2) {
            const id3v2Tag = file.getTag(tagTypes.Id3v2, true);
            if (id3v2Tag && TagLib.Id3v2PopularimeterFrame) {
              const rating255 = ratingTo255(metadata.rating);

              // Remove existing POPM frames
              try {
                const frames = id3v2Tag.getFramesByClassType(TagLib.Id3v2FrameClassType?.PopularimeterFrame);
                if (frames) {
                  for (const frame of frames) {
                    id3v2Tag.removeFrame(frame);
                  }
                }
              } catch {
                // No existing frames
              }

              // Add new POPM frame
              try {
                const popm = TagLib.Id3v2PopularimeterFrame.fromUser('no@email');
                popm.rating = rating255;
                popm.playCount = BigInt(0);
                id3v2Tag.addFrame(popm);
              } catch {
                // POPM frame creation failed
              }
            }
          }
        } catch {
          // MP3 rating write failed
        }
      } else if (ext === '.flac' || ext === '.ogg') {
        // For FLAC/OGG, use Vorbis comment
        try {
          const tagTypes = TagLib.TagTypes;
          if (tagTypes && (tagTypes.Xiph || tagTypes.FlacMetadata)) {
            const xiphTag = file.getTag(tagTypes.Xiph || tagTypes.FlacMetadata, true);
            if (xiphTag && xiphTag.setFieldAsStrings) {
              xiphTag.setFieldAsStrings('RATING', [metadata.rating.toString()]);
            }
          }
        } catch {
          // FLAC/OGG rating write failed
        }
      }
    }

    file.save();
    file.dispose();
  } catch (error) {
    throw error;
  }

  // Update file modification time
  fs.utimesSync(filePath, new Date(), new Date());
}

export async function scanFolder(folderPath: string): Promise<MusicFile[]> {
  const files: MusicFile[] = [];

  async function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && isSupportedAudio(entry.name)) {
        try {
          const metadata = await readMetadata(fullPath);
          files.push(metadata);
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  await scan(folderPath);
  return files;
}

// Convert DbFileRecord to MusicFile for renderer
export function dbRecordToMusicFile(record: DbFileRecord): MusicFile {
  return {
    id: record.path,
    path: record.path,
    filename: record.filename,
    title: record.title || path.basename(record.filename, path.extname(record.filename)),
    artist: record.artist,
    album: record.album,
    rating: record.rating,
    lastMetadataUpdate: record.mtime ? new Date(record.mtime) : null,
    format: record.format as AudioFormat,
    size: record.size,
    bitrate: record.bitrate ?? undefined
  };
}

// Convert MusicFile to DB insert record
function musicFileToDbRecord(file: MusicFile, source: 'local' | 'android'): Omit<DbFileRecord, 'id' | 'created_at' | 'updated_at' | 'last_scanned'> {
  return {
    path: file.path,
    source,
    filename: file.filename,
    filename_lower: file.filename.toLowerCase(),
    directory: path.dirname(file.path),
    format: file.format,
    size: file.size,
    mtime: file.lastMetadataUpdate?.getTime() ?? null,
    title: file.title,
    artist: file.artist,
    album: file.album,
    rating: file.rating,
    bitrate: file.bitrate ?? null
  };
}

interface FileOnDisk {
  path: string;
  mtime: number;
  size: number;
}

// Walk filesystem collecting audio file info (no metadata reading)
function walkForAudioFiles(dir: string): FileOnDisk[] {
  const results: FileOnDisk[] = [];

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && isSupportedAudio(entry.name)) {
          try {
            const stats = fs.statSync(fullPath);
            results.push({
              path: fullPath,
              mtime: stats.mtimeMs,
              size: stats.size
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(dir);
  return results;
}

// Incremental scan: only read metadata for new/changed files, use DB cache for unchanged
export async function incrementalScanFolder(
  folderPath: string,
  db: DatabaseManager,
  source: 'local' | 'android' = 'local',
  onProgress?: (scanned: number, total: number, file: string) => void
): Promise<MusicFile[]> {
  // 1. Walk filesystem
  const filesOnDisk = walkForAudioFiles(folderPath);
  const currentPaths = new Set(filesOnDisk.map(f => f.path));

  // 2. Get cached entries from DB
  const cachedFiles = db.getFilesInTree(folderPath, source);
  const cachedByPath = new Map(cachedFiles.map(f => [f.path, f]));

  // 3. Classify files
  const toRead: FileOnDisk[] = [];
  const unchanged: DbFileRecord[] = [];

  for (const diskFile of filesOnDisk) {
    const cached = cachedByPath.get(diskFile.path);
    if (cached && cached.mtime === Math.floor(diskFile.mtime) && cached.size === diskFile.size) {
      unchanged.push(cached);
    } else {
      toRead.push(diskFile);
    }
  }

  // 4. Remove deleted files from DB
  db.removeStaleFiles(folderPath, source, currentPaths);

  // 5. Read metadata for new/changed files and upsert to DB
  const newRecords: Omit<DbFileRecord, 'id' | 'created_at' | 'updated_at' | 'last_scanned'>[] = [];

  for (let i = 0; i < toRead.length; i++) {
    const diskFile = toRead[i];
    onProgress?.(i + 1, toRead.length, path.basename(diskFile.path));

    try {
      const metadata = await readMetadata(diskFile.path);
      newRecords.push(musicFileToDbRecord(metadata, source));
    } catch {
      // Skip unreadable files
    }
  }

  if (newRecords.length > 0) {
    db.batchUpsertFiles(newRecords);
  }

  // 6. Return all files as MusicFile[]
  const allDbFiles = db.getFilesInTree(folderPath, source);
  return allDbFiles.map(dbRecordToMusicFile);
}

export function getFolderTree(folderPath: string): FolderNode {
  const name = path.basename(folderPath);

  const node: FolderNode = {
    name,
    path: folderPath,
    children: [],
    isExpanded: false
  };

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const childPath = path.join(folderPath, entry.name);
        node.children.push(getFolderTree(childPath));
      }
    }

    node.children.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // Folder read failed
  }

  return node;
}
