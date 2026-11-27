import { DatabaseSync } from 'node:sqlite';
import { GateError, type Principal } from './auth.ts';

/** One SQLite writer; claims, limits and bans are one atomic transaction across restarts. */
export class GateStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS replay (key TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS bans (identity TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS devices (identity TEXT NOT NULL, device TEXT NOT NULL, user TEXT NOT NULL, PRIMARY KEY(identity,device));`);
  }
  claim(p: Principal, now: number): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM replay WHERE expires <= ?').run(now);
      this.db.prepare('DELETE FROM limits WHERE start < ?').run(now - 120);
      if (this.db.prepare('SELECT 1 FROM bans WHERE identity=?').get(p.identityHash)) throw new GateError(403, 'identity_unavailable');
      for (const key of p.replayKeys) {
        if (this.db.prepare('SELECT 1 FROM replay WHERE key=?').get(key)) throw new GateError(409, 'authorization_replayed');
      }
      this.consume('identity:' + p.identityHash, 6, now);
      this.consume('node:' + p.meshId + ':' + p.nodeId, 120, now);
      for (const key of p.replayKeys) this.db.prepare('INSERT INTO replay VALUES (?,?)').run(key, p.expiresAt);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private consume(key: string, max: number, now: number): void {
    const row = this.db.prepare('SELECT start,count FROM limits WHERE key=?').get(key) as { start: number; count: number } | undefined;
    if (!row || now - row.start >= 60) this.db.prepare('INSERT OR REPLACE INTO limits VALUES (?,?,1)').run(key, now);
    else {
      if (row.count >= max) throw new GateError(429, 'rate_limited');
      this.db.prepare('UPDATE limits SET count=count+1 WHERE key=?').run(key);
    }
  }
  ban(identityHash: string): void { this.db.prepare('INSERT OR IGNORE INTO bans VALUES (?)').run(identityHash); }
  remember(identity: string, user: string, device: string): void { this.db.prepare('INSERT OR REPLACE INTO devices VALUES (?,?,?)').run(identity, device, user); }
  owns(identity: string, device: string): string | undefined {
    return (this.db.prepare('SELECT user FROM devices WHERE identity=? AND device=?').get(identity, device) as { user: string } | undefined)?.user;
  }
  forget(identity: string, device: string): void { this.db.prepare('DELETE FROM devices WHERE identity=? AND device=?').run(identity, device); }
  close(): void { this.db.close(); }
}
