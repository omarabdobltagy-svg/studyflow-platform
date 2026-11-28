import { getSIETeacher, getSIESubject, SIE_CATALOG_META } from "@shared/sie-catalog";

export type TeacherPublicUpdate = {
  externalId: string;
  teacherId: string;
  teacherName: string;
  sourceType: "youtube" | "facebook";
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  observedAt: string;
  durationMinutes?: number;
  announcementType?: "new_content" | "lecture_cancelled" | "class_suspended" | "schedule_changed" | "revision" | "general";
  confidence?: "high" | "medium" | "low";
  affectedDate?: string;
  contentAnalysis?: TeacherVideoContentAnalysis;
  /** Scoped verification derived only from a substantive public YouTube description. */
  descriptionMatch?: {
    subjectId: string;
    branchId: string;
    topics: string[];
    verifiedAt: string;
  };
};

export type TeacherVideoTopicSegment = {
  titleAr: string;
  descriptionAr: string;
  startSeconds: number;
  endSeconds: number;
  subjectHints: string[];
  branchHints: string[];
  curriculumKeywords: string[];
  confidence: "high" | "medium" | "low";
};

export type TeacherVideoInstruction = {
  instructionAr: string;
  kind: "homework" | "exam" | "platform_content" | "deadline" | "scope" | "other";
  startSeconds?: number;
  confidence: "high" | "medium" | "low";
  explicit: boolean;
};

export type TeacherVideoContentAnalysis = {
  /** Semantic classification inferred from the video itself, independent of title keywords. */
  contentType?: "revision" | "lesson" | "announcement" | "mixed" | "unknown";
  status: "processing" | "retry_wait" | "complete" | "failed";
  interactionId?: string;
  model?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount?: number;
  nextRetryAt?: string;
  error?: string;
  summaryAr?: string;
  topics?: TeacherVideoTopicSegment[];
  teacherInstructions?: TeacherVideoInstruction[];
  topicsNotCovered?: string[];
};

export type TeacherAnnouncementType = NonNullable<TeacherPublicUpdate["announcementType"]>;

function normalizeAnnouncementText(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[ـً-ٟ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Only explicit, unambiguous teacher statements can change a student's timetable.
 * New YouTube uploads are content updates, not evidence of a cancelled class.
 */
export function classifyTeacherAnnouncement(
  title: string,
  description: string,
  sourceType: "youtube" | "facebook",
): { announcementType: TeacherAnnouncementType; confidence: "high" | "medium" | "low" } {
  const text = normalizeAnnouncementText(title + " " + description);
  const cancelled = [
    /تم الغاء المحاضره/,
    /المحاضره اتلغت/,
    /المحاضره ملغيه/,
    /مش هيكون فيه محاضره/,
    /مفيش محاضره( اليوم)?/,
    /لا توجد محاضره( اليوم)?/,
    /no class today/,
    /class cancelled/,
    /class canceled/,
    /lecture cancelled/,
    /lecture canceled/,
  ];
  const suspended = [
    /اجازه من المحاضرات/,
    /راحه من المحاضرات/,
    /هنريح من المحاضرات/,
    /مفيش محاضرات( اليوم| الاسبوع ده)?/,
    /مش هننزل محاضرات/,
    /توقف المحاضرات/,
    /وقف المحاضرات/,
    /تعليق المحاضرات/,
    /classes are suspended/,
    /classes suspended/,
    /break from lectures/,
  ];
  const changed = [
    /تغيير موعد المحاضره/,
    /المحاضره اتنقلت/,
    /تأجيل المحاضره/,
    /تم تأجيل المحاضره/,
    /ميعاد المحاضره اتغير/,
    /موعد المحاضره الجديد/,
    /lecture rescheduled/,
    /class rescheduled/,
    /new lecture time/,
  ];
  const revision = [
    /مراجعه نهائيه/,
    /مراجعه شامله/,
    /مراجعه على/,
    /revision session/,
    /final revision/,
  ];
  if (cancelled.some(pattern => pattern.test(text))) return { announcementType: "lecture_cancelled", confidence: "high" };
  if (suspended.some(pattern => pattern.test(text))) return { announcementType: "class_suspended", confidence: "high" };
  if (changed.some(pattern => pattern.test(text))) return { announcementType: "schedule_changed", confidence: "high" };
  if (revision.some(pattern => pattern.test(text))) return { announcementType: "revision", confidence: sourceType === "youtube" ? "medium" : "low" };
  if (sourceType === "youtube") return { announcementType: "new_content", confidence: "medium" };
  return { announcementType: "general", confidence: "low" };
}

export function classifyTeacherPublicUpdate<T extends TeacherPublicUpdate>(update: T): T {
  const classified = classifyTeacherAnnouncement(update.title, update.description, update.sourceType);
  return { ...update, ...classified };
}

export function isHighConfidenceScheduleAnnouncement(
  update: Pick<TeacherPublicUpdate, "announcementType" | "confidence">,
): boolean {
  return update.confidence === "high"
    && ["lecture_cancelled", "class_suspended", "schedule_changed"].includes(update.announcementType ?? "");
}

export type TeacherSourceScanResult = {
  updates: TeacherPublicUpdate[];
  scanState: Record<string, string>;
  resolvedChannels: Record<string, string>;
};

const YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  T_AR_MOHAMED_SALAH: "UCdur25RCItdfoXA89ORWSkw",
  T_EN_MAHMOUD_RADWAN: "UCndPJfSCMRiJTI2QuCqjn_Q",
  T_HIS_AHMED_GHONIEM: "UCDNYAiloNfFoMCvKmrsaA4g",
  T_HIS_ABDELHADY: "UCThV5LrCMIWs9tyDvZ9IC2w",
  T_PROG_KHALED_ASHRAF: "UClvKiBCF_fSF_CU_jZ8tZcA",
};

function normalizeYoutubeChannelText(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9ء-ي]+/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function youtubeChannelMatchesTeacher(channelTitle: string, teacherName: string, brandName: string): boolean {
  const channel = normalizeYoutubeChannelText(channelTitle);
  if (!channel) return false;
  return [teacherName, brandName]
    .map(normalizeYoutubeChannelText)
    .filter(alias => alias.length >= 4)
    .some(alias => channel.includes(alias));
}

async function searchTeacherYoutubeChannelId(teacherId: string, apiKey: string): Promise<string | null> {
  const teacher = getSIETeacher(teacherId);
  if (!teacher) return null;
  const subjectName = teacher.subjectIds
    .map(subjectId => getSIESubject(subjectId)?.nameAr)
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const query = [teacher.nameAr, teacher.brandName, subjectName].filter(Boolean).join(" ");
  if (!query.trim()) return null;
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "channel");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);
  const response = await fetchJson(url.toString());
  const items = Array.isArray(response.items) ? response.items as Array<Record<string, any>> : [];
  for (const item of items) {
    const channelId = typeof item.id?.channelId === "string" ? item.id.channelId : "";
    const channelTitle = typeof item.snippet?.title === "string" ? item.snippet.title : "";
    if (/^UC[\w-]{20,}$/.test(channelId)
      && youtubeChannelMatchesTeacher(channelTitle, teacher.nameAr, teacher.brandName)) {
      return channelId;
    }
  }
  return null;
}

const SOURCE_SCAN_INTERVAL_MS = 45 * 60 * 1_000;
const MAX_UPDATES_PER_SCAN = 12;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function xmlTag(entry: string, tag: string) {
  const match = entry.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">"));
  return match ? decodeXml(match[1].trim()) : "";
}

export function parseYoutubeAtomFeed(
  xml: string,
  teacher: { teacherId: string; teacherName: string },
  observedAt = new Date(),
): TeacherPublicUpdate[] {
  const entries = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/g) ?? [];
  return entries.flatMap(entry => {
    const videoId = xmlTag(entry, "yt:videoId");
    const title = xmlTag(entry, "title");
    const publishedAt = xmlTag(entry, "published");
    const description = xmlTag(entry, "media:description").slice(0, 2_200);
    if (!videoId || !title || !Number.isFinite(Date.parse(publishedAt))) return [];
    return [{
      externalId: "youtube:" + videoId,
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      sourceType: "youtube" as const,
      title: title.slice(0, 240),
      description,
      url: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
      publishedAt: new Date(publishedAt).toISOString(),
      observedAt: observedAt.toISOString(),
    }];
  });
}

export function parseYoutubeDurationMinutes(duration: string): number | undefined {
  const match = duration.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  const totalSeconds = Number(match[1] ?? 0) * 86_400
    + Number(match[2] ?? 0) * 3_600
    + Number(match[3] ?? 0) * 60
    + Number(match[4] ?? 0);
  return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : undefined;
}

export function shouldScanTeacherSource(lastScannedAt: string | undefined, now = Date.now()) {
  if (!lastScannedAt) return true;
  const timestamp = Date.parse(lastScannedAt);
  return !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= SOURCE_SCAN_INTERVAL_MS;
}

export type TeacherMonitoringProfile = {
  educationSystem?: string;
  gradeYear?: string;
  subjectIds?: string[];
  teacherSelections?: Record<string, string>;
  selection?: Record<string, any>;
};

export function isSecondYearBaccalaureateProfile(profile: TeacherMonitoringProfile): boolean {
  return profile.educationSystem === "baccalaureate"
    && String(profile.gradeYear ?? "").trim() === SIE_CATALOG_META.gradeYear
    && Array.isArray(profile.subjectIds)
    && profile.subjectIds.some(subjectId => /_G2_BAC$/.test(subjectId));
}

export function isSecondYearBaccalaureateUpdate(update: { title?: unknown; description?: unknown }): boolean {
  const text = (String(update.title ?? "") + " " + String(update.description ?? ""))
    .normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ً-ٰٟـ]/g, "");
  const hasBaccalaureateMarker = /بكالوريا|baccalaureate|(?:^|\W)2\s*bac(?:calaureate)?(?:$|\W)|(?:^|\W)bac\s*2(?:$|\W)/iu.test(text);
  const hasSecondYearMarker = /الصف\s*الثاني|ثاني\s*(?:ثانوي|الثانوي)|تاني(?:ة)?\s*(?:ثانوي|بكالوريا)|الثانيه|الثانية|second\s*(?:year|secondary)|2nd\s*(?:year|secondary)|grade\s*11|\bg11\b|(?:^|\W)2\s*bac(?:calaureate)?(?:$|\W)/iu.test(text);
  const hasOtherYearMarker = /(?:الصف|دفعة|سنة)\s*(?:الأول|الأولى|الاول|اولى|الثالث|الثالثة|تالتة)|(?:الأول|الأولى|اولى|الثالث|الثالثة|تالتة)\s*بكالوريا|(?:first|third)\s*(?:year|secondary|bac)|(?:1st|3rd)\s*(?:year|secondary)|grade\s*(?:10|12)|\bg(?:10|12)\b/iu.test(text);
  return hasBaccalaureateMarker && hasSecondYearMarker && !hasOtherYearMarker;
}
export function selectedTeacherIds(profile: TeacherMonitoringProfile): string[] {
  if (!isSecondYearBaccalaureateProfile(profile)) return [];
  const selection = profile.selection ?? {};
  const choices = {
    ...(profile.teacherSelections ?? {}),
    ...((selection.teacherChoices && typeof selection.teacherChoices === "object") ? selection.teacherChoices : {}),
  } as Record<string, string>;
  const subjectIds = new Set(profile.subjectIds ?? []);
  const validTeacherIds = Object.entries(choices).flatMap(([subjectId, teacherId]) => {
    if (!subjectIds.has(subjectId) || !/_G2_BAC$/.test(subjectId)) return [];
    if (typeof teacherId !== "string" || !teacherId || teacherId === "__SKIP__" || teacherId === "__DEFERRED__") return [];
    const teacher = getSIETeacher(teacherId);
    const courseStatus = teacher?.systemCourseVerification?.EG_BACCALAUREATE;
    if (!teacher || !teacher.subjectIds.includes(subjectId) || !courseStatus || courseStatus === "not_verified_for_2026_2027") return [];
    return [teacherId];
  });
  return [...new Set(validTeacherIds)];
}

export function acceptedAlternativeReviewVideoIds(profile: TeacherMonitoringProfile): Set<string> {
  if (!isSecondYearBaccalaureateProfile(profile)) return new Set();
  const selection = profile.selection ?? {};
  const raw = selection.acceptedAlternativeReviewVideoIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((value): value is string =>
    typeof value === "string" && /^youtube:[A-Za-z0-9_-]{6,20}$/.test(value)
  ));
}

export function isTeacherVideoUpdateAllowed(
  profile: TeacherMonitoringProfile,
  update: Pick<TeacherPublicUpdate, "teacherId" | "externalId">,
): boolean {
  return selectedTeacherIds(profile).includes(update.teacherId)
    || acceptedAlternativeReviewVideoIds(profile).has(update.externalId);
}

export function getAcceptedAlternativeReviewContext(
  profile: TeacherMonitoringProfile,
  externalId: string,
): { subjectId: string; branchId: string } | undefined {
  if (!acceptedAlternativeReviewVideoIds(profile).has(externalId)) return undefined;
  const selection = profile.selection ?? {};
  const contexts = selection.acceptedAlternativeReviewContext;
  if (!contexts || typeof contexts !== "object" || Array.isArray(contexts)) return undefined;
  const context = contexts[externalId];
  if (!context || typeof context !== "object") return undefined;
  const subjectId = typeof context.subjectId === "string" ? context.subjectId : "";
  const branchId = typeof context.branchId === "string" ? context.branchId : "";
  if (!profile.subjectIds?.includes(subjectId) || !/_G2_BAC$/.test(subjectId)
    || !/^[A-Z0-9_-]{2,120}$/.test(branchId)) return undefined;
  return { subjectId, branchId };
}

function configuredFacebookPageIds(): Record<string, string> {
  const raw = process.env.STUDYFLOW_TEACHER_FACEBOOK_PAGES;
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter(([teacherId, pageId]) =>
      /^[A-Z0-9_-]{3,80}$/.test(teacherId) && typeof pageId === "string" && /^[0-9]{5,40}$/.test(pageId)
    )) as Record<string, string>;
  } catch {
    return {};
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "StudyFlow-Teacher-Updates/1.0 (+public-channel-monitor)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Public teacher source returned HTTP " + response.status);
  return response.text();
}



const YOUTUBE_API_KEY_PROBE_INTERVAL_MS = 15 * 60 * 1_000;
let youtubeApiKeyProbeAt = 0;
let youtubeApiKeyProbeInFlight: Promise<void> | null = null;

async function probeYoutubeApiKey(apiKey: string, now = Date.now()): Promise<void> {
  if (youtubeApiKeyProbeInFlight) return youtubeApiKeyProbeInFlight;
  if (now - youtubeApiKeyProbeAt < YOUTUBE_API_KEY_PROBE_INTERVAL_MS) return;

  youtubeApiKeyProbeAt = now;
  const task = (async () => {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("part", "id");
      url.searchParams.set("id", "UCdur25RCItdfoXA89ORWSkw");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url, {
        headers: { "user-agent": "StudyFlow-YouTube-Key-Probe/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) {
        const payload = await response.json() as Record<string, any>;
        const channelFound = Array.isArray(payload.items) && payload.items.length > 0;
        console.info("[StudyFlow YouTube API] API key accepted", {
          httpStatus: response.status,
          channelFound,
        });
        return;
      }
      const payload = await response.json().catch(() => ({})) as Record<string, any>;
      const apiStatus = typeof payload.error?.status === "string" ? payload.error.status : "unknown";
      const apiReason = Array.isArray(payload.error?.errors) && typeof payload.error.errors[0]?.reason === "string"
        ? payload.error.errors[0].reason
        : "unknown";
      console.warn("[StudyFlow YouTube API] API key rejected or unavailable", {
        httpStatus: response.status,
        apiStatus,
        apiReason,
      });
    } catch (error) {
      console.warn("[StudyFlow YouTube API] Key probe request failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  })();

  youtubeApiKeyProbeInFlight = task;
  try {
    await task;
  } finally {
    if (youtubeApiKeyProbeInFlight === task) youtubeApiKeyProbeInFlight = null;
  }
}

function getTeacherProfileChannelId(profileUrl: string): string | null {
  try {
    const parsed = new URL(profileUrl);
    const idFromQuery = parsed.searchParams.get("id");
    const idFromPath = parsed.pathname.match(/(?:^|\\/)channel\\/(UC[\\w-]{20,})(?:\\/|$)/i)?.[1]
      ?? parsed.pathname.match(/(?:^|\\/)(UC[\\w-]{20,})(?:\\/|$)/i)?.[1];
    const candidate = idFromQuery ?? idFromPath;
    return candidate && /^UC[\\w-]{20,}$/i.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function getTeacherProfileVideoId(profileUrl: string): string | null {
  try {
    const parsed = new URL(profileUrl);
    const host = parsed.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "www.zolotube.com", "zolotube.com"].includes(host)) return null;
    const candidate = host.endsWith("youtu.be")
      ? parsed.pathname.replace(/^\\/+/, "").split("/")[0]
      : parsed.searchParams.get("v") ?? parsed.pathname.match(/^\\/(?:shorts|embed)\\/([A-Za-z0-9_-]{6,20})/)?.[1] ?? null;
    return candidate && /^[A-Za-z0-9_-]{6,20}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export async function resolveTeacherYoutubeChannelId(teacherId: string, savedChannelId?: string): Promise<string | null> {
  const known = YOUTUBE_CHANNEL_IDS[teacherId];
  if (known) return known;
  if (savedChannelId && /^UC[\\w-]{20,}$/.test(savedChannelId)) return savedChannelId;
  const teacher = getSIETeacher(teacherId);
  if (!teacher) return null;
  const profileUrl = teacher.profileUrl ?? "";
  const directChannelId = getTeacherProfileChannelId(profileUrl);
  if (directChannelId) return directChannelId;
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return null;

  const handle = profileUrl.match(/youtube\\.com\\/@([^/?]+)/i)?.[1];
  if (handle) {
    const result = await fetchJson(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle="
        + encodeURIComponent("@" + handle) + "&key=" + encodeURIComponent(apiKey)
    );
    const items = Array.isArray(result.items) ? result.items as Array<Record<string, any>> : [];
    const match = items.find(item => typeof item.id === "string"
      && /^UC[\\w-]{20,}$/.test(item.id)
      && youtubeChannelMatchesTeacher(String(item.snippet?.title ?? ""), teacher.nameAr, teacher.brandName));
    if (match?.id) return match.id as string;
  }

  // Some teacher catalogs link to a sample video, not to the channel page. Resolve its
  // channel with the low-cost videos.list endpoint instead of a broad channel search.
  const profileVideoId = getTeacherProfileVideoId(profileUrl);
  if (profileVideoId) {
    const result = await fetchJson(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet&id="
        + encodeURIComponent(profileVideoId) + "&key=" + encodeURIComponent(apiKey)
    );
    const items = Array.isArray(result.items) ? result.items as Array<Record<string, any>> : [];
    const item = items[0];
    const channelId = typeof item?.snippet?.channelId === "string" ? item.snippet.channelId : "";
    const channelTitle = typeof item?.snippet?.channelTitle === "string" ? item.snippet.channelTitle : "";
    if (/^UC[\\w-]{20,}$/.test(channelId)
      && youtubeChannelMatchesTeacher(channelTitle, teacher.nameAr, teacher.brandName)) return channelId;
  }

  return searchTeacherYoutubeChannelId(teacherId, apiKey);
}

async function fetchJson(url: string, accessToken?: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "StudyFlow-Teacher-Updates/1.0 (+public-page-monitor)",
      ...(accessToken ? { authorization: "Bearer " + accessToken } : {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Public teacher page returned HTTP " + response.status);
  return response.json() as Promise<Record<string, any>>;
}

export async function scanSelectedTeacherSources(
  profile: TeacherMonitoringProfile,
  now = new Date(),
): Promise<TeacherSourceScanResult> {
  const selection = profile.selection ?? {};
  const previousState = (selection.teacherPublicScanState && typeof selection.teacherPublicScanState === "object")
    ? selection.teacherPublicScanState as Record<string, string>
    : {};
  const selectedIds = selectedTeacherIds(profile);
  const savedChannels = selection.teacherYoutubeChannels && typeof selection.teacherYoutubeChannels === "object"
    ? selection.teacherYoutubeChannels as Record<string, string>
    : {};
  const resolvedChannels: Record<string, string> = {};
  if (!isSecondYearBaccalaureateProfile(profile) || selectedIds.length === 0) {
    return { updates: [], scanState: previousState, resolvedChannels };
  }
  const youtubeApiKey = process.env.YOUTUBE_API_KEY?.trim() ?? "";
  if (youtubeApiKey) await probeYoutubeApiKey(youtubeApiKey, now.getTime());
  const facebookPages = configuredFacebookPageIds();
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v27.0";
  const tasks: Promise<{ key: string; updates: TeacherPublicUpdate[]; channelId?: string } | null>[] = [];

  for (const teacherId of selectedIds) {
    const teacher = getSIETeacher(teacherId);
    const teacherName = teacher?.nameAr ?? teacherId;
    const teacherYoutubeUrl = teacher?.profileUrl ?? "";
    const directChannelId = YOUTUBE_CHANNEL_IDS[teacherId]
      ?? savedChannels[teacherId]
      ?? getTeacherProfileChannelId(teacherYoutubeUrl);
    const youtubeKey = teacherId + ":youtube";
    if (shouldScanTeacherSource(previousState[youtubeKey], now.getTime())) {
      tasks.push((async () => {
        let channelId: string | undefined = directChannelId;
        if (!channelId) {
          channelId = await resolveTeacherYoutubeChannelId(teacherId, savedChannels[teacherId]) ?? undefined;
        }
        if (!channelId) return { key: youtubeKey, updates: [] };
        const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId));
        return {
          key: youtubeKey,
          updates: parseYoutubeAtomFeed(xml, { teacherId, teacherName }, now),
          channelId,
        };
      })().catch(() => null));
    }

    const pageId = facebookPages[teacherId];
    const facebookKey = teacherId + ":facebook";
    if (pageId && pageToken && shouldScanTeacherSource(previousState[facebookKey], now.getTime())) {
      tasks.push((async () => {
        const url = new URL("https://graph.facebook.com/" + graphVersion + "/" + encodeURIComponent(pageId) + "/feed");
        url.searchParams.set("fields", "id,message,story,created_time,permalink_url");
        url.searchParams.set("limit", "10");
        const payload = await fetchJson(url.toString(), pageToken);
        const posts = Array.isArray(payload.data) ? payload.data as Array<Record<string, unknown>> : [];
        const updates = posts.flatMap((item: Record<string, unknown>) => {
          const externalId = typeof item.id === "string" ? item.id : "";
          const title = String(item.story ?? item.message ?? "").trim();
          const publishedAt = String(item.created_time ?? "");
          if (!externalId || !title || !Number.isFinite(Date.parse(publishedAt))) return [];
          return [{
            externalId: "facebook:" + externalId,
            teacherId,
            teacherName,
            sourceType: "facebook" as const,
            title: title.slice(0, 240),
            description: String(item.message ?? item.story ?? "").slice(0, 1_200),
            url: typeof item.permalink_url === "string" ? item.permalink_url : "https://www.facebook.com/" + externalId,
            publishedAt: new Date(publishedAt).toISOString(),
            observedAt: now.toISOString(),
          }];
        });
        return { key: facebookKey, updates };
      })().catch(() => null));
    }
  }

  const settled = await Promise.all(tasks);
  const scanState = { ...previousState };
  const updates: TeacherPublicUpdate[] = [];
  for (const item of settled) {
    if (!item) continue;
    scanState[item.key] = now.toISOString();
    updates.push(...item.updates);
    if (item.channelId) {
      const teacherId = item.key.replace(/:youtube$/, "");
      resolvedChannels[teacherId] = item.channelId;
    }
  }
  let orderedUpdates = updates
    .map(classifyTeacherPublicUpdate)
    // These uploads come from the verified public channel of a selected teacher.
    // Keep recent videos even when the title omits a grade marker; Gemini must map
    // actual segments to this student's official curriculum before creating tasks.
    .filter(update => update.sourceType === "youtube"
      || isSecondYearBaccalaureateUpdate(update)
      || isHighConfidenceScheduleAnnouncement(update))
    .filter(update => now.getTime() - Date.parse(update.publishedAt) <= 30 * 24 * 60 * 60 * 1_000)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MAX_UPDATES_PER_SCAN);

  const apiKey = youtubeApiKey;
  const videoIds = orderedUpdates
    .filter(update => update.sourceType === "youtube")
    .map(update => update.externalId.replace(/^youtube:/, ""));
  if (apiKey && videoIds.length) {
    try {
      const metadata = await fetchJson(
        "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id="
          + encodeURIComponent(videoIds.join(",")) + "&key=" + encodeURIComponent(apiKey),
      );
      const durationById = new Map<string, number>();
      for (const video of Array.isArray(metadata.items) ? metadata.items : []) {
        const minutes = typeof video.contentDetails?.duration === "string"
          ? parseYoutubeDurationMinutes(video.contentDetails.duration)
          : undefined;
        if (typeof video.id === "string" && minutes) durationById.set(video.id, minutes);
      }
      orderedUpdates = orderedUpdates.map(update => {
        const videoId = update.externalId.replace(/^youtube:/, "");
        const durationMinutes = durationById.get(videoId);
        return durationMinutes ? { ...update, durationMinutes } : update;
      });
    } catch {
      // Duration enrichments are optional; title, description and source link remain usable.
    }
  }

  return { updates: orderedUpdates, scanState, resolvedChannels };
}
