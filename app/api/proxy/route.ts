import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("url required", { status: 400 });
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("bad url", { status: 400 });
  }
    try {
    target = new URL(url);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (!/(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/.test(target.hostname))
    return new Response("host not allowed", { status: 403 });

  const range = req.headers.get("range");
  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      ...(range ? { Range: range } : {}),
    },
  });
