import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT v.*, h.watched_at FROM history h
       JOIN videos v ON v.id = h.video_id ORDER BY h.watched_at DESC LIMIT 200`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { video_id } = await req.json();
  if (!video_id) return NextResponse.json({ error: "video_id required" }, { status: 400 });
  db.prepare(
