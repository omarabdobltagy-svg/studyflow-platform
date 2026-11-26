export const STUDENT_LESSON_STATES = ["not_watched", "watched_only", "studied", "needs_review"] as const;
export type StudentLessonState = typeof STUDENT_LESSON_STATES[number];

export type SavedStudentLessonState = {
  state?: StudentLessonState;
  updatedAt?: string;
  source?: "student_self_report" | "teacher_class_followup" | "legacy_migration";
};

export function isStudentLessonState(value: unknown): value is StudentLessonState {
  return typeof value === "string" && (STUDENT_LESSON_STATES as readonly string[]).includes(value);
}

/**
 * The student frontier means "the last lesson reached in the teacher's explanation".
 * Before the explicit state model was introduced, the legacy inclusive frontier
 * represented completed learning. New-model frontiers default to watched-only until
 * the student reports studying the lesson.
 */
export function getEffectiveStudentLessonState(input: {
  choices: Array<{ nodeId: string }>;
  nodeId: string;
  studentFrontierId?: string | null;
  lessonStateModelVersion?: number;
  saved?: SavedStudentLessonState | null;
}): StudentLessonState {
  if (isStudentLessonState(input.saved?.state)) return input.saved.state;
  const index = input.choices.findIndex(choice => choice.nodeId === input.nodeId);
  if (index < 0) return "not_watched";
  const frontier = input.studentFrontierId;
  const frontierIndex = frontier === "__NOT_STARTED__"
    ? -1
    : typeof frontier === "string"
      ? input.choices.findIndex(choice => choice.nodeId === frontier)
      : -1;
  if (frontierIndex < index) return "not_watched";
  return input.lessonStateModelVersion && input.lessonStateModelVersion >= 1
    ? "watched_only"
    : "studied";
}

export function isStudentLessonStudyComplete(state: StudentLessonState): boolean {
  return state === "studied";
}

export function getStudentLessonStateLabel(state: StudentLessonState): string {
  switch (state) {
    case "not_watched": return "لم يشاهد الشرح";
    case "watched_only": return "شاهد الشرح فقط";
    case "studied": return "ذاكر وفهم";
    case "needs_review": return "ذاكر ويحتاج مراجعة";
  }
}

export function summarizeStudentLessonStates(states: StudentLessonState[]) {
  return {
    total: states.length,
    notWatched: states.filter(state => state === "not_watched").length,
    watchedOnly: states.filter(state => state === "watched_only").length,
    studied: states.filter(state => state === "studied").length,
    needsReview: states.filter(state => state === "needs_review").length,
  };
}
