const MAX_VIDEO_ID_LENGTH = 128;

/** Validates a video id coming from a request body or query string. */
export function parseVideoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!id || id.length > MAX_VIDEO_ID_LENGTH) return null;
  return id;
}
