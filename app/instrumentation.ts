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
        const videos = await fetchVideos(username);
        const insert = db.prepare(
          `INSERT OR REPLACE INTO videos (id, username, caption, video_url, thumbnail_url, post_url, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const tx = db.transaction(() => {
          for (const v of videos)
            insert.run(v.id, username, v.caption, v.videoUrl, v.thumbnailUrl, v.postUrl, v.timestamp);
        });
        tx();
      } catch (e) {
        console.error(`[poller] ${username}:`, (e as Error).message);
      }
    }
  };

  const g = globalThis as { __instafeedPoller?: NodeJS.Timeout };
  if (!g.__instafeedPoller) {
    g.__instafeedPoller = setInterval(poll, POLL_MS);
    setTimeout(poll, 15_000);
