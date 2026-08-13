import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isValidUsername } from "@/lib/apify";

export async function GET() {
  const rows = db.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}


  export async function POST(req: NextRequest) {
    const { username, full_name, profile_pic } = await req.json();
    if (!username || !isValidUsername(username))
  db.prepare(
    "INSERT OR IGNORE INTO subscriptions (username, full_name, profile_pic) VALUES (?, ?, ?)"
  ).run(username, full_name ?? "", profile_pic ?? "");
  return NextResponse.json({ ok: true });
}
