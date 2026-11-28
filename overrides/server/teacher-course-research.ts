import { getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { getTeacherCourseFacts, upsertTeacherCourseFacts, type TeacherCourseFactsInput } from "./db";
import { callDataApi } from "./_core/dataApi";
import { invokeLLMWithNvidiaFallback } from "./_core/llmFallback";

type ResearchScope = Pick<TeacherCourseFactsInput, "teacherId" | "subjectId" | "educationSystem" | "gradeYear">;
type TeacherResearchClassification = {
  availableModes: Array<"center" | "online">;
  homeworkPolicy: TeacherCourseFactsInput["homeworkPolicy"];
  homeworkRequiredBeforeNextLecture: TeacherCourseFactsInput["homeworkRequiredBeforeNextLecture"];
  preLectureExamRequired: TeacherCourseFactsInput["preLectureExamRequired"];
  confidence: TeacherCourseFactsInput["confidence"];
  verificationStatus: TeacherCourseFactsInput["verificationStatus"];
  evidence: TeacherCourseFactsInput["evidence"];
  notes?: string;
};

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

type CuratedDeliveryFacts = {
  availableModes: Array<"center" | "online">;
  confidence: "low" | "medium" | "high";
  evidence: TeacherCourseFactsInput["evidence"];
  verified: boolean;
};

/**
 * Curated public-profile checks for the current StudyFlow G2 BAC cohort.
 * Online means an online course/video platform was found; it does not imply live tutoring.
 * A physical center is included only where the teacher's public first-party page explicitly lists it.
 */
const CURATED_DELIVERY_FACTS: Record<string, CuratedDeliveryFacts> = {
  T_AR_MOHAMED_SALAH: {
    availableModes: ["online", "center"], confidence: "high", verified: true,
    evidence: [{ title: "تفاصيل بداية دفعة 2027 — أونلاين وسنتر مع أ. محمد صلاح", url: "https://www.youtube.com/watch?v=H_1-JOKbMW8", source: "قناة بسطتهالك الرسمية", excerpt: "الفيديو الرسمي يذكر صراحة تقديم محمد صلاح للأونلاين والسنتر ضمن دفعة 2027 للبكالوريا والثانوية العامة." }, { title: "صفحة بسطتهالك الرسمية على فيسبوك", url: "https://www.facebook.com/salah.bassthalk", source: "Facebook · بسطتهالك", excerpt: "صفحة اجتماعية مرتبطة بقنوات المدرس الرسمية؛ لا يعتمد عليها وحدها لإثبات نوع الدراسة." }],
  },
  T_AR_REDA_FAROUK: {
    availableModes: ["online", "center"], confidence: "high", verified: true,
    evidence: [{ title: "مواعيد السنة الجديدة ونظام الأونلاين والسنتر — دفعة 2027", url: "https://youtu.be/8CoIm7Ul5Wo", source: "قناة رضا الفاروق الرسمية", excerpt: "وصف الفيديو الرسمي يذكر تفاصيل الأونلاين والسنتر ضمن إعلان دفعة 2027 للثانوية والبكالوريا." }, { title: "صفحة رضا الفاروق الرسمية على فيسبوك", url: "https://www.facebook.com/RedaElfaroukOfficial/", source: "Facebook · رضا الفاروق", excerpt: "رابط الصفحة الرسمية مذكور ضمن روابط المدرس؛ لا يعتمد عليه وحده لإثبات نوع الدراسة." }],
  },
  T_AR_MOHAMED_TAREK: {
    availableModes: [], confidence: "low", verified: false,
    evidence: [{ title: "قناة محمد طارق — لم تتأكد مطابقة المنهج الحالي", url: "https://youtube.com/@mr.mohamed_tarek", source: "قناة يوتيوب عامة", excerpt: "لم يظهر دليل كافٍ يثبت تقديمه الحالي لمنهج الصف الثاني بكالوريا 2027 أو وجود سنتر." }],
  },
  T_EN_MAHMOUD_RADWAN: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "Englishawy — مراجعات الصف الثاني بكالوريا 2027", url: "https://www.youtube.com/@MahmoudRadwan.Englishawy", source: "قناة إنجلشاوي", excerpt: "قناة المدرس تعرض محتوى حديثًا للصف الثاني بكالوريا وروابط المنصة؛ لا يوجد دليل على مركز حضوري." }],
  },
  T_EN_SHERIF: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "منصة شريف المصري — اللغة الإنجليزية للصف الثاني بكالوريا", url: "https://sherifelmassry.com/", source: "منصة شريف المصري", excerpt: "المنصة تعرض شرحًا وتطبيقات واختبارات للصف الثاني بكالوريا؛ عناوين المكتبات المعروضة تخص بيع الكتب وليست مراكز تدريس." }],
  },
  T_EN_AHMED_SOBHY: {
    availableModes: ["online"], confidence: "medium", verified: true,
    evidence: [{ title: "إنجليزي البكالوريا — دروس الصف الثاني بكالوريا", url: "https://zolotube.com/channel?id=UCP4vtEvANSvCszyJFBEiqOA", source: "قناة إنجليزي البكالوريا", excerpt: "محتوى دروس حديثة للصف الثاني بكالوريا متاح أونلاين؛ لم يظهر دليل على سنتر حضوري." }],
  },
  T_HIS_AHMED_GHONIEM: {
    availableModes: ["online", "center"], confidence: "high", verified: true,
    evidence: [{ title: "أحمد غنيم — المحاضرات الأونلاين والحضورية", url: "https://ahmedghoniem.com/", source: "موقع أحمد غنيم الرسمي", excerpt: "الموقع يعرض دروسًا أونلاين وقسم Offline Lectures ويذكر قاعة غنيم بالمعادي وعدة سناتر تعليمية." }],
  },
  T_HIS_MARWAN: {
    availableModes: ["online"], confidence: "medium", verified: true,
    evidence: [{ title: "المؤرخ مروان حسن — محتوى تاريخ الصف الثاني بكالوريا 2027", url: "https://youtube.com/channel/UCJqSCcNDCxe4b259TXPZbcw", source: "قناة المؤرخ مروان حسن", excerpt: "تظهر دروسًا حديثة لمنهج التاريخ للصف الثاني بكالوريا؛ لم يظهر دليل موثق على سنتر حضوري." }],
  },
  T_HIS_ABDELHADY: {
    availableModes: ["online"], confidence: "medium", verified: true,
    evidence: [{ title: "محمود عبدالهادي — محتوى تاريخ الصف الثاني بكالوريا", url: "https://zolotube.com/channel?id=UCThV5LrCMIWs9tyDvZ9IC2w", source: "قناة محمود عبدالهادي", excerpt: "تظهر دروس تاريخ للصف الثاني بكالوريا متاحة أونلاين؛ لم يظهر دليل على مركز حضوري." }],
  },
  T_PROG_IMAD_SHARAF: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "WE4CODE — كورس البرمجة والذكاء الاصطناعي", url: "https://we4code.com/course/7", source: "منصة WE4CODE", excerpt: "المنصة تعرض كورس الصف الثاني بكالوريا بدروس وملفات وواجبات واختبارات واجتماعات أونلاين." }],
  },
  T_PROG_ANAS_AHMED: {
    availableModes: [], confidence: "low", verified: false,
    evidence: [{ title: "Code-UP — لم يتأكد ارتباط المدرس بالمقرر الظاهر", url: "https://www.code-up.tech/", source: "منصة Code-UP", excerpt: "المنصة تعرض مقرر البرمجة للصف الثاني بكالوريا، لكن صفحة المصدر لا تثبت أن د. أنس أحمد هو المدرس المسؤول عنه." }],
  },
  T_PROG_KHALED_ASHRAF: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "برمجة بكالوريا — درس الصف الثاني بكالوريا 2027", url: "https://www.youtube.com/watch?v=oIYgUBLUJxU", source: "قناة برمجة بكالوريا", excerpt: "يوجد درس برمجة حديث للصف الثاني بكالوريا 2027 متاح عبر يوتيوب؛ لم يظهر دليل على سنتر حضوري." }],
  },
  T_HIS_AHMED_ADEL: {
    availableModes: [], confidence: "low", verified: false,
    evidence: [{ title: "أحمد عادل — مصدر غير مطابق للصف الثاني بكالوريا", url: "https://www.mr-ahmed-adel.com/course/90", source: "موقع أحمد عادل", excerpt: "الصفحة المعروضة مراجعة نهائية لطلاب الأزهر ولا تثبت تدريس تاريخ الصف الثاني بكالوريا الحالي أو تقديم سنتر." }],
  },
  T_HIS_GOMAA_EL_SAYED: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "منصة القيصر — تاريخ الصف الثاني بكالوريا", url: "https://gomaa-elsayed.com/years/2", source: "منصة القيصر", excerpt: "الصفحة تعرض مقررات تاريخ للصف الثاني بكالوريا مع التسجيل والاشتراك عبر المنصة؛ لم يظهر دليل على مركز حضوري." }],
  },
  T_PROG_MAZEN_ALI_BARMAGTHALK: {
    availableModes: ["online"], confidence: "high", verified: true,
    evidence: [{ title: "برمجتهالك — البرمجة والذكاء الاصطناعي للصف الثاني بكالوريا", url: "https://barmagthalk.pyramitech.com/", source: "منصة برمجتهالك", excerpt: "المنصة تعرض كورس البرمجة والذكاء الاصطناعي للصف الثاني بكالوريا، وتذكر م. مازن علي كمدرب ومؤسس." }],
  },
};

export function getCuratedTeacherDeliveryFacts(teacherId: string) {
  return CURATED_DELIVERY_FACTS[teacherId] ?? null;
}

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

export function normalizeTeacherSearchText(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function teacherSourceMatches(teacherName: string, brandName: string, channelTitle: string, title: string) {
  const channel = normalizeTeacherSearchText(normalized(channelTitle, 180));
  const titleText = normalizeTeacherSearchText(normalized(title, 240));
  const candidates = [teacherName, brandName]
    .map(value => normalizeTeacherSearchText(value))
    .filter(value => value.length >= 4);
  // Keep full-name/brand matching strict, but normalize common Arabic spelling variants.
  // This avoids dropping the teacher's own channel because one source omitted hamza or tashkeel.
  return candidates.some(value => channel.includes(value) || titleText.includes(value));
}

async function collectYouTubeEvidence(teacherName: string, brandName: string, subjectName: string) {
  const queries = [...new Set([
    `${teacherName} ${subjectName} سنتر أونلاين`,
    `${brandName} ${subjectName} كورس محاضرات اشتراك`,
    `${teacherName} ${subjectName} نظام الحضور والمجموعات`,
    `${teacherName} ${subjectName} الواجب قبل المحاضرة القادمة`,
    `${teacherName} ${subjectName} امتحان قبل كل محاضرة`,
  ].map(value => normalized(value, 300)).filter(value => value.length > 0))];
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

type PublicEvidenceItem = { title: string; url: string; source: string; excerpt?: string; publishedAt?: string };

export function normalizeSocialSearchItems(
  teacherName: string,
  brandName: string,
  items: Array<Record<string, unknown>>,
): PublicEvidenceItem[] {
  const byUrl = new Map<string, PublicEvidenceItem>();
  for (const item of items) {
    const title = normalized(item.title ?? item.name ?? item.heading, 240);
    const url = normalized(item.link ?? item.url ?? item.href, 1_000);
    const excerpt = normalized(item.snippet ?? item.description ?? item.text ?? item.summary, 900);
    if (!title || !/^https:\/\/(?:www\.|m\.|mbasic\.)?(?:facebook\.com|instagram\.com|tiktok\.com)\//i.test(url)) continue;
    if (!teacherSourceMatches(teacherName, brandName, title, excerpt)) continue;
    if (byUrl.has(url)) continue;
    const platform = /facebook\.com/i.test(url) ? "Facebook" : /instagram\.com/i.test(url) ? "Instagram" : "TikTok";
    byUrl.set(url, {
      title, url, source: platform + " · " + title.slice(0, 120),
      ...(excerpt ? { excerpt } : {}),
      ...(typeof item.date === "string" ? { publishedAt: item.date.slice(0, 40) } : {}),
    });
  }
  return [...byUrl.values()].slice(0, 12);
}

async function collectSocialEvidence(teacherName: string, brandName: string, subjectName: string): Promise<PublicEvidenceItem[]> {
  const queries = [...new Set([
    `site:facebook.com "${teacherName}" "${subjectName}" سنتر بكالوريا`,
    `site:facebook.com "${teacherName}" "${subjectName}" أونلاين محاضرات`,
    `site:facebook.com "${brandName}" دفعة 2027 سنتر`,
    `site:instagram.com "${teacherName}" "${subjectName}"`,
    `site:tiktok.com "${teacherName}" "${subjectName}"`,
  ])];
  const responses = await Promise.allSettled(queries.map(query =>
    callDataApi("Google/search", { query: { gl: "EG", hl: "ar", q: query } }) as Promise<Record<string, unknown>>
  ));
  const items: Array<Record<string, unknown>> = [];
  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    const payload = response.value;
    const raw = Array.isArray(payload.items) ? payload.items
      : Array.isArray(payload.organic) ? payload.organic
      : Array.isArray(payload.organic_results) ? payload.organic_results
      : Array.isArray(payload.results) ? payload.results
      : [];
    items.push(...raw as Array<Record<string, unknown>>);
  }
  return normalizeSocialSearchItems(teacherName, brandName, items);
}

async function collectPublicTeacherEvidence(teacherName: string, brandName: string, subjectName: string): Promise<PublicEvidenceItem[]> {
  const [youtube, social] = await Promise.all([
    collectYouTubeEvidence(teacherName, brandName, subjectName),
    collectSocialEvidence(teacherName, brandName, subjectName).catch(error => {
      console.warn("[Teacher directory] Social search unavailable:", error instanceof Error ? error.message.slice(0, 180) : "unknown error");
      return [] as PublicEvidenceItem[];
    }),
  ]);
  const byUrl = new Map<string, PublicEvidenceItem>();
  for (const item of [...social, ...youtube]) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  return [...byUrl.values()].slice(0, 30);
}

async function classifyEvidence(
  teacherName: string,
  subjectName: string,
  scope: ResearchScope,
  evidence: TeacherCourseFactsInput["evidence"],
): Promise<TeacherResearchClassification> {
  const unavailable: TeacherResearchClassification = {
    availableModes: [] as Array<"center" | "online">,
    homeworkPolicy: "unknown" as const,
    homeworkRequiredBeforeNextLecture: "unknown" as const,
    preLectureExamRequired: "unknown" as const,
    confidence: "low" as const,
    verificationStatus: "insufficient_evidence" as const,
    evidence: [] as TeacherCourseFactsInput["evidence"],
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
  const modelConfidence = enumValue(parsed.confidence, ["low", "medium", "high"] as const, "low");
  const availableModes: Array<"center" | "online"> = Array.isArray(parsed.availableModes)
    ? [...new Set(parsed.availableModes.filter((mode: unknown): mode is "center" | "online" => mode === "center" || mode === "online"))]
    : [];
  const hasKnownClaim = availableModes.length > 0 || parsed.homeworkPolicy === "yes" || parsed.homeworkPolicy === "no" || parsed.homeworkPolicy === "varies"
    || parsed.homeworkRequiredBeforeNextLecture === "yes" || parsed.homeworkRequiredBeforeNextLecture === "no" || parsed.homeworkRequiredBeforeNextLecture === "varies"
    || parsed.preLectureExamRequired === "yes" || parsed.preLectureExamRequired === "no" || parsed.preLectureExamRequired === "varies";
  const hasSupportingEvidence = hasKnownClaim && selectedIndices.length >= 1;
  const confidence = hasSupportingEvidence ? modelConfidence : "low";
  const verificationStatus: TeacherResearchClassification["verificationStatus"] = !hasSupportingEvidence ? "insufficient_evidence"
    : confidence === "high" ? "verified"
      : confidence === "medium" ? "partial"
        : "insufficient_evidence";

  return {
    availableModes,
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
    let evidence: TeacherCourseFactsInput["evidence"] = [];
    let classified: TeacherResearchClassification;
    try {
      evidence = await collectPublicTeacherEvidence(teacher.nameAr, teacher.brandName, subject.nameAr);
      classified = await classifyEvidence(teacher.nameAr, subject.nameAr, scope, evidence);
    } catch (error) {
      console.warn("[Teacher directory] Research pipeline failed:", error instanceof Error ? error.message.slice(0, 250) : "unknown error");
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
    // Evidence collection and classification failures are cached for a short retry window.

    const now = new Date();
    const ttlHours = classified.verificationStatus === "research_failed" ? FAILURE_RETRY_HOURS
      : classified.verificationStatus === "insufficient_evidence" ? 72 : CACHE_DAYS * 24;
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
  const curated = scope.educationSystem === "EG_BACCALAUREATE"
    && scope.gradeYear === "الصف الثاني الثانوي – دفعة 2027"
    ? getCuratedTeacherDeliveryFacts(scope.teacherId)
    : null;
  if (curated) {
    const now = new Date();
    return {
      state: curated.verified ? "verified" : "insufficient_evidence",
      facts: {
        availableModes: curated.availableModes,
        homeworkPolicy: current?.homeworkPolicy as TeacherCourseFactsInput["homeworkPolicy"] ?? "unknown",
        homeworkRequiredBeforeNextLecture: current?.homeworkRequiredBeforeNextLecture as TeacherCourseFactsInput["homeworkRequiredBeforeNextLecture"] ?? "unknown",
        preLectureExamRequired: current?.preLectureExamRequired as TeacherCourseFactsInput["preLectureExamRequired"] ?? "unknown",
        confidence: curated.confidence,
        evidence: curated.evidence,
        checkedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000),
        isStale: false,
      },
    };
  }
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


export type DiscoveredTeacher = {
  found: boolean;
  nameAr: string;
  brandName: string;
  sourceUrl: string;
  availableModes: Array<"center" | "online">;
  confidence: "low" | "medium" | "high";
  evidence: Array<{ title: string; url: string; source: string }>;
  notes: string;
};

/** Discover a teacher from strict public channel matches; delivery modes remain unknown without evidence. */
export async function discoverTeacherForSubject(input: {
  teacherName: string;
  subjectId: string;
  educationSystem: "EG_BACCALAUREATE" | "EG_GENERAL_SECONDARY";
  gradeYear: string;
}): Promise<DiscoveredTeacher> {
  const teacherName = normalized(input.teacherName, 120);
  const subject = getSIESubject(input.subjectId);
  if (!subject) throw new Error("المادة المحددة غير موجودة في دليل الدراسة.");
  const empty: DiscoveredTeacher = {
    found: false, nameAr: teacherName, brandName: teacherName, sourceUrl: "",
    availableModes: [], confidence: "low", evidence: [],
    notes: "لم نعثر على قناة أو مصدر عام يطابق اسم المدرس بدرجة كافية.",
  };
  if (teacherName.length < 2) return empty;
  const sources = await collectPublicTeacherEvidence(teacherName, teacherName, subject.nameAr);
  if (!sources.length) return empty;
  const channelCounts = new Map<string, number>();
  for (const source of sources) {
    const channel = source.source.replace(/^(?:YouTube|Facebook|Instagram|TikTok)\s*·\s*/i, "").trim();
    if (channel) channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
  }
  const brandName = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? teacherName;
  const classification = await classifyEvidence(
    teacherName, subject.nameAr,
    { teacherId: "CUSTOM_TEACHER_DISCOVERY", subjectId: input.subjectId, educationSystem: input.educationSystem, gradeYear: input.gradeYear },
    sources,
  );
  return {
    found: true,
    nameAr: teacherName,
    brandName,
    sourceUrl: sources[0].url,
    availableModes: classification.confidence === "low" ? [] : classification.availableModes,
    confidence: classification.confidence,
    evidence: sources.slice(0, 5).map(source => ({ title: source.title, url: source.url, source: source.source })),
    notes: classification.notes || (classification.confidence === "low"
      ? "عثرنا على محتوى متطابق مع الاسم، لكن لم يظهر دليل كافٍ لتأكيد طرق الدراسة."
      : "تم فحص محتوى عام مرتبط بالمدرس. راجع المصدر للتأكد من تطابقه مع مدرسك."),
  };
}