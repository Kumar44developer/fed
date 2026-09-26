import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "instafeed.db"));


db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    profile_pic TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
