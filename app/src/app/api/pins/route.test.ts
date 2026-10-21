import { beforeEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { req } from "@/test/http";
import { DELETE, GET, POST } from "./route";

beforeEach(() => {
  db.exec("DELETE FROM pins; DELETE FROM videos; DELETE FROM history;");
  db.prepare("INSERT INTO videos (id, username) VALUES ('v1', 'nat')").run();
});

const pin = (body: unknown) => POST(req("/api/pins", { method: "POST", body }));

describe("/api/pins", () => {
  it("pins a video (201), then reports it as already pinned (200)", async () => {
    expect((await pin({ video_id: "v1" })).status).toBe(201);
    expect((await pin({ video_id: "v1" })).status).toBe(200);
    const list = await (await GET()).json();
    expect(list.map((v: { id: string }) => v.id)).toEqual(["v1"]);
  });

  it("writes to the pins table, not the history table", async () => {
    await pin({ video_id: "v1" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM history").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM pins").get()).toEqual({ n: 1 });
  });

  it("returns 404 for unknown videos and 400 for bad input", async () => {
    expect((await pin({ video_id: "missing" })).status).toBe(404);
    expect((await pin({})).status).toBe(400);
    expect((await pin("garbage")).status).toBe(400);
    expect((await DELETE(req("/api/pins", { method: "DELETE" }))).status).toBe(400);
  });

  it("unpins via ?video_id= as the UI expects", async () => {
    await pin({ video_id: "v1" });
    const res = await DELETE(req("/api/pins?video_id=v1", { method: "DELETE" }));
    expect(await res.json()).toEqual({ ok: true, removed: true });
    expect(await (await GET()).json()).toEqual([]);
  });
});
