import { describe, expect, it } from "vitest";
import { normalizeYouTubeSearchItems } from "./youtube-search";

describe("YouTube Data API result normalization", () => {
  it("converts valid video results to stable watch URLs", () => {
    const items = normalizeYouTubeSearchItems({
      items: [{
        id: { videoId: "AbCdEf12345" },
        snippet: {
          title: "مراجعة النحو",
          channelTitle: "مدرس اللغة العربية",
          channelId: "UC123",
          publishedAt: "2026-11-20T10:00:00Z",
          description: "مراجعة فرع النحو",
        },
      }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.youtube.com/watch?v=AbCdEf12345");
    expect(items[0].channelTitle).toBe("مدرس اللغة العربية");
  });
  it("drops malformed and duplicate videos", () => {
    const items = normalizeYouTubeSearchItems({
      items: [
        { id: { videoId: "AbCdEf12345" }, snippet: { title: "عنوان", channelTitle: "قناة" } },
        { id: { videoId: "AbCdEf12345" }, snippet: { title: "نسخة مكررة", channelTitle: "قناة" } },
        { id: { videoId: "bad" }, snippet: { title: "معرف غير صالح", channelTitle: "قناة" } },
      ],
    });
    expect(items).toHaveLength(1);
  });
  it("returns an empty list for invalid payloads", () => {
    expect(normalizeYouTubeSearchItems(null)).toEqual([]);
    expect(normalizeYouTubeSearchItems({ items: "not-an-array" })).toEqual([]);
  });
});
