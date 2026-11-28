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

function normalizeDescriptionText(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefer the publisher-supplied YouTube description when it explicitly names a
 * curriculum checkpoint in the exact requested branch. A generic "revision"
 * title is never evidence. Fuzzy catalog matching is only used after exact
 * normalized lesson-title matching.
 */
export function matchTeacherReviewDescription(input: TeacherReviewDescriptionMatchInput): string[] {
  const rawDescription = String(input.description ?? "").trim();
  if (rawDescription.length < 60) return [];

  const branch = getSIECheckpointProgressBranches(input.subjectId)
    .find(item => item.branchId === input.branchId);
  if (!branch?.choices?.length) return [];

  const normalizedDescription = " " + normalizeDescriptionText(rawDescription) + " ";
  const directMatches = branch.choices.filter(choice => {
    const normalizedTitle = normalizeDescriptionText(choice.title);
    return normalizedTitle.length >= 3 && normalizedDescription.includes(" " + normalizedTitle + " ");
  });
  if (directMatches.length) {
    return [...new Set(directMatches.slice(0, 5).map(choice => choice.title))];
  }

  const match = matchSIECheckpointTask([input.subjectId], rawDescription);
  if (!match || !branch.choices.some(choice => choice.nodeId === match.nodeId)) return [];
  return [match.title];
}
