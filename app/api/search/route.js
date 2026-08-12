import { NextRequest, NextResponse } from "next/server";
import { searchProfile, isValidUsername } from "@/lib/apify";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("username") ?? "";
  const username = raw.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });
  if (!isValidUsername(username))
    return NextResponse.json(
      { error: "Invalid username. Use only letters, numbers, dots and underscores (no spaces)." },
      { status: 400 }
    );
 try {
    const profile = await searchProfile(username);
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json(profile);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
