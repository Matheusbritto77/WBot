declare const Bun: any;
import { join } from 'path';
import { getDataPath, IS_HEADLESS } from '../utils/paths';
import { createRequire } from 'module';

export class DatabaseService {
  private db: any = null;

  public init() {
    if (this.db) return;
    const dbPath = join(getDataPath(), 'database.sqlite');

    try {
      const require = createRequire(import.meta.url);
      if (IS_HEADLESS && typeof Bun !== 'undefined') {
        // Em modo servidor (VPS), usamos o bun:sqlite que já vem embutido e não dá erro de libstdc++
        console.log('[Database] Usando motor nativo bun:sqlite (VPS)');
        const { Database } = require('bun:sqlite');
        this.db = new Database(dbPath);
      } else {
        // No desktop (Windows), continuamos com o better-sqlite3
        console.log('[Database] Usando motor better-sqlite3 (Desktop)');
        const BetterDatabase = require('better-sqlite3');
        this.db = new BetterDatabase(dbPath);
      }
    } catch (err: any) {
      console.error('[Database] Erro fatal ao carregar o driver do banco:', err.message);
      throw err;
    }

    // Base schema
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
    `);

    // Migration: Add columns to existing automation_flows if missing
    try {
      const columns = this.db.prepare("PRAGMA table_info(automation_flows)").all() as any[];
      const columnNames = columns.map(c => c.name);

      if (!columnNames.includes('trigger_type')) {
        this.db.exec("ALTER TABLE automation_flows ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'keyword'");
      }
      if (!columnNames.includes('trigger_value')) {
        this.db.exec("ALTER TABLE automation_flows ADD COLUMN trigger_value TEXT DEFAULT ''");
      }
    } catch (e) {
      console.error("[Database] Migration error:", e);
    }

    // Initialize message counts if not exists
    this.db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES ('total_messages', 0)").run();
    this.db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES ('monthly_messages', 0)").run();
  }

  private getDb(): any {
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
