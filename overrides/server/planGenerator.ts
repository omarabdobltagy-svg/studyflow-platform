import { z } from "zod";
import { getSIECheckpointBranches, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { ensureRequiredLessonCoverage, getMissingLessonCheckpoints, type RequiredLessonCheckpoint } from "./plan-coverage";
import { invokeLLM } from "./_core/llm";
import { getStudentProfile, saveAiPlan } from "./db";
import { formatTextbookEvidence, retrieveTextbookEvidence } from "./textbook-retrieval";

const planSchema = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(500),
  strategy: z.string().min(10).max(700).optional(),
  coverage: z.object({ requiredLessons: z.number().int().nonnegative(), coveredLessons: z.number().int().nonnegative(), appendedLessons: z.number().int().nonnegative(), unverifiedBacklog: z.array(z.object({ subject: z.string(), count: z.number().int().nonnegative() })) }).optional(),
  durationLabel: z.string().min(2).max(70),
  steps: z.array(z.object({
    day: z.string().min(1).max(30),
    title: z.string().min(2).max(120),
    detail: z.string().min(5).max(350),
    minutes: z.number().int().min(5).max(480),
    category: z.string().min(2).max(100),
    subtasks: z.array(z.string().min(2).max(220)).max(5).optional(),
  })).min(3).max(120),
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
  if (first < 0 || last <= first) throw new Error("تعذّر تحويل الخطة الذكية إلى صيغة صالحة. حاول مرة أخرى.");
  let value: unknown;
  try { value = JSON.parse(cleaned.slice(first, last + 1)); }
  catch { throw new Error("تعذّر قراءة بيانات الخطة. حاول مرة أخرى."); }
  const parsed = planSchema.safeParse(value);
  if (!parsed.success) {
    console.error("[StudyFlow planner] Invalid plan structure:", parsed.error.issues);
    throw new Error("الاستجابة الذكية غير مكتملة. حاول وصف هدفك بصورة أبسط.");
  }
  return parsed.data;
}

function buildLearningContext(profile: NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>) {
  const requiredLessons: RequiredLessonCheckpoint[] = [];
  const unverifiedBacklog: Array<{ subject: string; count: number }> = [];
  const selection = (profile.selection || {}) as Record<string, any>;
  const choices = (selection.teacherChoices || profile.teacherSelections || {}) as Record<string, string>;
  const frontiers = (selection.teacherFrontiers || {}) as Record<string, string>;
  const teacherStates = (selection.teacherProgressState || {}) as Record<string, Record<string, any>>;
  const lessonProgress = (selection.subjectLessonProgress || {}) as Record<string, Record<string, any>>;
  const courseProgress = (selection.learningCourseProgress || {}) as Record<string, any>;
  const assessmentHistory = Array.isArray(selection.learningAssessments)
    ? selection.learningAssessments as Array<Record<string, any>>
    : [];

  const subjectContext = (profile.subjects || []).map(subjectId => {
    const subject = getSIESubject(subjectId);
    const teacherId = choices[subjectId];
    const teacher = teacherId ? getSIETeacher(teacherId) : undefined;
    const state = teacherStates[subjectId] || {};
    const reported = courseProgress[subjectId] || {};
    const branchRecords = (reported.branches || {}) as Record<string, Record<string, any>>;
    const branches = getSIECheckpointBranches(subjectId);
    const studentLegacyFrontier = reported.lastCompletedLessonId || frontiers[subjectId] || state.studentAttendedFrontier || null;
    const subjectLessonRecords = lessonProgress[subjectId] || {};

    const branchSummaries = branches.map(branch => {
      const saved = branchRecords[branch.branchId] || {};
      const belongsToBranch = (value: unknown) =>
        typeof value === "string" &&
        (value === "__NOT_STARTED__" ||
          branch.choices.some(choice => choice.nodeId === value));
      const latestSq3rCompleted = [...branch.choices].reverse().find(choice => {
        const completedSteps = subjectLessonRecords[choice.nodeId]?.completedSteps;
        return Array.isArray(completedSteps) && completedSteps.length === 5;
      })?.nodeId;
      const studentFrontier = Object.prototype.hasOwnProperty.call(saved, "lastCompletedLessonId")
        ? saved.lastCompletedLessonId
        : belongsToBranch(studentLegacyFrontier) ? studentLegacyFrontier : latestSq3rCompleted ?? "__UNKNOWN__";
      const teacherFrontier = Object.prototype.hasOwnProperty.call(saved, "teacherTeachingFrontierId")
        ? saved.teacherTeachingFrontierId
        : belongsToBranch(reported.teacherTeachingFrontierId) ? reported.teacherTeachingFrontierId : "__UNKNOWN__";
      const schoolFrontier = Object.prototype.hasOwnProperty.call(saved, "schoolClassFrontierId")
        ? saved.schoolClassFrontierId
        : belongsToBranch(reported.schoolClassFrontierId) ? reported.schoolClassFrontierId : "__UNKNOWN__";
      const gap = calculateLearningGap(branch.choices, {
        studentFrontierId: studentFrontier,
        teacherTeachingFrontierId: teacherFrontier,
        schoolClassFrontierId: schoolFrontier,
      });
      const missingCheckpoints = getMissingLessonCheckpoints(branch.choices, gap.studentPosition, gap.referencePosition);
      requiredLessons.push(...missingCheckpoints.map(checkpoint => ({
        subjectId,
        subjectName: subject?.nameAr || subjectId,
        branchId: branch.branchId,
        branchTitle: branch.branchTitle,
        lessonId: checkpoint.nodeId,
        lessonTitle: checkpoint.title,
        estimatedMinutes: Number(reported.estimatedMinutesPerLesson ?? 45),
      })));
      const referenceLabel = gap.referenceSource === "teacher" ? "المدرس"
        : gap.referenceSource === "school" ? "المدرسة" : "غير متاح";
      const studentLabel = branch.choices.find(choice => choice.nodeId === studentFrontier)?.title
        || (studentFrontier === "__NOT_STARTED__" ? "لم يبدأ بعد" : "غير محدد");
      const referenceLabelTitle = branch.choices.find(choice => choice.nodeId === gap.referenceFrontierId)?.title
        || (gap.referenceFrontierId === "__NOT_STARTED__" ? "لم يبدأ بعد" : "غير محدد");
      const records = branch.choices.map(choice => subjectLessonRecords[choice.nodeId]).filter(Boolean);
      const completed = records.filter((item: any) => Array.isArray(item.completedSteps) && item.completedSteps.length === 5).length;
      const underway = records.filter((item: any) => Array.isArray(item.completedSteps) && item.completedSteps.length > 0 && item.completedSteps.length < 5).length;
      const hard = branch.choices.filter(choice => subjectLessonRecords[choice.nodeId]?.difficulty === "hard").map(choice => choice.title);

      return [
        "الفرع الرسمي: " + branch.branchTitle,
        "موضع الطالب: " + studentLabel,
        "مرجع المقارنة: " + referenceLabel + " — " + referenceLabelTitle,
        "الفجوة داخل هذا الفرع فقط: " + (gap.gapCount === null
          ? "غير محسوبة لعدم اكتمال البيانات داخل الفرع"
          : gap.gapCount + " نقطة داخل الفرع؛ متقدم عن المرجع: " + (gap.aheadCount ?? 0)),
        "إنجاز SQ3R في الفرع: " + completed + " مكتمل؛ " + underway + " قيد الدراسة",
        "كل الدروس المطلوبة التي يجب تغطيتها في الخطة داخل هذا الفرع: " + (missingCheckpoints.map(item => item.title).join("، ") || "لا توجد فجوة مؤكدة قابلة للقياس"),
        "نقاط صعبة: " + (hard.join("، ") || "لا توجد بيانات"),
      ].join(" | ");
    }).join("\n");

    const recentAssessments = assessmentHistory.filter(item => item.subjectId === subjectId).slice(-5);
    const assessmentSummary = recentAssessments.map(item =>
      String(item.assessmentType || "تقييم") + ": " + String(item.scorePercent) + "%"
      + (Array.isArray(item.weakConcepts) && item.weakConcepts.length
        ? "؛ نقاط تحتاج تقوية: " + item.weakConcepts.join("، ") : "")
    ).join(" | ");
    const legacyBacklog = profile.backlog[subjectId] ?? (subject && profile.backlog[subject.nameAr]) ?? null;
    if (legacyBacklog !== null && Number(legacyBacklog) > 0) unverifiedBacklog.push({ subject: subject?.nameAr || subjectId, count: Number(legacyBacklog) });
    const lessonList = branches.map(branch =>
      branch.branchTitle + ": " + branch.choices.map(choice => choice.title).join("، ")
    ).join("؛ ");

    return [
      "المادة: " + ((subject && subject.nameAr) || subjectId),
      "تقدم كل فرع مستقل (ممنوع جمع فجوات الفروع أو مقارنة موضع من فرع بفرع آخر):\n" + (branchSummaries || "الفهرس غير متاح"),
      "التراكم القديم المسجل يدويًا (غير مؤكد ولا يحل محل الفجوات الفرعية): " + (legacyBacklog === null ? "لا يوجد" : legacyBacklog),
      "آخر محاضرة/عنصر في كورس المدرس كما أبلغ الطالب: " + (reported.teacherCourseFrontier || "غير محدد"),
      "الوقت التقديري للدرس: " + (reported.estimatedMinutesPerLesson ?? 45) + " دقيقة",
      "صعوبة المادة حسب الطالب: " + (reported.difficulty || "غير محددة"),
      "نتائج التقييمات الحديثة: " + (assessmentSummary || "لا توجد نتائج مسجلة"),
      "المدرس المختار: " + ((teacher && teacher.nameAr) || teacherId || "لم يحدد"),
      "أحدث محتوى عام معروف للمدرس (ليس مرجع تقدم مدفوع): " + ((teacher && teacher.latestPublicCheckpoint) || "غير متاح"),
      "فهرس الكورس المدفوع: " + ((teacher && teacher.paidCourseCatalogFrontier) ? JSON.stringify(teacher.paidCourseCatalogFrontier) : "غير موثق"),
      "دروس المنهج بحسب الفروع: " + (lessonList || "فهرس المنهج غير محمّل"),
    ].join("\n");
  }).join("\n\n");

  const context = [
    "اسم الطالب: " + profile.studentName,
    "النظام: " + profile.educationSystem + "؛ الصف: " + profile.gradeYear + "؛ المسار: " + profile.track,
    "المواد ومواضعها: \n" + (subjectContext || "لا توجد مواد مسجلة"),
    "قيم التراكم القديمة (تُعامل كمدخلات غير مؤكدة فقط): " + Object.entries(profile.backlog).map(entry => entry[0] + ": " + entry[1]).join("، "),
    "العائق المعلن: " + (profile.obstacle || "غير محدد"),
    "إجمالي الدروس المؤكدة المطلوبة في الفجوات المحسوبة: " + requiredLessons.length,
  ].join("\n");
  return { context, requiredLessons, unverifiedBacklog };
}

export async function generatePersonalPlan(
  userId: number,
  prompt: string,
  includeStudentProfile = true,
  constraints: { dailyMinutes?: number; startDate?: string } = {}
): Promise<GeneratedPlan> {
  const dailyMinutes = Math.max(20, Math.min(600, Math.trunc(constraints.dailyMinutes ?? 120)));
  const profile = includeStudentProfile ? await getStudentProfile(userId) : null;
  const learningInventory = profile ? buildLearningContext(profile) : {
    context: "لم يطلب المستخدم تخصيص الخطة بالملف الدراسي.",
    requiredLessons: [] as RequiredLessonCheckpoint[],
    unverifiedBacklog: [] as Array<{ subject: string; count: number }>,
  };
  const textbookRetrieval = profile
    ? retrieveTextbookEvidence(profile.subjects || [], prompt, 4)
    : { passages: [], coverageNotes: [] };
  const textbookContext = formatTextbookEvidence(textbookRetrieval);
  const context = profile
    ? learningInventory.context + "\n\nمصادر نصية من الكتب الرسمية مرتبطة بطلب الخطة:\n" + (textbookContext || "لم يتم استرجاع مقتطف مطابق من كتاب متاح.")
    : learningInventory.context;
  const system = [
    "أنت محرك التخطيط الدراسي داخل StudyFlow، ولست مساعد دردشة عام.",
    "حلّل فجوة المنهج المحسوبة تلقائيًا لكل فرع مستقل داخل المادة، وموضع الطالب وموضع التدريس المرجعي داخل الفرع نفسه، وتقدم SQ3R ونتائج التقييم وصعوبة الدروس؛ ثم ابنِ خطة عملية متوازنة.",
    "مصدر المرجع له أولوية صارمة داخل كل فرع: استخدم موضع المدرس إذا كان معروفًا، وإلا استخدم موضع الفصل في المدرسة داخل الفرع نفسه. موضع الطالب يظل مستقلًا عن الاثنين. لا تقارن أو تجمع فجوات فروع متوازية، ولا تستخدم رقم التراكم القديم كأنه فجوة مؤكدة.",
    "لا تخلط بين آخر محتوى عام للمدرس، محتوى الكورس المدفوع، موضع ما شرحه المدرس، موضع المدرسة، وما أتمه الطالب. لا تخترع أرقام محاضرات أو أسماء دروس أو مواضع غير مسجلة.",
    "إذا توفرت مقتطفات مسترجعة من كتاب رسمي، اجعلها المرجع الأول عند تحديد موضوعات الخطة واذكر صفحات PDF في التفاصيل عند الاستناد إليها. المعرفة العامة تستخدم لسد المتطلبات السابقة غير المشروحة وتوضع بوضوح كتمهيد مساند، ولا تنسب للكتاب. إذا كان فهرس مادة غير محمّل فاذكر هذا القيد ولا تخترع محتوى منهجيًا لها.",
    "رتّب الأولويات بحسب موعد الاختبار إن ذُكر، والمتطلبات السابقة، وحجم التراكم، وصعوبة الدرس. الدرس الصعب أو التأسيسي يحتاج فهمًا وتدريبًا واسترجاعًا، وليس قراءة سريعة؛ الدرس المألوف القصير يمكن أن يأخذ مراجعة مركزة.",
    "الحد الأقصى لوقت الدراسة اليومي هو " + dailyMinutes + " دقيقة. مجموع دقائق الخطوات التي تحمل اسم اليوم نفسه يجب ألا يتجاوز هذا الحد، مع ترك هامش تعويض واقعي.",
    constraints.startDate ? "تاريخ بداية التنفيذ: " + constraints.startDate + "." : "تاريخ البداية يحدده الطالب عند اعتماد الخطة.",
    "احترم سعة اليوم المحددة من الطالب. لا تتجاوزها، ووزع الخطة واقعيًا مع هامش تعويض. إذا نقصت البيانات فاختر بداية تدريجية واذكر الافتراض في الملخص.",
    "لا تعتبر غياب السجل دليلًا على الإنجاز، ولا توبّخ الطالب.",
    "أخرج كائن JSON فقط بالعربية وبالحقول: title, summary, strategy, durationLabel, steps (3-120 عنصرًا فيها day,title,detail,minutes,category,subtasks), habits (1-4 عناصر فيها title,cue), reviewQuestion.",
    "كل خطوة يجب أن تحدد المادة والوحدة/الفرع والدرس وطريقة مذاكرته، لا عنوانًا عامًا.",
    "قائمة الدروس المطلوبة في بيانات الطالب إلزامية: يجب أن يظهر كل درس منها في خطوة واحدة على الأقل بعنوانه أو باسمه الواضح. لا تدمج دروسًا متعددة في مهمة عامة ولا تحذف أي عنصر من القائمة.",
    "لكل درس مطلوب، أضف subtasks بثلاث نقاط: مشاهدة/استكمال المحاضرة، الفهم والاسترجاع من الكتاب، ثم حل التدريبات وتصحيح الأخطاء. الحد الأقصى 120 خطوة.",
    "لا تنشئ دروسًا لأرقام التراكم اليدوي غير المؤكد؛ اعرضها كبيانات تحتاج تأكيدًا منفصلًا.",
  ].join("\n");
  const user = "طلب الطالب أو قيوده الجديدة:\n" + prompt + "\n\nبيانات الملف الدراسي الحالية:\n" + context;
  let response;
  try {
    response = await invokeLLM({
      maxTokens: 8000,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/response_format|json_object|structured output|unsupported|not support/i.test(message)) throw error;
    response = await invokeLLM({
      maxTokens: 8000,
      messages: [{ role: "system", content: system + "\nاكتب JSON صحيحًا فقط دون Markdown." }, { role: "user", content: user }],
    });
  }
  const result = response.choices[0] && response.choices[0].message ? response.choices[0].message.content : "";
  const text = contentAsText(result);
  if (!text) throw new Error("لم تصل استجابة من المخطط الذكي. حاول مرة أخرى.");
  const generatedPlan = parseGeneratedPlan(text);
  const coverage = ensureRequiredLessonCoverage(generatedPlan.steps, learningInventory.requiredLessons, dailyMinutes);
  const plan: GeneratedPlan = {
    ...generatedPlan,
    steps: coverage.steps as GeneratedPlan["steps"],
    strategy: generatedPlan.strategy || generatedPlan.summary,
    coverage: {
      requiredLessons: learningInventory.requiredLessons.length,
      coveredLessons: coverage.coveredLessons,
      appendedLessons: coverage.appendedLessons,
      unverifiedBacklog: learningInventory.unverifiedBacklog,
    },
  };
  if (plan.steps.length > 120) throw new Error("حجم الفجوة أكبر من سعة الخطة الواحدة. قسّمها حسب المادة أو الفرع حتى لا تُحذف أي دروس.");
  await saveAiPlan(userId, { prompt, title: plan.title, planJson: JSON.stringify(plan) });
  return plan;
}
