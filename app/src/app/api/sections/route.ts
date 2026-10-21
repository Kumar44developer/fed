import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

interface SectionRow {
  id: number;
  name: string;
}

interface MemberRow {
  section_id: number;
  username: string;
}

export async function GET() {
  const sections = db.prepare("SELECT * FROM sections ORDER BY id").all() as SectionRow[];
  const members = db.prepare("SELECT * FROM section_members").all() as MemberRow[];
  return NextResponse.json(
    sections.map((s) => ({
      ...s,
      usernames: members.filter((m) => m.section_id === s.id).map((m) => m.username),
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const { usernames, id: existingId } = body ?? {};
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const save = db.transaction((): number | bigint => {
    let id: number | bigint;
    if (existingId && existingId !== -1) {
      db.prepare("UPDATE sections SET name = ? WHERE id = ?").run(name, existingId);
      id = existingId;
    } else {
      const info = db.prepare("INSERT OR IGNORE INTO sections (name) VALUES (?)").run(name);
      id =
        info.changes > 0
          ? info.lastInsertRowid
          : (db.prepare("SELECT id FROM sections WHERE name = ?").get(name) as SectionRow).id;
    }
    if (Array.isArray(usernames)) {
      db.prepare("DELETE FROM section_members WHERE section_id = ?").run(id);
      const ins = db.prepare(
        "INSERT OR IGNORE INTO section_members (section_id, username) VALUES (?, ?)"
      );
      for (const u of usernames) if (typeof u === "string") ins.run(id, u);
    }
    return id;
  });

  try {
    const id = save();
    return NextResponse.json({ ok: true, id: Number(id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  db.prepare("DELETE FROM sections WHERE id = ?").run(id);
  db.prepare("DELETE FROM section_members WHERE section_id = ?").run(id);
  return NextResponse.json({ ok: true });
}
