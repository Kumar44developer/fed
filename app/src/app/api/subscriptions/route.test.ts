import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { req } from "@/test/http";
import { DELETE, GET, POST } from "./route";

describe("/api/subscriptions", () => {
  it("rejects invalid usernames instead of inserting them", async () => {
    for (const body of [{}, { username: "bad name" }, { username: 5 }, "not json"]) {
      const res = await POST(req("/api/subscriptions", { method: "POST", body }));
      expect(res.status).toBe(400);
    }
    expect(await (await GET()).json()).toEqual([]);
  });

  it("subscribes once and unsubscribes with cached videos removed", async () => {
    const body = { username: "natgeo", full_name: "Nat Geo", profile_pic: "p.jpg" };
    await POST(req("/api/subscriptions", { method: "POST", body }));
    await POST(req("/api/subscriptions", { method: "POST", body }));
    const subs = await (await GET()).json();
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject(body);

    db.prepare("INSERT INTO videos (id, username) VALUES ('v1', 'natgeo')").run();
    await DELETE(req("/api/subscriptions?username=natgeo", { method: "DELETE" }));
    expect(await (await GET()).json()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM videos").get()).toEqual({ n: 0 });
  });
});
