import { describe, expect, it } from "vitest";
import {
  formatTextbookEvidence,
  inspectTextbookIndex,
  rankTextbookPassages,
  retrieveTextbookEvidence,
  splitTextbookPages,
} from "./textbook-retrieval";

describe("textbook page retrieval", () => {
  const pages = splitTextbookPages(
    "HIS_G2_BAC",
    "كتاب التاريخ الوطني - الجزء الأول",
    "history-part1.txt",
    "full_text_part_1",
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

  it("preserves physical PDF page numbers when splitting source text", () => {
    expect(pages.map(page => page.pdfPage)).toEqual([1, 2, 3]);
    expect(pages[1].text).toContain("الاحتلال");
  });

  it("ranks the relevant book passage for an Arabic question", () => {
    const results = rankTextbookPassages(pages, "مقاومة الدولة المصرية القديمة للاحتلال", 2);
    expect(results[0].pdfPage).toBe(2);
    expect(results[0].passage).toContain("الاحتلال");
  });

  it("returns book identity and a page reference with retrieved evidence", () => {
    const result = rankTextbookPassages(pages, "التحولات السياسية والاقتصادية", 1);
    const formatted = formatTextbookEvidence({ passages: result, coverageNotes: [] });
    expect(formatted).toContain("كتاب التاريخ الوطني");
    expect(formatted).toContain("صفحة PDF الفعلية: 3");
  });
});


describe("uploaded official textbook corpus", () => {
  it("parses the page markers from the actual source files", () => {
    const history = inspectTextbookIndex("HIS_G2_BAC");
    const programming = inspectTextbookIndex("PROG_AI_G2_BAC");
    expect(history.files.every(file => file.exists && file.bytes > 0)).toBe(true);
    expect(programming.files.every(file => file.exists && file.bytes > 0)).toBe(true);
    console.log("[TEXTBOOK HISTORY INDEX]", JSON.stringify(history));
    console.log("[TEXTBOOK PROGRAMMING INDEX]", JSON.stringify(programming));
    expect(history.files.reduce((sum, file) => sum + file.markerCount, 0), JSON.stringify(history.files)).toBeGreaterThan(100);
    expect(programming.files.reduce((sum, file) => sum + file.markerCount, 0)).toBeGreaterThan(50);
    expect(history.pageCount).toBeGreaterThan(100);
    expect(programming.pageCount).toBeGreaterThan(50);
  });

  it("retrieves a page from the uploaded National History Part 1 source", () => {
    const result = retrieveTextbookEvidence(
      ["HIS_G2_BAC"],
      "بناء الدولة المصرية واستمرارها عبر التاريخ",
      3,
    );
    expect(result.passages.length).toBeGreaterThan(0);
    expect(result.passages.every(item => item.sourceFile.includes("history-part1"))).toBe(true);
    expect(result.passages.some(item => item.bookTitle.includes("التاريخ الوطني") && item.pdfPage > 0)).toBe(true);
  });

  it("retrieves a page from Programming and AI Part 2", () => {
    const result = retrieveTextbookEvidence(
      ["PROG_AI_G2_BAC"],
      "الشبكات العصبية والتعلم العميق",
      3,
    );
    expect(result.passages.length).toBeGreaterThan(0);
    expect(result.passages.every(item => item.sourceFile.includes("programming-part2"))).toBe(true);
  });
});
