import { ApifyClient } from "apify-client";

export interface IgProfile {
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount?: number;
  biography?: string;
}

export interface IgVideo {
  id: string;
  caption: string;
  videoUrl: string;
  thumbnailUrl: string;
  postUrl: string;
  timestamp: string;
}

type ApifyItem = Record<string, unknown>;

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

export function isValidUsername(u: unknown): u is string {
  return typeof u === "string" && USERNAME_RE.test(u);
}

/** Turns user input like " @Some.User " into "some.user". */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
}

let client: ApifyClient | null = null;
function apify(): ApifyClient {
  if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN is not configured");
  client ??= new ApifyClient({ token: process.env.APIFY_TOKEN });
  return client;
}

export function toProfile(p: ApifyItem): IgProfile {
  return {
    username: String(p.username),
    fullName: String(p.fullName ?? ""),
    profilePicUrl: String(p.profilePicUrlHD ?? p.profilePicUrl ?? ""),
    followersCount: Number(p.followersCount ?? 0),
    biography: String(p.biography ?? ""),
  };
}

export function toVideos(items: ApifyItem[]): IgVideo[] {
  return items
    .filter((p) => p.videoUrl && (p.id || p.shortCode))
    .map((p) => ({
      id: String(p.id ?? p.shortCode),
      caption: String(p.caption ?? ""),
      videoUrl: String(p.videoUrl),
      thumbnailUrl: String(p.displayUrl ?? p.thumbnailUrl ?? ""),
      postUrl: String(p.url ?? `https://www.instagram.com/p/${p.shortCode}/`),
      timestamp: String(p.timestamp ?? ""),
    }));
}

export async function searchProfile(username: string): Promise<IgProfile | null> {
  const run = await apify().actor("apify/instagram-profile-scraper").call({
    usernames: [username],
  });
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  const p = (items as ApifyItem[])[0];
  if (!p || !p.username) return null;
  return toProfile(p);
}

export async function fetchVideos(username: string): Promise<IgVideo[]> {
  const run = await apify().actor("apify/instagram-reel-scraper").call({
    username: [username],
    resultsLimit: 30,
  });
  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  return toVideos(items as ApifyItem[]);
}
