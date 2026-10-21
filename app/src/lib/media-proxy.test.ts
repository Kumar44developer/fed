import { describe, expect, it, vi } from "vitest";
import { isAllowedHost, parseMediaUrl, proxyMedia } from "./media-proxy";

const CDN = "https://scontent.cdninstagram.com/v/t50/video.mp4";

function upstream(status: number, headers: Record<string, string> = {}, body: string | null = "data") {
  return new Response(status === 304 || body === null ? null : body, { status, headers });
}

function fetchSequence(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

describe("isAllowedHost", () => {
  it.each(["cdninstagram.com", "scontent-lhr8-1.cdninstagram.com", "video.fbcdn.net", "FBCDN.NET"])(
    "allows %s",
    (h) => expect(isAllowedHost(h)).toBe(true)
  );

  it.each(["evilcdninstagram.com", "cdninstagram.com.evil.io", "fbcdn.net.attacker.dev", "localhost", "169.254.169.254"])(
    "blocks %s",
    (h) => expect(isAllowedHost(h)).toBe(false)
  );
});

describe("parseMediaUrl", () => {
  it("accepts https CDN urls", () => {
    const r = parseMediaUrl(CDN);
    expect(r.ok && r.url.hostname).toBe("scontent.cdninstagram.com");
  });

  it.each([
    [null, 400],
    ["not a url", 400],
    ["http://scontent.cdninstagram.com/a.jpg", 400],
    ["https://user:pw@scontent.cdninstagram.com/a.jpg", 400],
    ["https://scontent.cdninstagram.com:8443/a.jpg", 403],
    ["https://example.com/a.jpg", 403],
    ["file:///etc/passwd", 400],
  ])("rejects %j with %i", (raw, status) => {
    const r = parseMediaUrl(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(status);
  });
});

describe("proxyMedia", () => {
  it("relays media with range headers and caching", async () => {
    const fetchImpl = fetchSequence(
      upstream(206, { "content-type": "video/mp4", "content-range": "bytes 0-3/10", "x-secret": "no" })
    );
    const res = await proxyMedia(new URL(CDN), new Headers({ range: "bytes=0-3", cookie: "session=1" }), { fetchImpl });

    expect(res.status).toBe(206);
    expect(await res.text()).toBe("data");
    expect(res.headers.get("content-range")).toBe("bytes 0-3/10");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-secret")).toBeNull();

    const [, init] = fetchImpl.mock.calls[0];
    const sent = new Headers(init?.headers);
    expect(sent.get("range")).toBe("bytes=0-3");
    expect(sent.get("cookie")).toBeNull(); // never leak our users' cookies upstream
    expect(init?.redirect).toBe("manual");
  });

  it("follows redirects that stay on the CDN", async () => {
    const fetchImpl = fetchSequence(
      upstream(302, { location: "https://video.fbcdn.net/real.mp4" }, null),
      upstream(200, { "content-type": "video/mp4" })
    );
    const res = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl });
    expect(res.status).toBe(200);
    expect(String(fetchImpl.mock.calls[1][0])).toBe("https://video.fbcdn.net/real.mp4");
  });

  it("blocks redirects to non-CDN hosts (SSRF)", async () => {
    const fetchImpl = fetchSequence(upstream(302, { location: "http://169.254.169.254/latest/meta-data" }, null));
    const res = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl });
    expect(res.status).toBe(502);
    expect(await res.text()).toMatch(/redirect blocked/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    const hop = () => upstream(302, { location: CDN }, null);
    const fetchImpl = fetchSequence(hop(), hop(), hop());
    const res = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl, maxRedirects: 2 });
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("too many redirects");
  });

  it("refuses to relay non-media content types", async () => {
    const fetchImpl = fetchSequence(upstream(200, { "content-type": "text/html" }, "<script>alert(1)</script>"));
    const res = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl });
    expect(res.status).toBe(415);
  });

  it("maps upstream errors without caching them", async () => {
    const notFound = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl: fetchSequence(upstream(404)) });
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get("cache-control")).toBe("no-store");

    const forbidden = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl: fetchSequence(upstream(403)) });
    expect(forbidden.status).toBe(502);
  });

  it("passes through 304 for conditional requests", async () => {
    const fetchImpl = fetchSequence(upstream(304, { etag: '"abc"' }));
    const res = await proxyMedia(new URL(CDN), new Headers({ "if-none-match": '"abc"' }), { fetchImpl });
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"abc"');
  });

  it("returns 502 on network errors and 504 on timeouts", async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect((await proxyMedia(new URL(CDN), new Headers(), { fetchImpl: failing })).status).toBe(502);

    const hanging = vi.fn<typeof fetch>((_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))
    );
    const res = await proxyMedia(new URL(CDN), new Headers(), { fetchImpl: hanging, timeoutMs: 20 });
    expect(res.status).toBe(504);
  });
});
