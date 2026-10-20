# InstaFeed

> Subscribe to Instagram accounts and watch their reels in one clean, YouTube-style feed. No Instagram account required.

InstaFeed is a self-hosted [Next.js](https://nextjs.org) app. You search for public Instagram profiles, subscribe to them, and get their latest video posts in a single chronological feed. You can organize creators into **sections**, save videos to **playlists**, **pin** favorites, and keep a **watch history**. A background poller keeps the feed fresh automatically.

---

## ✨ Features

- 🔍 **Profile search**: look up any public Instagram username (with input validation).
- ➕ **Subscriptions**: follow creators and see all of their reels in one feed.
- 📺 **Unified feed**: every subscribed creator's videos, newest first, auto-refreshing every 30 seconds.
- 🗂️ **Sections**: group creators into custom categories (e.g. "Cooking", "Tech").
- 🎵 **Playlists**: save individual videos into named playlists.
- 📌 **Pins**: keep favorite videos one click away.
- 🕘 **Watch history**: automatically tracks what you've watched (clearable).
- 🔄 **Background polling**: a server-side job fetches new videos for every subscription every 3 minutes.
- 🛡️ **Media proxy**: streams Instagram CDN media through the app (with HTTP range support for seeking), restricted to `cdninstagram.com` / `fbcdn.net`.
- 🔐 **Authentication**: email + password sign-up/sign-in via Supabase. Every page except `/login` is protected by middleware.

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Route Handlers, Instrumentation) |
| UI | React 19, CSS Modules, Geist font |
| Language | TypeScript |
| Database | SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (`instafeed.db`) |
| Scraping | [Apify](https://apify.com) (`apify/instagram-profile-scraper`, `apify/instagram-reel-scraper`) |
| Auth | [Supabase Auth](https://supabase.com/docs/guides/auth) (`@supabase/ssr`, `@supabase/supabase-js`) |

## 🏗️ How It Works

```
┌────────────┐   fetch    ┌──────────────────────┐   Apify API   ┌──────────────┐
│  Browser   │ ─────────▶ │  Next.js API routes  │ ────────────▶ │  Instagram   │
│ (page.tsx) │ ◀───────── │   /api/*             │ ◀──────────── │  (scrapers)  │
└────────────┘    JSON    └──────────┬───────────┘               └──────────────┘
      │                              │ read / write
      │  /api/proxy?url=…            ▼
      └──────────────▶   ┌──────────────────────┐
        video/images     │  SQLite (instafeed.db)│ ◀── background poller (every 3 min,
                         └──────────────────────┘      started in instrumentation.ts)
```

1. **Search**: `/api/search` calls the Apify profile scraper to resolve a username.
2. **Subscribe**: the profile is saved to the `subscriptions` table.
3. **Fetch videos**: `/api/videos` returns cached reels or fetches fresh ones (up to 30) from Apify.
4. **Poll**: `instrumentation.ts` registers a Node.js interval that refreshes all subscriptions every 3 minutes.
5. **Watch**: the client plays media through `/api/proxy` to get around Instagram CDN hotlinking restrictions.

## 📁 Project Structure

```
fed/
└── app/
    ├── layout.tsx           # Root layout & metadata
    ├── page.tsx             # Main client UI (feed, sidebar, player)
    ├── page.module.css
    ├── globals.css
    ├── login/
    │   └── Page.tsx         # Supabase email/password login & sign-up
    ├── middleware.ts        # Auth guard (redirects to /login)
    ├── instrumentation.ts   # Background Instagram poller
    ├── lib/
    │   ├── db.ts            # SQLite connection + schema
    │   └── apify.ts         # Apify client: searchProfile / fetchVideos
    ├── api/
    │   ├── feed/            # GET  combined feed
    │   ├── search/          # GET  look up a profile
    │   ├── subscriptions/   # GET/POST/DELETE subscriptions
    │   ├── videos/          # GET  videos for a user (?refresh=1)
    │   ├── sections/        # GET/POST/DELETE sections
    │   ├── playlists/       # GET/POST/DELETE playlists & items
    │   ├── pins/            # GET/POST/DELETE pinned videos
    │   ├── history/         # GET/POST/DELETE watch history
    │   └── proxy/           # GET  Instagram CDN media proxy
    ├── next.config.ts
    └── package.json
```

## 🗄️ Database Schema

The SQLite database (`instafeed.db`) is created automatically on first run:

| Table | Purpose |
|-------|---------|
| `subscriptions` | Followed accounts (`username`, `full_name`, `profile_pic`) |
| `videos` | Cached reels (`id`, `username`, `caption`, `video_url`, `thumbnail_url`, `post_url`, `timestamp`) |
| `sections` / `section_members` | Custom creator groups |
| `playlists` / `playlist_items` | Saved video collections |
| `pins` | Pinned videos |
| `history` | Watched videos with timestamps |

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** and npm
- An **[Apify](https://console.apify.com/)** account and API token
- A **[Supabase](https://supabase.com/)** project with Email auth enabled

### 1. Clone and install

```bash
git clone https://github.com/Kumar44developer/fed.git
cd fed/app
npm install
```

> `better-sqlite3` is a native module. If installation fails, make sure you have build tools installed (Python 3 and a C++ compiler).

### 2. Configure environment variables

Create `app/.env.local`:

```env
# Apify: used to scrape Instagram profiles and reels
APIFY_TOKEN=your_apify_api_token

# Supabase: used for authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> If the Supabase variables are not set, the middleware skips the auth check.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, search for an Instagram username, and subscribe.

### Production build

```bash
npm run build
npm start
```

> InstaFeed uses a local SQLite file and a long-running background poller, so deploy it to a **persistent Node.js server** (VPS, Docker, Railway, Render, etc.) rather than a serverless platform.

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?username=<name>` | Look up an Instagram profile |
| `GET` | `/api/subscriptions` | List subscriptions |
| `POST` | `/api/subscriptions` | Subscribe: `{ username, full_name, profile_pic }` |
| `DELETE` | `/api/subscriptions?username=<name>` | Unsubscribe (also removes cached videos) |
| `GET` | `/api/feed` | All videos from subscribed accounts, newest first |
| `GET` | `/api/videos?username=<name>[&refresh=1]` | Videos for one account (cached or fresh) |
| `GET/POST/DELETE` | `/api/sections` | Manage sections: `{ id?, name, usernames[] }` / `?id=` |
| `GET/POST/DELETE` | `/api/playlists` | Manage playlists and playlist items |
| `GET/POST/DELETE` | `/api/pins` | Manage pinned videos: `{ video_id }` |
| `GET/POST/DELETE` | `/api/history` | Watch history: `{ video_id }`, DELETE clears all |
| `GET` | `/api/proxy?url=<cdn-url>` | Stream Instagram CDN media (range requests supported) |

## ⚙️ Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Background poll interval | `app/instrumentation.ts` (`POLL_MS`) | 3 minutes |
| Client feed refresh | `app/page.tsx` | 30 seconds |
| Reels fetched per account | `app/lib/apify.ts` (`resultsLimit`) | 30 |
| Database file | `app/lib/db.ts` | `./instafeed.db` |

## ⚠️ Disclaimer

This project is for personal and educational use. It only accesses publicly available content through third-party scraping services. Respect [Instagram's Terms of Use](https://help.instagram.com/581066165581870), creators' rights, and Apify's usage policies. Scraping calls use Apify credits.

## 🤝 Contributing

Contributions are welcome:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

## 👤 Author

**Kumar Swamy R Y** · [@Kumar44developer](https://github.com/Kumar44developer)
