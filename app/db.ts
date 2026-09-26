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

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    caption TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    post_url TEXT,
    timestamp TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS section_members (
    section_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    PRIMARY KEY (section_id, username)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    playlist_id INTEGER NOT NULL,
    video_id TEXT NOT NULL,
