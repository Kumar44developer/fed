export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { createPoller, resolvePollInterval } = await import("./lib/video-ingestion");
  const intervalMs = resolvePollInterval();
  if (intervalMs === 0) {
    console.log("[poller] disabled (INSTAFEED_POLL_INTERVAL_MS=0)");
    return;
  }
  if (!process.env.APIFY_TOKEN) {
    console.warn("[poller] APIFY_TOKEN is not set; background polling disabled");
    return;
  }

  const g = globalThis as { __instafeedPoller?: ReturnType<typeof createPoller> };
  if (g.__instafeedPoller) return;

  const { default: db } = await import("./lib/db");
  const { ingestor } = await import("./lib/ingestor");
  const listUsernames = db.prepare("SELECT username FROM subscriptions ORDER BY username");

  g.__instafeedPoller = createPoller({
    intervalMs,
    listUsernames: () => (listUsernames.all() as { username: string }[]).map((s) => s.username),
    refresh: (username) => ingestor.refresh(username),
  });
  g.__instafeedPoller.start();
}
