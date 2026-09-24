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

  const clearHistory = async () => {
    await fetch("/api/history", { method: "DELETE" });
    if (view.kind === "history") setVideos([]);
  };

  const subOf = (username: string) => subs.find((s) => s.username === username);

  const viewTitle = () => {
    switch (view.kind) {
      case "all":
        return "All";
      case "pinned":
        return `📌 Pinned (${pins.length})`;
      case "history":
        return "History";
      case "user":
        return subOf(view.username)?.full_name || `@${view.username}`;
      case "section":
       return sections.find((s) => s.id === view.id)?.name || "Section";
      case "playlist":
        return playlists.find((p) => p.id === view.id)?.name || "Playlist";
    }
  }


  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">▶</div>
          <div>
            <div className="brand-name">InstaFeed</div>
            <div className="brand-tag">YOUR FEED, YOUR RULES</div>
          </div>
        </div>
        <form onSubmit={search} className="topsearch">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an Instagram username"
          />
          <button type="submit" disabled={searching}>
            {searching ? "…" : "🔍"}
          </button>
        </form>
        <div className="top-actions">
          <button
            className="pill"
            onClick={() => {
              setEditSection(null);
              setNewSectionName("");
              setNewSectionMembers([]);
              setEditSection({ id: -1, name: "", usernames: [] });
            }}
          >
            + New Section
          </button>
          <button className="pill purple" onClick={createPlaylist}>
            🎵 + New Playlist
          </button>
          <button className="pill" onClick={() => go({ kind: "history" })}>
            🕘 History
          </button>
          <button
            className="pill"
            onClick={() => {
              setSideTab("playlists");
              if (playlists.length) go({ kind: "playlist", id: playlists[0].id });
            }}
          >

            👁 View Playlists
          </button>
        </div>
      </header>


      {(result || searchError) && (
        <div className="search-result-bar">
          {searchError && <span className="error">{searchError}</span>}
          {result && (
            <>
              {result.profilePicUrl && <img src={proxied(result.profilePicUrl)} alt="" />}
              <strong>@{result.username}</strong>
              <span className="muted">{result.fullName}</span>
              {result.followersCount ? (
                <span className="muted">{result.followersCount.toLocaleString()} followers</span>
              ) : null}
              {subOf(result.username) ? (
                <button className="pill" disabled>Subscribed</button>
              ) : (
                <button className="pill accent" onClick={() => subscribe(result)}>
                  + Subscribe
                </button>
              )}
              <button className="pill" onClick={() => setResult(null)}>✕</button>
            </>
          )}
        </div>
      )}

      <div className="chipbar">
        <div className="side-toggle">
          <button
            className={sideTab === "subs" ? "on" : ""}
            onClick={() => setSideTab("subs")}
          >
            Sections
          </button>
          <button
            className={sideTab === "playlists" ? "on" : ""}
            onClick={() => setSideTab("playlists")}
          >
            Playlists
          </button>
        </div>
        <button
          className={`chip ${view.kind === "all" ? "active" : ""}`}
          onClick={() => go({ kind: "all" })}
        >

          All
        </button>
        <button
          className={`chip ${view.kind === "pinned" ? "active" : ""}`}
          onClick={() => go({ kind: "pinned" })}
        >

          📌 Pinned ({pins.length})
        </button>
        {sections.map((s) => (
          <button
         key={s.id}
            className={`chip ${view.kind === "section" && view.id === s.id ? "active" : ""}`}
            onClick={() => go({ kind: "section", id: s.id })}
            onDoubleClick={() => {
              setEditSection(s);
              setNewSectionName(s.name);
          setNewSectionMembers(s.usernames);
            }}
          >

            {s.name}
          </button>
        ))}
      </div>
    <div className="body">
        <aside className="sidebar">
          {sideTab === "subs" ? (
            <>
             <h2>Subscriptions</h2>
              {subs.length === 0 && <p className="muted">Search a username above to subscribe.</p>}
              <ul>
                {subs.map((s) => (
                  <li
                    key={s.username}
                {subs.map((s) => (
                  <li
                    key={s.username}
                    className={view.kind === "user" && view.username === s.username ? "active" : ""}
                    onClick={() => go({ kind: "user", username: s.username })}
                  >
                 {s.profile_pic ? (
                      <img src={proxied(s.profile_pic)} alt="" />
                    ) : (
                      <div className="avatar-ph" />
                    )}
                    <span className="sub-name">{s.full_name || s.username}</span>
                    <button
                      className="remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        unsubscribe(s.username);
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h2>Playlists</h2>
              {playlists.length === 0 && (
                <p className="muted">No playlists yet. Use “+ New Playlist”.</p>
              )}
              <ul>
                {playlists.map((p) => (
                  <li
                    key={p.id}
                    className={view.kind === "playlist" && view.id === p.id ? "active" : ""}
                    onClick={() => go({ kind: "playlist", id: p.id })}
                  >
                    <div className="avatar-ph playlist-ic">🎵</div>
                    <span className="sub-name">
                      {p.name} <span className="muted">({p.videos.length})</span>
                    </span>
                    <button
                      className="remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(p.id);
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>


        <main className="feed">
          <div className="feed-head">
            <h1 className="feed-title">{viewTitle()}</h1>
            <div className="feed-head-actions">
              {view.kind === "history" && videos.length > 0 && (
                <button className="pill" onClick={clearHistory}>
                  Clear history
                </button>
              )}
              {view.kind === "section" && (
                <button
                  className="pill"
                  onClick={() => {
                    const s = sections.find((x) => view.kind === "section" && x.id === view.id);
                    if (s) {
                      setEditSection(s);
                      setNewSectionName(s.name);
                      setNewSectionMembers(s.usernames);
                    }
                  }}
                >
                  Edit section
                </button>
              )}
              <button
                className="pill"
                onClick={() => loadView(view, view.kind === "user")}
                disabled={loading}
              >
                ⟳ Refresh
              </button>
            </div>
          </div>
          {loading && <div className="empty">Loading feed…</div>}
          {error && <p className="error">{error}</p>}
          {!loading && videos.length === 0 && !error && (
            <div className="empty">Nothing here yet.</div>
          )}
          <div className="grid">
            {videos.map((v) => {
              const s = subOf(v.username);
              const pic = v.profile_pic || s?.profile_pic || "";
              const name = v.full_name || s?.full_name || v.username;
              return (
                <div key={v.id} className="card">
                  <div className="thumb" onClick={() => openVideo(v)}>
                    <img src={proxied(v.thumbnail_url)} alt="" loading="lazy" />
                    <span className="play-badge">▶</span>
                    <button
                      className={`pin-btn ${isPinned(v.id) ? "pinned" : ""}`}
                      title={isPinned(v.id) ? "Unpin" : "Pin"}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(v);
                      }}
                    >
                      📌
                    </button>
                  </div>
                  <div className="meta">
                    {pic ? (
                      <img className="avatar" src={proxied(pic)} alt="" />
                    ) : (
                      <div className="avatar avatar-ph" />
                    )}
                   <div className="meta-text">
                      <div className="video-title" onClick={() => openVideo(v)}>
                       {title(v.caption)}
                      </div>
                      <div className="muted">{name}</div>
                      <div className="muted">{timeAgo(v.timestamp)}</div>
                    </div>
                  </div>
                  <button className="pill small" onClick={() => setAddToPlaylist(v)}>
                    🎵 Playlist
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      </div>


      {playing && (
        <div className="modal" onClick={() => setPlaying(null)}>
          <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlaying(null)}>✕</button>
            <video
              src={proxied(playing.video_url)}
              poster={proxied(playing.thumbnail_url)}
              controls
              autoPlay
              loop
              playsInline
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="modal-meta">
              <div className="video-title">{title(playing.caption)}</div>
              <div className="muted">
                @{playing.username} · {timeAgo(playing.timestamp)}
              </div>
              <a href={playing.post_url} target="_blank" rel="noreferrer">
                View on Instagram →
              </a>
            </div>
          </div>
        </div>
      )}


      {addToPlaylist && (
        <div className="modal" onClick={() => setAddToPlaylist(null)}>
          <div className="modal-inner small-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAddToPlaylist(null)}>✕</button>
            <h3>Add to playlist</h3>
            {playlists.length === 0 && (
              <p className="muted">No playlists yet — create one first with “+ New Playlist”.</p>
            )}
            <ul className="pick-list">
              {playlists.map((p) => (
                <li key={p.id} onClick={() => addVideoToPlaylist(p.id, addToPlaylist)}>
                  🎵 {p.name} <span className="muted">({p.videos.length})</span>
                </li>
              ))}
            </ul>
           <button className="pill" onClick={createPlaylist}>+ New Playlist</button>
          </div>
        </div>
      )}

      {editSection && (
        <div className="modal" onClick={() => setEditSection(null)}>
          <div className="modal-inner small-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditSection(null)}>✕</button>
            <h3>{editSection.id === -1 ? "New Section" : "Edit Section"}</h3>
            <input
              className="text-input"
              placeholder="Section name (e.g. AI CREATORS)"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
            />
            <p className="muted">Pick accounts for this section:</p>
            <ul className="pick-list">
              {subs.map((s) => (
                <li
                  key={s.username}
                  className={newSectionMembers.includes(s.username) ? "picked" : ""}
                  onClick={() =>
                    setNewSectionMembers((m) =>
                      m.includes(s.username)
                        ? m.filter((x) => x !== s.username)
                        : [...m, s.username]
                    )
                  }
                >
                  {newSectionMembers.includes(s.username) ? "✅" : "⬜"} {s.full_name || s.username}
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="pill accent" onClick={createSection}>
                Save
              </button>
