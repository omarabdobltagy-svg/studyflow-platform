import { z } from "zod";
import { getSIECheckpointChoices, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { invokeLLM } from "./_core/llm";
import { getStudentProfile, saveAiPlan } from "./db";

const planSchema = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(500),
  durationLabel: z.string().min(2).max(70),
  steps: z.array(z.object({
    day: z.string().min(1).max(30),
    title: z.string().min(2).max(120),
    detail: z.string().min(5).max(350),
    minutes: z.number().int().min(5).max(480),
    category: z.string().min(2).max(60),
  })).min(3).max(10),
  habits: z.array(z.object({ title: z.string().min(2).max(120), cue: z.string().min(2).max(160) })).min(1).max(4),
  reviewQuestion: z.string().min(5).max(250),
});
export type GeneratedPlan = z.infer<typeof planSchema>;

function contentAsText(content: any): string {
  return typeof content === "string" ? content : Array.isArray(content)
    ? content.filter(item => item.type === "text").map(item => item.text).join("\n")
    : "";
}

export function parseGeneratedPlan(content: string): GeneratedPlan {
  const cleaned = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("استجابة المخطط لم تحتوِ على خطة قابلة للقراءة.");
  let value: unknown;
  try { value = JSON.parse(cleaned.slice(first, last + 1)); }
  catch { throw new Error("تعذّر قراءة بيانات الخطة. حاول مرة أخرى."); }
  const parsed = planSchema.safeParse(value);
  if (!parsed.success) {
    console.error("[StudyFlow planner] Invalid plan structure:", parsed.error.issues);
    throw new Error("الخطة التي وصلت غير مكتملة. أعد المحاولة أو قلّل نطاقها.");
  }
  return parsed.data;
}

function buildLearningContext(profile: NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>) {
  const selection = (profile.selection || {}) as Record<string, any>;
  const choices = (selection.teacherChoices || profile.teacherSelections || {}) as Record<string, string>;
  const frontiers = (selection.teacherFrontiers || {}) as Record<string, string>;
  const teacherStates = (selection.teacherProgressState || {}) as Record<string, Record<string, any>>;
  const lessonProgress = (selection.subjectLessonProgress || {}) as Record<string, Record<string, any>>;
  const subjectContext = (profile.subjects || []).map(subjectId => {
    const subject = getSIESubject(subjectId);
    const teacherId = choices[subjectId];
    const teacher = teacherId ? getSIETeacher(teacherId) : undefined;
    const state = teacherStates[subjectId] || {};
    const catalog = getSIECheckpointChoices(subjectId);
    const studentFrontier = frontiers[subjectId] || state.studentAttendedFrontier || "";
    const frontierName = catalog.find(item => item.nodeId === studentFrontier);
    const records = lessonProgress[subjectId] || {};
    const completed = Object.values(records).filter((item: any) => Array.isArray(item.completedSteps) && item.completedSteps.length === 5).length;
    const underway = Object.values(records).filter((item: any) => Array.isArray(item.completedSteps) && item.completedSteps.length > 0 && item.completedSteps.length < 5).length;
    const hard = Object.entries(records).filter((entry: any) => entry[1].difficulty === "hard").map((entry: any) => {
      const lesson = catalog.find(item => item.nodeId === entry[0]);
      return lesson ? lesson.title : entry[0];
    });
    const backlog = profile.backlog[subjectId] || profile.backlog[(subject && subject.nameAr) || ""] || 0;
    const lessonList = catalog.map(item => item.unitTitle + " / " + item.title).join("؛ ");
    return [
      "المادة: " + ((subject && subject.nameAr) || subjectId),
      "التراكم المسجل: " + backlog,
      "المدرس المختار: " + ((teacher && teacher.nameAr) || teacherId || "لم يحدد"),
      "أحدث محتوى عام معروف للمدرس: " + ((teacher && teacher.latestPublicCheckpoint) || "غير متاح"),
      "الموضع الذي أبلغ الطالب أنه وصل إليه: " + ((frontierName && frontierName.title) || studentFrontier || "غير محدد"),
      "مصدر/ثقة تقرير الطالب: " + (state.evidenceSource || "تقرير الطالب") + " / " + (state.confidence || "غير محددة"),
      "فهرس الكورس المدفوع: " + ((teacher && teacher.paidCourseCatalogFrontier) ? JSON.stringify(teacher.paidCourseCatalogFrontier) : "غير موثق"),
      "دروس المنهج: " + (lessonList || "فهرس المنهج غير محمّل"),
      "دروس أُنجزت SQ3R: " + completed + "؛ قيد الدراسة: " + underway + "؛ صعبة حسب تقييم الطالب: " + (hard.join("، ") || "لا توجد بيانات"),
    ].join("\n");
  }).join("\n\n");
  return [
    "اسم الطالب: " + profile.studentName,
    "النظام: " + profile.educationSystem + "؛ الصف: " + profile.gradeYear + "؛ المسار: " + profile.track,
    "المواد ومواضعها: \n" + (subjectContext || "لا توجد مواد مسجلة"),
    "التراكم: " + Object.entries(profile.backlog).map(entry => entry[0] + ": " + entry[1]).join("، "),
    "العائق المعلن: " + (profile.obstacle || "غير محدد"),
  ].join("\n");
}

export async function generatePersonalPlan(userId: number, prompt: string, includeStudentProfile = true): Promise<GeneratedPlan> {
  const profile = includeStudentProfile ? await getStudentProfile(userId) : null;
  const context = profile ? buildLearningContext(profile) : "لم يطلب المستخدم تخصيص الخطة بالملف الدراسي.";
  const system = [
    "أنت محرك التخطيط الدراسي داخل StudyFlow، ولست مساعد دردشة عام.",
    "حلّل تراكم كل مادة، تقدم الطالب مع المدرس، تقدم SQ3R، وصعوبة الدروس المسجلة؛ ثم ابنِ خطة عملية متوازنة.",
    "لا تخلط بين آخر محتوى عام للمدرس، محتوى الكورس المدفوع، وما شاهده الطالب. لا تخترع أرقام محاضرات أو أسماء دروس.",
    "إذا كان فهرس مادة غير محمّل فاذكر هذا القيد ولا تخترع محتوى منهجيًا لها.",
    "رتّب الأولويات بحسب موعد الاختبار إن ذُكر، والمتطلبات السابقة، وحجم التراكم، وصعوبة الدرس. الدرس الصعب أو التأسيسي يحتاج فهمًا وتدريبًا واسترجاعًا، وليس قراءة سريعة؛ الدرس المألوف القصير يمكن أن يأخذ مراجعة مركزة.",
    "احترم سعة اليوم المحددة من الطالب. لا تتجاوزها، ووزع الخطة واقعيًا مع هامش تعويض. إذا نقصت البيانات فاختر بداية تدريجية واذكر الافتراض في الملخص.",
    "لا تعتبر غياب السجل دليلًا على الإنجاز، ولا توبّخ الطالب.",
    "أخرج كائن JSON فقط بالعربية وبالحقول: title, summary, durationLabel, steps (3-10 عناصر فيها day,title,detail,minutes,category), habits (1-4 عناصر فيها title,cue), reviewQuestion.",
    "كل خطوة يجب أن تحدد المادة والوحدة/الفرع والدرس وطريقة مذاكرته، لا عنوانًا عامًا.",
  ].join("\n");
  const user = "طلب الطالب أو قيوده الجديدة:\n" + prompt + "\n\nبيانات الملف الدراسي الحالية:\n" + context;
  let response;
  try {
    response = await invokeLLM({
      maxTokens: 2500,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/response_format|json_object|structured output|unsupported|not support/i.test(message)) throw error;
    response = await invokeLLM({
      maxTokens: 2500,
      messages: [{ role: "system", content: system + "\nاكتب JSON صحيحًا فقط دون Markdown." }, { role: "user", content: user }],
    });
  }
  const result = response.choices[0] && response.choices[0].message ? response.choices[0].message.content : "";
  const text = contentAsText(result);
  if (!text) throw new Error("لم تصل استجابة من المخطط الذكي. حاول مرة أخرى.");
  const plan = parseGeneratedPlan(text);
  await saveAiPlan(userId, { prompt, title: plan.title, planJson: JSON.stringify(plan) });
  return plan;
}
