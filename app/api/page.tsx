"use client";

import { useCallback, useEffect, useState } from "react";


interface Profile {
  username: string;
  fullName: string;
  profilePicUrl: string;
  followersCount?: number;
}

interface Sub {
  username: string;
  full_name: string;
  profile_pic: string;
}


interface Video {
  id: string;
  username: string;
  caption: string;
  video_url: string;
  thumbnail_url: string;
  post_url: string;
  timestamp: string;
  full_name?: string;
  profile_pic?: string;
}

interface Section {
  id: number;
  name: string;
  usernames: string[];
}
interface Playlist {
  id: number;
  name: string;
 videos: Video[];
}

const proxied = (url: string) => (url ? `/api/proxy?url=${encodeURIComponent(url)}` : "");

function timeAgo(ts: string) {
  const t = new Date(ts).getTime();
  if (!t) return "";
