import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function openDb(dbPath: string): Db {
  ensureDirForFile(dbPath);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

export function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      rating INTEGER NOT NULL DEFAULT 1000,
      pro INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      mode TEXT NOT NULL,                 -- ai_medium | ai_hard | online | local
      player1_id TEXT,                    -- nullable for guest
      player1_name TEXT NOT NULL,
      player2_id TEXT,
      player2_name TEXT NOT NULL,
      winner INTEGER,                     -- 1 | 2 | 0 draw | NULL in-progress
      finished_at INTEGER,
      p1_rating_before INTEGER,
      p1_rating_after INTEGER,
      p2_rating_before INTEGER,
      p2_rating_after INTEGER
    );

    CREATE TABLE IF NOT EXISTS moves (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      move_index INTEGER NOT NULL,
      player INTEGER NOT NULL,            -- 1 | 2
      col INTEGER NOT NULL,               -- 0..6
      row INTEGER NOT NULL,               -- 0..5
      created_at INTEGER NOT NULL,
      analysis_score REAL,                -- 0..1 (paid feature)
      analysis_text TEXT,
      FOREIGN KEY(game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT NOT NULL,
      friend_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, friend_user_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(friend_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id, move_index);
    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
  `);

  // Lightweight migrations for existing DBs
  const userCols = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!userCols.has("rating")) db.exec(`ALTER TABLE users ADD COLUMN rating INTEGER NOT NULL DEFAULT 1000;`);
  if (!userCols.has("pro")) db.exec(`ALTER TABLE users ADD COLUMN pro INTEGER NOT NULL DEFAULT 0;`);
}

