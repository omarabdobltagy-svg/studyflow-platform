import { describe, expect, it } from "vitest";
import { isSecondYearBaccalaureateProfile, parseYoutubeAtomFeed, parseYoutubeDurationMinutes, selectedTeacherIds, shouldScanTeacherSource } from "./teacher-content-monitor";

describe("teacher public channel monitor", () => {
  it("parses public YouTube upload entries and decodes Arabic metadata", () => {
    const xml = `<?xml version="1.0"?>
      <feed>
        <entry>
          <yt:videoId>abc123</yt:videoId>
          <title>مراجعة الوحدة الثانية &amp; حل التقييمات</title>
          <published>2026-11-24T18:00:00+00:00</published>
          <media:description><![CDATA[شرح ومراجعة & تطبيق]]></media:description>
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

  it("parses YouTube ISO 8601 durations into real session minutes", () => {
    expect(parseYoutubeDurationMinutes("PT3H58M36S")).toBe(239);
    expect(parseYoutubeDurationMinutes("PT45M19S")).toBe(46);
    expect(parseYoutubeDurationMinutes("P1DT2H")).toBe(1_560);
    expect(parseYoutubeDurationMinutes("PT0S")).toBeUndefined();
    expect(parseYoutubeDurationMinutes("unknown")).toBeUndefined();
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
  it("accepts only selected teachers mapped to second-year Egyptian Baccalaureate subjects", () => {
    const profile = {
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC"],
      teacherSelections: {
        ARB_G2_BAC: "T_AR_MOHAMED_SALAH",
        ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN",
        HIS_G2_BAC: "T_AR_MOHAMED_SALAH",
      },
    };
    expect(isSecondYearBaccalaureateProfile(profile)).toBe(true);
    expect(selectedTeacherIds(profile)).toEqual(expect.arrayContaining(["T_AR_MOHAMED_SALAH", "T_EN_MAHMOUD_RADWAN"]));
    expect(selectedTeacherIds(profile)).not.toContain("T_AR_REDA_FAROUK");
  });

  it("rejects second-year general secondary, other grades, and teacher-to-subject mismatches", () => {
    const base = {
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC"],
      teacherSelections: { ARB_G2_BAC: "T_AR_MOHAMED_SALAH" },
    };
    expect(selectedTeacherIds({ ...base, educationSystem: "general_secondary" })).toEqual([]);
    expect(selectedTeacherIds({ ...base, educationSystem: "baccalaureate", gradeYear: "الصف الأول الثانوي" })).toEqual([]);
    expect(selectedTeacherIds({
      ...base,
      educationSystem: "baccalaureate",
      teacherSelections: { ENG1_G2_BAC: "T_AR_MOHAMED_SALAH" },
    })).toEqual([]);
  });
});
