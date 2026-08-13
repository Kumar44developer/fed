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

export async function POST(req: NextRequest) {
  const { name, usernames, id: existingId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  let id: number | bigint;
  if (existingId && existingId !== -1) {
    db.prepare("UPDATE sections SET name = ? WHERE id = ?").run(name.trim(), existingId);
    id = existingId;
  } else {
    const info = db.prepare("INSERT OR IGNORE INTO sections (name) VALUES (?)").run(name.trim());
    id =
      (info.lastInsertRowid as number) ||
      (db.prepare("SELECT id FROM sections WHERE name = ?").get(name.trim()) as { id: number }).id;
  }
  if (Array.isArray(usernames)) {
    db.prepare("DELETE FROM section_members WHERE section_id = ?").run(id);
    const ins = db.prepare(
      "INSERT OR IGNORE INTO section_members (section_id, username) VALUES (?, ?)"
    );
    for (const u of usernames) ins.run(id, u);
  }
  return NextResponse.json({ ok: true, id });
}
