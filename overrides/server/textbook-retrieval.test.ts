import { describe, expect, it } from "vitest";
import {
  formatTextbookEvidence,
  getCurriculumBranchPriorityGuidance,
  inspectTextbookIndex,
  orderPlanStepsByCurriculumDependencies,
  rankTextbookPassages,
  retrieveTextbookEvidence,
  splitTextbookPages,
} from "./textbook-retrieval";
import { getSIECheckpointBranches } from "@shared/sie-catalog";
import {
  buildExamBlueprintContext,
  getSubjectExamBlueprint,
  SECOND_YEAR_BAC_EXAM_WINDOW_2026_2027,
} from "./exam-blueprints";

describe("branch-specific planning priority guidance", () => {
  it("boosts only the configured Arabic and English branches without creating exam-mark weights", () => {
    expect(getCurriculumBranchPriorityGuidance("ARB_G2_BAC", "ARB_NAHW")?.tier).toBe("core");
    expect(getCurriculumBranchPriorityGuidance("ENG1_G2_BAC", "ENG_GRAMMAR")?.tier).toBe("core");
    expect(getCurriculumBranchPriorityGuidance("ENG1_G2_BAC", "ENG_VOCABULARY")?.tier).toBe("core");
    expect(getCurriculumBranchPriorityGuidance("ARB_G2_BAC", "ARB_TEXTS")).toBeNull();
    expect(getCurriculumBranchPriorityGuidance("ENG1_G2_BAC", "ENG_STORY")).toBeNull();
  });
});

describe("Part 1 textbook planning context", () => {
  it("provides the teacher-led policy and learning intent for the four supported subjects", () => {
    const result = retrieveTextbookEvidence(
      ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC"],
      "Part 1 Ministry textbook planning",
      4,
    );
    const context = result.coverageNotes.join("\\n");
    expect(context).toContain("StudyFlow ينظم عبء المذاكرة");
    expect(context).toContain("ولا يختبر الطالب");
    expect(context).toContain("النحو");
    expect(context).toContain("Vocabulary");
    expect(context).toContain("الوثائق التاريخية");
    expect(context).toContain("التطبيق العملي");
    expect(context).toContain("المفردات في سياق الجملة");
    expect(context).toContain("لا تنقل عدد الأسئلة");
  });
});


describe("Part 1 curriculum mapping and ordering", () => {
  it("preserves every existing branch ID and branch order", () => {
    expect(getSIECheckpointBranches("ARB_G2_BAC").map(branch => branch.branchId)).toEqual([
      "ARB_NAHW",
      "ARB_BALAGHA",
      "ARB_READING",
      "ARB_TEXTS",
      "ARB_EXPRESSION",
      "ARB_SPELLING",
      "ARB_LITERATURE",
    ]);
    expect(getSIECheckpointBranches("ENG1_G2_BAC").map(branch => branch.branchId)).toEqual([
      "ENG_VOCABULARY",
      "ENG_GRAMMAR",
      "ENG_GRE",
      "ENG_TEXTBOOK",
      "ENG_STORY",
    ]);
    expect(getSIECheckpointBranches("HIS_G2_BAC").map(branch => branch.branchId)).toEqual(["HIS_G2_BAC:FULL"]);
    expect(getSIECheckpointBranches("PROG_AI_G2_BAC").map(branch => branch.branchId)).toEqual(["PROG_AI_G2_BAC:FULL"]);
  });

  it("orders linked programming concepts without blocking or deleting later steps", () => {
    const plan = {
      steps: [
        { title: "الاستجابة للحوادث", curriculumNodeIds: ["PROG_2_3"] },
        { title: "تصميم أمن الشبكات", curriculumNodeIds: ["PROG_2_2"] },
        { title: "التشفير والمصادقة", curriculumNodeIds: ["PROG_2_1"] },
      ],
    };
    const result = orderPlanStepsByCurriculumDependencies(plan);
    expect(result.steps.map(step => step.curriculumNodeIds[0])).toEqual([
      "PROG_2_1",
      "PROG_2_2",
      "PROG_2_3",
    ]);
    expect(result.steps).toHaveLength(3);
  });

  it("keeps English grammar and vocabulary as separate unit-linked tracking branches", () => {
    const result = retrieveTextbookEvidence(["ENG1_G2_BAC"], "English part 1", 5);
    const note = result.coverageNotes.join("\\n");
    expect(note).toContain("ENG_VOCABULARY");
    expect(note).toContain("ENG_GRAMMAR");
    expect(note).toContain("ENG_TEXTBOOK");
    expect(note).toContain("ربط مسارات الإنجليزي حسب الوحدة دون دمج الفروع");
  });
});

describe("second-year Baccalaureate exam window", () => {
  it("uses the user-confirmed approximate June window and a planning readiness target", () => {
    expect(SECOND_YEAR_BAC_EXAM_WINDOW_2026_2027).toMatchObject({
      start: "2027-06-12",
      end: "2027-06-22",
      planningReadyBy: "2027-06-11",
      precision: "approximate_user_confirmed",
    });
  });

  it("does not invent paper format, question counts, or component weights", () => {
    for (const id of ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC"]) {
      const blueprint = getSubjectExamBlueprint(id);
      expect(blueprint?.mcqShare).toBeNull();
      expect(blueprint?.essayShare).toBeNull();
      expect(blueprint?.paperMarks).toBeNull();
      expect(blueprint?.components).toEqual([]);
    }
    const context = buildExamBlueprintContext([
      { id: "ARB_G2_BAC", name: "العربي" },
      { id: "ENG1_G2_BAC", name: "الإنجليزي" },
      { id: "HIS_G2_BAC", name: "التاريخ" },
      { id: "PROG_AI_G2_BAC", name: "البرمجة والذكاء الاصطناعي" },
    ]);
    expect(context).toContain("12 يونيو 2027 إلى 22 يونيو 2027");
    expect(context).toContain("لا توجد حتى الآن نماذج استرشادية");
    expect(context).not.toContain("50% اختيار من متعدد");
    expect(context).not.toContain("عدد الأسئلة: 50");
  });
});

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
    expect(note).toContain("الصعوبة hard");
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
    expect(note).toContain("الصعوبة hard");
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
    expect(note).toContain("صعوبة كل موضوع تظل unknown");
    expect(note).toContain("نطاق مرئي تقديري");
    expect(note).toContain("ENG_U1_SEC_A_T1");
    expect(note).toContain("ENG_GRAMMAR_U1");
    expect(note).toContain("ENG_VOCABULARY_U1");
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
