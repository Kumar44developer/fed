import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { listPins, pinVideo, unpinVideo } from "@/lib/pins";
import { parseVideoId } from "@/lib/video-id";

export async function GET() {
  return NextResponse.json(listPins(db));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const videoId = parseVideoId(body?.video_id);
  if (!videoId) return NextResponse.json({ error: "video_id required" }, { status: 400 });

  const result = pinVideo(db, videoId);
  if (result === "video_not_found")
    return NextResponse.json({ error: "video not found" }, { status: 404 });
  return NextResponse.json({ ok: true, pinned: true }, { status: result === "pinned" ? 201 : 200 });
}

export async function DELETE(req: NextRequest) {
  const videoId = parseVideoId(req.nextUrl.searchParams.get("video_id"));
  if (!videoId) return NextResponse.json({ error: "video_id required" }, { status: 400 });
  const removed = unpinVideo(db, videoId);
  return NextResponse.json({ ok: true, removed });
}
