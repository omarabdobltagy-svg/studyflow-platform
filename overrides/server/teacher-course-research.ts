import { getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { getTeacherCourseFacts, upsertTeacherCourseFacts, type TeacherCourseFactsInput } from "./db";
import { callDataApi } from "./_core/dataApi";
import { invokeLLMWithNvidiaFallback } from "./_core/llmFallback";

type ResearchScope = Pick<TeacherCourseFactsInput, "teacherId" | "subjectId" | "educationSystem" | "gradeYear">;
type ResearchResult = {
  state: "verified" | "partial" | "insufficient_evidence" | "researching";
  facts: {
    availableModes: Array<"center" | "online">;
    homeworkPolicy: TeacherCourseFactsInput["homeworkPolicy"];
    homeworkRequiredBeforeNextLecture: TeacherCourseFactsInput["homeworkRequiredBeforeNextLecture"];
    preLectureExamRequired: TeacherCourseFactsInput["preLectureExamRequired"];
    confidence: TeacherCourseFactsInput["confidence"];
    evidence: TeacherCourseFactsInput["evidence"];
    checkedAt?: Date;
    expiresAt?: Date;
    isStale?: boolean;
  };
};

const inFlight = new Map<string, Promise<void>>();
const CACHE_DAYS = 30;
const FAILURE_RETRY_HOURS = 12;

function scopeKey(input: ResearchScope) {
  return [input.teacherId, input.subjectId, input.educationSystem, input.gradeYear].join("::");
}

function normalized(value: unknown, max = 800): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(item => item && typeof item === "object" && "text" in item
      ? String((item as { text?: unknown }).text ?? "")
      : "").join("\n");
  }
  return "";
}

function parseJsonObject(value: string): Record<string, any> | null {
  const cleaned = value.replace(/^\uFEFF/, "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function teacherSourceMatches(teacherName: string, brandName: string, channelTitle: string, title: string) {
  const channel = normalized(channelTitle, 180).toLocaleLowerCase("ar");
  const titleText = normalized(title, 240).toLocaleLowerCase("ar");
  const candidates = [teacherName, brandName].map(value => value.trim().toLocaleLowerCase("ar")).filter(value => value.length >= 4);
  return candidates.some(value => channel.includes(value) || titleText.includes(value));
}

async function collectYouTubeEvidence(teacherName: string, brandName: string, subjectName: string) {
  const queries = [
    `${teacherName} ${subjectName} سنتر أونلاين`,
    `${teacherName} ${subjectName} نظام الحضور والمجموعات والكورس`,
    `${teacherName} ${subjectName} الواجب قبل المحاضرة القادمة`,
    `${teacherName} ${subjectName} امتحان قبل كل محاضرة`,
  ];
  const responses = await Promise.allSettled(queries.map(query =>
    callDataApi("Youtube/search", { query: { gl: "EG", hl: "ar", q: query } }) as Promise<{
      items?: Array<Record<string, unknown>>;
      videos?: Array<Record<string, unknown>>;
    }>
  ));
  const byUrl = new Map<string, { title: string; url: string; source: string; excerpt?: string; publishedAt?: string }>();
  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    const raw = Array.isArray(response.value?.items) ? response.value.items
      : Array.isArray(response.value?.videos) ? response.value.videos : [];
    for (const item of raw) {
      const title = normalized(item.title ?? item.videoTitle ?? item.name, 240);
      const channel = normalized(item.channelTitle ?? item.channel_name ?? item.channel, 180);
      const url = normalized(item.url ?? item.link ?? item.videoUrl, 1_000);
      if (!title || !/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/i.test(url)) continue;
      if (!teacherSourceMatches(teacherName, brandName, channel, title)) continue;
      if (byUrl.has(url)) continue;
      const excerpt = normalized(item.description ?? item.snippet ?? item.text ?? item.descriptionSnippet, 900);
      byUrl.set(url, {
        title,
        url,
        source: channel ? `YouTube · ${channel}` : "YouTube",
        ...(excerpt ? { excerpt } : {}),
        ...(typeof item.publishedAt === "string" ? { publishedAt: item.publishedAt.slice(0, 40) } : {}),
      });
    }
  }
  return [...byUrl.values()].slice(0, 20);
}

async function classifyEvidence(
  teacherName: string,
  subjectName: string,
  scope: ResearchScope,
  evidence: TeacherCourseFactsInput["evidence"],
) {
  const unavailable = {
    availableModes: [] as Array<"center" | "online">,
    homeworkPolicy: "unknown" as const,
    homeworkRequiredBeforeNextLecture: "unknown" as const,
    preLectureExamRequired: "unknown" as const,
    confidence: "low" as const,
    verificationStatus: "insufficient_evidence" as const,
  };
  if (!evidence.length) return unavailable;

  const evidenceText = evidence.map((item, index) =>
    `[${index}] ${item.source}\nالعنوان: ${item.title}\nالمقتطف: ${item.excerpt || "لا يوجد مقتطف؛ العنوان فقط."}\nالرابط: ${item.url}`
  ).join("\n\n").slice(0, 10_000);

  const response = await invokeLLMWithNvidiaFallback({
    maxTokens: 1_400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `أنت محلل أدلة لملف المدرسين داخل StudyFlow. مهمتك استخراج معلومات تشغيلية محددة من المصادر المعروضة فقط، لا البحث من ذاكرتك ولا التخمين.

القواعد:
1) لا تعتبر نشر فيديو على YouTube دليلًا على أن المدرس يقدّم كورسًا أونلاين. لا تثبت online إلا إذا صرّح المصدر بوجود كورس/محاضرات/اشتراك أو حضور دراسي أونلاين.
2) لا تثبت center إلا إذا ظهر دليل صريح على سنتر أو مجموعة حضورية أو عنوان ومواعيد حضور.
3) لا تثبت homeworkPolicy=yes لمجرد ذكر كلمة واجب في عنوان واحد إلا إذا كان واضحًا أنه واجب يحدده المدرس لطلابه. لا تستنتج أن الواجب إلزامي قبل المحاضرة التالية من وجود واجب.
4) homeworkRequiredBeforeNextLecture=yes فقط إذا كان المصدر يصرح أن حل الواجب أو تسليمه شرط لدخول/حضور/مشاهدة المحاضرة التالية. خلاف ذلك unknown أو no عند وجود نفي صريح.
5) preLectureExamRequired=yes فقط عند وجود دليل صريح أن امتحان المدرس شرط قبل المحاضرة/الحصة التالية. لا تخلطه بوجود امتحانات دورية عادية.
6) استعمل unknown عند عدم وجود دليل. استخدم varies فقط عندما يذكر المصدر أن القاعدة تختلف فعلًا.
7) لا تضع مصدرًا في evidenceIndices إلا إذا كان يدعم الادعاء مباشرة. الدقة أهم من ملء الحقول.
8) confidence=high يتطلب أدلة صريحة متعددة أو إعلانًا رسميًا واضحًا؛ وmedium دليل مباشر واحد موثوق؛ وlow دليل غير مباشر أو غير كافٍ.

أخرج JSON فقط:
{
 "availableModes":["center","online"],
 "homeworkPolicy":"yes|no|varies|unknown",
 "homeworkRequiredBeforeNextLecture":"yes|no|varies|unknown",
 "preLectureExamRequired":"yes|no|varies|unknown",
 "confidence":"low|medium|high",
 "evidenceIndices":[0],
 "notes":"سبب مختصر لكل نتيجة غير معروفة أو غير مؤكدة"
}
لا تضف أسماء أو روابط مصادر غير موجودة في قائمة الأدلة.`,
      },
      {
        role: "user",
        content: `المدرس: ${teacherName}\nالمادة: ${subjectName}\nالنظام: ${scope.educationSystem}\nالصف: ${scope.gradeYear}\n\nالأدلة:\n${evidenceText}`,
      },
    ],
  });
  const raw = extractText(response.choices?.[0]?.message?.content ?? "");
  const parsed = parseJsonObject(raw);
  if (!parsed) return unavailable;

  const selectedIndices = Array.isArray(parsed.evidenceIndices)
    ? parsed.evidenceIndices.filter((index: unknown) => Number.isInteger(index) && Number(index) >= 0 && Number(index) < evidence.length).slice(0, 10)
    : [];
  const confidence = enumValue(parsed.confidence, ["low", "medium", "high"] as const, "low");
  const verificationStatus = confidence === "high" && selectedIndices.length >= 1 ? "verified"
    : confidence === "medium" && selectedIndices.length >= 1 ? "partial"
      : "insufficient_evidence";

  return {
    availableModes: Array.isArray(parsed.availableModes)
      ? [...new Set(parsed.availableModes.filter((mode: unknown): mode is "center" | "online" => mode === "center" || mode === "online"))]
      : [],
    homeworkPolicy: enumValue(parsed.homeworkPolicy, ["yes", "no", "varies", "unknown"] as const, "unknown"),
    homeworkRequiredBeforeNextLecture: enumValue(parsed.homeworkRequiredBeforeNextLecture, ["yes", "no", "varies", "unknown"] as const, "unknown"),
    preLectureExamRequired: enumValue(parsed.preLectureExamRequired, ["yes", "no", "varies", "unknown"] as const, "unknown"),
    confidence,
    verificationStatus,
    evidence: selectedIndices.map((index: number) => evidence[index]),
    notes: normalized(parsed.notes, 700),
  };
}

async function refreshTeacherCourseFacts(scope: ResearchScope) {
  const key = scopeKey(scope);
  const running = inFlight.get(key);
  if (running) return running;
  const task = (async () => {
    const teacher = getSIETeacher(scope.teacherId);
    const subject = getSIESubject(scope.subjectId);
    if (!teacher || !subject || !teacher.subjectIds.includes(scope.subjectId)) {
      throw new Error("Teacher and subject must exist in the shared catalog.");
    }
    const evidence = await collectYouTubeEvidence(teacher.nameAr, teacher.brandName, subject.nameAr);
    let classified;
    try {
      classified = await classifyEvidence(teacher.nameAr, subject.nameAr, scope, evidence);
    } catch (error) {
      console.warn("[Teacher directory] AI evidence classification failed:", error instanceof Error ? error.message.slice(0, 250) : "unknown error");
      classified = {
        availableModes: [] as Array<"center" | "online">,
        homeworkPolicy: "unknown" as const,
        homeworkRequiredBeforeNextLecture: "unknown" as const,
        preLectureExamRequired: "unknown" as const,
        confidence: "low" as const,
        verificationStatus: "research_failed" as const,
        evidence: [] as TeacherCourseFactsInput["evidence"],
      };
    }
    const now = new Date();
    const ttlHours = classified.verificationStatus === "research_failed" ? FAILURE_RETRY_HOURS : CACHE_DAYS * 24;
    await upsertTeacherCourseFacts({
      teacherId: teacher.teacherId,
      teacherName: teacher.nameAr,
      subjectId: scope.subjectId,
      educationSystem: scope.educationSystem,
      gradeYear: scope.gradeYear,
      availableModes: classified.availableModes,
      homeworkPolicy: classified.homeworkPolicy,
      homeworkRequiredBeforeNextLecture: classified.homeworkRequiredBeforeNextLecture,
      preLectureExamRequired: classified.preLectureExamRequired,
      evidence: classified.evidence,
      confidence: classified.confidence,
      verificationStatus: classified.verificationStatus,
      checkedAt: now,
      expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
    });
    if (classified.verificationStatus === "insufficient_evidence") {
      console.info("[Teacher directory] No reliable public evidence found; the profile remains unknown instead of guessing.", { teacherId: teacher.teacherId, subjectId: scope.subjectId });
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export async function getTeacherCourseFactsWithRefresh(scope: ResearchScope): Promise<ResearchResult> {
  const current = await getTeacherCourseFacts(scope);
  const stale = !current || current.isStale;
  if (stale) {
    void refreshTeacherCourseFacts(scope).catch(error => {
      console.warn("[Teacher directory] Background refresh failed:", error instanceof Error ? error.message.slice(0, 300) : "unknown error");
    });
  }
  if (!current) {
    return {
      state: inFlight.has(scopeKey(scope)) ? "researching" : "insufficient_evidence",
      facts: {
        availableModes: [],
        homeworkPolicy: "unknown",
        homeworkRequiredBeforeNextLecture: "unknown",
        preLectureExamRequired: "unknown",
        confidence: "low",
        evidence: [],
      },
    };
  }
  return {
    state: current.isStale ? "researching" : current.verificationStatus === "verified" ? "verified"
      : current.verificationStatus === "partial" ? "partial" : "insufficient_evidence",
    facts: {
      availableModes: current.availableModes,
      homeworkPolicy: current.homeworkPolicy as TeacherCourseFactsInput["homeworkPolicy"],
      homeworkRequiredBeforeNextLecture: current.homeworkRequiredBeforeNextLecture as TeacherCourseFactsInput["homeworkRequiredBeforeNextLecture"],
      preLectureExamRequired: current.preLectureExamRequired as TeacherCourseFactsInput["preLectureExamRequired"],
      confidence: current.confidence as TeacherCourseFactsInput["confidence"],
      evidence: current.evidence,
      checkedAt: current.checkedAt,
      expiresAt: current.expiresAt,
      isStale: current.isStale,
    },
  };
}
