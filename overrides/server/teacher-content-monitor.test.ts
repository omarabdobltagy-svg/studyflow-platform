import { describe, expect, it } from "vitest";
import { classifyTeacherAnnouncement, isHighConfidenceScheduleAnnouncement, isSecondYearBaccalaureateProfile, isSecondYearBaccalaureateUpdate, parseYoutubeAtomFeed, parseYoutubeDurationMinutes, selectedTeacherIds, shouldScanTeacherSource } from "./teacher-content-monitor";

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
  it("classifies explicit cancellation and schedule changes without requiring year keywords", () => {
    const cancelled = classifyTeacherAnnouncement("المحاضرة اتلغت النهارده", "مفيش محاضرة اليوم", "facebook");
    expect(cancelled).toEqual({ announcementType: "lecture_cancelled", confidence: "high" });
    expect(isHighConfidenceScheduleAnnouncement(cancelled)).toBe(true);

    const suspended = classifyTeacherAnnouncement("هنريح من المحاضرات الأسبوع ده", "", "facebook");
    expect(suspended).toEqual({ announcementType: "class_suspended", confidence: "high" });
    expect(isHighConfidenceScheduleAnnouncement(suspended)).toBe(true);
    expect(classifyTeacherAnnouncement("مفيش محاضرات الأسبوع ده", "", "facebook"))
      .toEqual({ announcementType: "class_suspended", confidence: "high" });

    const changed = classifyTeacherAnnouncement("تغيير موعد المحاضرة", "المحاضرة اتنقلت ليوم الخميس", "facebook");
    expect(changed).toEqual({ announcementType: "schedule_changed", confidence: "high" });
    expect(isHighConfidenceScheduleAnnouncement(changed)).toBe(true);
  });

  it("does not treat a new YouTube video or an ambiguous Facebook post as a cancellation", () => {
    const video = classifyTeacherAnnouncement("شرح الوحدة الثالثة", "محاضرة جديدة", "youtube");
    expect(video).toEqual({ announcementType: "new_content", confidence: "medium" });
    expect(isHighConfidenceScheduleAnnouncement(video)).toBe(false);

    const ambiguous = classifyTeacherAnnouncement("مفيش جديد", "تابعونا قريبًا", "facebook");
    expect(ambiguous).toEqual({ announcementType: "general", confidence: "low" });
    expect(isHighConfidenceScheduleAnnouncement(ambiguous)).toBe(false);
  });

  it("accepts teacher updates only when the post itself identifies second-year Baccalaureate", () => {
    expect(isSecondYearBaccalaureateUpdate({ title: "مراجعة نحو تانية بكالوريا 2027" })).toBe(true);
    expect(isSecondYearBaccalaureateUpdate({ title: "2 Bac 2027 - Unit 3 revision" })).toBe(true);
    expect(isSecondYearBaccalaureateUpdate({ title: "Baccalaureate الصف الثاني الثانوي" })).toBe(true);
    expect(isSecondYearBaccalaureateUpdate({ title: "مراجعة تانية بكالوريا وتالتة بكالوريا" })).toBe(false);
  });

  it("rejects generic or other-grade posts even from a teacher selected for second-year Baccalaureate", () => {
    expect(isSecondYearBaccalaureateUpdate({ title: "مراجعة نحو للصف الأول الثانوي بكالوريا" })).toBe(false);
    expect(isSecondYearBaccalaureateUpdate({ title: "مراجعة نحو تالتة بكالوريا" })).toBe(false);
    expect(isSecondYearBaccalaureateUpdate({ title: "شرح نحو للصف الثاني الثانوي" })).toBe(false);
    expect(isSecondYearBaccalaureateUpdate({ title: "مراجعة عامة في النحو" })).toBe(false);
  });
});
