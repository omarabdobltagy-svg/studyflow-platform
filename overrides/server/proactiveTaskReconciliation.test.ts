import { describe, expect, it } from "vitest";
import {
  getRootGoalForTask,
  isStudyFlowManagedGoal,
  taskLooksLikeTeacherObligation,
} from "./proactiveTaskReconciliation";

describe("AI task reconciliation ownership guards", () => {
  it("recognizes tasks beneath an AI plan root, including nested stages", () => {
    const goals = new Map([
      [10, { id: 10, parentGoalId: null, title: "خطة المذاكرة", category: "خطة مذاكرة" }],
      [11, { id: 11, parentGoalId: 10, title: "مهمة: النحو", category: "مهمة دراسية" }],
      [12, { id: 12, parentGoalId: 11, title: "مرحلة فرعية", category: "مرحلة" }],
    ]);
    const root = getRootGoalForTask(12, goals);
    expect(root?.id).toBe(10);
    expect(isStudyFlowManagedGoal(root)).toBe(true);
  });

  it("does not treat manual or unlinked tasks as AI-owned", () => {
    const goals = new Map([
      [20, { id: 20, parentGoalId: null, title: "مذاكرة خاصة", category: "شخصي" }],
    ]);
    expect(isStudyFlowManagedGoal(getRootGoalForTask(20, goals))).toBe(false);
    expect(isStudyFlowManagedGoal(getRootGoalForTask(null, goals))).toBe(false);
  });

  it("protects teacher assignments and assessments from automatic completion", () => {
    expect(taskLooksLikeTeacherObligation({ title: "واجب الدرس", notes: "حل الأسئلة" })).toBe(true);
    expect(taskLooksLikeTeacherObligation({ title: "تحضير lesson", category: "homework" })).toBe(true);
    expect(taskLooksLikeTeacherObligation({ title: "مذاكرة درس البلاغة", notes: "اقرأ وافهم" })).toBe(false);
  });
});
