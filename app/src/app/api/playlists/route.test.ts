import { beforeEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { req } from "@/test/http";
import { DELETE, GET, POST } from "./route";

beforeEach(() => {
  db.exec("DELETE FROM playlist_items; DELETE FROM playlists; DELETE FROM videos; DELETE FROM history;");
  db.prepare("INSERT INTO videos (id, username) VALUES ('v1', 'nat')").run();
});

const post = (body: unknown) => POST(req("/api/playlists", { method: "POST", body }));
const del = (qs: string) => DELETE(req(`/api/playlists?${qs}`, { method: "DELETE" }));
const list = async () => (await GET()).json();

describe("/api/playlists", () => {
  it("supports the UI flow: create, add video, list, remove, delete", async () => {
    const created = await post({ name: "Favs" });
    expect(created.status).toBe(201);
    const { id } = await created.json();

    expect((await post({ playlist_id: id, video_id: "v1" })).status).toBe(201);
    expect((await post({ playlist_id: id, video_id: "v1" })).status).toBe(200);
    const [pl] = await list();
    expect(pl).toMatchObject({ id, name: "Favs" });
    expect(pl.videos.map((v: { id: string }) => v.id)).toEqual(["v1"]);

    expect(await (await del(`id=${id}&video_id=v1`)).json()).toEqual({ ok: true, removed: true });
    expect((await list())[0].videos).toEqual([]);

    expect((await del(`id=${id}`)).status).toBe(200);
    expect(await list()).toEqual([]);
  });

  it("does not touch the history table", async () => {
    const { id } = await (await post({ name: "Favs" })).json();
    await post({ playlist_id: id, video_id: "v1" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM history").get()).toEqual({ n: 0 });
  });

  it("returns 409 for duplicate names", async () => {
    await post({ name: "Favs" });
    expect((await post({ name: " Favs " })).status).toBe(409);
  });

  it("returns 404 for unknown playlists or videos", async () => {
    const { id } = await (await post({ name: "Favs" })).json();
    expect((await post({ playlist_id: 999, video_id: "v1" })).status).toBe(404);
    expect((await post({ playlist_id: id, video_id: "missing" })).status).toBe(404);
    expect((await del("id=999")).status).toBe(404);
  });

  it("validates input", async () => {
    expect((await post("garbage")).status).toBe(400);
    expect((await post({ name: "" })).status).toBe(400);
    expect((await post({ playlist_id: "abc", video_id: "v1" })).status).toBe(400);
    expect((await post({ playlist_id: 1 })).status).toBe(400);
    expect((await del("")).status).toBe(400);
    expect((await del("id=1&video_id=")).status).toBe(400);
  });
});
