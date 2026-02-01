import * as mm from 'music-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { MusicFile, FolderNode, AudioFormat } from '../src/types';

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
      size: stats.size
    };
  } catch (error) {
    console.error(`Error reading metadata for ${filePath}:`, error);
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

  console.log(`Writing metadata to ${filePath}:`, metadata);

  try {
    const file = TagLib.File.createFromPath(filePath);

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
      console.log(`Writing rating ${metadata.rating} to ${ext} file`);

      if (ext === '.mp3') {
        // For MP3, we need to write POPM frame
        try {
          // Try to get or create ID3v2 tag
          const tagTypes = TagLib.TagTypes;
          console.log('Available TagTypes:', Object.keys(tagTypes || {}));

          if (tagTypes && tagTypes.Id3v2) {
            const id3v2Tag = file.getTag(tagTypes.Id3v2, true);
            console.log('Got ID3v2 tag:', !!id3v2Tag);

            if (id3v2Tag) {
              // Try to find PopularimeterFrame
              if (TagLib.Id3v2PopularimeterFrame) {
                const rating255 = ratingTo255(metadata.rating);
                console.log(`Creating POPM frame with rating ${rating255}`);

                // Remove existing POPM frames
                try {
                  const frames = id3v2Tag.getFramesByClassType(TagLib.Id3v2FrameClassType?.PopularimeterFrame);
                  if (frames) {
                    for (const frame of frames) {
                      id3v2Tag.removeFrame(frame);
                    }
                  }
                } catch (e) {
                  console.log('Could not remove existing POPM frames:', e);
                }

                // Add new POPM frame
                try {
                  const popm = TagLib.Id3v2PopularimeterFrame.fromUser('no@email');
                  popm.rating = rating255;
                  popm.playCount = BigInt(0);
                  id3v2Tag.addFrame(popm);
                  console.log('Added POPM frame');
                } catch (e) {
                  console.error('Could not create POPM frame:', e);
                }
              } else {
                console.log('Id3v2PopularimeterFrame not available');
              }
            }
          }
        } catch (e) {
          console.error('Error writing MP3 rating:', e);
        }
      } else if (ext === '.flac' || ext === '.ogg') {
        // For FLAC/OGG, use Vorbis comment
        try {
          const tagTypes = TagLib.TagTypes;
          if (tagTypes && (tagTypes.Xiph || tagTypes.FlacMetadata)) {
            const xiphTag = file.getTag(tagTypes.Xiph || tagTypes.FlacMetadata, true);
            if (xiphTag && xiphTag.setFieldAsStrings) {
              xiphTag.setFieldAsStrings('RATING', [metadata.rating.toString()]);
              console.log('Set FLAC/OGG rating via Xiph comment');
            }
          }
        } catch (e) {
          console.error('Error writing FLAC/OGG rating:', e);
        }
      }
    }

    file.save();
    file.dispose();
    console.log('File saved successfully');
  } catch (error) {
    console.error(`Error writing metadata to ${filePath}:`, error);
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
        } catch (error) {
          console.error(`Error scanning ${fullPath}:`, error);
        }
      }
    }
  }

  await scan(folderPath);
  return files;
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
  } catch (error) {
    console.error(`Error reading folder ${folderPath}:`, error);
  }

  return node;
}
