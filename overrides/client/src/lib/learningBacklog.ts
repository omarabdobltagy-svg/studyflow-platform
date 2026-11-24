import { getSIECheckpointBranches, getSIESubject } from "@shared/sie-catalog";

export type BranchGapSnapshot = {
  status?: string;
  gapCount?: number | null;
  aheadCount?: number | null;
};

export type SubjectBacklogSummary = {
  subjectId: string;
  subjectName: string;
  totalBranches: number;
  calculatedBranches: number;
  uncalculatedBranches: number;
  gapCount: number;
  aheadCount: number;
  legacyCount: number;
  source: "frontier" | "legacy" | "unknown";
  countLabel: string;
  coverageLabel: string;
};

/**
 * Calculates backlog from the saved student/teacher positions inside each
 * official curriculum branch. Unknown branches are never silently counted as 0.
 * Legacy manually-entered backlog is only a fallback when no branch can yet
 * produce a confirmed comparison, so the same work is never double counted.
 */
export function buildLearningBacklogSummary(
  subjectIds: string[],
  gapByBranch: Record<string, Record<string, BranchGapSnapshot>> | null | undefined,
  legacyBacklog: Record<string, unknown> | null | undefined,
): SubjectBacklogSummary[] {
  return subjectIds.map(subjectId => {
    const branches = getSIECheckpointBranches(subjectId).filter(branch => branch.choices.length > 0);
    const subjectGaps = gapByBranch?.[subjectId] ?? {};
    const calculated = branches.flatMap(branch => {
      const gap = subjectGaps[branch.branchId];
      if (gap?.status !== "calculated" || typeof gap.gapCount !== "number" || !Number.isFinite(gap.gapCount)) return [];
      return [{ gapCount: Math.max(0, gap.gapCount), aheadCount: Math.max(0, Number(gap.aheadCount) || 0) }];
    });
    const legacyRaw = legacyBacklog?.[subjectId]
      ?? legacyBacklog?.[getSIESubject(subjectId)?.nameAr || ""]
      ?? 0;
    const legacyCount = Math.max(0, Math.trunc(Number(legacyRaw) || 0));
    const hasCalculatedGaps = calculated.length > 0;
    const gapCount = calculated.reduce((total, item) => total + item.gapCount, 0);
    const aheadCount = calculated.reduce((total, item) => total + item.aheadCount, 0);
    const totalBranches = branches.length;
    const calculatedBranches = calculated.length;
    const uncalculatedBranches = Math.max(0, totalBranches - calculatedBranches);
    const source: SubjectBacklogSummary["source"] = hasCalculatedGaps
      ? "frontier"
      : legacyCount > 0 ? "legacy" : "unknown";
    const countLabel = source === "frontier"
      ? gapCount === 0 ? "لا توجد فجوة محسوبة" : `${gapCount} نقطة متأخرة`
      : source === "legacy" ? `${legacyCount} عنصر يدوي` : "لم يُحسب بعد";
    const coverageLabel = source === "frontier"
      ? uncalculatedBranches > 0
        ? `الفجوة محسوبة في ${calculatedBranches} من ${totalBranches} فروع؛ ${uncalculatedBranches} تحتاج استكمال المواضع`
        : `تم حساب الفجوة في ${calculatedBranches} فروع`
      : source === "legacy"
        ? "قيمة قديمة من التراكم اليدوي؛ لم تكتمل مقارنة المواضع بعد"
        : "سجّل موضعك وموضع المدرس أو المجموعة لحساب الفجوة";
    return {
      subjectId,
      subjectName: getSIESubject(subjectId)?.nameAr || subjectId,
      totalBranches,
      calculatedBranches,
      uncalculatedBranches,
      gapCount,
      aheadCount,
      legacyCount,
      source,
      countLabel,
      coverageLabel,
    };
  });
}
