import { describe, expect, it } from "vitest";
import {
  formatTextbookEvidence,
  inspectTextbookIndex,
  rankTextbookPassages,
  retrieveTextbookEvidence,
  splitTextbookPages,
} from "./textbook-retrieval";

describe("generic page parsing helpers", () => {
  const pages = splitTextbookPages(
    "HIS_G2_BAC",
    "Synthetic history fixture",
    "fixture.txt",
    "test_only",
    [
      "<PARSED TEXT OF PAGE: 1 / 3>",
      "مقدمة عن الدولة المصرية وتطورها عبر التاريخ.",
      "الوعي التاريخي يساعد على فهم الحاضر.",
      "<PARSED TEXT OF PAGE: 2 / 3>",
      "قاومت الدولة المصرية القديمة الاحتلال، وحافظت على مؤسساتها.",
      "توضح الأدلة التاريخية أسباب المقاومة ونتائجها.",
      "<PARSED TEXT OF PAGE: 3 / 3>",
      "التاريخ منهج لتحليل التحولات السياسية والاقتصادية والاجتماعية.",
    ].join("\n"),
  );

  it("preserves physical page numbers when splitting a supplied test fixture", () => {
    expect(pages.map(page => page.pdfPage)).toEqual([1, 2, 3]);
    expect(pages[1].text).toContain("الاحتلال");
  });

  it("ranks a relevant Arabic passage in a synthetic fixture", () => {
    const results = rankTextbookPassages(pages, "مقاومة الدولة المصرية القديمة للاحتلال", 2);
    expect(results[0].pdfPage).toBe(2);
    expect(results[0].passage).toContain("الاحتلال");
  });

  it("formats synthetic source identity and page references", () => {
    const result = rankTextbookPassages(pages, "التحولات السياسية والاقتصادية", 1);
    const formatted = formatTextbookEvidence({ passages: result, coverageNotes: [] });
    expect(formatted).toContain("Synthetic history fixture");
    expect(formatted).toContain("صفحة PDF الفعلية: 3");
  });
});

describe("metadata-only official first-part curriculum", () => {
  it("does not load or store verbatim textbook page bodies", () => {
    for (const subjectId of [
      "ARB_G2_BAC",
      "ENG1_G2_BAC",
      "HIS_G2_BAC",
      "PROG_AI_G2_BAC",
      "SECOND_LANGUAGE_G2_BAC_PENDING",
    ]) {
      const result = inspectTextbookIndex(subjectId);
      expect(result.files).toHaveLength(0);
      expect(result.pageCount).toBe(0);
    }
  });

  it("provides Arabic lesson names, printed page ranges, size and provisional difficulty", () => {
    const result = retrieveTextbookEvidence(["ARB_G2_BAC"], "اللغة العربية", 3);
    const note = result.coverageNotes.join("\n");
    expect(result.passages).toHaveLength(0);
    expect(note).toContain("9 دروس");
    expect(note).toContain("العلم بين القانون والضمير");
    expect(note).toContain("ص8–25");
    expect(note).toContain("الصعوبة المبدئية hard");
    expect(note).toContain("ثقة low");
  });

  it("provides History lesson ranges and distinguishes lesson length from difficulty", () => {
    const result = retrieveTextbookEvidence(["HIS_G2_BAC"], "التاريخ الوطني", 3);
    const note = result.coverageNotes.join("\n");
    expect(note).toContain("12 درسًا");
    expect(note).toContain("بناء الدولة المصرية واستمرارها عبر التاريخ");
    expect(note).toContain("ص9–20");
    expect(note).toContain("مرتكزات الدور المصري إقليميًا ودوليًا");
    expect(note).toContain("الحجم small");
  });

  it("uses only first-part Programming chapters and their printed page ranges", () => {
    const result = retrieveTextbookEvidence(["PROG_AI_G2_BAC"], "البرمجة والذكاء الاصطناعي", 3);
    const note = result.coverageNotes.join("\n");
    expect(note).toContain("14 درسًا");
    expect(note).toContain("كيف يعمل الذكاء الاصطناعي");
    expect(note).toContain("ص12–17");
    expect(note).toContain("الصعوبة المبدئية hard");
    expect(note).not.toContain("جمع البيانات وتنقيتها");
    expect(note).not.toContain("الشبكات العصبية والتعلم العميق");
  });

  it("provides English topics and unit-level ranges without inventing topic difficulty", () => {
    const result = retrieveTextbookEvidence(["ENG1_G2_BAC"], "English", 3);
    const note = result.coverageNotes.join("\n");
    expect(note).toContain("5 وحدات");
    expect(note).toContain("20 موضوعًا");
    expect(note).toContain("Living Well in a Complex World");
    expect(note).toContain("Social Media and Self-Image");
    expect(note).toContain("صفحات مطبوعة 12–38");
    expect(note).toContain("لا يوجد تقدير موثوق لصعوبة كل موضوع على حدة");
  });

  it("reports missing Italian source accurately without guessing page ranges or difficulty", () => {
    const result = retrieveTextbookEvidence(["SECOND_LANGUAGE_G2_BAC_PENDING"], "Italian", 3);
    const note = result.coverageNotes.join("\n");
    expect(note).toContain("Dove abiti?");
    expect(note).toContain("Tempo libero");
    expect(note).toContain("ملف الكتاب الأصلي غير موجود");
    expect(note).toContain("يلزم ملف الكتاب لتحديد الصفحات والحجم والمحتوى");
  });

  it("keeps retrieved text passages empty and excludes every Part 2 source", () => {
    const result = retrieveTextbookEvidence(
      ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC", "SECOND_LANGUAGE_G2_BAC_PENDING"],
      "خطة الترم الأول",
      10,
    );
    expect(result.passages).toHaveLength(0);
    const note = result.coverageNotes.join("\n");
    expect(note).toContain("الجزء الأول");
    expect(note).not.toContain("الجزء الثاني - الفصول 5–7");
    expect(note).not.toContain("جمع البيانات وتنقيتها");
  });
});
