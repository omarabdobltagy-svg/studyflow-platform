export type CompletedTaskCandidate = {
  id: number;
  title: string;
};

export type PlanStepTaskReference = {
  title: string;
  existingTask?: {
    id: number;
    status: "todo" | "done";
  };
};

export type CompletedPlanStepMatch = {
  pendingIndexes: number[];
  preservedCompletedTaskIds: number[];
  ambiguousTitleCount: number;
};

function normalizeTaskTitle(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ar").replace(/\\s+/g, " ").trim();
}

/**
 * A stable task ID is authoritative. Title-only fallback is allowed only when
 * the title is unique in both the plan and the completed task set.
 */
export function matchCompletedPlanSteps(
  steps: readonly PlanStepTaskReference[],
  completedTasks: readonly CompletedTaskCandidate[],
): CompletedPlanStepMatch {
  const completedById = new Map(completedTasks.map(task => [task.id, task]));
  const completedByTitle = new Map<string, CompletedTaskCandidate[]>();
  for (const task of completedTasks) {
    const normalized = normalizeTaskTitle(task.title);
    if (!normalized) continue;
    const bucket = completedByTitle.get(normalized) ?? [];
    bucket.push(task);
    completedByTitle.set(normalized, bucket);
  }

  const stepTitleCounts = new Map<string, number>();
  for (const step of steps) {
    const normalized = normalizeTaskTitle(step.title);
    if (normalized) stepTitleCounts.set(normalized, (stepTitleCounts.get(normalized) ?? 0) + 1);
  }

  const pendingIndexes: number[] = [];
  const preservedCompletedTaskIds = new Set<number>();
  let ambiguousTitleCount = 0;

  steps.forEach((step, index) => {
    const reference = step.existingTask;
    if (reference?.status === "done") {
      preservedCompletedTaskIds.add(reference.id);
      return;
    }

    if (reference?.id) {
      const exactTask = completedById.get(reference.id);
      if (exactTask) {
        preservedCompletedTaskIds.add(exactTask.id);
        return;
      }
    }

    const normalized = normalizeTaskTitle(step.title);
    const titleMatches = normalized ? completedByTitle.get(normalized) ?? [] : [];
    const stepCount = normalized ? stepTitleCounts.get(normalized) ?? 0 : 0;
    if (titleMatches.length === 1 && stepCount === 1) {
      preservedCompletedTaskIds.add(titleMatches[0].id);
      return;
    }

    if (titleMatches.length > 0 && (titleMatches.length > 1 || stepCount > 1)) {
      ambiguousTitleCount += 1;
    }
    pendingIndexes.push(index);
  });

  return {
    pendingIndexes,
    preservedCompletedTaskIds: [...preservedCompletedTaskIds],
    ambiguousTitleCount,
  };
}
