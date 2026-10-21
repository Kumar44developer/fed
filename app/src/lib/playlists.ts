import type Database from "better-sqlite3";

export const MAX_PLAYLIST_NAME_LENGTH = 100;

export interface PlaylistVideo {
  id: string;
  username: string;
  caption: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  post_url: string | null;
  timestamp: string | null;
  full_name: string | null;
  profile_pic: string | null;
  added_at: string;
}

export interface Playlist {
  id: number;
  name: string;
  videos: PlaylistVideo[];
}

export type CreateResult = { ok: true; id: number } | { ok: false; reason: "duplicate_name" };
export type AddResult = "added" | "already_added" | "playlist_not_found" | "video_not_found";

/** Trims and validates a playlist name; returns null when invalid. */
export function parsePlaylistName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_PLAYLIST_NAME_LENGTH) return null;
  return name;
}

/** Parses a positive integer id from a body field or query string. */
export function parseId(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * All playlists with their videos in two queries (no N+1). Videos are ordered
 * by when they were added; items whose video no longer exists are skipped.
 */
export function listPlaylists(db: Database.Database): Playlist[] {
  const playlists = db
    .prepare("SELECT id, name FROM playlists ORDER BY id")
    .all() as { id: number; name: string }[];
  const items = db
    .prepare(
      `SELECT pi.playlist_id, pi.added_at, v.*, s.full_name, s.profile_pic
         FROM playlist_items pi
         JOIN videos v ON v.id = pi.video_id
         LEFT JOIN subscriptions s ON s.username = v.username
        ORDER BY pi.added_at, pi.rowid`
    )
    .all() as (PlaylistVideo & { playlist_id: number })[];

  const byPlaylist = new Map<number, PlaylistVideo[]>(playlists.map((p) => [p.id, []]));
  for (const { playlist_id, ...video } of items) byPlaylist.get(playlist_id)?.push(video);
  return playlists.map((p) => ({ ...p, videos: byPlaylist.get(p.id) ?? [] }));
}

export function createPlaylist(db: Database.Database, name: string): CreateResult {
  const info = db.prepare("INSERT OR IGNORE INTO playlists (name) VALUES (?)").run(name);
  if (info.changes === 0) return { ok: false, reason: "duplicate_name" };
  return { ok: true, id: Number(info.lastInsertRowid) };
}

export function addToPlaylist(db: Database.Database, playlistId: number, videoId: string): AddResult {
  if (!db.prepare("SELECT 1 FROM playlists WHERE id = ?").get(playlistId)) return "playlist_not_found";
  if (!db.prepare("SELECT 1 FROM videos WHERE id = ?").get(videoId)) return "video_not_found";
  const info = db
    .prepare("INSERT OR IGNORE INTO playlist_items (playlist_id, video_id) VALUES (?, ?)")
    .run(playlistId, videoId);
  return info.changes > 0 ? "added" : "already_added";
}

/** Returns true when the video was in the playlist. */
export function removeFromPlaylist(db: Database.Database, playlistId: number, videoId: string): boolean {
  return (
    db
      .prepare("DELETE FROM playlist_items WHERE playlist_id = ? AND video_id = ?")
      .run(playlistId, videoId).changes > 0
  );
}

/** Deletes a playlist and its items atomically. Returns true when it existed. */
export function deletePlaylist(db: Database.Database, playlistId: number): boolean {
  return db.transaction(() => {
    db.prepare("DELETE FROM playlist_items WHERE playlist_id = ?").run(playlistId);
    return db.prepare("DELETE FROM playlists WHERE id = ?").run(playlistId).changes > 0;
  })();
}
