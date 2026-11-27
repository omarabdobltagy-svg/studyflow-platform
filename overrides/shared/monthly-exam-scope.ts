import { calculateLearningGap } from "./sie-learning-progress";
import { getSIECheckpointProgressBranches, getSIESubject } from "./sie-catalog";

export type MonthlyExamCoveredBranch = {
  subjectId: string;
  subjectName: string;
  branchId: string;
  branchTitle: string;
  referenceSource: "teacher" | "school";
  lessonIds: string[];
  lessonTitles: string[];
};

/**
 * Builds an inspectable candidate exam scope from the teacher/center frontier
 * explicitly saved by the student. It never treats an absent frontier as zero.
 * This is an operational estimate, not an official school exam-content notice.
 */
export function buildMonthlyExamCoveredScope(
  subjectIds: string[],
  learningCourseProgress: Record<string, any>,
  courseModes: Record<string, string> = {},
): MonthlyExamCoveredBranch[] {
  const result: MonthlyExamCoveredBranch[] = [];
  for (const subjectId of subjectIds) {
    const subjectProgress = learningCourseProgress[subjectId] ?? {};
    const branchRecords = (subjectProgress.branches ?? {}) as Record<string, Record<string, any>>;
    const subjectName = getSIESubject(subjectId)?.nameAr ?? subjectId;
    const courseMode = courseModes[subjectId] ?? subjectProgress.courseMode ?? "online";
    for (const branch of getSIECheckpointProgressBranches(subjectId)) {
      const saved = branchRecords[branch.branchId] ?? {};
      const gap = calculateLearningGap(branch.choices, {
        teacherTeachingFrontierId: typeof saved.teacherTeachingFrontierId === "string"
          ? saved.teacherTeachingFrontierId
          : "__UNKNOWN__",
        schoolClassFrontierId: courseMode === "center" && typeof saved.schoolClassFrontierId === "string"
          ? saved.schoolClassFrontierId
          : "__UNKNOWN__",
      });
      if (gap.referencePosition === null || gap.referencePosition <= 0) continue;
      const covered = branch.choices.slice(0, gap.referencePosition);
      if (!covered.length) continue;
      result.push({
        subjectId,
        subjectName,
        branchId: branch.branchId,
        branchTitle: branch.branchTitle,
        referenceSource: gap.referenceSource === "school" ? "school" : "teacher",
        lessonIds: covered.map(choice => choice.nodeId),
        lessonTitles: covered.map(choice => choice.title),
      });
    }
  }
  return result;
}
