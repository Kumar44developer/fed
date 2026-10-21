import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  parseId,
  parsePlaylistName,
  removeFromPlaylist,
} from "@/lib/playlists";
import { parseVideoId } from "@/lib/video-id";

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function GET() {
  return NextResponse.json(listPlaylists(db));
}

/**
 * POST { name }                  -> create a playlist
 * POST { playlist_id, video_id } -> add a video to a playlist
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("JSON body required", 400);

  if ("playlist_id" in body || "video_id" in body) {
    const playlistId = parseId(body.playlist_id);
    const videoId = parseVideoId(body.video_id);
    if (!playlistId || !videoId) return error("playlist_id and video_id required", 400);
    switch (addToPlaylist(db, playlistId, videoId)) {
      case "playlist_not_found":
        return error("playlist not found", 404);
      case "video_not_found":
        return error("video not found", 404);
      case "added":
        return NextResponse.json({ ok: true, added: true }, { status: 201 });
      case "already_added":
        return NextResponse.json({ ok: true, added: false });
    }
  }

  const name = parsePlaylistName(body.name);
  if (!name) return error("name required (max 100 characters)", 400);
  const result = createPlaylist(db, name);
  if (!result.ok) return error("a playlist with this name already exists", 409);
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}

/**
 * DELETE ?id=&video_id= -> remove a video from a playlist
 * DELETE ?id=           -> delete the playlist
 */
export async function DELETE(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const playlistId = parseId(params.get("id"));
  if (!playlistId) return error("id required", 400);

  if (params.has("video_id")) {
    const videoId = parseVideoId(params.get("video_id"));
    if (!videoId) return error("invalid video_id", 400);
    return NextResponse.json({ ok: true, removed: removeFromPlaylist(db, playlistId, videoId) });
  }

  if (!deletePlaylist(db, playlistId)) return error("playlist not found", 404);
  return NextResponse.json({ ok: true });
}
