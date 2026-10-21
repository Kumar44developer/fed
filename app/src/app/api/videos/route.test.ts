import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "@/lib/db";
import { req } from "@/test/http";

const fetchVideos = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apify")>()),
  fetchVideos,
}));

const { GET } = await import("./route");

const reel = (id: string, timestamp = "2026-01-01T00:00:00Z") => ({
  id,
  caption: id,
  videoUrl: `https://scontent.cdninstagram.com/${id}.mp4`,
  thumbnailUrl: "",
  postUrl: "",
  timestamp,
});

const get = (qs: string) => GET(req(`/api/videos?${qs}`));

beforeEach(() => {
  db.exec("DELETE FROM videos");
  fetchVideos.mockReset();
});

describe("/api/videos", () => {
  it("validates the username", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("username=" + encodeURIComponent("bad name!"))).status).toBe(400);
  });

  it("fetches on first request, then serves from the cache", async () => {
    fetchVideos.mockResolvedValue([reel("a", "2025-01-01T00:00:00Z"), reel("b")]);
    const first = await (await get("username=nat")).json();
    expect(first.map((v: { id: string }) => v.id)).toEqual(["b", "a"]);
    await get("username=nat");
    expect(fetchVideos).toHaveBeenCalledTimes(1);
  });

  it("refresh=1 fetches again and coalesces concurrent refreshes", async () => {
    fetchVideos.mockResolvedValue([reel("a")]);
    await get("username=nat");
    fetchVideos.mockClear();

    const [r1, r2] = await Promise.all([get("username=nat&refresh=1"), get("username=nat&refresh=1")]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(fetchVideos).toHaveBeenCalledTimes(1);
  });

  it("serves stale data when a refresh fails", async () => {
    fetchVideos.mockResolvedValueOnce([reel("a")]);
    await get("username=nat");
    fetchVideos.mockRejectedValueOnce(new Error("apify down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get("username=nat&refresh=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-instafeed-stale")).toBe("1");
    expect(await res.json()).toHaveLength(1);
    errSpy.mockRestore();
  });

  it("returns 502 without leaking upstream errors when nothing is cached", async () => {
    fetchVideos.mockRejectedValueOnce(new Error("APIFY_TOKEN is not configured"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get("username=nat");
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("APIFY_TOKEN");
    errSpy.mockRestore();
  });
});
