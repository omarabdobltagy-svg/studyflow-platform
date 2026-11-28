export type OfficialEducationImpact =
  | "exam_schedule"
  | "exam_scope"
  | "curriculum_update"
  | "official_policy"
  | "general";

export type OfficialEducationConfidence = "high" | "medium" | "low";

export type OfficialEducationStudentScope = {
  educationSystem: string;
  gradeYear: string;
  subjects: string[];
};

export type OfficialEducationUpdate = {
  externalId: string;
  sourceId: string;
  sourceLabel: string;
  sourceHost: string;
  title: string;
  excerpt: string;
  url: string;
  publishedAt: string | null;
  observedAt: string;
  impactType: OfficialEducationImpact;
  confidence: OfficialEducationConfidence;
  affectedSubjects: string[];
};

export type OfficialEducationSourceStatus = {
  sourceId: string;
  sourceLabel: string;
  status: "ok" | "empty" | "http_error" | "unavailable";
  updateCount: number;
  httpStatus?: number;
};

export type OfficialEducationScanResult = {
  checkedAt: string;
  updates: OfficialEducationUpdate[];
  sources: OfficialEducationSourceStatus[];
};

type OfficialSource = {
  sourceId: string;
  label: string;
  url: string;
};

const OFFICIAL_SOURCES: OfficialSource[] = [
  { sourceId: "moe_main", label: "وزارة التربية والتعليم", url: "https://moe.gov.eg/ar/" },
  { sourceId: "moe_information_center", label: "مركز معلومات وزارة التربية والتعليم", url: "https://emis.gov.eg/" },
  { sourceId: "cairo_government_rss", label: "بوابة محافظة القاهرة — الإشعارات", url: "https://cairo.gov.eg/ar/rss" },
];

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const parsed = Number(code);
      return parsed > 0 && parsed <= 0x10ffff ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return parsed > 0 && parsed <= 0x10ffff ? String.fromCodePoint(parsed) : "";
    });
}

function stripMarkup(value: string): string {
  return decodeHtml(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|li|h[1-6]|div|article|section)>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArabic(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ـً-ٟ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePublishedAt(section: string): string | null {
  const candidates = [
    section.match(/<time\b[^>]*datetime\s*=\s*["']([^"']+)["']/i)?.[1],
    section.match(/<meta\b[^>]*(?:property|name)\s*=\s*["'](?:article:published_time|datePublished|pubdate)["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1],
    section.match(/<meta\b[^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["'](?:article:published_time|datePublished|pubdate)["']/i)?.[1],
    section.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:[T ][0-9:.+\-Z]+)?)\b/)?.[1],
    (() => {
      const match = section.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
      if (!match) return undefined;
      return match[2] + "/" + match[1] + "/" + match[3];
    })(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function classifyImpact(value: string): OfficialEducationImpact {
  const text = normalizeArabic(value);
  if (/جدول.{0,36}امتحان|امتحان.{0,36}جدول|مواعيد.{0,36}امتحان|امتحانات.{0,36}الصف/.test(text)) return "exam_schedule";
  if (/نطاق.{0,36}امتحان|اجزاء.{0,36}امتحان|المقرر.{0,36}امتحان|ما يدخل.{0,36}امتحان/.test(text)) return "exam_scope";
  if (/تعديل.{0,36}مناهج|تحديث.{0,36}مناهج|تطوير.{0,36}مناهج|الكتب.{0,36}المدرسيه|المقررات.{0,36}الدراسيه/.test(text)) return "curriculum_update";
  if (/قرار.{0,24}وزاري|ضوابط.{0,36}(?:امتحان|دراسه)|تعليمات.{0,36}(?:امتحان|دراسه)|تعميم.{0,36}وزاره/.test(text)) return "official_policy";
  return "general";
}

export function classifyOfficialEducationUpdate(
  title: string,
  excerpt: string,
  source: Pick<OfficialSource, "sourceId" | "label" | "url">,
  scope: OfficialEducationStudentScope,
  publishedAt: string | null,
  observedAt = new Date().toISOString(),
): Omit<OfficialEducationUpdate, "externalId" | "sourceHost" | "url"> & { url: string } {
  const combined = (title + " " + excerpt).trim();
  const normalized = normalizeArabic(combined);
  const impactType = classifyImpact(combined);
  const explicitBaccalaureate = /البكالوريا|بكالوريا مصر|مسار البكالوريا|egyptian baccalaureate/.test(normalized);
  const relevantSubjectNames = scope.subjects
    .filter(name => name && normalizeArabic(name).length >= 3 && normalized.includes(normalizeArabic(name)))
    .slice(0, 8);
  const parsedDate = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  const observed = Date.parse(observedAt);
  const isRecentPublishedEvidence = Number.isFinite(parsedDate)
    && Number.isFinite(observed)
    && parsedDate <= observed + 60 * 60 * 1_000
    && observed - parsedDate <= 120 * 24 * 60 * 60 * 1_000;
  const normalizedGrade = normalizeArabic(scope.gradeYear);
  const isSecondYear = /الصف الثاني|السنه الثانيه|second year|grade 11|g11/.test(normalizedGrade);
  const isBaccalaureateStudent = scope.educationSystem === "baccalaureate" && isSecondYear;
  const highConfidence = isBaccalaureateStudent && explicitBaccalaureate
    && impactType !== "general" && isRecentPublishedEvidence;
  const confidence: OfficialEducationConfidence = highConfidence
    ? "high"
    : isBaccalaureateStudent && (explicitBaccalaureate || impactType !== "general")
      ? "medium"
      : "low";

  return {
    sourceId: source.sourceId,
    sourceLabel: source.label,
    title: title.slice(0, 220),
    excerpt: excerpt.slice(0, 1_200),
    publishedAt,
    observedAt,
    impactType,
    confidence,
    affectedSubjects: relevantSubjectNames,
    url: source.url,
  };
}

/** Parses only HTTPS article links hosted on the same official domain as the configured source. */
export function parseOfficialEducationPage(
  html: string,
  source: OfficialSource,
  scope: OfficialEducationStudentScope,
  now = new Date(),
): OfficialEducationUpdate[] {
  const base = new URL(source.url);
  const output: OfficialEducationUpdate[] = [];
  const seen = new Set<string>();
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const attrs = match[1] ?? "";
    const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href) continue;
    let target: URL;
    try {
      target = new URL(decodeHtml(href.trim()), base);
    } catch {
      continue;
    }
    if (target.protocol !== "https:" || target.hostname !== base.hostname) continue;
    target.hash = "";
    const title = stripMarkup(match[2] ?? "");
    if (title.length < 9 || title.length > 220) continue;
    const sectionStart = Math.max(0, (match.index ?? 0) - 450);
    const sectionEnd = Math.min(html.length, (match.index ?? 0) + match[0].length + 450);
    const section = html.slice(sectionStart, sectionEnd);
    const excerpt = stripMarkup(section).slice(0, 1_200);
    const relevanceText = normalizeArabic(title + " " + excerpt);
    if (!/بكالوريا|امتحان|امتحانات|المناهج|المنهج|المقررات|الصف الثاني|قرار وزاري|تقييمات/.test(relevanceText)) continue;
    const url = target.toString();
    if (seen.has(url)) continue;
    seen.add(url);
    const publishedAt = parsePublishedAt(section);
    const classified = classifyOfficialEducationUpdate(title, excerpt, source, scope, publishedAt, now.toISOString());
    output.push({
      ...classified,
      externalId: source.sourceId + ":" + url,
      sourceHost: target.hostname,
      url,
    });
  }
  return output.slice(0, 16);
}

async function fetchOfficialPage(
  source: OfficialSource,
  scope: OfficialEducationStudentScope,
  now: Date,
  fetchImpl: typeof fetch,
): Promise<{ updates: OfficialEducationUpdate[]; status: OfficialEducationSourceStatus }> {
  try {
    const response = await fetchImpl(source.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "user-agent": "StudyFlow-Education-Monitor/1.0 (+https://studyflow-app-production.up.railway.app)",
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return {
        updates: [],
        status: { sourceId: source.sourceId, sourceLabel: source.label, status: "http_error", updateCount: 0, httpStatus: response.status },
      };
    }
    const configuredHost = new URL(source.url).hostname;
    const finalResponseUrl = new URL(response.url || source.url);
    // Never accept a redirect to a non-official host, even from an official start URL.
    if (finalResponseUrl.protocol !== "https:" || finalResponseUrl.hostname !== configuredHost) {
      return {
        updates: [],
        status: { sourceId: source.sourceId, sourceLabel: source.label, status: "unavailable", updateCount: 0, httpStatus: response.status },
      };
    }
    const html = (await response.text()).slice(0, 1_200_000);
    const updates = parseOfficialEducationPage(html, source, scope, now);
    return {
      updates,
      status: { sourceId: source.sourceId, sourceLabel: source.label, status: updates.length ? "ok" : "empty", updateCount: updates.length, httpStatus: response.status },
    };
  } catch {
    return {
      updates: [],
      status: { sourceId: source.sourceId, sourceLabel: source.label, status: "unavailable", updateCount: 0 },
    };
  }
}

export async function scanOfficialEducationSources(
  scope: OfficialEducationStudentScope,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<OfficialEducationScanResult> {
  const normalizedGrade = normalizeArabic(scope.gradeYear);
  const isSecondYear = /الصف الثاني|السنه الثانيه|second year|grade 11|g11/.test(normalizedGrade);
  if (scope.educationSystem !== "baccalaureate" || !isSecondYear) {
    return {
      checkedAt: now.toISOString(),
      updates: [],
      sources: OFFICIAL_SOURCES.map(source => ({ sourceId: source.sourceId, sourceLabel: source.label, status: "empty", updateCount: 0 })),
    };
  }
  const results = await Promise.all(OFFICIAL_SOURCES.map(source => fetchOfficialPage(source, scope, now, fetchImpl)));
  const updates = new Map<string, OfficialEducationUpdate>();
  for (const result of results) {
    for (const update of result.updates) updates.set(update.externalId, update);
  }
  const ordered = [...updates.values()]
    .sort((a, b) => Date.parse(b.publishedAt ?? b.observedAt) - Date.parse(a.publishedAt ?? a.observedAt))
    .slice(0, 24);
  return {
    checkedAt: now.toISOString(),
    updates: ordered,
    sources: results.map(result => result.status),
  };
}

export type HighConfidenceOfficialPlanningSignal = Omit<OfficialEducationUpdate, "confidence" | "impactType"> & {
  confidence: "high";
  impactType: Exclude<OfficialEducationImpact, "general">;
};

/** Only these source-backed, explicit and recent signals may invalidate a stored plan. */
export function isHighConfidenceOfficialPlanningSignal(value: unknown): value is HighConfidenceOfficialPlanningSignal {
  if (!value || typeof value !== "object") return false;
  const update = value as Partial<OfficialEducationUpdate>;
  return update.confidence === "high"
    && Boolean(update.externalId && update.url && update.sourceHost)
    && ["exam_schedule", "exam_scope", "curriculum_update", "official_policy"].includes(String(update.impactType));
}
