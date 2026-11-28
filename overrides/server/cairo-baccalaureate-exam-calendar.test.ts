import { describe, expect, it } from "vitest";
import { CAIRO_BAC_EXAM_CALENDAR_NOTICE, getCairoSecondYearBaccalaureateExams, getUpcomingCairoSecondYearBaccalaureateExams } from "@shared/cairo-baccalaureate-exam-calendar";

describe("Cairo second-year Baccalaureate exam calendar", () => {
  it("returns only added-to-total subjects for the matching second-year Baccalaureate profile", () => {
    const exams = getCairoSecondYearBaccalaureateExams({
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC", "FINANCIAL_CULTURE_G2_BAC"],
    });
    expect(exams.map(item => [item.date, item.subjectId])).toEqual([
      ["2026-11-29", "ARB_G2_BAC"],
      ["2026-11-30", "ENG1_G2_BAC"],
      ["2026-12-01", "HIS_G2_BAC"],
      ["2026-12-02", "PROG_AI_G2_BAC"],
    ]);
    expect(exams.every(item => item.schoolConfirmed === false)).toBe(true);
  });

  it("selects only the specialization actually included in the student's profile", () => {
    const exams = getCairoSecondYearBaccalaureateExams({
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC", "CHEM_G2_BAC_PENDING"],
    });
    expect(exams.filter(item => item.category === "specialization").map(item => item.subjectId).sort())
      .toEqual(["CHEM_G2_BAC_PENDING", "PROG_AI_G2_BAC"].sort());
  });

  it("does not return a timetable for another education system or grade", () => {
    expect(getCairoSecondYearBaccalaureateExams({
      educationSystem: "general_secondary", gradeYear: "الصف الثاني الثانوي", subjectIds: ["ARB_G2_BAC"],
    })).toEqual([]);
    expect(getCairoSecondYearBaccalaureateExams({
      educationSystem: "baccalaureate", gradeYear: "الصف الأول الثانوي", subjectIds: ["ARB_G2_BAC"],
    })).toEqual([]);
  });

  it("removes an exam from the coming list after midnight in Cairo", () => {
    const profile = {
      educationSystem: "baccalaureate",
      gradeYear: "الصف الثاني الثانوي – دفعة 2027",
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC"],
    };
    expect(getUpcomingCairoSecondYearBaccalaureateExams(profile, new Date("2026-11-28T21:59:59.000Z")).map(item => item.date))
      .toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    expect(getUpcomingCairoSecondYearBaccalaureateExams(profile, new Date("2026-12-02T22:00:00.000Z"))).toEqual([]);
  });

  it("marks the Cairo table as a proposal and explicitly excludes non-added subjects", () => {
    expect(CAIRO_BAC_EXAM_CALENDAR_NOTICE).toMatchObject({
      schoolName: "مدرسة المرج الثانوية بنين",
      schoolConfirmation: "unverified",
      sourceLabel: "جدول مديرية التربية والتعليم بالقاهرة المقترح",
      excludedNonAggregateSubjects: ["الثقافة المالية", "التربية الرياضية"],
    });
  });
});
