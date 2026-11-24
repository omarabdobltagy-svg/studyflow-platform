/**
 * Egypt public pre-university school calendar reference.
 *
 * Official school dates are refreshed per academic year; the current
 * 2026/27 dates below cover public, official-language and private schools.
 */
/**
 * General Egyptian pre-university structure under Education Law 139/1981
 * as amended by Law 169/2025 (effective 14 August 2025).
 */
export const EGYPT_GENERAL_EDUCATION_STRUCTURE = {
  compulsoryYears: 12,
  basicEducation: { primaryYears: 6, preparatoryYears: 3, totalYears: 9 },
  generalSecondaryYears: 3,
  technicalSecondaryYears: 3,
  advancedTechnologicalYears: 5,
  vocationalSecondaryYears: { minimum: 1, maximum: 2 },
  law: "139/1981 amended by 169/2025",
  effectiveDate: "2025-08-14",
  scope: "general_secondary_and_technical_routes_only",
} as const;

/**
 * Assessment and calendar facts for the 2026/27 school year. A monthly
 * examination reflects what was taught, not every item printed in the
 * full-year curriculum index. Assessment weights vary by grade and stage.
 */
export const EGYPT_GENERAL_ASSESSMENT_CONTEXT_2026_2027 = {
  firstMonthlyTransferGradeExams: { start: "2026-10-18", end: "2026-10-22" },
  firstMonthlyExamScope: "content taught from the start of the school year through the end of the first month",
  monthlyAssessmentAppliesToTransferGrades: true,
  prepCertificateExamScheduleIsGovernorateSpecific: true,
  ongoingAssessmentIncludes: ["monthly exams", "weekly assessments", "classwork", "homework", "attendance and participation"],
  endOfCurriculumDistributionWeekReservedForRevision: true,
  note: "The listed assessment elements are not a universal fixed grading-weight formula for every grade.",
} as const;

export const EGYPT_SCHOOL_CALENDAR_2026_2027 = {
  academicYear: "2026/2027",
  schoolYearStart: "2026-09-12",
  firstTermInstructionStart: "2026-09-12",
  firstTermInstructionEnd: "2027-01-08",
  transferFirstTermExamsStart: "2027-01-09",
  transferFirstTermExamsEnd: "2027-01-14",
  preparatoryFirstTermExamsStart: "2027-01-16",
  preparatoryFirstTermExamsEnd: "2027-01-21",
  midyearBreakStart: "2027-01-23",
  midyearBreakEnd: "2027-02-04",
  secondTermInstructionStart: "2027-02-06",
  transferSecondTermExamsStart: "2027-05-22",
  transferSecondTermExamsEnd: "2027-05-27",
  preparatorySecondTermExamsStart: "2027-05-29",
  preparatorySecondTermExamsEnd: "2027-06-03",
  schoolYearEnd: "2027-06-24",
  generalSecondaryExamsStart: "2027-06-26",
  generalSecondaryExamsEnd: "2027-07-21",
  firstTermActualSchoolDays: 93,
  secondTermActualSchoolDays: 90,
  totalActualSchoolDays: 183,
  schoolWeeksAcrossYear: 39,
} as const;

export type EgyptSchoolPhase =
  | "before_school_year"
  | "first_term"
  | "first_term_exams"
  | "midyear_break"
  | "second_term"
  | "second_term_exams"
  | "general_secondary_exams"
  | "after_school_year";

export type EgyptSchoolProgress = {
  academicYear: string;
  phase: EgyptSchoolPhase;
  term: 1 | 2 | null;
  termProgress: number;
  activePart: 1 | 2;
  labelAr: string;
};

function day(value: string | Date): number {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, date] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

function between(date: number, start: string, end: string): boolean {
  return date >= day(start) && date <= day(end);
}

function fraction(date: number, start: string, end: string): number {
  const first = day(start);
  const last = day(end);
  if (date <= first) return 0;
  if (date >= last) return 1;
  return (date - first) / (last - first);
}

/**
 * Returns a date-aware school-year phase and an evenly-distributed pacing
 * estimate. The estimate is a planning hint, never a claim about a named
 * teacher's real progress.
 */
export function getEgyptSchoolProgress(value: string | Date = new Date()): EgyptSchoolProgress {
  const date = day(value);
  const c = EGYPT_SCHOOL_CALENDAR_2026_2027;

  if (date < day(c.schoolYearStart)) {
    return { academicYear: c.academicYear, phase: "before_school_year", term: null, termProgress: 0, activePart: 1, labelAr: "قبل بداية العام الدراسي" };
  }

  if (between(date, c.firstTermInstructionStart, c.firstTermInstructionEnd)) {
    return { academicYear: c.academicYear, phase: "first_term", term: 1, termProgress: fraction(date, c.firstTermInstructionStart, c.firstTermInstructionEnd), activePart: 1, labelAr: "الفصل الدراسي الأول" };
  }

  if (between(date, c.transferFirstTermExamsStart, "2027-01-22")) {
    return { academicYear: c.academicYear, phase: "first_term_exams", term: 1, termProgress: 1, activePart: 1, labelAr: "امتحانات الفصل الدراسي الأول" };
  }

  if (between(date, c.midyearBreakStart, c.midyearBreakEnd)) {
    return { academicYear: c.academicYear, phase: "midyear_break", term: null, termProgress: 1, activePart: 1, labelAr: "إجازة نصف العام" };
  }

  if (between(date, c.secondTermInstructionStart, "2027-05-21")) {
    return { academicYear: c.academicYear, phase: "second_term", term: 2, termProgress: fraction(date, c.secondTermInstructionStart, "2027-05-21"), activePart: 2, labelAr: "الفصل الدراسي الثاني" };
  }

  if (between(date, c.transferSecondTermExamsStart, c.schoolYearEnd)) {
    return { academicYear: c.academicYear, phase: "second_term_exams", term: 2, termProgress: 1, activePart: 2, labelAr: "امتحانات الفصل الدراسي الثاني" };
  }

  if (between(date, c.generalSecondaryExamsStart, c.generalSecondaryExamsEnd)) {
    return { academicYear: c.academicYear, phase: "general_secondary_exams", term: null, termProgress: 1, activePart: 2, labelAr: "امتحانات الثانوية العامة" };
  }

  return { academicYear: c.academicYear, phase: "after_school_year", term: null, termProgress: 1, activePart: 2, labelAr: "بعد نهاية العام الدراسي" };
}
