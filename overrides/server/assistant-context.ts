export type StandaloneAssistantContextInput = {
  subjects: string[];
  curriculum: string;
  textbookEvidence: string;
  attachmentContext?: string;
};

/**
 * Builds context for the curriculum-only assistant.
 * Planner decisions, tasks, calendars, teacher schedules and progress are
 * intentionally not accepted as inputs to this function.
 */
export function buildStandaloneAssistantContext(input: StandaloneAssistantContextInput): string {
  return [
    "نطاق المحادثة: مساعد معرفي مستقل لفهم محتوى المنهج، وليس محرك تخطيط.",
    "المواد المختارة: " + (input.subjects.filter(Boolean).join("، ") || "لم تُحدد مادة بعد."),
    "فهرس المنهج المتاح:\n" + (input.curriculum.trim() || "لا يتوفر فهرس لهذه المواد حاليًا."),
    "مقتطفات الكتاب المسترجعة:\n" + (input.textbookEvidence.trim() || "لم يُسترجع نص مطابق من مصادر الكتاب المفهرسة."),
    input.attachmentContext?.trim()
      ? "مرفق من الطالب للمناقشة فقط:\n" + input.attachmentContext.trim()
      : "",
  ].filter(Boolean).join("\n\n");
}
