import { getDateKeyInTimeZone } from "./date-time";
import { SIE_CATALOG_META } from "./sie-catalog";

export type CairoSecondYearBaccalaureateExamProfile = {
  educationSystem?: string | null;
  gradeYear?: string | null;
  subjectIds?: string[] | null;
};

export type CairoSecondYearBaccalaureateExam = {
  date: string;
  dayName: string;
  subjectId: string;
  subjectName: string;
  category: "core" | "specialization";
  scope: "cairo_directorate_proposed";
  schoolConfirmed: false;
};

const CORE_EXAMS: Array<Omit<CairoSecondYearBaccalaureateExam, "scope" | "schoolConfirmed">> = [
  { date: "2026-11-29", dayName: "الأحد", subjectId: "ARB_G2_BAC", subjectName: "اللغة العربية", category: "core" },
  { date: "2026-11-30", dayName: "الاثنين", subjectId: "ENG1_G2_BAC", subjectName: "اللغة الإنجليزية", category: "core" },
  { date: "2026-12-01", dayName: "الثلاثاء", subjectId: "HIS_G2_BAC", subjectName: "التاريخ المصري", category: "core" },
];

const SPECIALIZATION_EXAMS: Record<string, string> = {
  PHY_G2_BAC_PENDING: "الفيزياء",
  MATH_G2_BAC_PENDING: "الرياضيات",
  CHEM_G2_BAC_PENDING: "الكيمياء",
  PROG_AI_G2_BAC: "البرمجة والذكاء الاصطناعي",
  ACCOUNTING_G2_BAC_PENDING: "المحاسبة",
  BUSINESS_G2_BAC_PENDING: "إدارة الأعمال",
  PSYCHOLOGY_G2_BAC_PENDING: "علم النفس",
  SECOND_LANGUAGE_G2_BAC_PENDING: "اللغة الأجنبية الثانية",
};

/**
 * Cairo's published November 2026 proposal for second-year Egyptian Baccalaureate.
 * Only subjects added to the aggregate are returned; Financial Culture and PE are omitted.
 * No school-specific timetable is inferred from the directorate-level proposal.
 */
export function getCairoSecondYearBaccalaureateExams(
  profile: CairoSecondYearBaccalaureateExamProfile | null | undefined,
): CairoSecondYearBaccalaureateExam[] {
  if (profile?.educationSystem !== "baccalaureate") return [];
  const gradeYear = String(profile.gradeYear ?? "").trim();
  const isSecondYear = gradeYear === SIE_CATALOG_META.gradeYear || /الصف الثاني الثانوي/.test(gradeYear);
  if (!isSecondYear) return [];

  const selected = new Set(Array.isArray(profile.subjectIds) ? profile.subjectIds : []);
  if (!selected.size) return [];

  const exams = CORE_EXAMS.filter(exam => selected.has(exam.subjectId));
  const specialization = Object.entries(SPECIALIZATION_EXAMS)
    .filter(([subjectId]) => selected.has(subjectId))
    .map(([subjectId, subjectName]) => ({
      date: "2026-12-02",
      dayName: "الأربعاء",
      subjectId,
      subjectName,
      category: "specialization" as const,
    }));

  return [...exams, ...specialization]
    .map(exam => ({ ...exam, scope: "cairo_directorate_proposed" as const, schoolConfirmed: false as const }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.subjectName.localeCompare(right.subjectName, "ar"));
}

export function getUpcomingCairoSecondYearBaccalaureateExams(
  profile: CairoSecondYearBaccalaureateExamProfile | null | undefined,
  now: Date,
): CairoSecondYearBaccalaureateExam[] {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return [];
  const cairoToday = getDateKeyInTimeZone(now, "Africa/Cairo");
  return getCairoSecondYearBaccalaureateExams(profile).filter(exam => exam.date >= cairoToday);
}

export const CAIRO_BAC_EXAM_CALENDAR_NOTICE = {
  schoolName: "مدرسة المرج الثانوية بنين",
  schoolConfirmation: "unverified" as const,
  sourceLabel: "جدول مديرية التربية والتعليم بالقاهرة المقترح",
  excludedNonAggregateSubjects: ["الثقافة المالية", "التربية الرياضية"] as const,
};
