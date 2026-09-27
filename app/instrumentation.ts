export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { default: db } = await import("./lib/db");
  const { fetchVideos } = await import("./lib/apify");

const POLL_MS = 3 * 60 * 1000;
