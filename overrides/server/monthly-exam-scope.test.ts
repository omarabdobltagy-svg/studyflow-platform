import { describe, expect, it } from "vitest";
import { getSIECheckpointProgressBranches } from "@shared/sie-catalog";
import { buildMonthlyExamCoveredScope } from "@shared/monthly-exam-scope";

describe("monthly exam covered-content scope", () => {
  it("uses only lessons up to the explicitly saved teacher frontier", () => {
    const branch = getSIECheckpointProgressBranches("ARB_G2_BAC").find(item => item.choices.length >= 2);
    expect(branch).toBeDefined();
    if (!branch) return;
    const frontier = branch.choices[1];
    const result = buildMonthlyExamCoveredScope(
      ["ARB_G2_BAC"],
      { ARB_G2_BAC: { branches: { [branch.branchId]: { teacherTeachingFrontierId: frontier.nodeId } } } },
      { ARB_G2_BAC: "online" },
    );
    const covered = result.find(item => item.branchId === branch.branchId);
    expect(covered?.referenceSource).toBe("teacher");
    expect(covered?.lessonIds).toEqual(branch.choices.slice(0, 2).map(item => item.nodeId));
  });

  it("uses the recorded center/class frontier when the teacher frontier is unavailable", () => {
    const branch = getSIECheckpointProgressBranches("ARB_G2_BAC").find(item => item.choices.length >= 2);
    expect(branch).toBeDefined();
    if (!branch) return;
    const result = buildMonthlyExamCoveredScope(
      ["ARB_G2_BAC"],
      { ARB_G2_BAC: { branches: { [branch.branchId]: { schoolClassFrontierId: branch.choices[1].nodeId } } } },
      { ARB_G2_BAC: "center" },
    );
    expect(result.find(item => item.branchId === branch.branchId)?.referenceSource).toBe("school");
  });

  it("does not invent coverage when no teacher or class frontier was saved", () => {
    expect(buildMonthlyExamCoveredScope(["ARB_G2_BAC"], { ARB_G2_BAC: { branches: {} } })).toEqual([]);
  });
});
