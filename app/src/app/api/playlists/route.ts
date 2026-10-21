import { NextResponse } from "next/server";

// Placeholder: the previous file was a copy of the history route and wrote
// playlist changes into the history table. The real implementation lands in a follow-up PR.
// GET returns an empty list so the UI keeps working in the meantime.
export async function GET() {
  return NextResponse.json([]);
}

const notImplemented = () =>
  NextResponse.json({ error: "Playlists are not implemented yet" }, { status: 501 });

export const POST = notImplemented;
export const DELETE = notImplemented;
