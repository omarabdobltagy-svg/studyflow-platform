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
          [first.branchId]: { status: "calculated", gapCount: 3, aheadCount: 0, studentPosition: 1, referencePosition: 4 },
          [second.branchId]: { status: "student_position_missing", gapCount: null, studentPosition: null, referencePosition: 5 },
        },
      },
      { [subjectId]: 20 },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(3);
    expect(result.calculatedBranches).toBe(1);
    expect(result.uncalculatedBranches).toBe(branches.length - 1);
    expect(result.countLabel).toBe("3 نقطة متأخرة");
    expect(result.coverageLabel).toContain("فروع");
  });

  it("reconstructs a missing API snapshot from the saved positions for that same branch", () => {
    const branch = branches.find(item => item.choices.length >= 3);
    expect(branch).toBeDefined();
    const result = buildLearningBacklogSummary(
      [subjectId],
      {},
      {},
      {
        courseProgress: {
          [subjectId]: {
            courseMode: "online",
            branches: {
              [branch!.branchId]: {
                lastCompletedLessonId: branch!.choices[0].nodeId,
                teacherTeachingFrontierId: branch!.choices[2].nodeId,
              },
            },
          },
        },
      },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(2);
    expect(result.calculatedBranches).toBe(1);
    expect(result.uncalculatedBranches).toBe(branches.length - 1);
  });

  it("uses legacy linear progress records when no teacher identity is selected", () => {
    const subject = "PROG_AI_G2_BAC";
    const linear = getSIECheckpointBranches(subject)[0];
    expect(linear.choices.length).toBeGreaterThan(2);
    const result = buildLearningBacklogSummary(
      [subject],
      {},
      {},
      {
        courseProgress: {
          [subject]: {
            courseMode: "online",
            branches: {
              oldUnit1: {
                lastCompletedLessonId: linear.choices[0].nodeId,
                teacherTeachingFrontierId: linear.choices[3].nodeId,
                teacherName: "مدرس محفوظ سابقًا",
              },
            },
          },
        },
      },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(3);
    expect(result.calculatedBranches).toBe(1);
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
    expect(result.coverageLabel).toContain("موضع المدرس/المجموعة");
  });

  it("shows unknown when there is neither a calculated gap nor legacy backlog", () => {
    const result = buildLearningBacklogSummary([subjectId], {}, {})[0];
    expect(result.source).toBe("unknown");
    expect(result.countLabel).toBe("لم يُحسب بعد");
    expect(result.totalBranches).toBe(branches.length);
    expect(result.uncalculatedBranches).toBe(branches.length);
    expect(result.referenceMissingBranches).toBe(branches.length);
  });

  it("keeps the two missing-position causes separate", () => {
    const first = branches[0];
    const second = branches[1];
    const result = buildLearningBacklogSummary(
      [subjectId],
      {
        [subjectId]: {
          [first.branchId]: { status: "reference_missing", gapCount: null, studentPosition: 2, referencePosition: null },
          [second.branchId]: { status: "student_position_missing", gapCount: null, studentPosition: null, referencePosition: 4 },
        },
      },
      {},
    )[0];

    expect(result.studentMissingBranches).toBe(1);
    expect(result.referenceMissingBranches).toBe(branches.length - 1);
    expect(result.coverageLabel).toContain("ينقصها موضعك");
    expect(result.coverageLabel).toContain("ينقصها موضع المدرس/المجموعة");
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


  it("falls back from an unconfirmed unknown branch marker to the saved subject frontier", () => {
    const branch = branches.find(item => item.choices.length >= 3);
    expect(branch).toBeDefined();
    const result = buildLearningBacklogSummary(
      [subjectId],
      {},
      {},
      {
        courseProgress: {
          [subjectId]: {
            lastCompletedLessonId: branch!.choices[0].nodeId,
            teacherTeachingFrontierId: branch!.choices[2].nodeId,
            branches: {
              [branch!.branchId]: {
                lastCompletedLessonId: "__UNKNOWN__",
                teacherTeachingFrontierId: "__UNKNOWN__",
              },
            },
          },
        },
      },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(2);
    expect(result.calculatedBranches).toBe(1);
  });

  it("respects an explicitly confirmed unknown position instead of replacing it with stale progress", () => {
    const branch = branches.find(item => item.choices.length >= 3);
    expect(branch).toBeDefined();
    const result = buildLearningBacklogSummary(
      [subjectId],
      {},
      {},
      {
        courseProgress: {
          [subjectId]: {
            lastCompletedLessonId: branch!.choices[0].nodeId,
            teacherTeachingFrontierId: branch!.choices[2].nodeId,
            branches: {
              [branch!.branchId]: {
                lastCompletedLessonId: "__UNKNOWN__",
                studentFrontierConfirmedAt: "2026-11-24T12:00:00.000Z",
                teacherTeachingFrontierId: branch!.choices[2].nodeId,
              },
            },
          },
        },
      },
    )[0];

    expect(result.source).toBe("unknown");
    expect(result.studentMissingBranches).toBe(branches.length);
  });

  it("reads the earlier student-progress field when the newer branch record is incomplete", () => {
    const branch = branches.find(item => item.choices.length >= 3);
    expect(branch).toBeDefined();
    const result = buildLearningBacklogSummary(
      [subjectId],
      {},
      {},
      {
        courseProgress: {
          [subjectId]: {
            teacherTeachingFrontierId: branch!.choices[2].nodeId,
            branches: { [branch!.branchId]: { teacherTeachingFrontierId: branch!.choices[2].nodeId } },
          },
        },
        legacyStudentFrontiers: { [subjectId]: branch!.choices[0].nodeId },
      },
    )[0];

    expect(result.source).toBe("frontier");
    expect(result.gapCount).toBe(2);
  });

});
