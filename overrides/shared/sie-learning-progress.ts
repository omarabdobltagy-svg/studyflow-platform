export type LearningReferenceSource = "teacher" | "school" | "unavailable";

export type LearningGapInput = {
  studentFrontierId?: string | null;
  teacherTeachingFrontierId?: string | null;
  schoolClassFrontierId?: string | null;
};

export type LearningGapResult = {
  referenceSource: LearningReferenceSource;
  referenceFrontierId: string | null;
  referenceFrontierTitle: string | null;
  studentFrontierId: string | null;
  studentFrontierTitle: string | null;
  referencePosition: number | null;
  studentPosition: number | null;
  gapCount: number | null;
  aheadCount: number | null;
  status: "calculated" | "student_position_missing" | "reference_missing";
};

const NOT_STARTED = "__NOT_STARTED__";
const UNKNOWN_VALUES = new Set(["", "__UNKNOWN__", "__DEFERRED__", "__NONE__"]);

/**
 * Calculates the curriculum gap using ordered, ministry-aligned curriculum checkpoints.
 * Teacher progress is the primary reference; the school-class frontier is the fallback.
 * Student progress is kept separate from both references.
 *
 * Positions are counts of completed curriculum checkpoints (0 means not started).
 * A missing reference or missing student position produces null, never a fabricated zero.
 */
export function calculateLearningGap(
  choices: Array<{ nodeId: string; title: string }>,
  input: LearningGapInput
): LearningGapResult {
  const positionOf = (frontierId?: string | null): number | null => {
    if (choices.length === 0 || !frontierId || UNKNOWN_VALUES.has(frontierId)) return null;
    if (frontierId === NOT_STARTED) return 0;
    const index = choices.findIndex(choice => choice.nodeId === frontierId);
    return index < 0 ? null : index + 1;
  };

  const titleOf = (frontierId?: string | null): string | null => {
    if (!frontierId || UNKNOWN_VALUES.has(frontierId) || frontierId === NOT_STARTED) return null;
    return choices.find(choice => choice.nodeId === frontierId)?.title ?? null;
  };

  const teacherPosition = positionOf(input.teacherTeachingFrontierId);
  const schoolPosition = positionOf(input.schoolClassFrontierId);
  const hasTeacherReference = teacherPosition !== null;
  const hasSchoolReference = schoolPosition !== null;
  const referenceSource: LearningReferenceSource = hasTeacherReference
    ? "teacher"
    : hasSchoolReference
      ? "school"
      : "unavailable";
  const referenceFrontierId = hasTeacherReference
    ? input.teacherTeachingFrontierId === NOT_STARTED ? NOT_STARTED : input.teacherTeachingFrontierId ?? null
    : hasSchoolReference
      ? input.schoolClassFrontierId === NOT_STARTED ? NOT_STARTED : input.schoolClassFrontierId ?? null
      : null;
  const referencePosition = hasTeacherReference ? teacherPosition : hasSchoolReference ? schoolPosition : null;
  const studentPosition = positionOf(input.studentFrontierId);
  const studentFrontierId = input.studentFrontierId && !UNKNOWN_VALUES.has(input.studentFrontierId)
    ? input.studentFrontierId
    : null;
  const gapCount = referencePosition !== null && studentPosition !== null
    ? Math.max(0, referencePosition - studentPosition)
    : null;
  const aheadCount = referencePosition !== null && studentPosition !== null
    ? Math.max(0, studentPosition - referencePosition)
    : null;

  return {
    referenceSource,
    referenceFrontierId,
    referenceFrontierTitle: titleOf(referenceFrontierId),
    studentFrontierId,
    studentFrontierTitle: titleOf(studentFrontierId),
    referencePosition,
    studentPosition,
    gapCount,
    aheadCount,
    status: referencePosition === null
      ? "reference_missing"
      : studentPosition === null
        ? "student_position_missing"
        : "calculated",
  };
}


export type LearningBranchDefinition = {
  branchId: string;
  choices: Array<{ nodeId: string; title: string }>;
};

export type LearningBranchInputs = Record<string, LearningGapInput>;

/**
 * Computes every curriculum branch independently. A frontier from one branch
 * can never be compared with checkpoints from another branch.
 */
export function calculateLearningGapsByBranch(
  branches: LearningBranchDefinition[],
  inputs: LearningBranchInputs = {},
): Record<string, LearningGapResult> {
  return Object.fromEntries(branches.map(branch => [
    branch.branchId,
    calculateLearningGap(branch.choices, inputs[branch.branchId] ?? {}),
  ]));
}
