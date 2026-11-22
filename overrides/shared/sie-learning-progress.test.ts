import { describe, expect, it } from "vitest";
import { calculateLearningGap, calculateLearningGapsByBranch } from "./sie-learning-progress";

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

  it("does not claim a zero gap when the subject curriculum is not loaded", () => {
    const result = calculateLearningGap([], {
      teacherTeachingFrontierId: "__NOT_STARTED__",
      schoolClassFrontierId: "__NOT_STARTED__",
      studentFrontierId: "__NOT_STARTED__",
    });
    expect(result.referenceSource).toBe("unavailable");
    expect(result.gapCount).toBeNull();
    expect(result.status).toBe("reference_missing");
  });
});


describe("calculateLearningGapsByBranch", () => {
  const branches = [
    { branchId: "unit-a", choices: [{ nodeId: "A1", title: "A1" }, { nodeId: "A2", title: "A2" }] },
    { branchId: "unit-b", choices: [{ nodeId: "B1", title: "B1" }, { nodeId: "B2", title: "B2" }] },
  ];

  it("calculates each branch against its own teacher or school frontier", () => {
    const result = calculateLearningGapsByBranch(branches, {
      "unit-a": {
        teacherTeachingFrontierId: "A2",
        schoolClassFrontierId: "A1",
        studentFrontierId: "A1",
      },
      "unit-b": {
        teacherTeachingFrontierId: "__UNKNOWN__",
        schoolClassFrontierId: "B2",
        studentFrontierId: "B1",
      },
    });
    expect(result["unit-a"].referenceSource).toBe("teacher");
    expect(result["unit-a"].gapCount).toBe(1);
    expect(result["unit-b"].referenceSource).toBe("school");
    expect(result["unit-b"].gapCount).toBe(1);
  });

  it("does not compare checkpoints across parallel branches", () => {
    const result = calculateLearningGapsByBranch(branches, {
      "unit-a": {
        teacherTeachingFrontierId: "B2",
        studentFrontierId: "A1",
      },
    });
    expect(result["unit-a"].referenceSource).toBe("unavailable");
    expect(result["unit-a"].gapCount).toBeNull();
    expect(result["unit-b"].gapCount).toBeNull();
  });

  it("preserves unknown branches rather than treating them as caught up", () => {
    const result = calculateLearningGapsByBranch(branches, {});
    expect(result["unit-a"].status).toBe("reference_missing");
    expect(result["unit-a"].gapCount).toBeNull();
    expect(result["unit-b"].status).toBe("reference_missing");
  });
});
