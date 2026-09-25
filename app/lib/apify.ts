import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });


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

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;


export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u);
}
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  if (!items.length) return null;
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  if (!items.length) return null;
    username: String(p.username),
    fullName: String(p.fullName ?? ""),
    profilePicUrl: String(p.profilePicUrlHD ?? p.profilePicUrl ?? ""),
    followersCount: Number(p.followersCount ?? 0),
    biography: String(p.biography ?? ""),
  };
}
