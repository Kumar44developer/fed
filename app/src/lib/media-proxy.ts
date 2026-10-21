/**
 * Streams Instagram CDN media through our origin (Instagram blocks hotlinking).
 *
 * Security model: only HTTPS URLs on the Instagram/Facebook CDNs are fetched,
 * redirects are followed manually and re-validated (so an allowed host cannot
 * bounce us to an internal address), and only image/video/audio responses are
 * relayed back to the browser.
 */

export const ALLOWED_HOST_SUFFIXES = ["cdninstagram.com", "fbcdn.net"] as const;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FORWARDED_REQUEST_HEADERS = ["range", "if-range", "if-none-match", "if-modified-since"];
const RELAYED_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const PASS_THROUGH_STATUSES = new Set([200, 206, 304, 416]);
const MEDIA_TYPE_RE = /^(image|video|audio)\//i;

export type ParsedMediaUrl = { ok: true; url: URL } | { ok: false; status: 400 | 403; error: string };

export interface ProxyOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRedirects?: number;
}

export function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function parseMediaUrl(raw: string | null | undefined): ParsedMediaUrl {
  if (!raw) return { ok: false, status: 400, error: "url required" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, error: "bad url" };
  }
  if (url.protocol !== "https:") return { ok: false, status: 400, error: "only https urls are allowed" };
  if (url.username || url.password) return { ok: false, status: 400, error: "credentials not allowed" };
  if (url.port && url.port !== "443") return { ok: false, status: 403, error: "port not allowed" };
  if (!isAllowedHost(url.hostname)) return { ok: false, status: 403, error: "host not allowed" };
  return { ok: true, url };
}

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function proxyMedia(
  target: URL,
  requestHeaders: Headers,
  { fetchImpl = fetch, timeoutMs = 15_000, maxRedirects = 3 }: ProxyOptions = {}
): Promise<Response> {
  const headers = new Headers({ "user-agent": USER_AGENT });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = requestHeaders.get(name);
    if (value) headers.set(name, value);
  }

  const signal = AbortSignal.timeout(timeoutMs);
  let url = target;
  let upstream: Response;
  try {
    for (let hop = 0; ; hop++) {
      upstream = await fetchImpl(url, { headers, redirect: "manual", signal });
      if (!REDIRECT_STATUSES.has(upstream.status)) break;

      await upstream.body?.cancel();
      if (hop >= maxRedirects) return textResponse(502, "too many redirects");
      const location = upstream.headers.get("location");
      if (!location) return textResponse(502, "redirect without location");
      const next = parseMediaUrl(new URL(location, url).toString());
      if (!next.ok) return textResponse(502, `redirect blocked: ${next.error}`);
      url = next.url;
    }
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") return textResponse(504, "upstream timed out");
    return textResponse(502, "upstream fetch failed");
  }

  if (!PASS_THROUGH_STATUSES.has(upstream.status)) {
    await upstream.body?.cancel();
    return upstream.status === 404 || upstream.status === 410
      ? textResponse(404, "media not found")
      : textResponse(502, `upstream responded ${upstream.status}`);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if ((upstream.status === 200 || upstream.status === 206) && !MEDIA_TYPE_RE.test(contentType)) {
    await upstream.body?.cancel();
    return textResponse(415, "upstream did not return media");
  }

  const out = new Headers();
  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  out.set("x-content-type-options", "nosniff");
  out.set("content-security-policy", "default-src 'none'; sandbox");
  out.set("cache-control", upstream.status === 416 ? "no-store" : "public, max-age=3600");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
