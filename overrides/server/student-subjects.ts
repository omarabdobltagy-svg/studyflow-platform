import { SIE_SUBJECTS, type SIEEducationSystem } from "../shared/sie-catalog";

type StudentSelection = { subjectIds?: unknown; systemId?: unknown };

/** Resolve stable curriculum IDs while preserving Arabic display labels. */
export function resolveStudentSubjectIds(
  displaySubjects: string[],
  selection: StudentSelection,
  educationSystem: SIEEducationSystem | "other",
): string[] {
  const configured = Array.isArray(selection.subjectIds)
    ? [...new Set(selection.subjectIds.filter((value): value is string =>
        typeof value === "string" && SIE_SUBJECTS.some(subject => subject.subjectId === value)
      ))]
    : [];
  if (configured.length) return configured;

  const system = selection.systemId === "EG_GENERAL_SECONDARY" ? "general_secondary"
    : selection.systemId === "EG_BACCALAUREATE" ? "baccalaureate" : educationSystem;
  const resolved: string[] = [];
  for (const value of displaySubjects) {
    const byId = SIE_SUBJECTS.find(subject => subject.subjectId === value);
    if (byId) {
      if (!resolved.includes(byId.subjectId)) resolved.push(byId.subjectId);
      continue;
    }
    const matches = SIE_SUBJECTS.filter(subject => subject.nameAr === value);
    const preferred = system === "general_secondary"
      ? matches.find(subject => subject.subjectId.endsWith("_GENERAL"))
      : system === "baccalaureate"
        ? matches.find(subject => subject.subjectId.includes("_BAC") || subject.subjectId.endsWith("_PENDING"))
        : undefined;
    const match = preferred ?? (matches.length === 1 ? matches[0] : undefined);
    if (match && !resolved.includes(match.subjectId)) resolved.push(match.subjectId);
  }
  return resolved;
}
