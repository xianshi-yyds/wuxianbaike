import Database from 'better-sqlite3';
import path from 'path';

import { APP_DATA_DIR, ensureDirectory } from '@/lib/server/storage';

interface GlobalDatabaseCache {
  __wuxianKnowledgeDb?: Database.Database;
}

const globalCache = globalThis as typeof globalThis & GlobalDatabaseCache;

const initializeDatabase = (db: Database.Database) => {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
};

export const getDatabase = () => {
  if (globalCache.__wuxianKnowledgeDb) {
    return globalCache.__wuxianKnowledgeDb;
  }

  ensureDirectory(APP_DATA_DIR);
  const db = new Database(path.join(APP_DATA_DIR, 'app.db'));
  initializeDatabase(db);
  globalCache.__wuxianKnowledgeDb = db;
  return db;
};
