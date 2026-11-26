import { describe, expect, it } from "vitest";
import { normalizeTeacherSearchText, teacherSourceMatches } from "./teacher-course-research";

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
