import { describe, expect, it } from "vitest";
import { buildPlanStrategySnapshot } from "./plan-strategy";

describe("plan strategy snapshots", () => {
  it("marks the first generated plan as the baseline without inventing a prior comparison", () => {
    const plan = { title: "خطة المذاكرة", summary: "البداية", steps: [{ title: "عربي", curriculumNodeIds: ["ARB_1"], dayIndex: 0 }] };
    const result = buildPlanStrategySnapshot(null, plan, { exams: [{ subjectName: "اللغة العربية", date: "2026-11-29", daysUntil: 1, source: "school_calendar" }] }, new Date("2026-11-28T10:00:00.000Z"));
    expect(result.revision.status).toBe("baseline");
    expect(result.revision.hasPreviousVersion).toBe(false);
    expect(result.baseline.steps).toHaveLength(1);
    expect(result.revision.triggers[0]?.code).toBe("exam_imminent");
    expect(result.revision.diff.added).toHaveLength(0);
  });
  it("preserves the original baseline and records exam/pressure-driven changes", () => {
    const previous = { title: "خطة المذاكرة", summary: "الخطة الأصلية", steps: [
      { title: "درس 1", curriculumNodeIds: ["ARB_1"], dayIndex: 0, priority: "medium" },
      { title: "درس 2", curriculumNodeIds: ["ENG_1"], dayIndex: 1, priority: "medium" },
    ] };
    const baseline = buildPlanStrategySnapshot(null, previous, {}, new Date("2026-11-27T10:00:00.000Z"));
    const next = { ...previous, summary: "استعداد عاجل", steps: [
      { title: "درس 1", curriculumNodeIds: ["ARB_1"], dayIndex: 0, priority: "critical" },
      { title: "مراجعة", curriculumNodeIds: ["ARB_2"], dayIndex: 0, priority: "high" },
    ] };
    const result = buildPlanStrategySnapshot({ ...previous, strategy: baseline }, next, {
      exams: [{ subjectName: "اللغة العربية", date: "2026-11-29", daysUntil: 1, source: "school_calendar" }],
      energyLevel: "low", dailyMinutes: 45, openTasksCount: 12,
    }, new Date("2026-11-28T10:00:00.000Z"));
    expect(result.baseline.summary).toBe("الخطة الأصلية");
    expect(result.revision.status).toBe("adapted");
    expect(result.revision.diff.added).toHaveLength(1);
    expect(result.revision.diff.removed).toHaveLength(1);
    expect(result.revision.diff.reprioritized).toHaveLength(1);
    expect(result.revision.triggers.map(item => item.code)).toEqual(["exam_imminent", "low_energy", "limited_capacity", "heavy_backlog"]);
    expect(result.history).toHaveLength(1);
  });
  it("does not treat display-date changes as rescheduling when the planned day index is unchanged", () => {
    const previous = { title: "خطة", summary: "", steps: [{ title: "درس", curriculumNodeIds: ["ARB_1"], dayIndex: 1, day: "الأحد" }] };
    const next = { title: "خطة", summary: "", steps: [{ title: "درس", curriculumNodeIds: ["ARB_1"], dayIndex: 1, day: "الإثنين" }] };
    const result = buildPlanStrategySnapshot(previous, next, {}, new Date("2026-11-28T10:00:00.000Z"));
    expect(result.revision.diff.rescheduled).toHaveLength(0);
    expect(result.revision.diff.preservedCount).toBe(1);
  });
}
