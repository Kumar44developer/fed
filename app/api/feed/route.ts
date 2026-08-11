import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT v.*, s.full_name, s.profile_pic FROM videos v
       JOIN subscriptions s ON s.username = v.username
       ORDER BY v.timestamp DESC`
    )
