export type OpenPlanStepLike = {
  plannerTaskStatus?: string;
  existingTask?: { status?: string } | null;
};

/**
 * The first unfinished action is the single source of truth for both
 * the dashboard's "study priority" and the planner's "next step".
 */
export function getNextOpenPlanStep<T extends OpenPlanStepLike>(
  steps: readonly T[] | null | undefined,
): T | null {
  return steps?.find(step =>
    step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done"
  ) ?? null;
}
