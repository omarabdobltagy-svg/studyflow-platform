import { performance } from "node:perf_hooks";

export type YouTubeSearchVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  url: string;
  publishedAt: string;
  description: string;
};
type YouTubeApiSearchPayload = {
  items?: Array<{
    id?: { videoId?: unknown };
    snippet?: {
      title?: unknown;
      channelTitle?: unknown;
      channelId?: unknown;
      publishedAt?: unknown;
      description?: unknown;
    };
  }>;
  error?: { message?: string; errors?: Array<{ reason?: string }> };
};
const CACHE_TTL_MS = 5 * 60 * 1_000;
const CACHE_MAX = 120;
const cache = new Map<string, { expiresAt: number; items: YouTubeSearchVideo[] }>();

export function normalizeYouTubeSearchItems(payload: unknown): YouTubeSearchVideo[] {
  if (!payload || typeof payload !== "object") return [];
  const rawItems = (payload as YouTubeApiSearchPayload).items;
  if (!Array.isArray(rawItems)) return [];
  const seen = new Set<string>();
  return rawItems.flatMap(item => {
    const videoId = typeof item?.id?.videoId === "string" ? item.id.videoId.trim() : "";
    const snippet = item?.snippet ?? {};
    const title = typeof snippet.title === "string" ? snippet.title.trim().slice(0, 240) : "";
    const channelTitle = typeof snippet.channelTitle === "string" ? snippet.channelTitle.trim().slice(0, 160) : "";
    const channelId = typeof snippet.channelId === "string" ? snippet.channelId.trim() : "";
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId) || !title || !channelTitle || seen.has(videoId)) return [];
    seen.add(videoId);
    return [{
      videoId,
      title,
      channelTitle,
      channelId,
      url: "https://www.youtube.com/watch?v=" + videoId,
      publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
      description: typeof snippet.description === "string" ? snippet.description.slice(0, 2_000) : "",
    }];
  });
}
function trimCache(now: number) {
  for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/** Uses the configured YouTube Data API key directly, with a short result cache. */
export async function searchYoutubeVideos(query: string, options: { maxResults?: number } = {}): Promise<YouTubeSearchVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured.");
  const normalizedQuery = query.replace(/\s+/g, " ").trim().slice(0, 400);
  if (!normalizedQuery) return [];
  const now = performance.now();
  trimCache(now);
  const maxResults = Math.min(50, Math.max(1, Math.trunc(options.maxResults ?? 25)));
  const cacheKey = normalizedQuery + "::" + maxResults;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.items;

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("order", "relevance");
  url.searchParams.set("regionCode", "EG");
  url.searchParams.set("relevanceLanguage", "ar");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  const raw = await response.text();
  let payload: YouTubeApiSearchPayload = {};
  try { payload = raw ? JSON.parse(raw) as YouTubeApiSearchPayload : {}; }
  catch { throw new Error("YouTube Data API returned an unreadable response."); }

  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason ?? "";
    if (/quotaExceeded|dailyLimitExceeded|rateLimitExceeded/i.test(reason)) {
      throw new Error("YouTube Data API quota is currently exhausted.");
    }
    throw new Error("YouTube Data API request failed with HTTP " + response.status + ".");
  }

  const items = normalizeYouTubeSearchItems(payload);
  cache.set(cacheKey, { items, expiresAt: performance.now() + CACHE_TTL_MS });
  trimCache(performance.now());
  return items;
}
