import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isValidUsername } from "@/lib/apify";
import { ingestor } from "@/lib/ingestor";
import { listVideos } from "@/lib/video-ingestion";

/**
 * GET ?username=          -> cached videos (fetched from Instagram on first request)
 * GET ?username=&refresh=1 -> fetch fresh videos, falling back to the cache on failure
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!username || !isValidUsername(username))
    return NextResponse.json({ error: "valid username required" }, { status: 400 });

  const cached = listVideos(db, username);
  if (cached.length && !refresh) return NextResponse.json(cached);

  try {
    await ingestor.refresh(username);
    return NextResponse.json(listVideos(db, username));
  } catch (e) {
    console.error(`[videos] refresh ${username}:`, (e as Error).message);
    if (cached.length) return NextResponse.json(cached, { headers: { "x-instafeed-stale": "1" } });
    return NextResponse.json({ error: "could not fetch videos, try again later" }, { status: 502 });
  }
}
