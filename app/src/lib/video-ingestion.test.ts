import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IgVideo } from "./apify";
import { initSchema } from "./schema";
import {
  DEFAULT_POLL_INTERVAL_MS,
  createPoller,
  createVideoIngestor,
  listVideos,
  resolvePollInterval,
  upsertVideos,
} from "./video-ingestion";

const video = (id: string, over: Partial<IgVideo> = {}): IgVideo => ({
  id,
  caption: `caption ${id}`,
  videoUrl: `https://scontent.cdninstagram.com/${id}.mp4`,
  thumbnailUrl: `https://scontent.cdninstagram.com/${id}.jpg`,
  postUrl: `https://www.instagram.com/reel/${id}/`,
  timestamp: "2026-01-01T00:00:00.000Z",
  ...over,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

const silent = { log: () => {}, error: () => {} };

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  initSchema(db);
});

describe("upsertVideos", () => {
  it("inserts new videos and updates existing ones in place", () => {
    expect(upsertVideos(db, "nat", [video("a"), video("b")])).toEqual({ inserted: 2, updated: 0 });
    const rowidBefore = db.prepare("SELECT rowid FROM videos WHERE id = 'a'").pluck().get();

    const fresh = video("a", { videoUrl: "https://scontent.cdninstagram.com/a-new.mp4" });
    expect(upsertVideos(db, "nat", [fresh, video("c")])).toEqual({ inserted: 1, updated: 1 });

    const row = db.prepare("SELECT rowid, video_url FROM videos WHERE id = 'a'").get() as {
      rowid: number;
      video_url: string;
    };
    expect(row.rowid).toBe(rowidBefore);
    expect(row.video_url).toBe(fresh.videoUrl);
    expect(db.prepare("SELECT COUNT(*) FROM videos").pluck().get()).toBe(3);
  });

  it("does not overwrite good data with empty values from a partial scrape", () => {
    upsertVideos(db, "nat", [video("a")]);
    upsertVideos(db, "nat", [video("a", { caption: "", videoUrl: "", thumbnailUrl: "" })]);
    expect(db.prepare("SELECT caption, video_url, thumbnail_url FROM videos").get()).toEqual({
      caption: "caption a",
      video_url: "https://scontent.cdninstagram.com/a.mp4",
      thumbnail_url: "https://scontent.cdninstagram.com/a.jpg",
    });
  });

  it("skips duplicates and items without an id", () => {
    expect(upsertVideos(db, "nat", [video("a"), video("a"), video("")])).toEqual({ inserted: 1, updated: 0 });
  });

  it("is atomic", () => {
    const bad = { ...video("b"), timestamp: {} as unknown as string }; // not bindable -> throws
    expect(() => upsertVideos(db, "nat", [video("a"), bad])).toThrow();
    expect(db.prepare("SELECT COUNT(*) FROM videos").pluck().get()).toBe(0);
  });

  it("lists a user's videos newest first", () => {
    upsertVideos(db, "nat", [
      video("old", { timestamp: "2025-01-01T00:00:00Z" }),
      video("new", { timestamp: "2026-06-01T00:00:00Z" }),
    ]);
    upsertVideos(db, "other", [video("x")]);
    expect((listVideos(db, "nat") as { id: string }[]).map((v) => v.id)).toEqual(["new", "old"]);
  });
});

describe("createVideoIngestor", () => {
  it("coalesces concurrent refreshes of the same user into one fetch", async () => {
    const d = deferred<IgVideo[]>();
    const fetchVideos = vi.fn(() => d.promise);
    const ingestor = createVideoIngestor(db, fetchVideos);

    const p1 = ingestor.refresh("nat");
    const p2 = ingestor.refresh("NAT");
    expect(fetchVideos).toHaveBeenCalledTimes(1);
    d.resolve([video("a")]);
    await expect(Promise.all([p1, p2])).resolves.toEqual([
      { inserted: 1, updated: 0 },
      { inserted: 1, updated: 0 },
    ]);

    // Once settled, the next refresh fetches again.
    fetchVideos.mockResolvedValueOnce([video("a")]);
    await expect(ingestor.refresh("nat")).resolves.toEqual({ inserted: 0, updated: 1 });
    expect(fetchVideos).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const fetchVideos = vi.fn<(u: string) => Promise<IgVideo[]>>().mockRejectedValueOnce(new Error("apify down"));
    const ingestor = createVideoIngestor(db, fetchVideos);
    await expect(ingestor.refresh("nat")).rejects.toThrow("apify down");
    fetchVideos.mockResolvedValueOnce([video("a")]);
    await expect(ingestor.refresh("nat")).resolves.toEqual({ inserted: 1, updated: 0 });
  });
});

describe("resolvePollInterval", () => {
  it.each([
    [undefined, DEFAULT_POLL_INTERVAL_MS],
    ["", DEFAULT_POLL_INTERVAL_MS],
    ["0", 0],
    ["60000", 60_000],
    ["500", DEFAULT_POLL_INTERVAL_MS],
    ["soon", DEFAULT_POLL_INTERVAL_MS],
  ])("%j -> %i", (raw, expected) => {
    expect(resolvePollInterval({ INSTAFEED_POLL_INTERVAL_MS: raw })).toBe(expected);
  });
});

describe("createPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("polls every user and keeps going when one fails", async () => {
    const refresh = vi.fn(async (u: string) => {
      if (u === "broken") throw new Error("private account");
      return { inserted: 1, updated: 2 };
    });
    const logger = { log: vi.fn(), error: vi.fn() };
    const poller = createPoller({ listUsernames: () => ["a", "broken", "b"], refresh, logger });

    await expect(poller.runOnce()).resolves.toEqual({ skipped: false, users: 3, failed: 1, inserted: 2, updated: 4 });
    expect(logger.error).toHaveBeenCalledWith("[poller] broken:", "private account");
  });

  it("never runs two polls at once", async () => {
    const d = deferred<{ inserted: number; updated: number }>();
    const refresh = vi.fn(() => d.promise);
    const poller = createPoller({ listUsernames: () => ["a"], refresh, logger: silent });

    const first = poller.runOnce();
    expect(poller.running).toBe(true);
    await expect(poller.runOnce()).resolves.toMatchObject({ skipped: true });
    d.resolve({ inserted: 0, updated: 0 });
    await first;
    expect(poller.running).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("schedules the next poll only after the previous one finishes", async () => {
    const pending: ReturnType<typeof deferred<{ inserted: number; updated: number }>>[] = [];
    const refresh = vi.fn(() => {
      const d = deferred<{ inserted: number; updated: number }>();
      pending.push(d);
      return d.promise;
    });
    const poller = createPoller({ listUsernames: () => ["a"], refresh, intervalMs: 1000, initialDelayMs: 100, logger: silent });
    poller.start();
    poller.start(); // idempotent

    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(1);

    // A slow poll (5x the interval) must not cause overlapping runs.
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);

    pending[0].resolve({ inserted: 0, updated: 0 });
    await vi.advanceTimersByTimeAsync(999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    poller.stop();
    pending[1].resolve({ inserted: 0, updated: 0 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("survives a failure to read subscriptions", async () => {
    const poller = createPoller({
      listUsernames: () => {
        throw new Error("db locked");
      },
      refresh: vi.fn(),
      logger: silent,
    });
    await expect(poller.runOnce()).resolves.toMatchObject({ skipped: false, users: 0 });
    expect(poller.running).toBe(false);
  });
});
