import { describe, expect, it } from "vitest";
import {
  formatTextbookEvidence,
  rankTextbookPassages,
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
