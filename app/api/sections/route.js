import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const sections = db.prepare("SELECT * FROM sections ORDER BY id").all() as {
    id: number;
    name: string;
  }[];
  const members = db.prepare("SELECT * FROM section_members").all() as {
    section_id: number;
    username: string;
  }[];
  return NextResponse.json(
    sections.map((s) => ({
      ...s,
      usernames: members.filter((m) => m.section_id === s.id).map((m) => m.username),
    }))
  );
}
