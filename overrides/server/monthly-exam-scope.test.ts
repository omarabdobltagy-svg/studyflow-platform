import { describe, expect, it } from "vitest";
import { getSIECheckpointProgressBranches } from "@shared/sie-catalog";
import {
  buildMonthlyExamCoveredScope,
  getMonthlyExamScopeRecord,
  monthlyExamScopeKey,
} from "@shared/monthly-exam-scope";

const subjectId = "ARB_G2_BAC";
const examDate = "2026-11-29";

function findBranchWithChoices(minimum: number) {
  const branch = getSIECheckpointProgressBranches(subjectId).find(item => item.choices.length >= minimum);
  if (!branch) throw new Error("Arabic curriculum branch with enough choices is missing.");
  return branch;
}

describe("monthly exam scope is independent from course progress", () => {
  it("does not infer exam content from a teacher or center teaching frontier", () => {
    const branch = findBranchWithChoices(2);
    const records = {
      [subjectId]: {
        branches: {
          [branch.branchId]: {
            teacherTeachingFrontierId: branch.choices[1].nodeId,
            schoolClassFrontierId: branch.choices[1].nodeId,
          },
        },
      },
    };
    expect(buildMonthlyExamCoveredScope([subjectId], records, examDate)).toEqual([]);
  });

  it("uses only explicitly included and excluded curriculum nodes for the exact exam date", () => {
    const branch = findBranchWithChoices(2);
    const included = branch.choices[0];
    const excluded = branch.choices[1];
    const key = monthlyExamScopeKey(subjectId, examDate);
    const records = {
      [key]: {
        subjectId,
        examDate,
        includedNodeIds: [included.nodeId],
        excludedNodeIds: [excluded.nodeId],
        source: "student_reported",
        savedAt: "2026-11-28T08:00:00.000Z",
      },
    };

    const result = buildMonthlyExamCoveredScope([subjectId], records, examDate);
    const scopedBranch = result.find(item => item.branchId === branch.branchId);
    expect(scopedBranch?.source).toBe("student_reported");
    expect(scopedBranch?.lessonIds).toEqual([included.nodeId]);
    expect(scopedBranch?.lessonTitles).toEqual([included.title]);
    expect(scopedBranch?.excludedLessonIds).toEqual([excluded.nodeId]);
    expect(scopedBranch?.excludedLessonTitles).toEqual([excluded.title]);
  });

  it("does not leak a saved scope into another monthly exam date", () => {
    const branch = findBranchWithChoices(1);
    const key = monthlyExamScopeKey(subjectId, examDate);
    const records = {
      [key]: {
        subjectId,
        examDate,
        includedNodeIds: [branch.choices[0].nodeId],
        excludedNodeIds: [],
        source: "student_reported",
        savedAt: "2026-11-28T08:00:00.000Z",
      },
    };
    expect(buildMonthlyExamCoveredScope([subjectId], records, "2026-12-29")).toEqual([]);
    expect(getMonthlyExamScopeRecord(records, subjectId, "2026-12-29")).toBeNull();
  });

  it("keeps school confirmation distinct from a student's own report", () => {
    const branch = findBranchWithChoices(1);
    const records = {
      [monthlyExamScopeKey(subjectId, examDate)]: {
        subjectId,
        examDate,
        includedNodeIds: [branch.choices[0].nodeId],
        excludedNodeIds: [],
        source: "school_confirmed",
        savedAt: "2026-11-28T08:00:00.000Z",
      },
    };
    const scope = getMonthlyExamScopeRecord(records, subjectId, examDate);
    expect(scope?.source).toBe("school_confirmed");
  });
});
