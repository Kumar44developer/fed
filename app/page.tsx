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
    setPlaylists(pl);
    setPins(pn);
  }, []);

  const loadView = useCallback(
    async (v: View, refresh = false) => {
      setLoading(true);
      setError("");
      try {
        let data: Video[] = [];
        if (v.kind === "all") {
          data = await fetch("/api/feed").then((r) => r.json());
        } else if (v.kind === "user") {
          const res = await fetch(
            `/api/videos?username=${encodeURIComponent(v.username)}${refresh ? "&refresh=1" : ""}`
          );
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Failed to load");
          data = d;
        } else if (v.kind === "section") {
          const all: Video[] = await fetch("/api/feed").then((r) => r.json());
          const sec = sections.find((s) => s.id === v.id);
          data = all.filter((vid) => sec?.usernames.includes(vid.username));
        } else if (v.kind === "playlist") {
          const pl: Playlist[] = await fetch("/api/playlists").then((r) => r.json());
          data = pl.find((p) => p.id === v.id)?.videos ?? [];
        } else if (v.kind === "history") {
          data = await fetch("/api/history").then((r) => r.json());
        } else if (v.kind === "pinned") {
          data = await fetch("/api/pins").then((r) => r.json());
        }
        setVideos(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [sections]
  );

  useEffect(() => {
    loadMeta().then(() => loadView({ kind: "all" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // server-side poller keeps Apify data fresh; here we just re-read the local DB
    const iv = setInterval(() => loadView(view), 30 * 1000);
    return () => clearInterval(iv);
  }, [view, loadView]);

  const go = (v: View, refresh = false) => {
    setView(v);
    loadView(v, refresh);
  };


  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    setSearchError("");
    try {
      const res = await fetch(`/api/search?username=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const subscribe = async (p: Profile) => {
    await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: p.username,
        full_name: p.fullName,
        profile_pic: p.profilePicUrl,
      }),
    });
    setResult(null);
    setQuery("");
    await loadMeta();
    go({ kind: "user", username: p.username }, true);
  };

  const unsubscribe = async (username: string) => {
    await fetch(`/api/subscriptions?username=${encodeURIComponent(username)}`, {
      method: "DELETE",
    });
    await loadMeta();
    if (view.kind === "user" && view.username === username) go({ kind: "all" });
    else loadView(view);
  };

  const openVideo = (v: Video) => {
    setPlaying(v);
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: v.id }),
    });
  };

  const isPinned = (id: string) => pins.some((p) => p.id === id);

  const togglePin = async (v: Video) => {
    if (isPinned(v.id)) {
      await fetch(`/api/pins?video_id=${encodeURIComponent(v.id)}`, { method: "DELETE" });
    } else {
      await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: v.id }),
      });
    }
    const pn = await fetch("/api/pins").then((r) => r.json());
    setPins(pn);
    if (view.kind === "pinned") setVideos(pn);
  };

  const createSection = async () => {
    if (!newSectionName.trim()) return;
    await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSectionName.trim(),
        usernames: newSectionMembers,
        ...(editSection ? { id: editSection.id } : {}),
      }),
    });
    setEditSection(null);
    setNewSectionName("");
    setNewSectionMembers([]);
    await loadMeta();
  };

  const deleteSection = async (id: number) => {
    await fetch(`/api/sections?id=${id}`, { method: "DELETE" });
    await loadMeta();
    if (view.kind === "section" && view.id === id) go({ kind: "all" });
  };


  const createPlaylist = async () => {
    const name = prompt("Playlist name:");
    if (!name?.trim()) return;
    await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    await loadMeta();
    setSideTab("playlists");
  };


  const deletePlaylist = async (id: number) => {
    await fetch(`/api/playlists?id=${id}`, { method: "DELETE" });
    await loadMeta();
    if (view.kind === "playlist" && view.id === id) go({ kind: "all" });
  };

  const addVideoToPlaylist = async (playlistId: number, video: Video) => {
    await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlist_id: playlistId, video_id: video.id }),
    });
    setAddToPlaylist(null);
    await loadMeta();
  };
