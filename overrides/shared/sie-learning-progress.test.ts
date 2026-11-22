import { describe, expect, it } from "vitest";
import { calculateLearningGap } from "./sie-learning-progress";

const curriculum = [
  { nodeId: "L1", title: "Lesson 1" },
  { nodeId: "L2", title: "Lesson 2" },
  { nodeId: "L3", title: "Lesson 3" },
  { nodeId: "L4", title: "Lesson 4" },
  { nodeId: "L5", title: "Lesson 5" },
  { nodeId: "L6", title: "Lesson 6" },
];

describe("calculateLearningGap", () => {
  it("uses the teacher frontier first and counts lessons after the student's frontier", () => {
    const result = calculateLearningGap(curriculum, {
      teacherTeachingFrontierId: "L6",
      schoolClassFrontierId: "L5",
      studentFrontierId: "L3",
    });
    expect(result.referenceSource).toBe("teacher");
    expect(result.referenceFrontierTitle).toBe("Lesson 6");
    expect(result.gapCount).toBe(3);
    expect(result.aheadCount).toBe(0);
  });

  it("falls back to the school frontier when the teacher frontier is unknown", () => {
    const result = calculateLearningGap(curriculum, {
      teacherTeachingFrontierId: "__UNKNOWN__",
      schoolClassFrontierId: "L5",
      studentFrontierId: "L2",
    });
    expect(result.referenceSource).toBe("school");
    expect(result.gapCount).toBe(3);
  });

  it("does not invent a gap when neither teaching reference is known", () => {
    const result = calculateLearningGap(curriculum, {
      teacherTeachingFrontierId: "__UNKNOWN__",
      schoolClassFrontierId: "__UNKNOWN__",
      studentFrontierId: "L2",
    });
    expect(result.referenceSource).toBe("unavailable");
    expect(result.gapCount).toBeNull();
    expect(result.status).toBe("reference_missing");
  });

  it("recognizes a student who is ahead of the selected reference", () => {
    const result = calculateLearningGap(curriculum, {
      schoolClassFrontierId: "L2",
      studentFrontierId: "L5",
    });
    expect(result.gapCount).toBe(0);
    expect(result.aheadCount).toBe(3);
  });

  it("counts every curriculum checkpoint when the student has not started", () => {
    const result = calculateLearningGap(curriculum, {
      schoolClassFrontierId: "L4",
      studentFrontierId: "__NOT_STARTED__",
    });
    expect(result.studentPosition).toBe(0);
    expect(result.gapCount).toBe(4);
  });

  it("does not calculate a gap if the student position is missing", () => {
    const result = calculateLearningGap(curriculum, {
      teacherTeachingFrontierId: "L4",
      studentFrontierId: "__UNKNOWN__",
    });
    expect(result.gapCount).toBeNull();
    expect(result.status).toBe("student_position_missing");
  });
});
