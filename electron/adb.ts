// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdbModule = require('@devicefarmer/adbkit');
const Adb = AdbModule.Adb;
type Client = InstanceType<typeof AdbModule.Client>;
type Device = { id: string; type: string };
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import type { MusicFile, FolderNode, DeviceInfo, AudioFormat } from '../src/types';
import { readMetadata } from './metadata';

const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aiff', '.wma'];

// Find ADB executable
function findAdb(): string | undefined {
  const possiblePaths = [
    path.join(os.homedir(), 'AppData/Local/Microsoft/WinGet/Packages/Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe/platform-tools/adb.exe'),
    path.join(os.homedir(), 'AppData/Local/Android/Sdk/platform-tools/adb.exe'),
    'C:/Program Files/Android/platform-tools/adb.exe',
    'C:/platform-tools/adb.exe',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Try to find in PATH
  try {
    const result = execSync('where adb', { encoding: 'utf8' });
    const firstLine = result.split('\n')[0].trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch {
    // Not in PATH
  }

  return undefined;
}

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

export class AdbManager extends EventEmitter {
  private client: Client;
  private currentDevice: Device | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private adbPath: string | undefined;

  constructor() {
    super();
    this.adbPath = findAdb();
    console.log('ADB path:', this.adbPath);

    // Start ADB server if we found the executable
    if (this.adbPath) {
      try {
        execSync(`"${this.adbPath}" start-server`, { encoding: 'utf8' });
        console.log('ADB server started');
      } catch (error) {
        console.error('Failed to start ADB server:', error);
      }
    }

    this.client = Adb.createClient({
      bin: this.adbPath
    });
    this.startTracking();
  }

  private async startTracking() {
    try {
      const tracker = await this.client.trackDevices();

      tracker.on('add', async (device: Device) => {
        console.log('Device connected:', device.id);
        this.currentDevice = device;
        await this.updateDeviceInfo(device);
        if (this.deviceInfo) {
          this.emit('device-connected', this.deviceInfo);
        }
      });

      tracker.on('remove', (device: Device) => {
        console.log('Device disconnected:', device.id);
        if (this.currentDevice?.id === device.id) {
          this.currentDevice = null;
          this.deviceInfo = null;
          this.emit('device-disconnected');
        }
      });

      tracker.on('end', () => {
        console.log('Device tracking ended');
      });

      // Check for already connected devices
      const devices = await this.client.listDevices();
      console.log('Initial devices:', devices.map(d => d.id));
      if (devices.length > 0) {
        this.currentDevice = devices[0];
        await this.updateDeviceInfo(devices[0]);
        if (this.deviceInfo) {
          console.log('Emitting device-connected:', this.deviceInfo);
          this.emit('device-connected', this.deviceInfo);
        }
      }
    } catch (error) {
      console.error('Error starting device tracking:', error);
    }
  }

  private async updateDeviceInfo(device: Device) {
    try {
      const properties = await this.client.getDevice(device.id).getProperties();
      this.deviceInfo = {
        id: device.id,
        model: properties['ro.product.model'] || 'Unknown Device',
        connected: true
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      this.deviceInfo = {
        id: device.id,
        model: 'Unknown Device',
        connected: true
      };
    }
  }

  async connect(): Promise<DeviceInfo | null> {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    try {
      const devices = await this.client.listDevices();
      if (devices.length > 0) {
        this.currentDevice = devices[0];
        await this.updateDeviceInfo(devices[0]);
        return this.deviceInfo;
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
    }

    return null;
  }

  disconnect() {
    this.currentDevice = null;
    this.deviceInfo = null;
  }

  async scanFolder(folderPath: string): Promise<MusicFile[]> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    const files: MusicFile[] = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msync-'));

    try {
      const entries = await this.listDirectory(folderPath);

      for (const entry of entries) {
        if (entry.isDirectory) {
          const subFiles = await this.scanFolder(entry.path);
          files.push(...subFiles);
        } else if (isSupportedAudio(entry.name)) {
          try {
            // Pull file to temp location to read metadata
            const tempPath = path.join(tempDir, entry.name);
            await this.pullFile(entry.path, tempPath);

            const metadata = await readMetadata(tempPath);

            // Update path to android path
            files.push({
              ...metadata,
              id: entry.path,
              path: entry.path
            });

            // Clean up temp file
            fs.unlinkSync(tempPath);
          } catch (error) {
            console.error(`Error reading metadata for ${entry.path}:`, error);
            // Add basic file info without full metadata
            const format = getAudioFormat(entry.name);
            if (format) {
              files.push({
                id: entry.path,
                path: entry.path,
                filename: entry.name,
                title: path.basename(entry.name, path.extname(entry.name)),
                artist: '',
                album: '',
                rating: 0,
                lastMetadataUpdate: null,
                format,
                size: entry.size || 0
              });
            }
          }
        }
      }
    } finally {
      // Clean up temp directory
      try {
        fs.rmdirSync(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }

    return files;
  }

  private async listDirectory(dirPath: string): Promise<Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
  }>> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    const entries: Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size?: number;
    }> = [];

    try {
      const device = this.client.getDevice(this.currentDevice.id);
      const files = await device.readdir(dirPath);

      for (const file of files) {
        if (file.name === '.' || file.name === '..') continue;

        entries.push({
          name: file.name,
          path: path.posix.join(dirPath, file.name),
          isDirectory: file.isDirectory(),
          size: file.size
        });
      }
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error);
    }

    return entries;
  }

  async getFolderTree(folderPath: string): Promise<FolderNode> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    const name = path.basename(folderPath) || folderPath;

    const node: FolderNode = {
      name,
      path: folderPath,
      children: [],
      isExpanded: false
    };

    try {
      const entries = await this.listDirectory(folderPath);

      for (const entry of entries) {
        if (entry.isDirectory && !entry.name.startsWith('.')) {
          // Only go one level deep for performance
          const childNode: FolderNode = {
            name: entry.name,
            path: entry.path,
            children: [],
            isExpanded: false
          };
          node.children.push(childNode);
        }
      }

      node.children.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(`Error getting folder tree for ${folderPath}:`, error);
    }

    return node;
  }

  async pullFile(androidPath: string, localPath: string): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      const device = this.client.getDevice(this.currentDevice.id);
      const transfer = await device.pull(androidPath);

      return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(localPath);

        transfer.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        transfer.pipe(writeStream);
      });
    } catch (error) {
      console.error(`Error pulling file ${androidPath}:`, error);
      throw error;
    }
  }

  async pushFile(localPath: string, androidPath: string): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    try {
      const device = this.client.getDevice(this.currentDevice.id);
      const transfer = await device.push(localPath, androidPath);

      return new Promise((resolve, reject) => {
        transfer.on('error', reject);
        transfer.on('end', resolve);
      });
    } catch (error) {
      console.error(`Error pushing file to ${androidPath}:`, error);
      throw error;
    }
  }

  async deleteFiles(filePaths: string[]): Promise<void> {
    if (!this.currentDevice) {
      throw new Error('No device connected');
    }

    const device = this.client.getDevice(this.currentDevice.id);

    for (const filePath of filePaths) {
      try {
        // Use shell command to delete file
        await device.shell(`rm "${filePath}"`);
        console.log(`Deleted ${filePath}`);
      } catch (error) {
        console.error(`Error deleting ${filePath}:`, error);
        throw error;
      }
    }
  }
}
