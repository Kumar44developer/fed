import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { initSchema } from "./schema";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  parseId,
  parsePlaylistName,
  removeFromPlaylist,
} from "./playlists";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO subscriptions (username, full_name) VALUES ('nat', 'Nat Geo')").run();
  const v = db.prepare("INSERT INTO videos (id, username) VALUES (?, ?)");
  for (const id of ["v1", "v2", "v3"]) v.run(id, "nat");
});

const create = (name: string) => {
  const r = createPlaylist(db, name);
  if (!r.ok) throw new Error("create failed");
  return r.id;
};

describe("parsing", () => {
  it("normalizes playlist names", () => {
    expect(parsePlaylistName("  Road   trip ")).toBe("Road trip");
    expect(parsePlaylistName("")).toBeNull();
    expect(parsePlaylistName("x".repeat(101))).toBeNull();
    expect(parsePlaylistName(7)).toBeNull();
  });

  it("parses positive integer ids only", () => {
    expect(parseId("12")).toBe(12);
    expect(parseId(3)).toBe(3);
    for (const bad of ["0", "-1", "1.5", "abc", "", null, undefined, Number.MAX_SAFE_INTEGER + 1])
      expect(parseId(bad)).toBeNull();
  });
});

describe("playlists", () => {
  it("creates playlists and rejects duplicate names", () => {
    const id = create("Favs");
    expect(createPlaylist(db, "Favs")).toEqual({ ok: false, reason: "duplicate_name" });
    expect(listPlaylists(db)).toEqual([{ id, name: "Favs", videos: [] }]);
  });

  it("adds videos in order, with creator info, and ignores duplicates", () => {
    const id = create("Favs");
    expect(addToPlaylist(db, id, "v2")).toBe("added");
    expect(addToPlaylist(db, id, "v1")).toBe("added");
    expect(addToPlaylist(db, id, "v2")).toBe("already_added");
    const [pl] = listPlaylists(db);
    expect(pl.videos.map((v) => v.id)).toEqual(["v2", "v1"]);
    expect(pl.videos[0]).toMatchObject({ full_name: "Nat Geo", username: "nat" });
    expect(pl.videos[0]).not.toHaveProperty("playlist_id");
  });

  it("keeps each playlist's videos separate", () => {
    const a = create("A");
    const b = create("B");
    addToPlaylist(db, a, "v1");
    addToPlaylist(db, b, "v3");
    expect(listPlaylists(db).map((p) => [p.name, p.videos.map((v) => v.id)])).toEqual([
      ["A", ["v1"]],
      ["B", ["v3"]],
    ]);
  });

  it("reports missing playlists and videos", () => {
    const id = create("Favs");
    expect(addToPlaylist(db, 999, "v1")).toBe("playlist_not_found");
    expect(addToPlaylist(db, id, "nope")).toBe("video_not_found");
  });

  it("removes single items", () => {
    const id = create("Favs");
    addToPlaylist(db, id, "v1");
    expect(removeFromPlaylist(db, id, "v1")).toBe(true);
    expect(removeFromPlaylist(db, id, "v1")).toBe(false);
  });

  it("deletes a playlist together with its items", () => {
    const id = create("Favs");
    addToPlaylist(db, id, "v1");
    expect(deletePlaylist(db, id)).toBe(true);
    expect(deletePlaylist(db, id)).toBe(false);
    expect(listPlaylists(db)).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM playlist_items").get()).toEqual({ n: 0 });
  });

  it("skips items whose video was deleted", () => {
    const id = create("Favs");
    addToPlaylist(db, id, "v1");
    addToPlaylist(db, id, "v2");
    db.prepare("DELETE FROM videos WHERE id = 'v1'").run();
    expect(listPlaylists(db)[0].videos.map((v) => v.id)).toEqual(["v2"]);
  });
});
