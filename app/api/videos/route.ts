import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { fetchVideos, isValidUsername } from "@/lib/apify";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!username || !isValidUsername(username))
    return NextResponse.json({ error: "valid username required" }, { status: 400 });


  const cached = db
    .prepare("SELECT * FROM videos WHERE username = ? ORDER BY timestamp DESC")
    .all(username);

  if (cached.length && !refresh) return NextResponse.json(cached);
