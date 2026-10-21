import Database from "better-sqlite3";
import path from "node:path";
import { initSchema } from "./schema";

/**
 * Resolves where the SQLite database lives. `INSTAFEED_DB_PATH` lets tests use
 * `:memory:` and lets deployments put the file on a persistent volume.
 */
export function resolveDbPath(env: Record<string, string | undefined> = process.env): string {
  return env.INSTAFEED_DB_PATH || path.join(process.cwd(), "instafeed.db");
}

export function openDatabase(file: string = resolveDbPath()): Database.Database {
  const db = new Database(file);
  if (file !== ":memory:") db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

// Reuse one connection across hot reloads in development.
const g = globalThis as { __instafeedDb?: Database.Database };
const db = g.__instafeedDb ?? openDatabase();
if (process.env.NODE_ENV === "development") g.__instafeedDb = db;

export default db;
