import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername, toProfile, toVideos } from "./apify";

describe("isValidUsername", () => {
  it.each(["natgeo", "some.user", "user_123", "a", "x".repeat(30)])("accepts %s", (u) => {
    expect(isValidUsername(u)).toBe(true);
  });

  it.each(["", "has space", "emoji😀", "semi;colon", "x".repeat(31), "../etc"])("rejects %j", (u) => {
    expect(isValidUsername(u)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidUsername(undefined)).toBe(false);
    expect(isValidUsername(42)).toBe(false);
    expect(isValidUsername({ username: "a" })).toBe(false);
  });
});

describe("normalizeUsername", () => {
  it("strips @, whitespace and lowercases", () => {
    expect(normalizeUsername("  @Some.User ")).toBe("some.user");
    expect(normalizeUsername("nat geo")).toBe("natgeo");
  });
});

describe("toProfile", () => {
  it("prefers the HD profile picture and fills defaults", () => {
    expect(toProfile({ username: "a", profilePicUrl: "lo", profilePicUrlHD: "hd" })).toEqual({
      username: "a",
      fullName: "",
      profilePicUrl: "hd",
      followersCount: 0,
      biography: "",
    });
  });
});

describe("toVideos", () => {
  it("keeps only items with a video url and an id", () => {
    const out = toVideos([
      { id: "1", videoUrl: "v1", caption: "hi", displayUrl: "t1", url: "p1", timestamp: "2026-01-01" },
      { id: "2", caption: "image post" },
      { videoUrl: "v3" },
      { shortCode: "abc", videoUrl: "v4" },
    ]);
    expect(out.map((v) => v.id)).toEqual(["1", "abc"]);
    expect(out[0]).toEqual({
      id: "1",
      caption: "hi",
      videoUrl: "v1",
      thumbnailUrl: "t1",
      postUrl: "p1",
      timestamp: "2026-01-01",
    });
    expect(out[1].postUrl).toBe("https://www.instagram.com/p/abc/");
  });
});
