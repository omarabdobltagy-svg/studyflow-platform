import { describe, expect, it } from "vitest";
import {
  classifyPlannerEventImpact,
  combinePlannerEventImpacts,
  evaluatePlanQuality,
  getAvailableStudyDays,
  schedulePlanSteps,
} from "./plannerEngine";

const settings = { dailyMinutes: 120, daysPerWeek: 5 as const, horizonDays: 7 as const };

describe("planner deterministic scheduler", () => {
  it("keeps each study day within capacity and respects weekly rest days", () => {
    const result = schedulePlanSteps([
      { title: "محاضرة العربي", detail: "مشاهدة الشرح", minutes: 90, category: "عربي" },
      { title: "حل واجب العربي", detail: "الواجب المسجل", minutes: 60, category: "عربي" },
      { title: "محاضرة التاريخ", detail: "مشاهدة الشرح", minutes: 60, category: "تاريخ" },
    ], settings);
    const totals = new Map<number, number>();
    for (const step of result.steps.filter(item => item.scheduleState === "scheduled")) {
      totals.set(step.dayIndex!, (totals.get(step.dayIndex!) ?? 0) + step.minutes);
    }
    expect([...totals.values()].every(total => total <= settings.dailyMinutes)).toBe(true);
    expect(result.steps.find(item => item.title === "محاضرة التاريخ")?.dateOffsetDays).toBe(1);
    expect(result.stats.availableStudyDays).toBe(5);
  });

  it("splits sessions that exceed the maximum session length", () => {
    const result = schedulePlanSteps([
      { title: "محاضرة طويلة", detail: "شرح كامل", minutes: 210, category: "عربي", curriculumNodeIds: ["ARB_1"] },
    ], settings);
    const parts = result.steps.filter(item => item.scheduleState === "scheduled");
    expect(parts.map(item => item.minutes)).toEqual([90, 30, 90]);
    expect(parts.map(item => item.dayIndex)).toEqual([1, 1, 2]);
    expect(parts.every(item => item.minutes <= 90)).toBe(true);
    expect(parts[0].curriculumNodeIds).toEqual(["ARB_1"]);
    expect(parts[1].curriculumNodeIds).toEqual([]);
  });

  it("keeps work beyond the selected horizon as deferred", () => {
    const result = schedulePlanSteps([
      { title: "موضوع كبير", detail: "متابعة الدرس", minutes: 480, category: "عربي" },
      { title: "التزام إضافي", detail: "مهمة مسجلة", minutes: 480, category: "تاريخ" },
    ], { dailyMinutes: 60, daysPerWeek: 5, horizonDays: 7 });
    expect(result.stats.availableStudyDays).toBe(5);
    expect(result.stats.deferredMinutes).toBeGreaterThan(0);
    expect(result.steps.some(step => step.scheduleState === "deferred" && step.dayIndex === null)).toBe(true);
  });

  it("does not attach a linked task to every split session", () => {
    const result = schedulePlanSteps([
      { title: "محاضرة", detail: "شرح", minutes: 180, category: "عربي", existingTask: { id: 42, status: "todo" } },
    ], settings);
    const attached = result.steps.filter(item => item.existingTask);
    expect(attached).toHaveLength(1);
    expect((attached[0].existingTask as any).id).toBe(42);
  });

  it("calculates the two-week horizon using the configured weekly study days", () => {
    expect(getAvailableStudyDays({ horizonDays: 14, daysPerWeek: 6 })).toBe(12);
    expect(getAvailableStudyDays({ horizonDays: 14, daysPerWeek: 7 })).toBe(14);
  });

  it("returns a ready quality report for feasible, non-duplicated schedules", () => {
    const result = schedulePlanSteps([
      { title: "محاضرة العربي", detail: "شرح", minutes: 60, category: "عربي" },
      { title: "محاضرة التاريخ", detail: "شرح", minutes: 60, category: "تاريخ" },
    ], settings);
    const quality = evaluatePlanQuality(result.steps, settings, result.stats);
    expect(quality.status).toBe("ready");
    expect(quality.score).toBe(100);
    expect(quality.blockers).toHaveLength(0);
  });

  it("blocks a schedule when a day exceeds the daily minute ceiling", () => {
    const overloaded = [
      { title: "جلسة العربي", category: "عربي", minutes: 80, scheduleState: "scheduled" as const, dayIndex: 1, sourceStepIndex: 0 },
      { title: "جلسة التاريخ", category: "تاريخ", minutes: 80, scheduleState: "scheduled" as const, dayIndex: 1, sourceStepIndex: 1 },
    ];
    const quality = evaluatePlanQuality(overloaded, settings);
    expect(quality.status).toBe("blocked");
    expect(quality.blockers).toContain("اليوم 1 يتجاوز الوقت اليومي (160/120 دقيقة).");
  });

  it("classifies small completions separately from structural changes", () => {
    expect(classifyPlannerEventImpact("task.completed", "task")).toBe("local");
    expect(classifyPlannerEventImpact("task.reopened", "task")).toBe("local");
    expect(classifyPlannerEventImpact("task.deleted", "task")).toBe("structural");
    expect(classifyPlannerEventImpact("teacher.progress.updated", "curriculum")).toBe("structural");
    expect(combinePlannerEventImpacts(["local", "none"])).toBe("local");
    expect(combinePlannerEventImpacts(["local", "structural"])).toBe("structural");
  });
});
