import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { initSchema } from "./schema";
import { listPins, pinVideo, unpinVideo } from "./pins";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initSchema(db);
  db.prepare("INSERT INTO subscriptions (username, full_name, profile_pic) VALUES ('nat', 'Nat Geo', 'p.jpg')").run();
  const v = db.prepare("INSERT INTO videos (id, username, caption) VALUES (?, ?, ?)");
  v.run("v1", "nat", "first");
  v.run("v2", "nat", "second");
  v.run("v3", "ghost", "creator not subscribed");
});

describe("pins", () => {
  it("pins existing videos and lists newest pin first with creator info", () => {
    expect(pinVideo(db, "v1")).toBe("pinned");
    expect(pinVideo(db, "v2")).toBe("pinned");
    const pins = listPins(db);
    expect(pins.map((p) => p.id)).toEqual(["v2", "v1"]);
    expect(pins[0]).toMatchObject({ full_name: "Nat Geo", profile_pic: "p.jpg", caption: "second" });
    expect(pins[0].pinned_at).toBeTruthy();
  });

  it("is idempotent and keeps the original position when re-pinned", () => {
    pinVideo(db, "v1");
    pinVideo(db, "v2");
    expect(pinVideo(db, "v1")).toBe("already_pinned");
    expect(listPins(db).map((p) => p.id)).toEqual(["v2", "v1"]);
  });

  it("refuses to pin unknown videos", () => {
    expect(pinVideo(db, "nope")).toBe("video_not_found");
    expect(listPins(db)).toEqual([]);
  });

  it("still lists videos whose creator is no longer subscribed", () => {
    pinVideo(db, "v3");
    expect(listPins(db)).toMatchObject([{ id: "v3", full_name: null }]);
  });

  it("unpins and reports whether anything changed", () => {
    pinVideo(db, "v1");
    expect(unpinVideo(db, "v1")).toBe(true);
    expect(unpinVideo(db, "v1")).toBe(false);
    expect(listPins(db)).toEqual([]);
  });

  it("hides pins whose video was deleted (e.g. after unsubscribing)", () => {
    pinVideo(db, "v1");
    pinVideo(db, "v2");
    db.prepare("DELETE FROM videos WHERE id = 'v1'").run();
    expect(listPins(db).map((p) => p.id)).toEqual(["v2"]);
  });
});
