import type Database from "better-sqlite3";
import type { IgVideo } from "./apify";

export const DEFAULT_POLL_INTERVAL_MS = 3 * 60 * 1000;
export const DEFAULT_POLL_INITIAL_DELAY_MS = 15_000;

export type FetchVideos = (username: string) => Promise<IgVideo[]>;

export interface UpsertResult {
  inserted: number;
  updated: number;
}

export interface VideoIngestor {
  /** Fetches and stores a user's videos. Concurrent calls for the same user share one fetch. */
  refresh(username: string): Promise<UpsertResult>;
}

export interface PollSummary {
  skipped: boolean;
  users: number;
  failed: number;
  inserted: number;
  updated: number;
}

export interface Poller {
  start(): void;
  stop(): void;
  /** Polls every subscription once. Returns `skipped: true` if a poll is already running. */
  runOnce(): Promise<PollSummary>;
  readonly running: boolean;
}

export interface PollerOptions {
  listUsernames: () => string[];
  refresh: (username: string) => Promise<UpsertResult>;
  intervalMs?: number;
  initialDelayMs?: number;
  logger?: Pick<Console, "log" | "error">;
}

/**
 * Inserts new videos and refreshes existing ones in a single transaction.
 *
 * Uses an upsert instead of INSERT OR REPLACE so rows are updated in place:
 * REPLACE deletes and re-inserts, which changes the rowid and would silently
 * drop any data stored only on the old row. Empty values from a partial
 * scrape never overwrite good data (Instagram CDN URLs expire, so non-empty
 * URLs are always refreshed).
 */
export function upsertVideos(db: Database.Database, username: string, videos: IgVideo[]): UpsertResult {
  const exists = db.prepare("SELECT 1 FROM videos WHERE id = ?");
  const upsert = db.prepare(
    `INSERT INTO videos (id, username, caption, video_url, thumbnail_url, post_url, timestamp)
     VALUES (@id, @username, @caption, @videoUrl, @thumbnailUrl, @postUrl, @timestamp)
     ON CONFLICT(id) DO UPDATE SET
       username      = excluded.username,
       caption       = COALESCE(excluded.caption, videos.caption),
       video_url     = COALESCE(excluded.video_url, videos.video_url),
       thumbnail_url = COALESCE(excluded.thumbnail_url, videos.thumbnail_url),
       post_url      = COALESCE(excluded.post_url, videos.post_url),
       timestamp     = COALESCE(excluded.timestamp, videos.timestamp),
       fetched_at    = datetime('now')`
  );
  const orNull = (s: string | undefined | null) => (s ? s : null);

  return db.transaction(() => {
    const result: UpsertResult = { inserted: 0, updated: 0 };
    const seen = new Set<string>();
    for (const v of videos) {
      if (!v.id || seen.has(v.id)) continue;
      seen.add(v.id);
      const isNew = !exists.get(v.id);
      upsert.run({
        id: v.id,
        username,
        caption: orNull(v.caption),
        videoUrl: orNull(v.videoUrl),
        thumbnailUrl: orNull(v.thumbnailUrl),
        postUrl: orNull(v.postUrl),
        timestamp: orNull(v.timestamp),
      });
      result[isNew ? "inserted" : "updated"]++;
    }
    return result;
  })();
}

export function listVideos(db: Database.Database, username: string) {
  return db.prepare("SELECT * FROM videos WHERE username = ? ORDER BY timestamp DESC, id").all(username);
}

export function createVideoIngestor(db: Database.Database, fetchVideos: FetchVideos): VideoIngestor {
  const inFlight = new Map<string, Promise<UpsertResult>>();
  return {
    refresh(username) {
      const key = username.toLowerCase();
      let pending = inFlight.get(key);
      if (!pending) {
        pending = (async () => upsertVideos(db, username, await fetchVideos(username)))().finally(() =>
          inFlight.delete(key)
        );
        inFlight.set(key, pending);
      }
      return pending;
    },
  };
}

/** Reads INSTAFEED_POLL_INTERVAL_MS. `0` disables polling; invalid values fall back to the default. */
export function resolvePollInterval(env: Record<string, string | undefined> = process.env): number {
  const raw = env.INSTAFEED_POLL_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_POLL_INTERVAL_MS;
  const n = Number(raw);
  if (n === 0) return 0;
  return Number.isSafeInteger(n) && n >= 10_000 ? n : DEFAULT_POLL_INTERVAL_MS;
}

/**
 * Background poller. The next poll is scheduled only after the previous one
 * finishes, so slow Apify runs (often longer than the interval) never overlap.
 * One failing account does not stop the others.
 */
export function createPoller({
  listUsernames,
  refresh,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  initialDelayMs = DEFAULT_POLL_INITIAL_DELAY_MS,
  logger = console,
}: PollerOptions): Poller {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let running = false;

  const schedule = (delay: number) => {
    timer = setTimeout(async () => {
      timer = undefined;
      await runOnce();
      if (started) schedule(intervalMs);
    }, delay);
    timer.unref?.();
  };

  async function runOnce(): Promise<PollSummary> {
    const summary: PollSummary = { skipped: false, users: 0, failed: 0, inserted: 0, updated: 0 };
    if (running) return { ...summary, skipped: true };
    running = true;
    try {
      let usernames: string[];
      try {
        usernames = listUsernames();
      } catch (e) {
        logger.error("[poller] could not read subscriptions:", (e as Error).message);
        return summary;
      }
      for (const username of usernames) {
        summary.users++;
        try {
          const r = await refresh(username);
          summary.inserted += r.inserted;
          summary.updated += r.updated;
        } catch (e) {
          summary.failed++;
          logger.error(`[poller] ${username}:`, (e as Error).message);
        }
      }
      return summary;
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      schedule(initialDelayMs);
      logger.log(`[poller] background Instagram poller started (every ${Math.round(intervalMs / 1000)}s)`);
    },
    stop() {
      started = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    runOnce,
    get running() {
      return running;
    },
  };
}
