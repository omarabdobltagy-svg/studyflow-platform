import { getSIETeacher } from "@shared/sie-catalog";

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
};

export type TeacherSourceScanResult = {
  updates: TeacherPublicUpdate[];
  scanState: Record<string, string>;
};

const YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  T_AR_MOHAMED_SALAH: "UCdur25RCItdfoXA89ORWSkw",
  T_EN_MAHMOUD_RADWAN: "UCndPJfSCMRiJTI2QuCqjn_Q",
};

const SOURCE_SCAN_INTERVAL_MS = 45 * 60 * 1_000;
const MAX_UPDATES_PER_SCAN = 12;

function decodeXml(value: string) {
  return value
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
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;
  const totalSeconds = Number(match[1] ?? 0) * 3_600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return totalSeconds > 0 ? Math.ceil(totalSeconds / 60) : undefined;
}

export function shouldScanTeacherSource(lastScannedAt: string | undefined, now = Date.now()) {
  if (!lastScannedAt) return true;
  const timestamp = Date.parse(lastScannedAt);
  return !Number.isFinite(timestamp) || timestamp > now || now - timestamp >= SOURCE_SCAN_INTERVAL_MS;
}

function selectedTeacherIds(profile: {
  teacherSelections?: Record<string, string>;
  selection?: Record<string, any>;
}) {
  const selection = profile.selection ?? {};
  const choices = {
    ...(profile.teacherSelections ?? {}),
    ...((selection.teacherChoices && typeof selection.teacherChoices === "object") ? selection.teacherChoices : {}),
  } as Record<string, string>;
  return [...new Set(Object.values(choices))]
    .filter((id): id is string => typeof id === "string" && !!id && id !== "__SKIP__" && id !== "__DEFERRED__");
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

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "StudyFlow-Teacher-Updates/1.0 (+public-page-monitor)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Public teacher page returned HTTP " + response.status);
  return response.json() as Promise<Record<string, any>>;
}

export async function scanSelectedTeacherSources(
  profile: {
    teacherName?: string;
    teacherSelections?: Record<string, string>;
    selection?: Record<string, any>;
  },
  now = new Date(),
): Promise<TeacherSourceScanResult> {
  const selection = profile.selection ?? {};
  const previousState = (selection.teacherPublicScanState && typeof selection.teacherPublicScanState === "object")
    ? selection.teacherPublicScanState as Record<string, string>
    : {};
  const selectedIds = selectedTeacherIds(profile);
  const facebookPages = configuredFacebookPageIds();
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v27.0";
  const tasks: Promise<{ key: string; updates: TeacherPublicUpdate[] } | null>[] = [];

  for (const teacherId of selectedIds) {
    const teacher = getSIETeacher(teacherId);
    const teacherName = teacher?.nameAr ?? teacherId;
    const teacherYoutubeUrl = teacher?.profileUrl ?? "";
    const directChannelId = YOUTUBE_CHANNEL_IDS[teacherId] ?? teacherYoutubeUrl.match(/youtube\.com\/channel\/(UC[\w-]+)/i)?.[1];
    const youtubeKey = teacherId + ":youtube";
    if (shouldScanTeacherSource(previousState[youtubeKey], now.getTime())) {
      tasks.push((async () => {
        let channelId = directChannelId;
        const handle = teacherYoutubeUrl.match(/youtube\.com\/@([^/?]+)/i)?.[1];
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!channelId && handle && apiKey) {
          const channelResponse = await fetchJson("https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=" + encodeURIComponent("@" + handle) + "&key=" + encodeURIComponent(apiKey));
          const channelItems = Array.isArray(channelResponse.items) ? channelResponse.items : [];
          channelId = typeof channelItems[0]?.id === "string" ? String(channelItems[0].id) : undefined;
        }
        if (!channelId) return { key: youtubeKey, updates: [] };
        const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId));
        return { key: youtubeKey, updates: parseYoutubeAtomFeed(xml, { teacherId, teacherName }, now) };
      })().catch(() => null));
    }

    const pageId = facebookPages[teacherId];
    const facebookKey = teacherId + ":facebook";
    if (pageId && pageToken && shouldScanTeacherSource(previousState[facebookKey], now.getTime())) {
      tasks.push((async () => {
        const url = new URL("https://graph.facebook.com/" + graphVersion + "/" + encodeURIComponent(pageId) + "/feed");
        url.searchParams.set("fields", "id,message,story,created_time,permalink_url");
        url.searchParams.set("limit", "10");
        url.searchParams.set("access_token", pageToken);
        const payload = await fetchJson(url.toString());
        const updates = (payload.data ?? []).flatMap(item => {
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
  }
  let orderedUpdates = updates
    .filter(update => now.getTime() - Date.parse(update.publishedAt) <= 30 * 24 * 60 * 60 * 1_000)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MAX_UPDATES_PER_SCAN);

  const apiKey = process.env.YOUTUBE_API_KEY;
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

  return { updates: orderedUpdates, scanState };
}
