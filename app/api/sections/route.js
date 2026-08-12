import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const sections = db.prepare("SELECT * FROM sections ORDER BY id").all() as {
    id: number;
    name: string;
  }[];
