import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });


export interface IgProfile {
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount?: number;
  biography?: string;
}
