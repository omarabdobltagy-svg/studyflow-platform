import { describe, expect, it } from "vitest";
import {
  EGYPT_SCHOOL_CALENDAR_2026_2027,
  EGYPT_GENERAL_EDUCATION_STRUCTURE,
  EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027,
  estimateTermCheckpointFrontier,
  getChoicesForCurrentSchoolPart,
  getEgyptSchoolProgress,
} from "./egypt-school-calendar";

describe("Egyptian public school calendar", () => {
  it("models the general education stages under the amended education law", () => {
    expect(EGYPT_GENERAL_EDUCATION_STRUCTURE).toMatchObject({
      compulsoryYears: 12,
      basicEducation: { primaryYears: 6, preparatoryYears: 3, totalYears: 9 },
      generalSecondaryYears: 3,
      technicalSecondaryYears: 3,
      advancedTechnologicalYears: 5,
      vocationalSecondaryYears: { minimum: 1, maximum: 2 },
      effectiveDate: "2025-08-14",
    });
  });

  it("does not treat a monthly exam as completion of the full-year textbook", () => {
    expect(EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027.firstMonthlyTransferGradeExams)
      .toEqual({ start: "2026-10-18", end: "2026-10-22" });
    expect(EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027.firstMonthlyExamScope)
      .toContain("through the end of the first month");
    expect(EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027.prepCertificateExamScheduleIsGovernorateSpecific).toBe(true);
    expect(EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027.note)
      .toContain("not a universal fixed grading-weight formula");
  });
  it("keeps the non-Baccalaureate 2026/27 school dates separate from university dates", () => {
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.schoolYearStart).toBe("2026-09-12");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.transferFirstTermExamsStart).toBe("2027-01-09");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.midyearBreakStart).toBe("2027-01-23");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.secondTermInstructionStart).toBe("2027-02-06");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.transferSecondTermExamsStart).toBe("2027-05-22");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.schoolYearEnd).toBe("2027-06-24");
  });

  it("does not assume the whole history syllabus is taught in the first two months", () => {
    const september = estimateTermCheckpointFrontier(12, "2026-09-20");
    const october = estimateTermCheckpointFrontier(12, "2026-10-18");
    const november = estimateTermCheckpointFrontier(12, "2026-11-24");
    expect(september).toBeLessThan(3);
    expect(october).toBeGreaterThan(0);
    expect(october).toBeLessThan(6);
    expect(november).toBeGreaterThan(october);
    expect(november).toBeLessThan(12);
  });

  it("switches from first-term to second-term curriculum without mixing both parts", () => {
    const choices = [
      { sourceLabel: "كتاب التاريخ - الجزء الأول", unitNumber: 1 },
      { sourceLabel: "كتاب التاريخ - الجزء الأول", unitNumber: 2 },
      { sourceLabel: "كتاب التاريخ - الجزء الثاني", unitNumber: 4 },
      { sourceLabel: "كتاب التاريخ - الجزء الثاني", unitNumber: 6 },
    ];
    expect(getChoicesForCurrentSchoolPart(choices, "2026-11-24")).toHaveLength(2);
    expect(getChoicesForCurrentSchoolPart(choices, "2027-03-01")).toHaveLength(2);
    expect(getEgyptSchoolProgress("2027-03-01").term).toBe(2);
  });

  it("uses distinct phases for first-term exams, midyear break and second-term exams", () => {
    expect(getEgyptSchoolProgress("2027-01-10").phase).toBe("first_term_exams");
    expect(getEgyptSchoolProgress("2027-01-25").phase).toBe("midyear_break");
    expect(getEgyptSchoolProgress("2027-05-24").phase).toBe("second_term_exams");
    expect(getEgyptSchoolProgress("2027-06-30").phase).toBe("general_secondary_exams");
    expect(getEgyptSchoolProgress("2027-01-23").phase).toBe("midyear_break");
  });
});
