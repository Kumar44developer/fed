export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { default: db } = await import("./lib/db");
  const { fetchVideos } = await import("./lib/apify");

const POLL_MS = 3 * 60 * 1000;

  const poll = async () => {
    const subs = db.prepare("SELECT username FROM subscriptions").all() as {
      username: string;
    }[];
    for (const { username } of subs) {
      try {
