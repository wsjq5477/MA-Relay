import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { BridgeError } from '../core.js';

export class Database {
  readonly db: DatabaseSync;
  private readonly lockDb: DatabaseSync;
  private closed = false;
  constructor(directory: string, filename: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // A separate SQLite transaction holds an OS file lock for the entire service lifetime.
    // The OS releases it on SIGKILL; no PID-reuse or stale-file unlink race is involved.
    const lockPath = resolve(directory, filename + '.lock');
    this.lockDb = new DatabaseSync(lockPath);
    try {
      chmodSync(lockPath, 0o600);
      this.lockDb.exec('PRAGMA busy_timeout=0; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS holder(pid INTEGER); DELETE FROM holder;');
      this.lockDb.prepare('INSERT INTO holder(pid) VALUES(?)').run(process.pid);
    } catch {
      this.lockDb.close();
      throw new BridgeError('DATA_LOCKED', 'Data directory is already in use or cannot be locked');
    }
    let opened: DatabaseSync | undefined;
    try {
      opened = new DatabaseSync(resolve(directory, filename));
      this.db = opened;
      chmodSync(resolve(directory, filename), 0o600);
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
      const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      if (version.user_version > 1) throw new BridgeError('SCHEMA_VERSION', 'Database version is newer than this application');
      this.db.exec('PRAGMA user_version=1');
    } catch {
      try { opened?.close(); } catch { /* Constructor may not have opened it. */ }
      this.lockDb.close();
      throw new BridgeError('STORAGE_UNAVAILABLE', 'Cannot open compatible writable database');
    }
  }
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.db.close(); }
    finally {
      this.lockDb.close();
    }
  }
}
