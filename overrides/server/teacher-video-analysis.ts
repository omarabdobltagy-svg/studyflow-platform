import { z } from "zod";

const INTERACTIONS_BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";

export const TeacherVideoAnalysisSchema = z.object({
  summaryAr: z.string().trim().min(10).max(2_000),
  topics: z.array(z.object({
    titleAr: z.string().trim().min(2).max(180),
    descriptionAr: z.string().trim().min(5).max(700),
    startSeconds: z.number().int().nonnegative(),
    endSeconds: z.number().int().positive(),
    subjectHints: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
    branchHints: z.array(z.string().trim().min(1).max(100)).max(5).default([]),
    curriculumKeywords: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
    confidence: z.enum(["high", "medium", "low"]).default("medium"),
  }).refine(topic => topic.endSeconds > topic.startSeconds)).max(60),
  teacherInstructions: z.array(z.object({
    instructionAr: z.string().trim().min(5).max(400),
    kind: z.enum(["homework", "exam", "platform_content", "deadline", "scope", "other"]),
    startSeconds: z.number().int().nonnegative().optional(),
    confidence: z.enum(["high", "medium", "low"]),
    explicit: z.boolean(),
  })).max(30).default([]),
  topicsNotCovered: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
}).strict();

export type TeacherVideoAnalysis = z.infer<typeof TeacherVideoAnalysisSchema>;

type GeminiInteractionState =
  | { status: "in_progress"; interactionId: string; model: string }
  | { status: "completed"; interactionId: string; model: string; analysis: TeacherVideoAnalysis }
  | { status: "failed"; interactionId: string; model: string; error: string; errorCode?: string; retryable: boolean };

function getApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || "";
}

function allowedYoutubeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(host)) return null;
    if (host.endsWith("youtu.be")) return url.pathname.replace(/^\/+/, "").trim() ? url.toString() : null;
    const videoId = url.searchParams.get("v");
    if (videoId) return "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId);
    if (/^\/(?:embed|shorts)\/[A-Za-z0-9_-]{6,}$/.test(url.pathname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function extractOutputText(payload: Record<string, any>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const outputs = steps.filter((step: any) => step?.type === "model_output").reverse();
  for (const output of outputs) {
    const text = Array.isArray(output.content)
      ? output.content.filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text).join("\n")
      : "";
    if (text.trim()) return text;
  }
  return "";
}

function parseAnalysis(raw: string): TeacherVideoAnalysis {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Gemini returned no structured video analysis.");
    value = JSON.parse(cleaned.slice(start, end + 1));
  }
  return TeacherVideoAnalysisSchema.parse(value);
}

async function requestJson(url: string, apiKey: string, init?: RequestInit): Promise<Record<string, any>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; }
  catch { payload = { raw: raw.slice(0, 1_000) }; }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || raw.slice(0, 600);
    throw new Error("Gemini video API " + response.status + ": " + message);
  }
  return payload;
}

export function isTeacherVideoAnalysisConfigured(): boolean {
  return Boolean(getApiKey());
}

/** Starts agentic analysis of a public YouTube video; the video is not downloaded by StudyFlow. */
export async function startTeacherVideoAnalysis(input: {
  url: string;
  videoTitle: string;
  teacherName: string;
  selectedSubjects: string[];
}): Promise<{ interactionId: string; model: string }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const videoUrl = allowedYoutubeUrl(input.url);
  if (!videoUrl) throw new Error("Only a public YouTube video URL can be analyzed.");

  const model = process.env.GEMINI_VIDEO_MODEL?.trim() || "gemini-3.8-flash";
  const prompt = [
    "أنت محلل محتوى تعليمي. حلّل الفيديو نفسه عبر الصوت والصورة والنص المتاح داخل الفيديو، ولا تعتمد على العنوان أو الوصف وحدهما.",
    "لغة النتيجة عربية واضحة. أخرج JSON فقط مطابقًا للمخطط المطلوب.",
    "استخرج التقسيم الحقيقي للمراجعة إلى موضوعات مستقلة ومترابطة. لا تقسّم الفيديو إلى فواصل زمنية ثابتة. كل جزء يجب أن يمثل موضوعًا دراسيًا فعليًا أو انتقالًا واضحًا بين فروع.",
    "لكل موضوع أعد: titleAr، descriptionAr، startSeconds، endSeconds، subjectHints، branchHints، curriculumKeywords، confidence.",
    "استخدم طوابع زمنية تقديرية دقيقة قدر الإمكان من الفيديو. إذا تعذر تحديد بداية أو نهاية موضوع بدقة، قلل الثقة ولا تخترع حدودًا زائفة.",
    "استخرج تعليمات المدرس الصريحة فقط: واجب، امتحان، جزء على منصة أخرى، موعد تسليم، نطاق ما يدخل أو لا يدخل. لا تحوّل عبارة عامة أو توقعًا إلى تكليف إلزامي.",
    "ميّز بين ما شرحه المدرس فعلًا، وما ذكر أنه موجود في المنصة، وما لم يتطرق إليه. لا تعتبر كل عنوان في الوصف جزءًا مشروحًا.",
    "لا تنشئ أسئلة أو واجبات أو اختبارات من عندك. لا تضف موضوعًا لم يرد في الفيديو.",
    "بيانات الفيديو: " + input.videoTitle,
    "المدرس: " + input.teacherName,
    "مواد الطالب المحددة: " + input.selectedSubjects.join("، "),
    "المخطط: {summaryAr:string,topics:[{titleAr,descriptionAr,startSeconds,endSeconds,subjectHints,branchHints,curriculumKeywords,confidence}],teacherInstructions:[{instructionAr,kind,startSeconds?,confidence,explicit}],topicsNotCovered:string[]}.",
  ].join("\n");

  const result = await requestJson(INTERACTIONS_BASE, apiKey, {
    method: "POST",
    body: JSON.stringify({
      model,
      input: [
        { type: "video", uri: videoUrl, processing: "agentic" },
        { type: "text", text: prompt },
      ],
      background: true,
    }),
  });
  const interactionId = typeof result.id === "string" ? result.id : "";
  if (!interactionId) throw new Error("Gemini did not return an interaction ID.");
  return { interactionId, model };
}

export async function getTeacherVideoAnalysis(interactionId: string): Promise<GeminiInteractionState> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  if (!/^v1_[A-Za-z0-9_-]+$/.test(interactionId)) throw new Error("Invalid Gemini interaction ID.");
  const payload = await requestJson(INTERACTIONS_BASE + "/" + encodeURIComponent(interactionId), apiKey, { method: "GET" });
  const model = typeof payload.model === "string" ? payload.model : process.env.GEMINI_VIDEO_MODEL || "gemini-3.8-flash";
  if (payload.status === "failed" || payload.status === "cancelled") {
    const rawErrors = Array.isArray(payload.errors) ? payload.errors : [];
    const primaryError = payload.error && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : {};
    const firstNestedError = rawErrors.find((item: unknown) => item && typeof item === "object") as Record<string, unknown> | undefined;
    const rawCode = primaryError.code ?? firstNestedError?.code ?? payload.error_code ?? payload.code;
    const rawMessage = primaryError.message ?? firstNestedError?.message
      ?? (typeof payload.error === "string" ? payload.error : undefined)
      ?? payload.message;
    const errorCode = rawCode === undefined || rawCode === null ? undefined : String(rawCode).slice(0, 80);
    const message = typeof rawMessage === "string" && rawMessage.trim()
      ? rawMessage.trim()
      : "Gemini interaction ended with status " + String(payload.status) + " without a provider error message.";
    const numericCode = Number(errorCode);
    const retryable = payload.status !== "cancelled" && (
      [408, 429, 500, 502, 503, 504].includes(numericCode)
      || /api_error|internal|unavailable|resource[_ -]?exhausted|deadline[_ -]?exceeded|rate[_ -]?limit/i.test(errorCode || "")
      || /high demand|temporar|deadline|timed? out|quota|resource exhausted|service unavailable|internal error/i.test(message)
      || (!errorCode && !rawMessage)
    );
    return {
      status: "failed",
      interactionId,
      model,
      error: message.slice(0, 500),
      ...(errorCode ? { errorCode } : {}),
      retryable,
    };
  }
  if (payload.status !== "completed") return { status: "in_progress", interactionId, model };
  const output = extractOutputText(payload);
  if (!output) throw new Error("Gemini completed without a final model output.");
  return { status: "completed", interactionId, model, analysis: parseAnalysis(output) };
}
