import { describe, expect, it } from "vitest";
import {
  getCairoSecondYearBaccalaureateExams,
  getUpcomingCairoSecondYearBaccalaureateExams,
} from "./cairo-baccalaureate-exam-calendar";
import { SIE_CATALOG_META } from "./sie-catalog";

const core = ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC"];

const profile = (trackId: string, electiveSubjectId: string, subjectIds = [...core, electiveSubjectId]) => ({
  educationSystem: "baccalaureate",
  gradeYear: SIE_CATALOG_META.gradeYear,
  subjectIds,
  selection: { trackId, electiveSubjectId },
});

describe("Cairo monthly exam Unit 2 focus", () => {
  it("attaches real Unit 2 lessons for Arabic, English and History", () => {
    const exams = getCairoSecondYearBaccalaureateExams(profile("BAC_MED_LIFE", "MATH_G2_BAC_PENDING"));
    const bySubject = new Map(exams.map(exam => [exam.subjectId, exam]));
    expect(bySubject.get("ARB_G2_BAC")?.unitFocus.lessons.map(item => item.nodeId)).toContain("ARB_U2_N1");
    expect(bySubject.get("ENG1_G2_BAC")?.unitFocus.lessons.map(item => item.nodeId)).toContain("ENG_U2_SEC_A_T1");
    expect(bySubject.get("HIS_G2_BAC")?.unitFocus.lessons.map(item => item.nodeId)).toContain("HIS_U2_L1");
    expect(bySubject.get("ARB_G2_BAC")?.unitFocus.unitNumber).toBe(2);
  });

  it("uses the student's selected Math elective for Medicine and does not hardcode Programming", () => {
    const exams = getCairoSecondYearBaccalaureateExams(profile(
      "BAC_MED_LIFE",
      "MATH_G2_BAC_PENDING",
      [...core, "MATH_G2_BAC_PENDING", "PROG_AI_G2_BAC"],
    ));
    expect(exams.some(exam => exam.subjectId === "MATH_G2_BAC_PENDING")).toBe(true);
    expect(exams.some(exam => exam.subjectId === "PROG_AI_G2_BAC")).toBe(false);
  });

  it("uses Programming only when it is the elective selected in the Engineering track", () => {
    const exams = getCairoSecondYearBaccalaureateExams(profile("BAC_ENG_CS", "PROG_AI_G2_BAC"));
    expect(exams.some(exam => exam.subjectId === "PROG_AI_G2_BAC")).toBe(true);
    expect(exams.some(exam => exam.subjectId === "MATH_G2_BAC_PENDING")).toBe(false);
  });

  it("does not fabricate Unit 2 contents when the selected subject has no Unit 2 catalogue", () => {
    const exams = getCairoSecondYearBaccalaureateExams(profile("BAC_MED_LIFE", "MATH_G2_BAC_PENDING"));
    const math = exams.find(exam => exam.subjectId === "MATH_G2_BAC_PENDING");
    expect(math).toBeDefined();
    expect(math?.unitFocus.lessons).toEqual([]);
    expect(math?.unitFocus.unitTitle).toMatch(/غير متاح/);
  });

  it("keeps the upcoming exam list ordered by the actual dates", () => {
    const exams = getUpcomingCairoSecondYearBaccalaureateExams(
      profile("BAC_MED_LIFE", "MATH_G2_BAC_PENDING"),
      new Date("2026-11-28T10:00:00.000Z"),
    );
    expect(exams.map(exam => exam.subjectId)).toEqual([
      "ARB_G2_BAC",
      "ENG1_G2_BAC",
      "HIS_G2_BAC",
      "MATH_G2_BAC_PENDING",
    ]);
  });
});
