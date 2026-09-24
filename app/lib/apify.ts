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
