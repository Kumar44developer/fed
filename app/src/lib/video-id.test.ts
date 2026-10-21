import { describe, expect, it } from "vitest";
import { parseVideoId } from "./video-id";

describe("parseVideoId", () => {
  it("trims and accepts normal ids", () => {
    expect(parseVideoId(" 3141592653_42 ")).toBe("3141592653_42");
  });

  it.each([undefined, null, 42, "", "   ", "x".repeat(129), { id: "a" }])("rejects %j", (v) => {
    expect(parseVideoId(v)).toBeNull();
  });
});
