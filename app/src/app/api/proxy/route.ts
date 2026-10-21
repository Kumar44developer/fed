import { NextRequest } from "next/server";
import { parseMediaUrl, proxyMedia } from "@/lib/media-proxy";

export async function GET(req: NextRequest) {
  const parsed = parseMediaUrl(req.nextUrl.searchParams.get("url"));
  if (!parsed.ok) {
    return new Response(parsed.error, {
      status: parsed.status,
      headers: { "cache-control": "no-store" },
    });
  }
  return proxyMedia(parsed.url, req.headers);
}
