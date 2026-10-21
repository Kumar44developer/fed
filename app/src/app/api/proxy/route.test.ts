import { afterEach, describe, expect, it, vi } from "vitest";
import { req } from "@/test/http";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("/api/proxy", () => {
  it("rejects missing, non-https and non-CDN urls before fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect((await GET(req("/api/proxy"))).status).toBe(400);
    expect((await GET(req("/api/proxy?url=" + encodeURIComponent("http://a.cdninstagram.com/x")))).status).toBe(400);
    expect((await GET(req("/api/proxy?url=" + encodeURIComponent("https://example.com/x")))).status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("streams allowed media", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img", { status: 200, headers: { "content-type": "image/jpeg" } }))
    );
    const res = await GET(req("/api/proxy?url=" + encodeURIComponent("https://scontent.cdninstagram.com/a.jpg")));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(await res.text()).toBe("img");
  });
});
