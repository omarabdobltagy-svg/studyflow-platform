import { describe, expect, it } from "vitest";
import { ensureRequiredLessonCoverage, getMissingLessonCheckpoints, type RequiredLessonCheckpoint } from "./plan-coverage";

describe("required curriculum coverage", () => {
  const checkpoints = [
    { nodeId: "L1", title: "المقدمة" },
    { nodeId: "L2", title: "بناء الدولة" },
    { nodeId: "L3", title: "التحولات السياسية" },
    { nodeId: "L4", title: "التحولات الاقتصادية" },
    { nodeId: "L5", title: "المراجعة" },
  ];

  it("extracts every checkpoint after the student's position through the reference position", () => {
    expect(getMissingLessonCheckpoints(checkpoints, 1, 4).map(item => item.nodeId)).toEqual(["L2", "L3", "L4"]);
  });

  it("does not invent lessons when either progress position is unknown or invalid", () => {
    expect(getMissingLessonCheckpoints(checkpoints, null, 4)).toEqual([]);
    expect(getMissingLessonCheckpoints(checkpoints, 4, 1)).toEqual([]);
  });

  it("adds an explicit step for every omitted checkpoint and a three-part study sequence", () => {
    const required: RequiredLessonCheckpoint[] = [
      { subjectId: "HIS", subjectName: "التاريخ", branchId: "unit-1", branchTitle: "الوحدة الأولى", lessonId: "L2", lessonTitle: "بناء الدولة", estimatedMinutes: 50 },
      { subjectId: "HIS", subjectName: "التاريخ", branchId: "unit-1", branchTitle: "الوحدة الأولى", lessonId: "L3", lessonTitle: "التحولات السياسية", estimatedMinutes: 60 },
    ];
    const result = ensureRequiredLessonCoverage(
      [{ day: "اليوم 1", title: "التاريخ — بناء الدولة", detail: "مراجعة الدرس", minutes: 50, category: "التاريخ" }],
      required,
    );
    expect(result.coveredLessons).toBe(2);
    expect(result.appendedLessons).toBe(1);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].subtasks).toHaveLength(3);
    expect(result.steps[1].title).toContain("التحولات السياسية");
  });
});
