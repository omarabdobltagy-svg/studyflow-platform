import { describe, expect, it } from "vitest";
import {
  EGYPT_SCHOOL_CALENDAR_2026_2027,
  EGYPT_GENERAL_EDUCATION_STRUCTURE,
  EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027,
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
  it("models the 2026/27 public school calendar separately from university dates", () => {
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.schoolYearStart).toBe("2026-09-12");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.transferFirstTermExamsStart).toBe("2027-01-09");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.midyearBreakStart).toBe("2027-01-23");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.secondTermInstructionStart).toBe("2027-02-06");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.transferSecondTermExamsStart).toBe("2027-05-22");
    expect(EGYPT_SCHOOL_CALENDAR_2026_2027.schoolYearEnd).toBe("2027-06-24");
  });

  it("uses distinct phases for first-term exams, midyear break and second-term exams", () => {
    expect(getEgyptSchoolProgress("2027-01-10").phase).toBe("first_term_exams");
    expect(getEgyptSchoolProgress("2027-01-25").phase).toBe("midyear_break");
    expect(getEgyptSchoolProgress("2027-05-24").phase).toBe("second_term_exams");
    expect(getEgyptSchoolProgress("2027-06-30").phase).toBe("general_secondary_exams");
    expect(getEgyptSchoolProgress("2027-01-23").phase).toBe("midyear_break");
  });
});
