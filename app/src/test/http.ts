import { NextRequest } from "next/server";

/** Builds a NextRequest for calling route handlers directly in tests. */
export function req(path: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  const { method = "GET", body } = init;
  return new NextRequest(new URL(path, "http://localhost"), {
    method,
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" } }),
  });
}
