export type GoalOwnershipCandidate = {
  id: number;
  parentGoalId?: number | null;
  title?: string | null;
  category?: string | null;
};

export type TaskOwnershipCandidate = {
  title?: string | null;
  notes?: string | null;
  category?: string | null;
  goalId?: number | null;
};

/** Follow goal ancestry so a task is only treated as AI-owned when its root is. */
export function getRootGoalForTask(
  goalId: number | null | undefined,
  goalsById: ReadonlyMap<number, GoalOwnershipCandidate>,
): GoalOwnershipCandidate | undefined {
  let current = typeof goalId === "number" ? goalsById.get(goalId) : undefined;
  const seen = new Set<number>();
  while (current?.parentGoalId && !seen.has(Number(current.id))) {
    seen.add(Number(current.id));
    current = goalsById.get(Number(current.parentGoalId));
  }
  return current;
}

export function isStudyFlowManagedGoal(goal: GoalOwnershipCandidate | undefined): boolean {
  if (!goal) return false;
  const category = String(goal.category ?? "").trim();
  const title = String(goal.title ?? "").trim();
  return ["خطة مذاكرة", "خطة يومية", "خطة ذكية", "خطة تدريبية"].includes(category)
    || ["خطة المذاكرة", "خطة StudyFlow اليومية", "خطة StudyFlow الذكية الحالية"].includes(title);
}

/** Never auto-close teacher homework, assessments, submissions, or worksheets. */
export function taskLooksLikeTeacherObligation(task: TaskOwnershipCandidate): boolean {
  const text = [task.title, task.notes, task.category]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ar");
  return /واجب|تسليم|امتحان|اختبار|كويز|quiz|homework|assignment|exam|\btest\b|تكليف|ورقة عمل|حل الأسئلة/.test(text);
}
