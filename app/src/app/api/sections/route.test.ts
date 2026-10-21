import { beforeEach, describe, expect, it } from "vitest";
import db from "@/lib/db";
import { req } from "@/test/http";
import { DELETE, GET, POST } from "./route";

const list = async () => (await GET()).json();

beforeEach(() => {
  db.exec("DELETE FROM sections; DELETE FROM section_members;");
});

describe("/api/sections", () => {
  it("creates a section with members", async () => {
    const res = await POST(req("/api/sections", { method: "POST", body: { name: " Cooking ", usernames: ["a", "b"] } }));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(await list()).toEqual([{ id, name: "Cooking", usernames: ["a", "b"] }]);
  });

  it("reuses the existing section when the name already exists", async () => {
    const first = await (await POST(req("/api/sections", { method: "POST", body: { name: "Tech" } }))).json();
    const second = await (
      await POST(req("/api/sections", { method: "POST", body: { name: "Tech", usernames: ["c"] } }))
    ).json();
    expect(second.id).toBe(first.id);
    expect(await list()).toEqual([{ id: first.id, name: "Tech", usernames: ["c"] }]);
  });

  it("renames and replaces members when an id is given", async () => {
    const { id } = await (
      await POST(req("/api/sections", { method: "POST", body: { name: "Old", usernames: ["a"] } }))
    ).json();
    await POST(req("/api/sections", { method: "POST", body: { id, name: "New", usernames: ["b", "c"] } }));
    expect(await list()).toEqual([{ id, name: "New", usernames: ["b", "c"] }]);
  });

  it("returns 409 instead of crashing when renaming onto an existing name", async () => {
    await POST(req("/api/sections", { method: "POST", body: { name: "A" } }));
    const { id } = await (await POST(req("/api/sections", { method: "POST", body: { name: "B" } }))).json();
    const res = await POST(req("/api/sections", { method: "POST", body: { id, name: "A" } }));
    expect(res.status).toBe(409);
  });

  it("validates input", async () => {
    expect((await POST(req("/api/sections", { method: "POST", body: { name: "  " } }))).status).toBe(400);
    expect((await POST(req("/api/sections", { method: "POST", body: "not json" }))).status).toBe(400);
    expect((await DELETE(req("/api/sections", { method: "DELETE" }))).status).toBe(400);
  });

  it("deletes a section and its members", async () => {
    const { id } = await (
      await POST(req("/api/sections", { method: "POST", body: { name: "Gone", usernames: ["a"] } }))
    ).json();
    await DELETE(req(`/api/sections?id=${id}`, { method: "DELETE" }));
    expect(await list()).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM section_members").get()).toEqual({ n: 0 });
  });
});
