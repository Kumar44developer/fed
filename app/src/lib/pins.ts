import type Database from "better-sqlite3";

export interface PinnedVideo {
  id: string;
  username: string;
  caption: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  post_url: string | null;
  timestamp: string | null;
  full_name: string | null;
  profile_pic: string | null;
  pinned_at: string;
}

export type PinResult = "pinned" | "already_pinned" | "video_not_found";

/**
 * Pinned videos, most recently pinned first. Pins whose video was removed
 * (e.g. after unsubscribing) are skipped rather than returned half-empty.
 */
export function listPins(db: Database.Database): PinnedVideo[] {
  return db
    .prepare(
      `SELECT v.*, s.full_name, s.profile_pic, p.pinned_at
         FROM pins p
         JOIN videos v ON v.id = p.video_id
         LEFT JOIN subscriptions s ON s.username = v.username
        ORDER BY p.pinned_at DESC, p.rowid DESC`
    )
    .all() as PinnedVideo[];
}

/** Pins a video. Re-pinning is a no-op so a video keeps its original position. */
export function pinVideo(db: Database.Database, videoId: string): PinResult {
  const exists = db.prepare("SELECT 1 FROM videos WHERE id = ?").get(videoId);
  if (!exists) return "video_not_found";
  const info = db.prepare("INSERT OR IGNORE INTO pins (video_id) VALUES (?)").run(videoId);
  return info.changes > 0 ? "pinned" : "already_pinned";
}

/** Returns true when a pin was removed. */
export function unpinVideo(db: Database.Database, videoId: string): boolean {
  return db.prepare("DELETE FROM pins WHERE video_id = ?").run(videoId).changes > 0;
}
