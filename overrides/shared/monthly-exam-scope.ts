import { getSIECheckpointProgressBranches, getSIESubject } from "./sie-catalog";

export type MonthlyExamScopeSource = "student_reported" | "school_confirmed";

export type MonthlyExamScopeRecord = {
  subjectId: string;
  examDate: string;
  includedNodeIds: string[];
  excludedNodeIds: string[];
  source: MonthlyExamScopeSource;
  savedAt: string;
};

export type MonthlyExamCoveredBranch = {
  subjectId: string;
  subjectName: string;
  branchId: string;
  branchTitle: string;
  source: MonthlyExamScopeSource;
  lessonIds: string[];
  lessonTitles: string[];
  excludedLessonIds: string[];
  excludedLessonTitles: string[];
};

export function monthlyExamScopeKey(subjectId: string, examDate: string): string {
  return subjectId + "::" + examDate;
}

export function getMonthlyExamScopeRecord(
  records: Record<string, unknown> | null | undefined,
  subjectId: string,
  examDate: string,
): MonthlyExamScopeRecord | null {
  if (!records || typeof records !== "object" || Array.isArray(records)) return null;
  const value = records[monthlyExamScopeKey(subjectId, examDate)];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<MonthlyExamScopeRecord>;
  if (record.subjectId !== subjectId || record.examDate !== examDate) return null;
  if (!Array.isArray(record.includedNodeIds) || !Array.isArray(record.excludedNodeIds)) return null;
  const validSource: MonthlyExamScopeSource = record.source === "school_confirmed" ? "school_confirmed" : "student_reported";
  const allowedIds = new Set(getSIECheckpointProgressBranches(subjectId).flatMap(branch => branch.choices.map(choice => choice.nodeId)));
  const includedNodeIds = [...new Set(record.includedNodeIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))];
  const excludedNodeIds = [...new Set(record.excludedNodeIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id) && !includedNodeIds.includes(id)))];
  if (!includedNodeIds.length) return null;
  return {
    subjectId,
    examDate,
    includedNodeIds,
    excludedNodeIds,
    source: validSource,
    savedAt: typeof record.savedAt === "string" ? record.savedAt : "",
  };
}

/**
 * Only explicit per-exam scope records are returned here.
 * A teacher/center frontier is course-progress evidence, never proof of exam content.
 */
export function buildMonthlyExamCoveredScope(
  subjectIds: string[],
  records: Record<string, unknown> | null | undefined,
  examDate: string,
): MonthlyExamCoveredBranch[] {
  const result: MonthlyExamCoveredBranch[] = [];
  for (const subjectId of subjectIds) {
    const scope = getMonthlyExamScopeRecord(records, subjectId, examDate);
    if (!scope) continue;
    const included = new Set(scope.includedNodeIds);
    const excluded = new Set(scope.excludedNodeIds);
    const subjectName = getSIESubject(subjectId)?.nameAr ?? subjectId;
    for (const branch of getSIECheckpointProgressBranches(subjectId)) {
      const includedChoices = branch.choices.filter(choice => included.has(choice.nodeId));
      const excludedChoices = branch.choices.filter(choice => excluded.has(choice.nodeId));
      if (!includedChoices.length && !excludedChoices.length) continue;
      result.push({
        subjectId,
        subjectName,
        branchId: branch.branchId,
        branchTitle: branch.branchTitle,
        source: scope.source,
        lessonIds: includedChoices.map(choice => choice.nodeId),
        lessonTitles: includedChoices.map(choice => choice.title),
        excludedLessonIds: excludedChoices.map(choice => choice.nodeId),
        excludedLessonTitles: excludedChoices.map(choice => choice.title),
      });
    }
  }
  return result;
}
