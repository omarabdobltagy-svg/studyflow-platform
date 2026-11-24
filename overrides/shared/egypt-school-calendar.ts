/**
 * Egypt public pre-university school calendar reference.
 *
 * Deliberately excludes Baccalaureate-specific examination windows.
 * Official school dates are refreshed per academic year; the current
 * 2026/27 dates below cover public, official-language and private schools.
 */
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
  firstTermWeeks: 17,
  secondTermWeeks: 15,
} as const;

export type EgyptSchoolPhase =
  | "before_school_year"
  | "first_term"
  | "first_term_exams"
  | "midyear_break"
  | "second_term"
  | "second_term_exams"
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

  if (between(date, c.transferFirstTermExamsStart, c.midyearBreakStart)) {
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

  return { academicYear: c.academicYear, phase: "after_school_year", term: null, termProgress: 1, activePart: 2, labelAr: "بعد نهاية العام الدراسي" };
}

/**
 * Estimate how many sequential checkpoints a typical class could have covered
 * by the selected date, assuming even curriculum distribution over the term.
 * A small allowance is applied by the caller, not here.
 */
export function estimateTermCheckpointFrontier(totalTermCheckpoints: number, value: string | Date = new Date()): number {
  const progress = getEgyptSchoolProgress(value);
  if (progress.phase === "before_school_year") return 0;
  if (progress.phase === "first_term_exams" || progress.phase === "midyear_break" || progress.phase === "second_term_exams" || progress.phase === "after_school_year") {
    return Math.max(0, Math.floor(totalTermCheckpoints));
  }
  if (progress.term === null) return 0;
  return Math.max(0, Math.min(totalTermCheckpoints, Math.floor(totalTermCheckpoints * progress.termProgress)));
}

/**
 * Split a linear textbook into its first- and second-term parts using the
 * part labels already attached to the official catalogue entries.
 */
export function getChoicesForCurrentSchoolPart<T extends { sourceLabel?: string; unitNumber?: number }>(
  choices: T[],
  value: string | Date = new Date(),
): T[] {
  const activePart = getEgyptSchoolProgress(value).activePart;
  const partTwo = (choice: T) =>
    /الجزء\s*الثاني|part\s*2|part\s*ii/i.test(choice.sourceLabel ?? "") ||
    (typeof choice.unitNumber === "number" && choice.unitNumber >= 5);
  return choices.filter(choice => activePart === 2 ? partTwo(choice) : !partTwo(choice));
}
