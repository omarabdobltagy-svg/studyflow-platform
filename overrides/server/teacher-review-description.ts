import {
  getSIECheckpointProgressBranches,
  matchSIECheckpointTask,
} from "@shared/sie-catalog";

export type TeacherReviewDescriptionMatchInput = {
  subjectId: string;
  branchId: string;
  title?: string | null;
  description?: string | null;
};

/**
 * Use the publisher-supplied YouTube description as the first verification source.
 * The video is considered description-matched only when the description is substantive
 * and the curriculum matcher resolves a concrete checkpoint inside the requested branch.
 * This never treats a generic "revision" title as sufficient evidence.
 */
export function matchTeacherReviewDescription(input: TeacherReviewDescriptionMatchInput): string[] {
  const description = String(input.description ?? "").normalize("NFKC").trim();
  if (description.length < 60) return [];

  const branch = getSIECheckpointProgressBranches(input.subjectId)
    .find(item => item.branchId === input.branchId);
  if (!branch?.choices?.length) return [];

  const match = matchSIECheckpointTask([input.subjectId], description);
  if (!match || !branch.choices.some(choice => choice.nodeId === match.nodeId)) return [];

  return [match.title];
}
