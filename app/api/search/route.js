import { NextRequest, NextResponse } from "next/server";
import { searchProfile, isValidUsername } from "@/lib/apify";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("username") ?? "";
  const username = raw.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (!isValidUsername(username))
