import db from "./db";
import { fetchVideos } from "./apify";
import { createVideoIngestor, type VideoIngestor } from "./video-ingestion";

// Shared through globalThis so the API routes and the background poller
// (which Next.js may load as separate module instances) coalesce refreshes.
const g = globalThis as { __instafeedIngestor?: VideoIngestor };

export const ingestor: VideoIngestor = (g.__instafeedIngestor ??= createVideoIngestor(db, fetchVideos));
