import { calculateLearningGap, type LearningGapResult } from "@shared/sie-learning-progress";
import { getSIECheckpointBranches, getSIESubject } from "@shared/sie-catalog";

export type BranchGapSnapshot = {
  status?: string;
  gapCount?: number | null;
  aheadCount?: number | null;
  studentPosition?: number | null;
  referencePosition?: number | null;
};

export type SubjectBacklogSummary = {
  subjectId: string;
  subjectName: string;
  totalBranches: number;
  calculatedBranches: number;
  uncalculatedBranches: number;
  studentMissingBranches: number;
  referenceMissingBranches: number;
  gapCount: number;
  aheadCount: number;
  legacyCount: number;
  source: "frontier" | "legacy" | "unknown";
  countLabel: string;
  coverageLabel: string;
};

export type LearningBacklogSources = {
  courseProgress?: Record<string, any> | null;
  courseModes?: Record<string, "center" | "online"> | null;
  teacherIds?: Record<string, string> | null;
  teacherNames?: Record<string, string> | null;
  legacyStudentFrontiers?: Record<string, string> | null;
  legacyStudentProgress?: Record<string, Record<string, any>> | null;
};

const NOT_STARTED = "__NOT_STARTED__";

function validPosition(choices: Array<{ nodeId: string }>, value: unknown): value is string {
  return typeof value === "string" && (
    value === NOT_STARTED || choices.some(choice => choice.nodeId === value)
  );
}

function frontierRecordForBranch(
  subjectId: string,
  branchId: string,
  choices: Array<{ nodeId: string }>,
  subjectRecord: Record<string, any>,
): Record<string, any> {
  const records = (subjectRecord.branches ?? {}) as Record<string, Record<string, any>>;
  const direct = records[branchId];
  if (direct) return direct;

  // Older Arabic reading data was stored by textbook unit before reading was
  // consolidated into one branch. Reuse a unit record only when its checkpoint
  // belongs to the current reading branch.
  if (subjectId === "ARB_G2_BAC" && branchId === "ARB_READING") {
    return Object.values(records).find(record =>
      choices.some(choice => [
        record.lastCompletedLessonId,
        record.teacherTeachingFrontierId,
        record.schoolClassFrontierId,
      ].includes(choice.nodeId))
    ) ?? {};
  }
  return {};
}

function pickLegacyLinearFrontier(
  records: Array<Record<string, any>>,
  choices: Array<{ nodeId: string }>,
  field: "lastCompletedLessonId" | "teacherTeachingFrontierId" | "schoolClassFrontierId",
  teacherId?: string,
  teacherName?: string,
): string | undefined {
  const filtered = records.filter(record => {
    if (field !== "teacherTeachingFrontierId") return true;
    // A missing current teacher identity is not a reason to discard historical
    // teacher observations. Only apply identity filtering when an identity exists.
    if (teacherId && teacherId !== "__SKIP__") return !record.teacherId || record.teacherId === teacherId;
    if (teacherName?.trim()) return !record.teacherName || record.teacherName === teacherName.trim();
    return true;
  });

  const candidates = filtered
    .map(record => record[field])
    .filter(value => value === "__UNKNOWN__" || validPosition(choices, value));
  const positioned = candidates
    .filter(value => value !== "__UNKNOWN__")
    .sort((left, right) => {
      const leftIndex = left === NOT_STARTED ? -1 : choices.findIndex(choice => choice.nodeId === left);
      const rightIndex = right === NOT_STARTED ? -1 : choices.findIndex(choice => choice.nodeId === right);
      return leftIndex - rightIndex;
    });
  return positioned.length ? positioned[positioned.length - 1] : candidates.length ? "__UNKNOWN__" : undefined;
}

function deriveSavedBranchGap(
  subjectId: string,
  branchId: string,
  choices: Array<{ nodeId: string; title: string }>,
  subjectRecord: Record<string, any> | undefined,
  sources: LearningBacklogSources,
): LearningGapResult {
  const record = frontierRecordForBranch(subjectId, branchId, choices, subjectRecord ?? {});
  const linear = subjectId === "HIS_G2_BAC" || subjectId === "PROG_AI_G2_BAC";
  const legacyRecords = linear
    ? Object.values((subjectRecord?.branches ?? {}) as Record<string, Record<string, any>>)
    : [];

  const ownOrFallback = (
    field: "lastCompletedLessonId" | "teacherTeachingFrontierId" | "schoolClassFrontierId",
  ): string => {
    const confirmationKey = field === "lastCompletedLessonId"
      ? "studentFrontierConfirmedAt"
      : field === "teacherTeachingFrontierId"
        ? "teacherFrontierConfirmedAt"
        : "schoolFrontierConfirmedAt";
    const branchValue = record[field];

    // A valid position in the current branch always wins. An explicit unknown
    // only blocks fallback when the student confirmed that unknown on purpose.
    if (validPosition(choices, branchValue)) return branchValue;
    if (branchValue === "__UNKNOWN__" && record[confirmationKey]) return "__UNKNOWN__";

    const subjectLevel = subjectRecord?.[field];
    if (validPosition(choices, subjectLevel)) return subjectLevel;

    if (field === "lastCompletedLessonId") {
      const legacyStudent = sources.legacyStudentFrontiers?.[subjectId]
        ?? sources.legacyStudentProgress?.[subjectId]?.studentAttendedFrontier;
      if (validPosition(choices, legacyStudent)) return legacyStudent;
    }

    if (linear) {
      const legacy = pickLegacyLinearFrontier(
        legacyRecords,
        choices,
        field,
        sources.teacherIds?.[subjectId],
        sources.teacherNames?.[subjectId],
      );
      if (legacy !== undefined) return legacy;
    }
    return "__UNKNOWN__";
  };

  const courseMode = sources.courseModes?.[subjectId] ?? subjectRecord?.courseMode ?? record.courseMode ?? "online";
  const studentFrontierId = ownOrFallback("lastCompletedLessonId");
  const teacherTeachingFrontierId = ownOrFallback("teacherTeachingFrontierId");
  const schoolClassFrontierId = courseMode === "center"
    ? ownOrFallback("schoolClassFrontierId")
    : "__UNKNOWN__";

  return calculateLearningGap(choices, {
    studentFrontierId,
    teacherTeachingFrontierId,
    schoolClassFrontierId,
  });
}

/**
 * Calculates backlog from saved branch positions first, then falls back to the
 * server's calculated snapshots, and finally to the old manually-entered value.
 * A syllabus index size is never used as a student's backlog.
 */
export function buildLearningBacklogSummary(
  subjectIds: string[],
  gapByBranch: Record<string, Record<string, BranchGapSnapshot>> | null | undefined,
  legacyBacklog: Record<string, unknown> | null | undefined,
  sources: LearningBacklogSources = {},
): SubjectBacklogSummary[] {
  return subjectIds.map(subjectId => {
    const branches = getSIECheckpointBranches(subjectId).filter(branch => branch.choices.length > 0);
    const subjectGaps = gapByBranch?.[subjectId] ?? {};
    const subjectRecord = sources.courseProgress?.[subjectId] as Record<string, any> | undefined;

    const resolved = branches.map(branch => {
      const snapshot = subjectGaps[branch.branchId];
      if (snapshot?.status === "calculated" && typeof snapshot.gapCount === "number" && Number.isFinite(snapshot.gapCount)) {
        return {
          status: "calculated",
          gapCount: Math.max(0, snapshot.gapCount),
          aheadCount: Math.max(0, Number(snapshot.aheadCount) || 0),
          studentPosition: snapshot.studentPosition ?? null,
          referencePosition: snapshot.referencePosition ?? null,
        };
      }
      if (snapshot && (snapshot.studentPosition != null || snapshot.referencePosition != null)) {
        return {
          ...snapshot,
          gapCount: snapshot.gapCount ?? null,
          aheadCount: snapshot.aheadCount ?? null,
          studentPosition: snapshot.studentPosition ?? null,
          referencePosition: snapshot.referencePosition ?? null,
        } as LearningGapResult;
      }
      // Reconstruct from the saved selection when a stale/legacy API snapshot
      // did not map that branch, while still preserving unknown as unknown.
      return deriveSavedBranchGap(subjectId, branch.branchId, branch.choices, subjectRecord, sources);
    });

    const calculated = resolved.filter(gap => gap.status === "calculated");
    const gapCount = calculated.reduce((total, item) => total + Math.max(0, item.gapCount ?? 0), 0);
    const aheadCount = calculated.reduce((total, item) => total + Math.max(0, item.aheadCount ?? 0), 0);
    const totalBranches = branches.length;
    const calculatedBranches = calculated.length;
    const uncalculatedBranches = Math.max(0, totalBranches - calculatedBranches);
    // Keep the two data-quality causes mutually exclusive. When both sides are
    // unknown, calculateLearningGap reports reference_missing first; it is not
    // counted again as a student-position failure.
    const studentMissingBranches = resolved.filter(gap => gap.status === "student_position_missing").length;
    const referenceMissingBranches = resolved.filter(gap => gap.status === "reference_missing").length;

    const legacyRaw = legacyBacklog?.[subjectId]
      ?? legacyBacklog?.[getSIESubject(subjectId)?.nameAr || ""]
      ?? 0;
    const legacyCount = Math.max(0, Math.trunc(Number(legacyRaw) || 0));
    const source: SubjectBacklogSummary["source"] = calculatedBranches > 0
      ? "frontier"
      : legacyCount > 0 ? "legacy" : "unknown";

    const countLabel = source === "frontier"
      ? gapCount === 0 ? "لا توجد فجوة محسوبة" : `${gapCount} نقطة متأخرة`
      : source === "legacy" ? `${legacyCount} عنصر يدوي` : "لم يُحسب بعد";

    const missingReasons = [
      studentMissingBranches ? `${studentMissingBranches} فروع ينقصها موضعك` : "",
      referenceMissingBranches ? `${referenceMissingBranches} فروع ينقصها موضع المدرس/المجموعة` : "",
    ].filter(Boolean).join("، ");

    const coverageLabel = source === "frontier"
      ? uncalculatedBranches > 0
        ? `تم حساب ${calculatedBranches} من ${totalBranches} فروع؛ ${missingReasons || `${uncalculatedBranches} فروع تحتاج استكمال بياناتها`}`
        : `تم حساب الفجوة في ${calculatedBranches} فروع`
      : source === "legacy"
        ? `قيمة التراكم اليدوية: ${legacyCount} عنصر. ${missingReasons || "لم تكتمل مقارنة مواضع المنهج بعد"}`
        : missingReasons
          ? missingReasons
          : "لا توجد مواضع محفوظة كافية لحساب الفجوة بعد";

    return {
      subjectId,
      subjectName: getSIESubject(subjectId)?.nameAr || subjectId,
      totalBranches,
      calculatedBranches,
      uncalculatedBranches,
      studentMissingBranches,
      referenceMissingBranches,
      gapCount,
      aheadCount,
      legacyCount,
      source,
      countLabel,
      coverageLabel,
    };
  });
}
