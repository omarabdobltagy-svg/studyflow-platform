export type RequiredLessonCheckpoint = {
  subjectId: string;
  subjectName: string;
  branchId: string;
  branchTitle: string;
  lessonId: string;
  lessonTitle: string;
  estimatedMinutes: number;
};

export type PlanStepWithSubtasks = {
  day: string;
  title: string;
  detail: string;
  minutes: number;
  category: string;
  subtasks?: string[];
};

export function getMissingLessonCheckpoints<T extends { nodeId: string; title: string }>(
  choices: T[],
  studentPosition: number | null,
  referencePosition: number | null,
): T[] {
  if (
    !Number.isInteger(studentPosition) ||
    !Number.isInteger(referencePosition) ||
    studentPosition === null ||
    referencePosition === null ||
    studentPosition < 0 ||
    referencePosition < 0 ||
    referencePosition <= studentPosition
  ) return [];
  return choices.slice(studentPosition, referencePosition);
}

function normalizeComparableText(value: string): string {
  return value.normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

function lessonSubtasks(lesson: RequiredLessonCheckpoint): string[] {
  return [
    `شاهد محاضرة «${lesson.lessonTitle}» أو استكمل الجزء الذي لم تشاهده، وسجّل الأفكار الأساسية.`,
    `اقرأ «${lesson.lessonTitle}» من الكتاب أو المصدر المعتمد، وافهمه ثم استرجع أهم النقاط دون النظر.`,
    `حل تدريبات على «${lesson.lessonTitle}»، وصحّح الأخطاء وسجّل النقاط التي تحتاج إلى مراجعة.`,
  ];
}

export function ensureRequiredLessonCoverage<T extends PlanStepWithSubtasks>(
  originalSteps: T[],
  requiredLessons: RequiredLessonCheckpoint[],
  dailyMinutes = 600,
): { steps: Array<T | PlanStepWithSubtasks>; coveredLessons: number; appendedLessons: number } {
  const steps: Array<T | PlanStepWithSubtasks> = [...originalSteps];
  let coveredLessons = 0;
  let appendedLessons = 0;

  for (const lesson of requiredLessons) {
    const lessonName = normalizeComparableText(lesson.lessonTitle);
    if (!lessonName) continue;
    const matchingIndex = steps.findIndex(step =>
      normalizeComparableText(`${step.title} ${step.detail}`).includes(lessonName)
    );
    if (matchingIndex >= 0) {
      const current = steps[matchingIndex];
      if (!current.subtasks?.length) steps[matchingIndex] = { ...current, subtasks: lessonSubtasks(lesson) };
      coveredLessons += 1;
      continue;
    }

    const estimate = Number.isFinite(lesson.estimatedMinutes) ? Math.round(lesson.estimatedMinutes) : 60;
    const minutes = Math.min(Math.max(20, dailyMinutes), Math.min(180, Math.max(20, estimate)));
    steps.push({
      day: "توزيع تلقائي",
      title: `${lesson.subjectName} — ${lesson.lessonTitle}`,
      detail: `عنصر مطلوب لاستكمال فجوة «${lesson.branchTitle}». يتضمن المسار المحاضرة والفهم النشط والتدريب؛ لم يتم إسقاط هذا الدرس من الخطة.`,
      minutes,
      category: `${lesson.subjectName} · ${lesson.branchTitle}`,
      subtasks: lessonSubtasks(lesson),
    });
    coveredLessons += 1;
    appendedLessons += 1;
  }

  return { steps, coveredLessons, appendedLessons };
}
