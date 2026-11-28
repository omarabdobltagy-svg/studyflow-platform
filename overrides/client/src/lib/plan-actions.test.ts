import { describe, expect, it } from "vitest";
import { getNextOpenPlanStep } from "./plan-actions";

describe("shared next study action", () => {
  it("skips tasks marked complete in either planner or task state", () => {
    const steps = [
      { title: "منتهية", plannerTaskStatus: "done" },
      { title: "مهمة منتهية", existingTask: { status: "done" } },
      { title: "الخطوة القادمة", curriculumNodeIds: ["ARB_C11_FIGURE"] },
    ];

    expect(getNextOpenPlanStep(steps)?.title).toBe("الخطوة القادمة");
  });

  it("returns the same first unfinished action regardless of its type", () => {
    const steps = [
      { title: "واجب مسجل", plannerTaskStatus: "todo", existingTask: { status: "todo" } },
      { title: "درس البلاغة", plannerTaskStatus: "todo", curriculumNodeIds: ["ARB_C11_FIGURE"] },
    ];

    expect(getNextOpenPlanStep(steps)?.title).toBe("واجب مسجل");
  });

  it("returns null when every step is complete or there are no steps", () => {
    expect(getNextOpenPlanStep([{ plannerTaskStatus: "done" }])).toBeNull();
    expect(getNextOpenPlanStep([])).toBeNull();
    expect(getNextOpenPlanStep(undefined)).toBeNull();
  });
});
