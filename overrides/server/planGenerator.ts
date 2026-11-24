import { z } from "zod";
import { getSIECheckpointBranches, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { invokeLLM, invokeNvidiaLLM } from "./_core/llm";
import { getStudentProfile, saveAiPlan } from "./db";
import { formatTextbookEvidence, retrieveTextbookEvidence } from "./textbook-retrieval";

const planSchema = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(500),
  durationLabel: z.string().min(2).max(70),
  steps: z.array(z.object({
    day: z.string().min(1).max(30),
    title: z.string().min(2).max(120),
    detail: z.string().min(5).max(260),
    minutes: z.number().int().min(5).max(480),
    category: z.string().min(2).max(60),
  })).min(3).max(6),
  habits: z.array(z.object({ title: z.string().min(2).max(120), cue: z.string().min(2).max(160) })).min(1).max(2),
  reviewQuestion: z.string().min(5).max(250),
});

export type GeneratedPlan = z.infer<typeof planSchema>;

function plannerProviderError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const isNvidia = /NVIDIA LLM invoke failed/i.test(message);
  if (/NVIDIA_API_KEY is not configured/i.test(message)) {
    return new Error("تعذر استخدام المخطط: رصيد أو مفتاح المزوّد الأساسي غير متاح، ومفتاح NVIDIA الاحتياطي غير مهيأ. أضف NVIDIA_API_KEY كمتغير سرّي على خدمة StudyFlow Preview 360 في Railway، وليس كمتغير Shared.");
  }
  if (/AI_API_KEY is not configured/i.test(message)) {
    return new Error("مفتاح المزوّد الأساسي غير مهيأ، كما أن مسار NVIDIA الاحتياطي غير متاح. راجع AI_API_KEY وNVIDIA_API_KEY في إعدادات خدمة التشغيل.");
  }
  const status = Number(message.match(/(?:NVIDIA )?LLM invoke failed:\s*(\d{3})/i)?.[1] ?? 0);
  const providerLabel = isNvidia ? "NVIDIA Nemotron 3 Ultra" : "المزوّد الأساسي";
  if (status === 401 || status === 403) {
    return new Error("رفض " + providerLabel + " بيانات الاعتماد أو الصلاحيات. راجع المفتاح ونطاق صلاحياته.");
  }
  if (status === 402) {
    return new Error("رصيد أو إعداد الفوترة لدى " + providerLabel + " لا يسمح بتنفيذ الطلب. راجع حساب المزوّد.");
  }
  if (status === 429) {
    return new Error("وصل " + providerLabel + " إلى حد الطلبات مؤقتًا. حاول مرة أخرى بعد قليل.");
  }
  if (status >= 500) {
    return new Error("خدمة " + providerLabel + " تواجه عطلًا مؤقتًا. حاول مرة أخرى بعد قليل.");
  }
  if (/timeout|timed out|network|fetch failed|ECONN/i.test(message)) {
    return new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من الاتصال وحاول مرة أخرى.");
  }
  return new Error("تعذر توليد الخطة الذكية. لم يتم حفظ خطة ناقصة؛ حاول مرة أخرى.");
}
function contentAsText(content: any): string {
  return typeof content === "string" ? content : Array.isArray(content)
    ? content.filter(item => item.type === "text").map(item => item.text).join("\n")
    : "";
}

function extractBalancedJsonObjects(source: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth++;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        candidates.push(source.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function removeTrailingCommasOutsideStrings(json: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < json.length; index++) {
    const char = json[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let next = index + 1;
      while (next < json.length && /\s/.test(json[next])) next++;
      if (json[next] === "}" || json[next] === "]") continue;
    }

    output += char;
  }

  return output;
}

export function parseGeneratedPlan(content: string): GeneratedPlan {
  const normalized = content
    .replace(/^\uFEFF/, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const candidates = extractBalancedJsonObjects(normalized);
  if (candidates.length === 0) {
    throw new Error("تعذّر تحويل الخطة الذكية إلى صيغة صالحة. حاول مرة أخرى.");
  }

  let lastParseError: unknown;
  let parsedAnyJson = false;
  let lastSchemaIssues: unknown;

  for (const candidate of candidates) {
    for (const jsonCandidate of [candidate, removeTrailingCommasOutsideStrings(candidate)]) {
      let value: unknown;
      try {
        value = JSON.parse(jsonCandidate);
        parsedAnyJson = true;
      } catch (error) {
        lastParseError = error;
        continue;
      }

      const parsed = planSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      lastSchemaIssues = parsed.error.issues;
      // A preceding explanatory JSON object may not be the plan. Continue
      // scanning for a later object that satisfies the complete plan schema.
      break;
    }
  }

  if (!parsedAnyJson) {
    const parseMessage = lastParseError instanceof Error ? lastParseError.message.slice(0, 180) : "invalid JSON";
    console.error("[StudyFlow planner] Model output is not valid JSON:", {
      contentLength: content.length,
      candidateCount: candidates.length,
      parseMessage,
    });
    throw new Error("تعذّر قراءة بيانات الخطة. حاول مرة أخرى.");
  }

  console.error("[StudyFlow planner] No JSON object matched the plan schema:", lastSchemaIssues);
  throw new Error("الاستجابة الذكية غير مكتملة. حاول وصف هدفك بصورة أبسط.");

function buildLearningContext(profile: NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>) {
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

  return [
    "اسم الطالب: " + profile.studentName,
    "النظام: " + profile.educationSystem + "؛ الصف: " + profile.gradeYear + "؛ المسار: " + profile.track,
    "المواد ومواضعها: \n" + (subjectContext || "لا توجد مواد مسجلة"),
    "قيم التراكم القديمة (تُعامل كمدخلات غير مؤكدة فقط): " + Object.entries(profile.backlog).map(entry => entry[0] + ": " + entry[1]).join("، "),
    "العائق المعلن: " + (profile.obstacle || "غير محدد"),
  ].join("\n");
}

export async function generatePersonalPlan(
  userId: number,
  prompt: string,
  includeStudentProfile = true,
  constraints: { dailyMinutes?: number; startDate?: string } = {}
): Promise<GeneratedPlan> {
  const dailyMinutes = Math.max(20, Math.min(600, Math.trunc(constraints.dailyMinutes ?? 120)));
  const profile = includeStudentProfile ? await getStudentProfile(userId) : null;
  const textbookRetrieval = profile
    ? retrieveTextbookEvidence(profile.subjects || [], prompt, 2)
    : { passages: [], coverageNotes: [] };
  const textbookContext = formatTextbookEvidence(textbookRetrieval).slice(0, 1_700);
  const context = (profile
    ? buildLearningContext(profile) + "\n\nمصادر نصية من الكتب الرسمية مرتبطة بطلب الخطة:\n" + (textbookContext || "لم يتم استرجاع مقتطف مطابق من كتاب متاح.")
    : "لم يطلب المستخدم تخصيص الخطة بالملف الدراسي.").slice(0, 3_600);
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
    "أخرج JSON صحيحًا فقط بالعربية: title, summary, durationLabel, steps (3-6 خطوات فيها day,title,detail,minutes,category), habits (1-2 فيها title,cue), reviewQuestion. اجعل التفاصيل موجزة ومحددة.",
    "كل خطوة يجب أن تحدد المادة والوحدة/الفرع والدرس وطريقة مذاكرته، لا عنوانًا عامًا.",
  ].join("\n");
  const user = "طلب الطالب أو قيوده الجديدة:\n" + prompt.slice(0, 1_200) + "\n\nبيانات الملف الدراسي الحالية:\n" + context;
  let response;
  const invokeCompact = async (
    provider: typeof invokeLLM,
    maxTokens: number,
    compact = false,
    jsonMode = true
  ) => provider({
    maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: compact ? system.slice(0, 2_900) + "\nأخرج JSON موجزًا فقط." : system },
      { role: "user", content: compact ? user.slice(0, 4_000) : user },
    ],
  });

  const invokeNvidiaFallback = async () => {
    console.warn("[StudyFlow planner] Primary provider billing/quota unavailable; switching to NVIDIA Nemotron 3 Ultra.");
    // NVIDIA's hosted endpoint does not advertise structured output.
    // Retain the full planning context and validate its JSON response with Zod.
    return invokeCompact(invokeNvidiaLLM, 6_144, false, true);
  };

  const isBillingOrQuotaFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /AI_API_KEY is not configured/i.test(message)
      || /(?:NVIDIA )?LLM invoke failed:\s*402\b/i.test(message)
      || /insufficient[_\s-]?(?:credits?|quota|balance)|out of credits|not enough credits|credit balance.{0,40}(?:low|insufficient|exhausted)|quota.{0,30}(?:exceeded|exhausted)|openrouter_credits|payment required/i.test(message);
  };

  const isUnsupportedJsonMode = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return /response_format|json_object|structured output|unsupported|not support/i.test(message);
  };

  try {
    try {
      response = await invokeCompact(invokeLLM, 1_400, false, true);
    } catch (primaryError) {
      if (isBillingOrQuotaFailure(primaryError)) {
        response = await invokeNvidiaFallback();
      } else if (isUnsupportedJsonMode(primaryError)) {
        try {
          response = await invokeCompact(invokeLLM, 1_400, false, false);
        } catch (retryError) {
          if (isBillingOrQuotaFailure(retryError)) {
            response = await invokeNvidiaFallback();
          } else {
            throw retryError;
          }
        }
      } else {
        throw primaryError;
      }
    }
  } catch (error) {
    console.error("[StudyFlow planner] Provider request failed:", error instanceof Error ? error.message.slice(0, 700) : "Unknown provider error");
    throw plannerProviderError(error);
  }

  const firstChoice = response.choices?.[0];
  const result = firstChoice?.message?.content ?? "";
  const text = contentAsText(result);
  if (!text) {
    console.error("[StudyFlow planner] Provider returned no final content:", {
      model: response.model || null,
      choiceCount: Array.isArray(response.choices) ? response.choices.length : 0,
      finishReason: firstChoice?.finish_reason ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
    });
    throw new Error("لم تصل استجابة من المخطط الذكي. حاول مرة أخرى.");
  }
  let plan: GeneratedPlan;
  try {
    plan = parseGeneratedPlan(text);
  } catch (error) {
    console.error("[StudyFlow planner] Plan JSON validation failed:", {
      model: response.model || null,
      finishReason: firstChoice?.finish_reason ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      contentLength: text.length,
    });
    throw error;
  }
  const minutesByDay = new Map<string, number>();
  for (const step of plan.steps) {
    minutesByDay.set(step.day, (minutesByDay.get(step.day) ?? 0) + step.minutes);
  }
  const overloadedDay = [...minutesByDay.entries()].find(([, minutes]) => minutes > dailyMinutes);
  if (overloadedDay) {
    throw new Error("الخطة المقترحة تجاوزت حدك اليومي في " + overloadedDay[0] + " (" + overloadedDay[1] + " دقيقة مقابل " + dailyMinutes + "). أعد المحاولة لتوليد توزيع أخف.");
  }
  await saveAiPlan(userId, { prompt, title: plan.title, planJson: JSON.stringify(plan) });
  return plan;
}
