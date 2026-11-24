import { describe, expect, it } from "vitest";
import { getSIECheckpointBranches } from "@shared/sie-catalog";
import { buildLearningBacklogSummary } from "./learningBacklog";

describe("buildLearningBacklogSummary", () => {
  const subjectId = "ARB_G2_BAC";
  const branches = getSIECheckpointBranches(subjectId).filter(branch => branch.choices.length > 0);

  it("sums only calculated branch gaps and never treats unknown branches as zero", () => {
    expect(branches.length).toBeGreaterThan(1);
    const [first, second] = branches;
    const result = buildLearningBacklogSummary(
      [subjectId],
      {
        [subjectId]: {
          [first.branchId]: { status: "calculated", gapCount: 3, aheadCount: 0 },
          [second.branchId]: { status: "student_position_missing", gapCount: null },
        },
      },
      { [subjectId]: 20 },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(3);
    expect(result.calculatedBranches).toBe(1);
    expect(result.uncalculatedBranches).toBe(branches.length - 1);
    expect(result.countLabel).toBe("3 نقطة متأخرة");
    expect(result.coverageLabel).toContain("تحتاج استكمال المواضع");
  });

  it("uses legacy backlog only when no branch comparison is calculated", () => {
    const result = buildLearningBacklogSummary(
      [subjectId],
      { [subjectId]: Object.fromEntries(branches.map(branch => [
        branch.branchId,
        { status: "reference_missing", gapCount: null },
      ])) },
      { [subjectId]: 5 },
    )[0];

    expect(result.source).toBe("legacy");
    expect(result.legacyCount).toBe(5);
    expect(result.gapCount).toBe(0);
    expect(result.countLabel).toBe("5 عنصر يدوي");
    expect(result.coverageLabel).toContain("لم تكتمل مقارنة المواضع");
  });

  it("shows unknown when there is neither a calculated gap nor legacy backlog", () => {
    const result = buildLearningBacklogSummary([subjectId], {}, {})[0];
    expect(result.source).toBe("unknown");
    expect(result.countLabel).toBe("لم يُحسب بعد");
    expect(result.totalBranches).toBe(branches.length);
    expect(result.uncalculatedBranches).toBe(branches.length);
  });

  it("does not report negative gaps as backlog", () => {
    const first = branches[0];
    const result = buildLearningBacklogSummary(
      [subjectId],
      { [subjectId]: { [first.branchId]: { status: "calculated", gapCount: 0, aheadCount: 2 } } },
      {},
    )[0];
    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(0);
    expect(result.aheadCount).toBe(2);
    expect(result.countLabel).toBe("لا توجد فجوة محسوبة");
  });
});
