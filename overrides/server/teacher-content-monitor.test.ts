import { describe, expect, it } from "vitest";
import { parseYoutubeAtomFeed, shouldScanTeacherSource } from "./teacher-content-monitor";

describe("teacher public channel monitor", () => {
  it("parses public YouTube upload entries and decodes Arabic metadata", () => {
    const xml = `<?xml version="1.0"?>
      <feed>
        <entry>
          <yt:videoId>abc123</yt:videoId>
          <title>مراجعة الوحدة الثانية &amp; حل التقييمات</title>
          <published>2026-11-24T18:00:00+00:00</published>
          <media:description>شرح ومراجعة &amp; تطبيق</media:description>
        </entry>
      </feed>`;
    const updates = parseYoutubeAtomFeed(xml, { teacherId: "T_EN_MAHMOUD_RADWAN", teacherName: "إنجلشاوي" }, new Date("2026-11-25T00:00:00Z"));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      externalId: "youtube:abc123",
      teacherName: "إنجلشاوي",
      title: "مراجعة الوحدة الثانية & حل التقييمات",
      description: "شرح ومراجعة & تطبيق",
      url: "https://www.youtube.com/watch?v=abc123",
    });
  });

  it("ignores incomplete entries with no stable video identifier", () => {
    const xml = `<feed><entry><title>مراجعة</title><published>2026-11-24T18:00:00Z</published></entry></feed>`;
    expect(parseYoutubeAtomFeed(xml, { teacherId: "T1", teacherName: "مدرس" })).toEqual([]);
  });

  it("throttles source scans without trusting invalid or future timestamps", () => {
    const now = Date.parse("2026-11-25T00:00:00Z");
    expect(shouldScanTeacherSource(undefined, now)).toBe(true);
    expect(shouldScanTeacherSource("invalid", now)).toBe(true);
    expect(shouldScanTeacherSource("2026-11-25T00:10:00Z", now)).toBe(true);
    expect(shouldScanTeacherSource("2026-11-24T23:30:00Z", now)).toBe(false);
    expect(shouldScanTeacherSource("2026-11-24T23:00:00Z", now)).toBe(true);
  });
});
