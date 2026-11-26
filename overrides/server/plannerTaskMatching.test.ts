import { describe, expect, it } from "vitest";
import { matchCompletedPlanSteps } from "./plannerTaskMatching";

describe("completed plan-step matching", () => {
  it("uses an explicit task ID when titles have changed", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "الدرس بعد التعديل", existingTask: { id: 12, status: "todo" } }],
      [{ id: 12, title: "عنوان قديم" }],
    );
    expect(result.pendingIndexes).toEqual([]);
    expect(result.preservedCompletedTaskIds).toEqual([12]);
  });

  it("does not match a title duplicated across completed tasks", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "مراجعة النحو" }],
      [{ id: 1, title: "مراجعة النحو" }, { id: 2, title: "مراجعة النحو" }],
    );
    expect(result.pendingIndexes).toEqual([0]);
    expect(result.preservedCompletedTaskIds).toEqual([]);
    expect(result.ambiguousTitleCount).toBe(1);
  });

  it("does not match a title duplicated inside the generated plan", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "مراجعة النحو" }, { title: "مراجعة النحو" }],
      [{ id: 1, title: "مراجعة النحو" }],
    );
    expect(result.pendingIndexes).toEqual([0, 1]);
    expect(result.ambiguousTitleCount).toBe(2);
  });

  it("uses normalized title matching only when the title is unique on both sides", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "  مراجعة   النحو " }],
      [{ id: 7, title: "مراجعة النحو" }],
    );
    expect(result.pendingIndexes).toEqual([]);
    expect(result.preservedCompletedTaskIds).toEqual([7]);
    expect(result.ambiguousTitleCount).toBe(0);
  });

  it("does not treat an external completed task as proof that the curriculum step is complete", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "محاضرة البرمجة", existingTask: { id: 99, status: "done" } }],
      [],
    );
    expect(result.pendingIndexes).toEqual([0]);
    expect(result.preservedCompletedTaskIds).toEqual([]);
  });

  it("skips an explicitly linked completed task only when it belongs to this goal tree", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "محاضرة البرمجة", existingTask: { id: 99, status: "done" } }],
      [{ id: 99, title: "محاضرة البرمجة" }],
    );
    expect(result.pendingIndexes).toEqual([]);
    expect(result.preservedCompletedTaskIds).toEqual([99]);
  });

  it("keeps an explicitly linked unfinished task pending", () => {
    const result = matchCompletedPlanSteps(
      [{ title: "محاضرة التاريخ", existingTask: { id: 20, status: "todo" } }],
      [],
    );
    expect(result.pendingIndexes).toEqual([0]);
    expect(result.preservedCompletedTaskIds).toEqual([]);
  });
});
