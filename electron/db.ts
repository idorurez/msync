import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let initSqlJs: any;
try {
  initSqlJs = require('sql.js');
} catch {
  // Will be loaded dynamically
}

export interface DbFileRecord {
  id: number;
  path: string;
  source: 'local' | 'android';
  filename: string;
  filename_lower: string;
  directory: string;
  format: string;
  size: number;
  mtime: number | null;
  title: string;
  artist: string;
  album: string;
  rating: number;
  bitrate: number | null;
  last_scanned: number;
  created_at: number;
  updated_at: number;
}

export interface LibraryRoot {
  id: number;
  path: string;
  source: 'local' | 'android';
  added_at: number;
}

export interface SyncLogEntry {
  id: number;
  local_file_id: number | null;
  android_file_id: number | null;
  direction: string;
  synced_at: number;
}

export interface CrossSourceMatch {
  local: DbFileRecord;
  android: DbFileRecord;
}

const SCHEMA_VERSION = 1;

export class DatabaseManager {
  private db: any = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'msync-library.db');
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        // In packaged app, look in node_modules
        const modulePath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(modulePath)) return modulePath;
        // Dev mode
        const devPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(devPath)) return devPath;
        return file;
      }
    });

    // Load existing DB or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA foreign_keys = ON');

    this.createSchema();
    this.migrate();
  }

  private createSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        path           TEXT NOT NULL UNIQUE,
        source         TEXT NOT NULL,
        filename       TEXT NOT NULL,
        filename_lower TEXT NOT NULL,
        directory      TEXT NOT NULL,
        format         TEXT NOT NULL,
        size           INTEGER NOT NULL,
        mtime          INTEGER,
        title          TEXT NOT NULL DEFAULT '',
        artist         TEXT NOT NULL DEFAULT '',
        album          TEXT NOT NULL DEFAULT '',
        rating         INTEGER NOT NULL DEFAULT 0,
        bitrate        INTEGER,
        last_scanned   INTEGER NOT NULL,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS library_roots (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        path      TEXT NOT NULL UNIQUE,
        source    TEXT NOT NULL,
        added_at  INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        local_file_id   INTEGER REFERENCES files(id),
        android_file_id INTEGER REFERENCES files(id),
        direction       TEXT NOT NULL,
        synced_at       INTEGER NOT NULL
      )
    `);

    // Indexes
    this.db.run('CREATE INDEX IF NOT EXISTS idx_files_filename_lower ON files(filename_lower)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_files_source ON files(source)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory)');
  }

  private migrate(): void {
    const result = this.db.exec('SELECT version FROM schema_version LIMIT 1');
    if (result.length === 0 || result[0].values.length === 0) {
      this.db.run('INSERT INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    }
    // Future migrations go here
  }

  private save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // File operations
  upsertFile(record: Omit<DbFileRecord, 'id' | 'created_at' | 'updated_at' | 'last_scanned'>): DbFileRecord {
    const now = Date.now();
    const existing = this.getFileByPath(record.path);

    if (existing) {
      this.db.run(`
        UPDATE files SET
          filename = ?, filename_lower = ?, directory = ?, format = ?,
          size = ?, mtime = ?, title = ?, artist = ?, album = ?,
          rating = ?, bitrate = ?, last_scanned = ?, updated_at = ?
        WHERE path = ?
      `, [
        record.filename, record.filename_lower, record.directory, record.format,
        record.size, record.mtime, record.title, record.artist, record.album,
        record.rating, record.bitrate, now, now, record.path
      ]);
      this.save();
      return this.getFileByPath(record.path)!;
    } else {
      this.db.run(`
        INSERT INTO files (path, source, filename, filename_lower, directory, format, size, mtime, title, artist, album, rating, bitrate, last_scanned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        record.path, record.source, record.filename, record.filename_lower,
        record.directory, record.format, record.size, record.mtime,
        record.title, record.artist, record.album, record.rating, record.bitrate,
        now, now, now
      ]);
      this.save();
      return this.getFileByPath(record.path)!;
    }
  }

  batchUpsertFiles(records: Omit<DbFileRecord, 'id' | 'created_at' | 'updated_at' | 'last_scanned'>[]): void {
    const now = Date.now();

    this.db.run('BEGIN TRANSACTION');
    try {
      for (const record of records) {
        const existing = this.getFileByPath(record.path);
        if (existing) {
          this.db.run(`
            UPDATE files SET
              filename = ?, filename_lower = ?, directory = ?, format = ?,
              size = ?, mtime = ?, title = ?, artist = ?, album = ?,
              rating = ?, bitrate = ?, last_scanned = ?, updated_at = ?
            WHERE path = ?
          `, [
            record.filename, record.filename_lower, record.directory, record.format,
            record.size, record.mtime, record.title, record.artist, record.album,
            record.rating, record.bitrate, now, now, record.path
          ]);
        } else {
          this.db.run(`
            INSERT INTO files (path, source, filename, filename_lower, directory, format, size, mtime, title, artist, album, rating, bitrate, last_scanned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            record.path, record.source, record.filename, record.filename_lower,
            record.directory, record.format, record.size, record.mtime,
            record.title, record.artist, record.album, record.rating, record.bitrate,
            now, now, now
          ]);
        }
      }
      this.db.run('COMMIT');
      this.save();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  getFileByPath(filePath: string): DbFileRecord | null {
    const result = this.db.exec('SELECT * FROM files WHERE path = ?', [filePath]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToFileRecord(result[0].columns, result[0].values[0]);
  }

  getFileById(id: number): DbFileRecord | null {
    const result = this.db.exec('SELECT * FROM files WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToFileRecord(result[0].columns, result[0].values[0]);
  }

  getFilesInTree(directory: string, source: 'local' | 'android'): DbFileRecord[] {
    // Match files where directory starts with the given path
    const result = this.db.exec(
      'SELECT * FROM files WHERE source = ? AND (directory = ? OR directory LIKE ?)',
      [source, directory, directory + '%']
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.rowToFileRecord(result[0].columns, row));
  }

  getFilesBySource(source: 'local' | 'android'): DbFileRecord[] {
    const result = this.db.exec('SELECT * FROM files WHERE source = ?', [source]);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => this.rowToFileRecord(result[0].columns, row));
  }

  findCrossSourceMatches(): CrossSourceMatch[] {
    const result = this.db.exec(`
      SELECT l.*, a.*
      FROM files l
      JOIN files a ON l.filename_lower = a.filename_lower
      WHERE l.source = 'local' AND a.source = 'android'
    `);
    if (result.length === 0) return [];

    const columns = result[0].columns;
    const halfCols = columns.length / 2;

    return result[0].values.map((row: any[]) => {
      const localCols = columns.slice(0, halfCols);
      const androidCols = columns.slice(halfCols);
      const localVals = row.slice(0, halfCols);
      const androidVals = row.slice(halfCols);
      return {
        local: this.rowToFileRecord(localCols, localVals),
        android: this.rowToFileRecord(androidCols, androidVals)
      };
    });
  }

  removeStaleFiles(directory: string, source: 'local' | 'android', currentPaths: Set<string>): number {
    const existing = this.getFilesInTree(directory, source);
    const toRemove = existing.filter(f => !currentPaths.has(f.path));

    if (toRemove.length > 0) {
      this.db.run('BEGIN TRANSACTION');
      try {
        for (const file of toRemove) {
          this.db.run('DELETE FROM files WHERE id = ?', [file.id]);
        }
        this.db.run('COMMIT');
        this.save();
      } catch (error) {
        this.db.run('ROLLBACK');
        throw error;
      }
    }

    return toRemove.length;
  }

  // Library roots
  addLibraryRoot(rootPath: string, source: 'local' | 'android'): LibraryRoot {
    const now = Date.now();
    this.db.run(
      'INSERT OR IGNORE INTO library_roots (path, source, added_at) VALUES (?, ?, ?)',
      [rootPath, source, now]
    );
    this.save();
    return this.getLibraryRoot(rootPath)!;
  }

  removeLibraryRoot(rootPath: string): void {
    this.db.run('DELETE FROM library_roots WHERE path = ?', [rootPath]);
    this.save();
  }

  getLibraryRoots(source?: 'local' | 'android'): LibraryRoot[] {
    const query = source
      ? 'SELECT * FROM library_roots WHERE source = ? ORDER BY added_at'
      : 'SELECT * FROM library_roots ORDER BY added_at';
    const params = source ? [source] : [];
    const result = this.db.exec(query, params);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      id: row[0] as number,
      path: row[1] as string,
      source: row[2] as 'local' | 'android',
      added_at: row[3] as number
    }));
  }

  private getLibraryRoot(rootPath: string): LibraryRoot | null {
    const result = this.db.exec('SELECT * FROM library_roots WHERE path = ?', [rootPath]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return {
      id: row[0] as number,
      path: row[1] as string,
      source: row[2] as 'local' | 'android',
      added_at: row[3] as number
    };
  }

  // Sync log
  logSync(localFileId: number | null, androidFileId: number | null, direction: string): void {
    this.db.run(
      'INSERT INTO sync_log (local_file_id, android_file_id, direction, synced_at) VALUES (?, ?, ?, ?)',
      [localFileId, androidFileId, direction, Date.now()]
    );
    this.save();
  }

  // Artist variant detection
  getArtistVariants(source?: 'local' | 'android'): Array<{ artist: string; count: number }> {
    const query = source
      ? "SELECT artist, COUNT(*) as count FROM files WHERE source = ? AND artist != '' GROUP BY artist ORDER BY count DESC"
      : "SELECT artist, COUNT(*) as count FROM files WHERE artist != '' GROUP BY artist ORDER BY count DESC";
    const params = source ? [source] : [];
    const result = this.db.exec(query, params);
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => ({
      artist: row[0] as string,
      count: row[1] as number
    }));
  }

  // Duplicate detection
  findDuplicates(source?: 'local' | 'android'): Array<{ filename_lower: string; files: DbFileRecord[] }> {
    const sourceFilter = source ? ' AND a.source = ? AND b.source = ?' : '';
    const params = source ? [source, source] : [];

    const result = this.db.exec(`
      SELECT DISTINCT a.filename_lower
      FROM files a
      JOIN files b ON a.filename_lower = b.filename_lower AND a.id < b.id ${sourceFilter}
    `, params);

    if (result.length === 0) return [];

    const dupes: Array<{ filename_lower: string; files: DbFileRecord[] }> = [];
    for (const row of result[0].values) {
      const fname = row[0] as string;
      const filesResult = this.db.exec(
        'SELECT * FROM files WHERE filename_lower = ?' + (source ? ' AND source = ?' : ''),
        source ? [fname, source] : [fname]
      );
      if (filesResult.length > 0) {
        dupes.push({
          filename_lower: fname,
          files: filesResult[0].values.map((r: any[]) => this.rowToFileRecord(filesResult[0].columns, r))
        });
      }
    }

    return dupes;
  }

  // Helpers
  private rowToFileRecord(columns: string[], values: any[]): DbFileRecord {
    const record: any = {};
    columns.forEach((col, i) => {
      record[col] = values[i];
    });
    return record as DbFileRecord;
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
