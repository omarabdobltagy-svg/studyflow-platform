import { readFileSync } from "node:fs";
import { join } from "node:path";

export type TextbookPage = {
  subjectId: string;
  bookTitle: string;
  sourceFile: string;
  coverage: string;
  pdfPage: number;
  text: string;
};

export type TextbookPassage = TextbookPage & {
  score: number;
  passage: string;
};

type BookSource = {
  title: string;
  files: string[];
  coverage: string;
};

const ROOT = join(process.cwd(), "server", "curriculum-data");

// No verbatim textbook page corpus is stored or retrieved. The planner consumes
// a compact derived curriculum profile with lesson names, printed-page spans,
// provisional size/difficulty indicators and explicit confidence levels.
const SOURCES: Record<string, BookSource> = {};

// These sources have a verified first-part curriculum index, but their complete
// textbook page bodies are not present in the checked-in corpus. Never retrieve
// or cite Part 2 files as a substitute for missing Part 1 content.
const COVERAGE_ONLY: Record<string, { title: string; description: string }> = {
  ARB_G2_BAC: {
    title: "كتاب اللغة العربية - الجزء الأول",
    description: "بيانات مشتقة من فهرس الكتاب: 3 وحدات و9 دروس بنطاقات صفحات مطبوعة. لا تُخزّن صفحات الكتاب أو اقتباساته حرفيًا.",
  },
  ENG1_G2_BAC: {
    title: "كتاب اللغة الإنجليزية الأولى - الجزء الأول",
    description: "فهرس مرئي موثق: 5 وحدات و20 موضوعًا، مع نطاقات صفحات تقديرية لكل موضوع مستخرجة من فواصل الأقسام المصوّرة. الصعوبة الفردية لكل موضوع غير محسومة.",
  },
  HIS_G2_BAC: {
    title: "كتاب التاريخ الوطني - الجزء الأول",
    description: "بيانات مشتقة من فهرس الكتاب: 3 وحدات و12 درسًا بنطاقات صفحات مطبوعة. لا تُخزّن صفحات الكتاب أو اقتباساته حرفيًا.",
  },
  PROG_AI_G2_BAC: {
    title: "كتاب البرمجة والذكاء الاصطناعي - الجزء الأول",
    description: "فهرس الجزء الأول موثق: 4 فصول و14 درسًا، مع بداية ونهاية صفحات الدرس في الكتاب والـPDF. لا يستخدم أي محتوى من الجزء الثاني.",
  },
  SECOND_LANGUAGE_G2_BAC_PENDING: {
    title: "كتاب اللغة الإيطالية - الجزء الأول",
    description: "المتاح حاليًا اسما وحدتين فقط: Dove abiti? وTempo libero. ملف الكتاب الأصلي غير موجود، لذلك حجم الدروس وصفحاتها وصعوبتها غير محددة.",
  },
};

const pageCache = new Map<string, TextbookPage[]>();

type CurriculumLessonProfile = {
  id: string;
  title: string;
  nodeId?: string;
  branchId?: string;
  catalogMapping?: { nodeId: string; branchId: string };
  pages?: [number, number];
  pageCount?: number;
  pageRangeConfidence?: "low" | "medium" | "high";
  pageRangeBasis?: string;
  pageRangeEstimated?: boolean;
  size?: "small" | "medium" | "large" | "unknown";
  sizeConfidence?: "low" | "medium" | "high";
  difficulty?: "easy" | "medium" | "hard" | "unknown";
  difficultyConfidence?: "low" | "medium" | "high";
  basis?: string;
  strategy?: string;
  lessons?: string[];
  section?: string;
};

type CurriculumUnitProfile = {
  id: string;
  title: string;
  pages?: [number, number];
  pageCount?: number;
  size?: "small" | "medium" | "large" | "unknown";
  difficulty?: "easy" | "medium" | "hard" | "unknown";
  difficultyConfidence?: "low" | "medium" | "high";
  basis?: string;
  strategy?: string;
  section?: string;
  skillPageReferences?: Record<string, unknown>;
  lessons?: Array<CurriculumLessonProfile | string>;
};

type CurriculumBranchPriorityGuidance = {
  tier?: "core";
  source?: string;
  rationale?: string;
};

type CurriculumDependencyEdge = {
  subjectId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: "prerequisite" | "curriculum_sequence" | "historical_context" | "same_unit_context";
  strength: "strong" | "medium" | "soft";
  confidence: "high" | "medium" | "low";
  hardBlock: false;
  reason: string;
};

type CurriculumIntelligence = {
  sourceEvidence?: {
    sourcePolicy?: string;
    books?: Array<{
      subjectId: string;
      fileName: string;
      pdfPages: number;
      method: string;
      pageMapConfidence: string;
      limitations?: string[];
    }>;
  };
  dependencyGraph?: {
    version: number;
    semantics?: string;
    edges: CurriculumDependencyEdge[];
  };
  planningPolicy?: {
    scope?: string;
    platformRole?: string;
    teacherOwnsInstruction?: string;
    allowedPlanTasks?: string[];
    prohibitedPlanTasks?: string[];
    assessmentEvidence?: string;
    branchTaxonomyPolicy?: string;
    coverageBoundary?: string;
  };
  subjectPlanningGuidance?: Record<string, {
    priorityBranches?: Record<string, CurriculumBranchPriorityGuidance>;
    requiredCoverage?: boolean;
    source?: string;
    rationale?: string;
    coverageRule?: string;
    otherSkillGuidance?: string;
    examPatternGuidance?: string;
  }>;
  subjects: Record<string, {
    title: string;
    coverage: string;
    units: CurriculumUnitProfile[];
    limitation?: string;
    learningIntent?: string[];
    branchContext?: Record<string, unknown>;
  }>;
};

let curriculumCatalogCache: CurriculumIntelligence | null = null;
let curriculumCatalogLoadAttempted = false;

function loadCurriculumCatalog(): CurriculumIntelligence | null {
  if (curriculumCatalogLoadAttempted) return curriculumCatalogCache;
  curriculumCatalogLoadAttempted = true;
  try {
    const file = readFileSync(join(ROOT, "curriculum-intelligence-part1.json"), "utf8");
    curriculumCatalogCache = JSON.parse(file) as CurriculumIntelligence;
  } catch (error) {
    console.error("[StudyFlow curriculum] Could not load derived curriculum profile:", error instanceof Error ? error.message : "unknown error");
    curriculumCatalogCache = null;
  }
  return curriculumCatalogCache;
}

/** Returns a non-exam priority signal explicitly configured for a curriculum branch. */
export function getCurriculumBranchPriorityGuidance(
  subjectId: string,
  branchId: string,
): CurriculumBranchPriorityGuidance | null {
  const catalogue = loadCurriculumCatalog();
  return catalogue?.subjectPlanningGuidance?.[subjectId]?.priorityBranches?.[branchId] ?? null;
}

function getCurriculumIntelligenceNotes(subjectIds: string[]): string[] {
  try {
    const catalogue = loadCurriculumCatalog();
    if (!catalogue) return ["بيانات المنهج التفصيلية غير متاحة الآن؛ لا تخترع أسماء دروس أو صفحات أو أحكام صعوبة."];
    const policy = catalogue.planningPolicy;
    const sourceLines = (catalogue.sourceEvidence?.books ?? [])
      .filter(book => subjectIds.includes(book.subjectId))
      .map(book => {
        const method = book.method === "visual_page_inspection_scanned_images"
          ? "فحص بصري لصفحات مصوّرة"
          : "استخراج نصي مع مراجعة بصرية";
        return "مصدر كتاب رسمي: " + book.fileName + "؛ " + book.pdfPages + " صفحة PDF؛ طريقة المعالجة: " + method
          + "؛ ثقة خريطة الصفحات: " + book.pageMapConfidence
          + (book.limitations?.length ? "؛ القيود: " + book.limitations.join(" | ") : "");
      });
    const policyLines = policy ? [
      "سياسة استخدام المعرفة المنهجية داخل StudyFlow:",
      policy.scope,
      policy.platformRole,
      policy.teacherOwnsInstruction,
      policy.branchTaxonomyPolicy,
      policy.assessmentEvidence,
      policy.coverageBoundary,
      ...(policy.allowedPlanTasks?.length ? ["أنواع مهام التخطيط المسموح بها: " + policy.allowedPlanTasks.join(" | ")] : []),
      ...(policy.prohibitedPlanTasks?.length ? ["أنواع مهام التخطيط المحظورة: " + policy.prohibitedPlanTasks.join(" | ")] : []),
    ].filter((line): line is string => typeof line === "string" && line.length > 0) : [];
    const guidanceLines = subjectIds.flatMap(subjectId => {
      const guidance = catalogue.subjectPlanningGuidance?.[subjectId];
      if (!guidance) return [];
      const lines = ["توجيهات التخطيط المعتمدة للمادة " + subjectId + ":"];
      if (guidance.requiredCoverage) lines.push("تغطية جميع الدروس غير المكتملة إلزامية؛ لا يُحذف أي درس من الخريطة السنوية بسبب ترتيب الأولوية.");
      if (guidance.rationale) lines.push(guidance.rationale);
      if (guidance.coverageRule) lines.push(guidance.coverageRule);
      if (guidance.otherSkillGuidance) lines.push(guidance.otherSkillGuidance);
      if (guidance.examPatternGuidance) lines.push("استلهام نوعي لمجالات المهارة فقط دون نسخ بنية الامتحان: " + guidance.examPatternGuidance);
      for (const [branchId, branch] of Object.entries(guidance.priorityBranches ?? {})) {
        if (branch.tier === "core") lines.push("أولوية تأسيسية للفرع " + branchId + "؛ إشارة ترتيب داخلية وليست وزن درجات رسميًا. " + (branch.rationale ?? ""));
      }
      return lines;
    });
    const subjectLines = subjectIds.flatMap(subjectId => {
      const subject = catalogue.subjects[subjectId];
      if (!subject) return [];
      const lines = [`المنهج المشتق — ${subject.title}:`];
      if (subject.learningIntent?.length) {
        lines.push("أهداف الكتاب لفهم طبيعة المقرر فقط؛ المعلم يتولى الشرح والتدريب والتقييم، ولا يحولها StudyFlow إلى أسئلة أو واجبات مهارية:");
        for (const intent of subject.learningIntent) lines.push("- " + intent);
      }
      if (subject.branchContext) {
        const context = subject.branchContext as Record<string, unknown>;
        const existingBranches = Array.isArray(context.branchIds)
          ? context.branchIds.join("، ")
          : [context.vocabularyBranchId, context.grammarBranchId, context.textbookBranchId, context.greBranchId, context.storyBranchId, context.branchId]
              .filter(value => typeof value === "string").join("، ");
        if (existingBranches) lines.push("معرفات الفروع الموجودة التي يجب الحفاظ عليها دون دمج أو إعادة تسمية: " + existingBranches + ".");
        if (Array.isArray(context.unitLinks)) {
          lines.push("ربط مسارات الإنجليزي حسب الوحدة دون دمج الفروع: " + context.unitLinks.map((item: any) =>
            "U" + item.unitNumber + " (" + item.vocabularyNodeId + " / " + item.grammarNodeId + " / " + (item.textbookNodeIds?.length ?? 0) + " موضوعات كتاب)"
          ).join(" | ") + ".");
        }
        if (context.requiredCoverage) lines.push("قاعدة التغطية: لا يُحذف أي درس غير مكتمل من الخطة السنوية.");
        lines.push("هذه مجرد روابط بين المحتوى والفروع الموجودة؛ لا تغيّر أسماء الفروع أو ترتيبها ولا تنشئ فروعًا جديدة.");
      }
      for (const unit of subject.units) {
        const unitRange = unit.pages ? `؛ صفحات مطبوعة ${unit.pages[0]}–${unit.pages[1]} (${unit.pageCount ?? unit.pages[1] - unit.pages[0] + 1} صفحة، ${unit.size ?? "حجم غير محدد"})` : "";
        lines.push(`الوحدة: ${unit.title}${unitRange}`);
        if (unit.skillPageReferences) {
          lines.push("مراجع مهارات الكتاب داخل الوحدة (للمعرفة السياقية فقط؛ لا ينشئ StudyFlow تدريبًا عليها): " + JSON.stringify(unit.skillPageReferences));
        }
        if (unit.lessons?.length && typeof unit.lessons[0] !== "string") {
          for (const entry of unit.lessons) {
            if (typeof entry === "string") continue;
            const range = entry.pages
              ? `; ص${entry.pages[0]}–${entry.pages[1]}${entry.pageRangeEstimated ? " (نطاق مرئي تقديري)" : ""}، ${entry.pageCount ?? entry.pages[1] - entry.pages[0] + 1} صفحة`
              : "";
            const size = entry.size && entry.size !== "unknown" ? entry.size : "غير محدد";
            const difficulty = entry.difficulty && entry.difficulty !== "unknown"
              ? `${entry.difficulty} (ثقة ${entry.difficultyConfidence ?? "low"})`
              : "غير محسوم";
            const mapping = entry.catalogMapping || (entry.nodeId ? { nodeId: entry.nodeId, branchId: entry.branchId } : null);
            const mapText = mapping ? `; معرف المنهج ${mapping.nodeId}؛ الفرع ${mapping.branchId}` : "";
            const rationale = entry.basis ? `; أساس التقدير: ${entry.basis.slice(0, 100)}` : "";
            const strategy = entry.strategy ? `; توجيه تقسيم/متابعة: ${entry.strategy.slice(0, 180)}` : "";
            lines.push(`- ${entry.title}${range}؛ الحجم ${size}؛ الصعوبة ${difficulty}${mapText}${rationale}${strategy}`);
          }
        } else if (unit.lessons?.length && typeof unit.lessons[0] === "string") {
          lines.push(`- الموضوعات: ${unit.lessons.join("؛ ")}؛ صفحات الوحدة وحجمها ${unitRange || "غير محددين"}؛ لا يوجد تقدير موثوق لصعوبة كل موضوع على حدة.`);
        } else {
          lines.push("- أسماء الوحدات فقط؛ الحجم والصعوبة غير محددين حتى يتوفر الكتاب.");
        }
      }
      if (subject.limitation) lines.push("حدود المصدر: " + subject.limitation);
      return lines;
    });
    const dependencyLines = (catalogue.dependencyGraph?.edges ?? [])
      .filter(edge => subjectIds.includes(edge.subjectId))
      .map(edge => edge.subjectId + ": " + edge.fromNodeId + " → " + edge.toNodeId
        + " (" + edge.relationType + "; " + edge.strength + "; " + edge.confidence + ")");
    const dependencyHeader = dependencyLines.length
      ? ["علاقات الدروس: prerequisite اعتماد مفاهيمي، curriculum_sequence ترتيب كتاب، historical_context سياق. جميعها تفضيلات ترتيب غير مانعة؛ لا تُحوّلها إلى شرط يحظر التوازي."]
      : [];
    return [...sourceLines, ...policyLines, ...guidanceLines, ...subjectLines, ...dependencyHeader, ...dependencyLines];
  } catch (error) {
    console.error("[StudyFlow curriculum] Could not load derived curriculum profile:", error instanceof Error ? error.message : "unknown error");
    return ["بيانات المنهج التفصيلية غير متاحة الآن؛ لا تخترع أسماء دروس أو صفحات أو أحكام صعوبة."];
  }
}

const ARABIC_STOP_WORDS = new Set([
  "من", "في", "على", "الى", "إلى", "عن", "ما", "ماذا", "هذا", "هذه", "ذلك", "تلك",
  "الذي", "التي", "الذين", "هو", "هي", "هم", "هن", "انا", "انت", "نحن", "كان", "كانت",
  "يكون", "تكون", "مع", "بين", "عند", "بعد", "قبل", "كل", "قد", "لم", "لن", "لا",
  "او", "أو", "ثم", "كما", "حيث", "حتى", "اذا", "إذا", "أن", "ان", "إن", "إنه",
  "وهو", "وهي", "وله", "لها", "به", "بها", "عليه", "عليها", "هناك", "هنا", "أي",
  "اي", "كيف", "لماذا", "هل", "ماهو", "يعني", "شرح", "اشرح", "عايز", "عاوز",
  "please", "the", "and", "for", "from", "with", "that", "this", "what", "how",
  "why", "into", "are", "was", "were", "you", "your", "have", "has", "had",
]);

function normalizeExtractedDocument(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/[\u00A0\u202F]/g, " ");
}

type PageMarker = { start: number; end: number; pageNumber: number; pageTotal: number };

function findPageMarkers(content: string): PageMarker[] {
  const normalized = normalizeExtractedDocument(content);
  const markers: PageMarker[] = [];
  const lines = normalized.split(/\r?\n/);
  let offset = 0;

  for (const line of lines) {
    const compact = line.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (compact.startsWith("PARSEDTEXTOFPAGE") || compact.startsWith("PARSEDTEXTFORPAGE")) {
      const numbers = line.match(/\d+/g) ?? [];
      if (numbers.length >= 2) {
        markers.push({
          start: offset,
          end: offset + line.length,
          pageNumber: Number(numbers[0]),
          pageTotal: Number(numbers[1]),
        });
      }
    }
    offset += line.length + 1;
  }

  if (markers.length) return markers;

  // Fallback for page markers that were flattened into surrounding text.
  const candidates = /<([^<>]{1,200})>/g;
  for (const match of normalized.matchAll(candidates)) {
    const inner = (match[1] ?? "")
      .replace(/[\p{C}\p{Z}\s]/gu, "")
      .toUpperCase();
    const parsed = /^PARSEDTEXT(?:OF|FOR)PAGE:(\d+)\/(\d+)$/.exec(inner);
    if (!parsed) continue;
    markers.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      pageNumber: Number(parsed[1]),
      pageTotal: Number(parsed[2]),
    });
  }
  return markers;
}

function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

function tokenize(value: string): string[] {
  return normalizeArabic(value.toLowerCase())
    .match(/[\p{L}\p{N}]{2,}/gu) ?? [];
}

function makeSearchTerms(value: string): Set<string> {
  const result = new Set<string>();
  for (const token of tokenize(value)) {
    if (ARABIC_STOP_WORDS.has(token) || token.length < 2) continue;
    result.add(token);
    if (token.length > 4 && /^[وف]/.test(token)) result.add(token.slice(1));
    if (token.length > 5 && token.startsWith("ال")) result.add(token.slice(2));
    if (token.length > 6 && token.startsWith("بال")) result.add(token.slice(3));
    if (token.length > 6 && token.startsWith("لل")) result.add(token.slice(2));
  }
  return result;
}

export function splitTextbookPages(
  subjectId: string,
  bookTitle: string,
  sourceFile: string,
  coverage: string,
  content: string,
): TextbookPage[] {
  const normalizedContent = normalizeExtractedDocument(content);
  const markers = findPageMarkers(normalizedContent);
  if (!markers.length) return [];
  return markers.map((marker, index) => {
    const start = marker.end;
    const end = index + 1 < markers.length ? markers[index + 1].start : normalizedContent.length;
    return {
      subjectId,
      bookTitle,
      sourceFile,
      coverage,
      pdfPage: marker.pageNumber,
      text: normalizedContent.slice(start, end).trim(),
    };
  }).filter(page => page.text.length >= 40);
}

export function inspectTextbookIndex(subjectId: string): {
  sourceRoot: string;
  files: Array<{ file: string; exists: boolean; bytes: number; markerCount: number; replacementCharacters: number; replacementRatio: number; prefix: string }>;
  pageCount: number;
  indexedCharacters: number;
} {
  const source = SOURCES[subjectId];
  if (!source) return { sourceRoot: ROOT, files: [], pageCount: 0, indexedCharacters: 0 };
  const files = source.files.map(file => {
    const fullPath = join(ROOT, file);
    const content = readFileSync(fullPath, "utf8");
    return {
      file,
      exists: true,
      bytes: Buffer.byteLength(content, "utf8"),
      markerCount: findPageMarkers(content).length,
      replacementCharacters: (content.match(/\uFFFD/g) ?? []).length,
      replacementRatio: (content.match(/\uFFFD/g) ?? []).length / Math.max(1, content.length),
      prefix: JSON.stringify(normalizeExtractedDocument(content).slice(0, 140)),
    };
  });
  const pages = loadPages(subjectId);
  return {
    sourceRoot: ROOT,
    files,
    pageCount: pages.length,
    indexedCharacters: pages.reduce((total, page) => total + page.text.length, 0),
  };
}

function loadPages(subjectId: string): TextbookPage[] {
  if (pageCache.has(subjectId)) return pageCache.get(subjectId)!;
  const source = SOURCES[subjectId];
  if (!source) return [];
  const pages: TextbookPage[] = [];
  for (const file of source.files) {
    const content = readFileSync(join(ROOT, file), "utf8");
    pages.push(...splitTextbookPages(subjectId, source.title, file, source.coverage, content));
  }
  pageCache.set(subjectId, pages);
  return pages;
}

function toPassages(page: TextbookPage): string[] {
  const lines = page.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const paragraphs: string[] = [];
  let current = "";
  for (const line of lines) {
    const joined = current ? current + " " + line : line;
    if (joined.length > 1_050 && current) {
      paragraphs.push(current);
      current = line;
    } else {
      current = joined;
    }
  }
  if (current) paragraphs.push(current);

  const passages: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1_100) {
      passages.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!؟?؛])\s+/);
    let chunk = "";
    for (const sentence of sentences) {
      if (chunk && (chunk.length + sentence.length + 1 > 1_100)) {
        passages.push(chunk);
        chunk = sentence;
      } else {
        chunk = chunk ? chunk + " " + sentence : sentence;
      }
    }
    if (chunk) passages.push(chunk);
  }
  return passages.filter(passage => passage.length >= 40);
}

export function rankTextbookPassages(
  pages: TextbookPage[],
  query: string,
  limit = 5,
): TextbookPassage[] {
  const terms = makeSearchTerms(query);
  if (!terms.size) return [];
  const ranked: TextbookPassage[] = [];
  for (const page of pages) {
    const pageText = normalizeArabic(page.text.toLowerCase());
    const passages = toPassages(page);
    for (const passage of passages) {
      const normalized = normalizeArabic(passage.toLowerCase());
      const passageTerms = makeSearchTerms(passage);
      let matches = 0;
      for (const term of terms) if (passageTerms.has(term)) matches++;
      if (!matches) continue;
      const coverage = matches / Math.max(1, terms.size);
      const density = matches / Math.sqrt(Math.max(1, passageTerms.size));
      const phraseBoost = query.trim().length > 5 && pageText.includes(normalizeArabic(query.trim().toLowerCase())) ? 1.5 : 0;
      const score = coverage * 4 + density + phraseBoost;
      ranked.push({ ...page, score, passage });
    }
  }
  return ranked.sort((a, b) => b.score - a.score || a.pdfPage - b.pdfPage).slice(0, Math.max(1, limit));
}


/**
 * Stable topological ordering for plan steps that happen to contain linked curriculum nodes.
 * Relationship edges are preferences only: none blocks a student's access to a later lesson.
 */
export function orderPlanStepsByCurriculumDependencies<
  T extends { steps: Array<{ curriculumNodeIds?: string[] }> }
>(plan: T): T {
  const catalogue = loadCurriculumCatalog();
  const edges = catalogue?.dependencyGraph?.edges ?? [];
  if (!edges.length || plan.steps.length < 2) return plan;

  const nodeToIndexes = new Map<string, number[]>();
  plan.steps.forEach((step, index) => {
    for (const nodeId of step.curriculumNodeIds ?? []) {
      const indexes = nodeToIndexes.get(nodeId) ?? [];
      indexes.push(index);
      nodeToIndexes.set(nodeId, indexes);
    }
  });

  const adjacency = Array.from({ length: plan.steps.length }, () => new Set<number>());
  const indegree = Array.from({ length: plan.steps.length }, () => 0);
  for (const edge of edges) {
    if (edge.hardBlock !== false) continue;
    // All current edges are ordering/context hints; same-unit context is not directional.
    if (edge.relationType === "same_unit_context") continue;
    const fromIndexes = nodeToIndexes.get(edge.fromNodeId) ?? [];
    const toIndexes = nodeToIndexes.get(edge.toNodeId) ?? [];
    for (const fromIndex of fromIndexes) {
      for (const toIndex of toIndexes) {
        if (fromIndex === toIndex || adjacency[fromIndex].has(toIndex)) continue;
        adjacency[fromIndex].add(toIndex);
        indegree[toIndex] += 1;
      }
    }
  }

  const orderedIndexes: number[] = [];
  const available = new Set<number>();
  for (let i = 0; i < indegree.length; i += 1) {
    if (indegree[i] === 0) available.add(i);
  }
  while (available.size) {
    const next = Math.min(...available);
    available.delete(next);
    orderedIndexes.push(next);
    for (const target of adjacency[next]) {
      indegree[target] -= 1;
      if (indegree[target] === 0) available.add(target);
    }
  }

  if (orderedIndexes.length !== plan.steps.length) {
    console.warn("[StudyFlow curriculum] Dependency graph cycle detected; preserving model step order.");
    return plan;
  }
  const steps = orderedIndexes.map(index => plan.steps[index]);
  return orderedIndexes.every((index, position) => index === position)
    ? plan
    : { ...plan, steps };
}

export function retrieveTextbookEvidence(
  subjectIds: string[],
  query: string,
  limit = 5,
): { passages: TextbookPassage[]; coverageNotes: string[] } {
  const passages: TextbookPassage[] = [];
  const coverageNotes: string[] = [];
  for (const subjectId of subjectIds) {
    const source = SOURCES[subjectId];
    if (source) {
      const diagnostics = inspectTextbookIndex(subjectId);
      const unindexedFiles = diagnostics.files.filter(file => file.markerCount === 0);
      if (unindexedFiles.length) {
        coverageNotes.push(
          "فجوة فهرسة في " + source.title + ": الملفات التالية لا تحتوي علامات صفحات قابلة للقراءة، لذلك لا تدخل في الاسترجاع ذي المراجع: " +
          unindexedFiles.map(file => file.file).join("، ") + "."
        );
      }
      const damagedFiles = diagnostics.files.filter(file => file.replacementRatio >= 0.02);
      if (damagedFiles.length) {
        coverageNotes.push(
          "تنبيه جودة استخراج في " + source.title + ": توجد محارف استبدال Unicode (U+FFFD) في بعض ملفات النص، بنسب تقريبية: " +
          damagedFiles.map(file => file.file + " " + (file.replacementRatio * 100).toFixed(1) + "%").join("، ") +
          ". لا تنقل اقتباسًا حرفيًا من موضع مشوّه؛ اطلب الصفحة الأصلية عند الحاجة إلى صياغة دقيقة."
        );
      }
      const results = rankTextbookPassages(loadPages(subjectId), query, Math.max(1, Math.ceil(limit / Math.max(1, subjectIds.length))));
      passages.push(...results);

      continue;
    }
    const indexOnly = COVERAGE_ONLY[subjectId];
    if (indexOnly) {
      coverageNotes.push(indexOnly.title + ": " + indexOnly.description);

    }
  }
  coverageNotes.push(...getCurriculumIntelligenceNotes(subjectIds));
  const deduped = new Map<string, TextbookPassage>();
  for (const passage of passages.sort((a, b) => b.score - a.score)) {
    const key = passage.subjectId + ":" + passage.pdfPage + ":" + passage.passage.slice(0, 90);
    if (!deduped.has(key)) deduped.set(key, passage);
  }
  return {
    passages: [...deduped.values()].slice(0, limit),
    coverageNotes,
  };
}

export function formatTextbookEvidence(
  result: ReturnType<typeof retrieveTextbookEvidence>,
): string {
  const sourceText = result.passages.map(item =>
    [
      "المادة: " + item.subjectId,
      "الكتاب: " + item.bookTitle,
      "ملف المصدر: " + item.sourceFile,
      "صفحة PDF الفعلية: " + item.pdfPage,
      "مقتطف مسترجع (يُستخدم كمصدر أساسي عند مطابقته للسؤال):",
      item.passage,
    ].join("\n"),
  );
  const notes = result.coverageNotes.length
    ? ["حالة تغطية المصادر:", ...result.coverageNotes.map(note => "- " + note)]
    : [];
  return [...notes, ...sourceText].join("\n\n");
}
