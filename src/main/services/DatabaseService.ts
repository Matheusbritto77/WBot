import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';

export class DatabaseService {
  private db: Database.Database | null = null;

  public init() {
    if (this.db) return;
    const dbPath = join(app.getPath('userData'), 'database.sqlite');
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id TEXT PRIMARY KEY,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS bot_stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'sse',
        url TEXT,
        command TEXT,
        args TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        schedule TEXT NOT NULL,
        prompt TEXT NOT NULL,
        target_jid TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loop_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        last_result TEXT,
        iterations INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS automation_flows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        nodes TEXT NOT NULL DEFAULT '[]',
        edges TEXT NOT NULL DEFAULT '[]',
        trigger_type TEXT NOT NULL DEFAULT 'keyword',
        trigger_value TEXT DEFAULT '',
        enabled INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Initialize message counts if not exists
      INSERT OR IGNORE INTO bot_stats (key, value) VALUES ('total_messages', 0);
      INSERT OR IGNORE INTO bot_stats (key, value) VALUES ('monthly_messages', 0);
    `);
  }

  private getDb(): Database.Database {
    if (!this.db) {
      this.init();
    }
    return this.db!;
  }

  public query(sql: string, params: any[] = []) {
    return this.getDb().prepare(sql).all(...params);
  }

  public get(sql: string, params: any[] = []) {
    return this.getDb().prepare(sql).get(...params);
  }

  public run(sql: string, params: any[] = []) {
    return this.getDb().prepare(sql).run(...params);
  }

  public setSetting(key: string, value: string) {
    this.getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  public getSetting(key: string): string | null {
    const row = this.getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  public incrementStat(key: string) {
    this.getDb().prepare('UPDATE bot_stats SET value = value + 1 WHERE key = ?').run(key);
  }

  public getStat(key: string): number {
    const row = this.getDb().prepare('SELECT value FROM bot_stats WHERE key = ?').get(key) as { value: number } | undefined;
    return row ? row.value : 0;
  }
}

export const databaseService = new DatabaseService();
