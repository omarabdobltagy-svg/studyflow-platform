import { describe, expect, it } from "vitest";
import { getExpectedToDateChoices } from "./egypt-school-calendar";
import {
  getSIECheckpointBranches,
  getSIECheckpointChoiceDisplayLabel,
  getSIECheckpointChoiceTypeLabel,
  getSIECheckpointChoices,
  getSIECheckpointChoicesForTeacher,
  getSIETeachersForSubject,
} from "./sie-catalog";

describe("Arabic course taxonomy", () => {
  it("separates Arabic lessons into the right learning branches", () => {
    const branches = getSIECheckpointBranches("ARB_G2_BAC");
    expect(branches.map(branch => branch.branchId)).toEqual([
      "ARB_NAHW",
      "ARB_BALAGHA",
      "ARB_READING",
      "ARB_TEXTS",
      "ARB_EXPRESSION",
      "ARB_SPELLING",
      "ARB_LITERATURE",
    ]);
    expect(branches.find(branch => branch.branchId === "ARB_NAHW")?.choices.map(choice => choice.title))
      .toContain("الأسماء الخمسة");
    expect(branches.find(branch => branch.branchId === "ARB_BALAGHA")?.choices.map(choice => choice.title))
      .toEqual([
        "الأسلوب الخبري والأسلوب الإنشائي",
        "الصورة الخيالية",
        "الإيجاز في البلاغة",
        "الإطناب",
      ]);
    expect(branches.find(branch => branch.branchId === "ARB_TEXTS")?.choices.map(choice => choice.title))
      .toContain("العلم نور");
  });

  it("includes all 21 indexed teacher-course lessons with their sequence numbers and source", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    const platformLessons = choices.filter(choice => choice.courseSequenceNumber);
    expect(platformLessons).toHaveLength(21);
    expect(platformLessons.map(choice => choice.courseSequenceNumber).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(choices.find(choice => choice.courseSequenceNumber === 19)).toMatchObject({
      title: "الإطناب",
      lessonType: "rhetoric",
      branchId: "ARB_BALAGHA",
    });
    expect(choices.find(choice => choice.courseSequenceNumber === 9)).toMatchObject({
      title: "التاء المربوطة والهاء المربوطة",
      lessonType: "spelling",
      branchId: "ARB_SPELLING",
    });
  });

  it("keeps all remaining textbook-only Arabic grammar, reading and text checkpoints", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    expect(choices.map(choice => choice.nodeId)).toContain("ARB_U3_N2");
    expect(choices.map(choice => choice.nodeId)).toContain("ARB_U3_L3");
    expect(new Set(choices.map(choice => choice.nodeId)).size).toBe(choices.length);
  });

  it("returns readable Arabic types and source-aware labels", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    const rhetoric = choices.find(choice => choice.courseSequenceNumber === 19)!;
    expect(getSIECheckpointChoiceTypeLabel(rhetoric)).toBe("بلاغة");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("الدرس 19 من 21");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("الفرع: البلاغة");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("فهرس منصة الشرح");
  });
});

describe("English curriculum selector metadata", () => {
  it("provides all 20 English topics with numbering, type, unit and official A/B section", () => {
    const choices = getSIECheckpointChoices("ENG1_G2_BAC");
    expect(choices).toHaveLength(50);
    expect(choices.filter(choice => choice.nodeId.startsWith("ENG_U") && choice.nodeId.includes("_SEC_"))).toHaveLength(40);
    expect(choices.filter(choice => choice.nodeId.startsWith("ENG_LOST_WORLD_CH"))).toHaveLength(10);
    expect(choices.find(choice => choice.nodeId === "ENG_U1_SEC_A_T1")).toMatchObject({
      lessonNumber: "1.1",
      unitNumber: 1,
      lessonType: "topic",
      branchId: "ENG_U1_SEC_A",
      branchTitle: "Unit 1 · Section A — Social Reflection",
    });
    expect(choices.find(choice => choice.nodeId === "ENG_U5_SEC_B_T2")?.lessonNumber).toBe("5.4");
    expect(choices.find(choice => choice.nodeId === "ENG_U6_SEC_A_T1")?.lessonNumber).toBe("6.1");
    expect(choices.find(choice => choice.nodeId === "ENG_U10_SEC_B_T2")?.lessonNumber).toBe("10.4");
    expect(choices.find(choice => choice.nodeId === "ENG_U8_SEC_B_T1")?.branchTitle).toContain("Building Future Professionals");
  });

  it("limits English textbook, Vocabulary and Grammar choices to the expected term window", () => {
    const branches = getSIECheckpointBranches("ENG1_G2_BAC");
    const textbook = branches.find(branch => branch.branchId === "ENG_TEXTBOOK")!;
    const vocabulary = branches.find(branch => branch.branchId === "ENG_VOCABULARY")!;
    const grammar = branches.find(branch => branch.branchId === "ENG_GRAMMAR")!;

    const octoberTopics = getExpectedToDateChoices(textbook.choices, "2026-10-18");
    const novemberTopics = getExpectedToDateChoices(textbook.choices, "2026-11-24");
    expect(octoberTopics).toHaveLength(7);
    expect(octoberTopics.every(choice => (choice.unitNumber ?? 0) <= 5)).toBe(true);
    expect(novemberTopics).toHaveLength(13);
    expect(novemberTopics.every(choice => (choice.unitNumber ?? 0) <= 5)).toBe(true);

    expect(getExpectedToDateChoices(vocabulary.choices, "2026-11-24")).toHaveLength(4);
    expect(getExpectedToDateChoices(grammar.choices, "2026-11-24")).toHaveLength(4);
  });

  it("shows lesson number, name, type and section in the visible English label", () => {
    const lesson = getSIECheckpointChoices("ENG1_G2_BAC").find(choice => choice.nodeId === "ENG_U1_SEC_A_T1")!;
    const label = getSIECheckpointChoiceDisplayLabel(lesson);
    expect(label).toContain("Lesson 1.1");
    expect(label).toContain("Social Media and Self-Image");
    expect(label).toContain("موضوع (Topic)");
    expect(label).toContain("Section A — Social Reflection");
  });
});


describe("subject curriculum layouts", () => {
  it("keeps History as one complete linear list rather than chapter branches", () => {
    const branches = getSIECheckpointBranches("HIS_G2_BAC");
    expect(branches).toHaveLength(1);
    expect(branches[0].branchTitle).toBe("المقرر بالكامل");
    expect(branches[0].choices).toHaveLength(24);
    expect(branches[0].choices[12]).toMatchObject({
      nodeId: "HIS_U4_L1",
      lessonNumber: "4.1",
      unitNumber: 4,
    });
    expect(branches[0].choices[23].nodeId).toBe("HIS_U6_L4");
  });

  it("keeps all seven Programming chapters in one complete linear list", () => {
    const branches = getSIECheckpointBranches("PROG_AI_G2_BAC");
    expect(branches).toHaveLength(1);
    expect(branches[0].branchTitle).toBe("المقرر بالكامل");
    expect(branches[0].choices).toHaveLength(23);
    expect(branches[0].choices[14]).toMatchObject({
      nodeId: "PROG_5_1",
      unitNumber: 5,
      lessonNumber: "5.1",
      sourceLabel: "كتاب البرمجة - الجزء 2",
    });
    expect(branches[0].choices[22].nodeId).toBe("PROG_7_3");
  });

  it("models English Vocabulary, Grammar and GRE separately from all textbook topics", () => {
    const branches = getSIECheckpointBranches("ENG1_G2_BAC");
    expect(branches.map(branch => branch.branchId)).toEqual([
      "ENG_VOCABULARY", "ENG_GRAMMAR", "ENG_GRE", "ENG_TEXTBOOK", "ENG_STORY",
    ]);
    expect(branches.find(branch => branch.branchId === "ENG_VOCABULARY")?.choices).toHaveLength(10);
    expect(branches.find(branch => branch.branchId === "ENG_GRAMMAR")?.choices).toHaveLength(10);
    expect(branches.find(branch => branch.branchId === "ENG_GRE")?.choices).toHaveLength(4);
    expect(branches.find(branch => branch.branchId === "ENG_TEXTBOOK")?.choices).toHaveLength(40);
    expect(branches.find(branch => branch.branchId === "ENG_STORY")?.choices).toHaveLength(10);
    expect(branches.find(branch => branch.branchId === "ENG_STORY")?.choices[0].title).toBe("A Dream of Adventure");
    expect(branches.find(branch => branch.branchId === "ENG_VOCABULARY")?.choices[0]).toMatchObject({
      nodeId: "ENG_VOCABULARY_U1",
      lessonType: "vocabulary",
      unitNumber: 1,
    });
    expect(branches.find(branch => branch.branchId === "ENG_GRAMMAR")?.choices[9]).toMatchObject({
      nodeId: "ENG_GRAMMAR_U10",
      lessonType: "grammar",
      unitNumber: 10,
    });
    expect(branches.find(branch => branch.branchId === "ENG_GRE")?.choices[0].sourceLabel).toContain("خارج المقرر الوزاري");
  });

  it("gives subjects without a loaded index one editable linear curriculum path", () => {
    const branches = getSIECheckpointBranches("PHY_G2_BAC_PENDING");
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({
      branchId: "PHY_G2_BAC_PENDING:FULL",
      branchTitle: "المقرر بالكامل",
      branchType: "course_track",
      choices: [],
    });
  });

  it("does not truncate a teacher's available course index to the first five lessons", () => {
    const teacher = getSIETeachersForSubject("ENG1_G2_BAC", "EG_BACCALAUREATE")[0];
    expect(teacher).toBeDefined();
    expect(getSIECheckpointChoicesForTeacher(teacher.teacherId)).toHaveLength(50);
  });
});

describe("Arabic named reading texts", () => {
  it("keeps actual text titles and excludes generic reading-analysis skills", () => {
    const reading = getSIECheckpointBranches("ARB_G2_BAC").find(branch => branch.branchId === "ARB_READING");
    const titles = reading?.choices.map(choice => choice.title) ?? [];
    expect(titles).toContain("العلم بين القانون والضمير");
    expect(titles).toContain("التقنية وصناعة الرأي العام");
    expect(titles).toContain("المرأة وبناء الدولة الحديثة");
    expect(titles).toContain("الثقافة أداة لا حلية");
    expect(titles).not.toContain("شرح زاوية الرؤية");
    expect(titles).not.toContain("أنواع الخطاب في النص المعلوماتي");
  });

  it("keeps Part 2 named poems in the Texts path rather than Reading skills", () => {
    const texts = getSIECheckpointBranches("ARB_G2_BAC").find(branch => branch.branchId === "ARB_TEXTS");
    const titles = texts?.choices.map(choice => choice.title) ?? [];
    expect(titles).toContain("أهواك يا وطني");
    expect(titles).toContain("دعوة إلى السلام");
    expect(titles).toContain("غُربة وحنين");
  });
});
