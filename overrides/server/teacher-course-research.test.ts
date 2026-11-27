import { describe, expect, it } from "vitest";
import { getCuratedTeacherDeliveryFacts, normalizeSocialSearchItems, normalizeTeacherSearchText, teacherSourceMatches } from "./teacher-course-research";

describe("teacher source matching", () => {
  it("normalizes common Arabic spelling variants", () => {
    expect(normalizeTeacherSearchText("أ/ مُحَمَّد صَلَاح")).toBe("ا محمد صلاح");
    expect(normalizeTeacherSearchText("الإنجليزيّة")).toBe("الانجليزيه");
  });

  it("matches a teacher channel when the source omits hamza or diacritics", () => {
    expect(teacherSourceMatches("محمد صلاح", "مستر محمد صلاح", "مستر محمد صلاح الرسمي", "شرح الوحدة الأولى")).toBe(true);
    expect(teacherSourceMatches("أحمد إبراهيم", "أحمد إبراهيم", "احمد ابراهيم - القناة الرسمية", "مراجعة")).toBe(true);
  });

  it("does not accept a generic subject channel as teacher evidence", () => {
    expect(teacherSourceMatches("محمد صلاح", "مستر محمد صلاح", "قناة اللغة العربية", "شرح نحو للثانوية العامة")).toBe(false);
  });

  it("accepts a direct brand match in a source title", () => {
    expect(teacherSourceMatches("محمود رضوان", "Englishawy", "قناة تعليمية", "Englishawy - قواعد اللغة الإنجليزية")).toBe(true);
  });
});


describe("curated public teacher delivery modes", () => {
  it("offers online and center for both official Arabic teacher announcements for the 2027 cohort", () => {
    expect(getCuratedTeacherDeliveryFacts("T_AR_MOHAMED_SALAH")?.availableModes).toEqual(["online", "center"]);
    expect(getCuratedTeacherDeliveryFacts("T_AR_REDA_FAROUK")?.availableModes).toEqual(["online", "center"]);
  });

  it("offers only online for teachers whose current public course is online", () => {
    expect(getCuratedTeacherDeliveryFacts("T_AR_MOHAMED_SALAH")?.availableModes).toEqual(["online"]);
    expect(getCuratedTeacherDeliveryFacts("T_EN_SHERIF")?.availableModes).toEqual(["online"]);
  });

  it("offers online and center only when both are supported by a first-party source", () => {
    expect(getCuratedTeacherDeliveryFacts("T_HIS_AHMED_GHONIEM")?.availableModes).toEqual(["online", "center"]);
  });

  it("keeps teacher identity or delivery details unknown when source evidence is not conclusive", () => {
    expect(getCuratedTeacherDeliveryFacts("T_AR_MOHAMED_TAREK")?.availableModes).toEqual([]);
    expect(getCuratedTeacherDeliveryFacts("T_PROG_ANAS_AHMED")?.verified).toBe(false);
    expect(getCuratedTeacherDeliveryFacts("T_HIS_AHMED_ADEL")?.availableModes).toEqual([]);
  });

  it("does not invent modes for an unreviewed teacher", () => {
    expect(getCuratedTeacherDeliveryFacts("T_NOT_IN_CATALOG")).toBeNull();
  });
});


describe("public social teacher-source matching", () => {
  it("accepts Facebook search results that identify the named teacher", () => {
    const matches = normalizeSocialSearchItems("رضا الفاروق", "رضا الفاروق", [{
      title: "رضا الفاروق — مواعيد السنة الجديدة ونظام الأونلاين والسنتر",
      link: "https://www.facebook.com/RedaElfaroukOfficial/posts/123456",
      snippet: "تفاصيل دفعة 2027 مع الأستاذ رضا الفاروق.",
    }]);
    expect(matches).toHaveLength(1);
    expect(matches[0].source).toContain("Facebook");
  });

  it("rejects generic social posts that do not identify the teacher and non-social URLs", () => {
    const matches = normalizeSocialSearchItems("رضا الفاروق", "رضا الفاروق", [
      { title: "مواعيد سنتر اللغة العربية", link: "https://www.facebook.com/center/posts/123", snippet: "حجز مجموعات اللغة العربية" },
      { title: "رضا الفاروق الرسمي", link: "https://example.com/reda", snippet: "حساب المدرس" },
    ]);
    expect(matches).toHaveLength(0);
  });
});
