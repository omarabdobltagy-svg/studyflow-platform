export type TeacherReviewRankingCandidate = {
  isSelectedTeacher?: boolean;
  verificationState?: string;
  matchedSignals?: number;
  publishedAt?: string;
};

/**
 * Keep the student's explicitly selected teacher ahead of alternatives.
 * Verification strength then orders candidates within each teacher group.
 */
export function rankTeacherReviewCandidates<T extends TeacherReviewRankingCandidate>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    const teacherPriority = Number(Boolean(right.isSelectedTeacher)) - Number(Boolean(left.isSelectedTeacher));
    if (teacherPriority) return teacherPriority;

    const verificationPriority = Number(right.verificationState === "content_verified")
      - Number(left.verificationState === "content_verified");
    if (verificationPriority) return verificationPriority;

    const signalPriority = Number(right.matchedSignals ?? 0) - Number(left.matchedSignals ?? 0);
    if (signalPriority) return signalPriority;

    const leftPublishedAt = Date.parse(left.publishedAt ?? "");
    const rightPublishedAt = Date.parse(right.publishedAt ?? "");
    const leftTime = Number.isFinite(leftPublishedAt) ? leftPublishedAt : 0;
    const rightTime = Number.isFinite(rightPublishedAt) ? rightPublishedAt : 0;
    return rightTime - leftTime;
  });
}
