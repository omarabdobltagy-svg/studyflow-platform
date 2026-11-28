import { describe, expect, it } from "vitest";
import { acceptedAlternativeReviewVideoIds, classifyTeacherAnnouncement, getAcceptedAlternativeReviewContext, getSelectedTeacherRevisionUpdates, isHighConfidenceScheduleAnnouncement, isSecondYearBaccalaureateProfile, isSecondYearBaccalaureateUpdate, isTeacherVideoUpdateAllowed, parseYoutubeAtomFeed, parseYoutubeDurationMinutes, selectedSubjectIdsForTeacher, selectedTeacherIds, shouldScanTeacherSource } from "./teacher-content-monitor";

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

  it("maps each selected teacher only to the subjects assigned to that teacher", () => {
    const profile = {
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC"],
      teacherSelections: {
        ARB_G2_BAC: "T_AR_MOHAMED_SALAH",
        ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN",
        HIS_G2_BAC: "T_HIS_AHMED_ADEL",
      },
    };
    expect(selectedSubjectIdsForTeacher(profile, "T_AR_MOHAMED_SALAH")).toEqual(["ARB_G2_BAC"]);
    expect(selectedSubjectIdsForTeacher(profile, "T_EN_MAHMOUD_RADWAN")).toEqual(["ENG1_G2_BAC"]);
    expect(selectedSubjectIdsForTeacher(profile, "T_HIS_AHMED_ADEL")).toEqual(["HIS_G2_BAC"]);
    expect(selectedSubjectIdsForTeacher(profile, "T_AR_REDA_FAROUK")).toEqual([]);
  });

  it("requires semantic revision classification and the student's selected teacher", () => {
    const profile = {
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC"],
      teacherSelections: {
        ARB_G2_BAC: "T_AR_MOHAMED_SALAH",
        ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN",
      },
    };
    const makeUpdate = (externalId: string, teacherId: string, title: string, contentType: "revision" | "lesson" | "unknown") => ({
      externalId, teacherId, teacherName: "مدرس مختار", sourceType: "youtube" as const,
      title, description: "وصف عام", url: "https://www.youtube.com/watch?v=abc123",
      publishedAt: "2026-11-28T10:00:00.000Z", observedAt: "2026-11-28T10:01:00.000Z",
      contentAnalysis: {
        status: "complete" as const, contentType,
        summaryAr: "تحليل مكتمل للفيديو يصف الموضوعات التي تمت مراجعتها.",
        topics: [{
          titleAr: "موضوع دراسي", descriptionAr: "تفصيل موضوعي", startSeconds: 0, endSeconds: 60,
          subjectHints: [], branchHints: [], curriculumKeywords: [], confidence: "high" as const,
        }],
        teacherInstructions: [], topicsNotCovered: [],
      },
    });
    const updates = [
      makeUpdate("youtube:titleOnlyRevision", "T_AR_MOHAMED_SALAH", "مراجعة النحو كاملة", "lesson"),
      makeUpdate("youtube:englishRevision", "T_EN_MAHMOUD_RADWAN", "لقاء جديد", "revision"),
      makeUpdate("youtube:wrongTeacherRevision", "T_AR_REDA_FAROUK", "مراجعة مؤكدة", "revision"),
      makeUpdate("youtube:unknownReview", "T_AR_MOHAMED_SALAH", "مراجعة شاملة", "unknown"),
    ];
    expect(getSelectedTeacherRevisionUpdates(profile, updates as any).map(update => update.externalId))
      .toEqual(["youtube:englishRevision"]);
  });

  it("allows only explicitly accepted alternative review videos, not all videos from that teacher", () => {
    const profile = {
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["HIS_G2_BAC"],
      teacherSelections: { HIS_G2_BAC: "T_HIS_AHMED_ADEL" },
      selection: { acceptedAlternativeReviewVideoIds: ["youtube:altVideo123"] },
    };
    expect(acceptedAlternativeReviewVideoIds(profile).has("youtube:altVideo123")).toBe(true);
    expect(isTeacherVideoUpdateAllowed(profile, { teacherId: "T_HIS_GOMAA_EL_SAYED", externalId: "youtube:altVideo123" })).toBe(true);
    expect(isTeacherVideoUpdateAllowed(profile, { teacherId: "T_HIS_GOMAA_EL_SAYED", externalId: "youtube:anotherVideo1" })).toBe(false);
    expect(isTeacherVideoUpdateAllowed(profile, { teacherId: "T_HIS_AHMED_ADEL", externalId: "youtube:selectedTeacherVideo" })).toBe(true);
    const scopedProfile = {
      ...profile,
      selection: {
        acceptedAlternativeReviewVideoIds: ["youtube:altVideo123"],
        acceptedAlternativeReviewContext: {
          "youtube:altVideo123": { subjectId: "HIS_G2_BAC", branchId: "HIS_UNIT_1" },
        },
      },
    };
    expect(getAcceptedAlternativeReviewContext(scopedProfile, "youtube:altVideo123"))
      .toEqual({ subjectId: "HIS_G2_BAC", branchId: "HIS_UNIT_1" });
    expect(getAcceptedAlternativeReviewContext(scopedProfile, "youtube:otherVideo1")).toBeUndefined();
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
