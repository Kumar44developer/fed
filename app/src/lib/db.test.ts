import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase, resolveDbPath } from "./db";

describe("resolveDbPath", () => {
  it("uses INSTAFEED_DB_PATH when set", () => {
    expect(resolveDbPath({ INSTAFEED_DB_PATH: "/data/x.db" })).toBe("/data/x.db");
  });

  it("defaults to ./instafeed.db", () => {
    expect(resolveDbPath({})).toBe(path.join(process.cwd(), "instafeed.db"));
  });
});

describe("openDatabase", () => {
  it("creates every table and is idempotent", () => {
    const db = openDatabase(":memory:");
    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]
    )
      .map((t) => t.name)
      .filter((n) => !n.startsWith("sqlite_"));
    expect(tables).toEqual([
      "history",
      "pins",
      "playlist_items",
      "playlists",
      "section_members",
      "sections",
      "subscriptions",
      "videos",
    ]);
    // running the schema again must not throw
    expect(() => openDatabase(":memory:")).not.toThrow();
  });
});
