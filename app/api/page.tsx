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
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} minutes ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)} days ago`;
  return `${Math.floor(s / 2592000)} months ago`;
}

function title(caption: string) {
  const first = (caption || "").split("\n")[0];
  return first.length > 90 ? first.slice(0, 90) + "…" : first || "(no caption)";
}

type View =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "history" }
  | { kind: "user"; username: string }
  | { kind: "section"; id: number }
  | { kind: "playlist"; id: number };

export default function Home() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Profile | null>(null);
  const [searchError, setSearchError] = useState("");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [pins, setPins] = useState<Video[]>([]);
  const [view, setView] = useState<View>({ kind: "all" });
  const [sideTab, setSideTab] = useState<"subs" | "playlists">("subs");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<Video | null>(null);
  const [addToPlaylist, setAddToPlaylist] = useState<Video | null>(null);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionMembers, setNewSectionMembers] = useState<string[]>([]);


  const loadMeta = useCallback(async () => {
    const [s, sec, pl, pn] = await Promise.all([
      fetch("/api/subscriptions").then((r) => r.json()),
      fetch("/api/sections").then((r) => r.json()),
      fetch("/api/playlists").then((r) => r.json()),
      fetch("/api/pins").then((r) => r.json()),
    ]);
    setSubs(s);
    setSections(sec);
