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

const SOURCES: Record<string, BookSource> = {
  ARB_G2_BAC: {
    title: "كتاب اللغة العربية - البكالوريا المصرية - الصف الثاني - الجزء الأول",
    files: ["arabic-part1.txt", "arabic-part2.txt"],
    coverage: "full_text_part_1",
  },
  HIS_G2_BAC: {
    title: "كتاب التاريخ الوطني - البكالوريا المصرية - الصف الثاني - الجزء الأول",
    files: ["history-part1.txt", "history-part2.txt"],
    coverage: "full_text_part_1",
  },
  PROG_AI_G2_BAC: {
    title: "كتاب البرمجة والذكاء الاصطناعي - البكالوريا المصرية - الصف الثاني - الجزء الثاني",
    files: ["programming-part2.txt"],
    coverage: "full_text_part_2_chapters_5_7",
  },
};

const COVERAGE_ONLY: Record<string, { title: string; description: string }> = {
  ENG1_G2_BAC: {
    title: "English - Egyptian Baccalaureate - 2nd Year - Part 1",
    description: "تم التحقق من فهرس الوحدات والأقسام والموضوعات فقط؛ صفحات الشرح الداخلية مصورة ولم يكتمل استخراج نصها.",
  },
};

const pageCache = new Map<string, TextbookPage[]>();

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
  const markers: PageMarker[] = [];
  const candidates = /<([^<>]{1,200})>/g;
  for (const match of content.matchAll(candidates)) {
    const inner = (match[1] ?? "")
      .normalize("NFKC")
      .replace(/[\p{C}\p{Z}\s]/gu, "")
      .toUpperCase();
    const parsed = /^PARSEDTEXTOFPAGE:(\d+)\/(\d+)$/.exec(inner);
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
  files: Array<{ file: string; exists: boolean; bytes: number; markerCount: number; prefix: string }>;
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
      const results = rankTextbookPassages(loadPages(subjectId), query, Math.max(1, Math.ceil(limit / Math.max(1, subjectIds.length))));
      passages.push(...results);
      if (subjectId === "PROG_AI_G2_BAC") {
        coverageNotes.push("البرمجة والذكاء الاصطناعي: نص الجزء الثاني فقط متاح للاسترجاع حاليًا؛ الجزء الأول غير موجود ضمن ملفات المصدر الحالية.");
      }
      if (subjectId === "ARB_G2_BAC") {
        coverageNotes.push("اللغة العربية: نص الجزء الأول متاح للاسترجاع؛ لا تفترض أن الأجزاء الأخرى مفهرسة.");
      }
      if (subjectId === "HIS_G2_BAC") {
        coverageNotes.push("التاريخ الوطني: نص الجزء الأول متاح للاسترجاع.");
      }
      continue;
    }
    const indexOnly = COVERAGE_ONLY[subjectId];
    if (indexOnly) coverageNotes.push(indexOnly.title + ": " + indexOnly.description);
  }
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
