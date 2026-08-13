import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isValidUsername } from "@/lib/apify";

export async function GET() {
  const rows = db.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}
