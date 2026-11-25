import { describe, expect, it } from "vitest";
import {
  SIE_SUBJECTS,
  SIE_TRACKS,
  getSIECheckpointBranches,
  getSIECheckpointChoiceDisplayLabel,
  getSIECheckpointChoiceTypeLabel,
  getSIECheckpointChoices,
  getSIECheckpointChoicesForTeacher,
  getSIECheckpointProgressOptions,
  getSIECheckpointProgressBranches,
  getSIEStudentVisibleBranches,
  getSIECheckpointUnits,
  matchSIECheckpointTask,
  normalizeSIECheckpointFrontier,
  getSIETeachersForSubject,
  validateSIESubjectSelection,
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
      title: "الفرق بين التاء المربوطة والهاء والتاء المفتوحة",
      lessonType: "spelling",
      branchId: "ARB_SPELLING",
    });
  });

  it("keeps all Arabic textbook grammar checkpoints, including the named application lessons", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    const nahw = getSIECheckpointBranches("ARB_G2_BAC").find(branch => branch.branchId === "ARB_NAHW");
    expect(nahw?.choices).toHaveLength(8);
    expect(nahw?.choices.map(choice => choice.nodeId)).toContain("ARB_U1_N3");
    expect(nahw?.choices.map(choice => choice.nodeId)).toContain("ARB_U2_N3");
    expect(nahw?.choices.map(choice => choice.title)).toContain("تطبيق على الأسماء الخمسة");
    expect(nahw?.choices.map(choice => choice.title)).toContain("تطبيق على الممنوع من الصرف وعلل منعه");
    expect(choices.map(choice => choice.nodeId)).toContain("ARB_U3_L3");
    expect(new Set(choices.map(choice => choice.nodeId)).size).toBe(choices.length);
  });

  it("treats multi-part Arabic grammar topics as one completed topic in progress selectors", () => {
    const options = getSIECheckpointProgressOptions("ARB_G2_BAC", "ARB_NAHW");
    const mamnooOptions = options.filter(option =>
      option.value === "ARB_U2_N3"
      || option.label.includes("الممنوع من الصرف")
      || option.label.includes("تابع الممنوع")
    );
    expect(mamnooOptions).toHaveLength(1);
    expect(mamnooOptions[0]).toMatchObject({
      value: "ARB_U2_N3",
      label: "الممنوع من الصرف وعلل منعه",
    });
    expect(options.find(option => option.value === "ARB_U3_N1")?.label)
      .toBe("النعت والبدل والتمييز بينهما");
    expect(options.findIndex(option => option.value === "ARB_U3_N1"))
      .toBe(options.findIndex(option => option.value === "ARB_U2_N3") + 1);

    for (const id of ["ARB_U2_N1", "ARB_U2_N2", "ARB_U2_N3"]) {
      expect(normalizeSIECheckpointFrontier("ARB_G2_BAC", "ARB_NAHW", id)).toBe("ARB_U2_N3");
    }
    expect(normalizeSIECheckpointFrontier("ARB_G2_BAC", "ARB_NAHW", "ARB_U3_N1")).toBe("ARB_U3_N1");
  });

  it("groups the official Arabic textbook into three units across its independent branches", () => {
    const units = getSIECheckpointUnits("ARB_G2_BAC");
    const officialUnits = units.filter(unit => unit.isOfficialUnit);
    expect(officialUnits.map(unit => unit.unitNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(officialUnits.map(unit => unit.unitTitle)).toEqual([
      "العلم والضمير",
      "سلطان الكلمة الرقمية",
      "الإنسان وكرامته",
      "بناء الوعي",
      "فن التفاوض والقيادة",
      "الثقافة أسلوب حياة",
    ]);
    const unitThreeNahw = officialUnits[2].branches.find(branch => branch.branchId === "ARB_NAHW");
    expect(unitThreeNahw?.choices.map(choice => choice.title)).toContain("النعت والبدل والتمييز بينهما");
    expect(unitThreeNahw?.choices.filter(choice => choice.title.includes("النعت والبدل والتمييز"))).toHaveLength(1);
  });

  it("keeps Arabic teacher-course branches separate from official textbook units", () => {
    const units = getSIECheckpointUnits("ARB_G2_BAC");
    const teacherTopics = units.filter(unit => !unit.isOfficialUnit);
    const titles = teacherTopics.map(unit => unit.title);
    expect(titles).toContain("التعبير");
    expect(titles).toContain("الإملاء");
    expect(titles).toContain("الأدب والقصة");
    expect(new Set(teacherTopics.map(unit => unit.unitId)).size).toBe(teacherTopics.length);
    for (const unit of teacherTopics) expect(unit.branches).toHaveLength(1);
    expect(teacherTopics.find(unit => unit.title === "التعبير")?.lessonCount).toBe(7);
    expect(teacherTopics.find(unit => unit.title === "الإملاء")?.lessonCount).toBe(2);
    expect(teacherTopics.find(unit => unit.title === "الأدب والقصة")?.lessonCount).toBe(12);
  });

  it("hides the standalone Reading branch while preserving legacy text IDs inside official units", () => {
    const rawReading = getSIECheckpointBranches("ARB_G2_BAC").find(branch => branch.branchId === "ARB_READING");
    expect(rawReading?.choices.map(choice => choice.nodeId)).toContain("ARB_U1_L1");

    const visible = getSIEStudentVisibleBranches("ARB_G2_BAC");
    expect(visible.map(branch => branch.branchId)).not.toContain("ARB_READING");
    expect(visible.map(branch => branch.branchId)).toEqual([
      "ARB_NAHW", "ARB_BALAGHA", "ARB_TEXTS", "ARB_EXPRESSION", "ARB_SPELLING", "ARB_LITERATURE",
    ]);

    const firstUnitReading = getSIECheckpointUnits("ARB_G2_BAC")
      .find(unit => unit.unitNumber === 1)
      ?.branches.find(item => item.branchId === "ARB_READING");
    expect(firstUnitReading?.branchTitle).toBe("نصوص الوحدة");
    expect(firstUnitReading?.choices.map(choice => choice.nodeId)).toContain("ARB_U1_L1");
  });

  it("includes the ten story works plus the book's literature-terms and general-exercise sections", () => {
    const literature = getSIECheckpointProgressBranches("ARB_G2_BAC")
      .find(branch => branch.branchId === "ARB_LITERATURE");
    const stories = literature?.choices.filter(choice => choice.lessonType === "story") ?? [];
    const supportSections = literature?.choices.filter(choice => choice.lessonType === "topic") ?? [];
    expect(stories).toHaveLength(10);
    expect(stories.map(choice => choice.title)).toEqual([
      "حكايات الغريب", "عودة الروح", "كفاح طيبة", "الأرض", "شمس وليل",
      "العبرات", "وا إسلاماه", "عبقرية عمر", "رجل تحت الصفر", "صح النوم",
    ]);
    expect(supportSections.map(choice => choice.title)).toEqual([
      "مصطلحات النقد الأدبي",
      "التدريبات العامة على الأعمال الأدبية",
    ]);
    expect(stories[2]).toMatchObject({ author: "نجيب محفوظ", lessonType: "story" });
    expect(getSIECheckpointChoiceDisplayLabel(stories[2])).toContain("المؤلف: نجيب محفوظ");
  });

  it("keeps expression activities in the catalog and preserves legacy spelling IDs without showing them as lessons", () => {
    const rawChoices = getSIECheckpointChoices("ARB_G2_BAC");
    const branches = getSIECheckpointBranches("ARB_G2_BAC");
    const expression = branches.find(branch => branch.branchId === "ARB_EXPRESSION");
    const spelling = branches.find(branch => branch.branchId === "ARB_SPELLING");
    const expressionIds = expression?.choices.map(choice => choice.nodeId) ?? [];
    const spellingIds = spelling?.choices.map(choice => choice.nodeId) ?? [];

    for (const id of [
      "ARB_EXP_U1_POSITION_WRITE",
      "ARB_EXP_U1_INFO_PARAGRAPH",
      "ARB_EXP_U1_INTERVIEW",
      "ARB_EXP_U1_CRITICAL_PARAGRAPH",
      "ARB_EXP_U1_OPINION_PARAGRAPH",
      "ARB_EXP_U1_SHORT_POSITION",
      "ARB_EXP_U1_DIALOGUE",
      "ARB_EXP_U2_SHORT_STORY",
      "ARB_EXP_U2_SUMMARY_REWRITE",
      "ARB_EXP_U2_POSITION",
      "ARB_EXP_U2_ORAL_PRESENTATION",
      "ARB_EXP_U2_ANALYTICAL_PARAGRAPH",
    ]) expect(expressionIds).toContain(id);

    const legacySpellingIds = [
      "ARB_SPELL_U1_HAMZA_PRACTICE",
      "ARB_SPELL_U1_TAA_MARBUTA",
      "ARB_SPELL_U1_CORRECT_WRITING",
      "ARB_SPELL_U1_TAA_TYPES",
      "ARB_SPELL_U2_HAMZA_CORRECTION",
      "ARB_SPELL_U2_ORTHOGRAPHY_REVIEW",
    ];
    for (const id of legacySpellingIds) {
      expect(rawChoices.some(choice => choice.nodeId === id)).toBe(true);
      expect(spellingIds).not.toContain(id);
    }
    expect(spellingIds).toEqual(["ARB_C09_TAA_MARBUTA", "ARB_SPELL_U2_MIDDLE_HAMZA", "ARB_C20_HAMZA"]);
    expect(spelling?.choices.find(choice => choice.nodeId === "ARB_SPELL_U2_MIDDLE_HAMZA")).toMatchObject({
      title: "رسم الهمزة المتوسطة", unitNumber: 2, lessonType: "spelling", sourceLabel: "كتاب الطالب - الجزء الأول، الوحدة الثانية",
    });
    expect(expression?.choices.find(choice => choice.nodeId === "ARB_EXP_U1_CRITICAL_PARAGRAPH")?.sourceLabel).toContain("ص36");
    expect(expression?.choices.find(choice => choice.nodeId === "ARB_EXP_U2_ANALYTICAL_PARAGRAPH")?.sourceLabel).toContain("ص85");
    expect(new Set([...expressionIds, ...spellingIds]).size).toBe(expressionIds.length + spellingIds.length);
  });

  it("shows the actual spelling course lessons and the extra Ministry topic in progress selectors", () => {
    const options = getSIECheckpointProgressOptions("ARB_G2_BAC", "ARB_SPELLING");
    expect(options).toHaveLength(3);
    expect(options.map(option => option.value)).toEqual(["ARB_C09_TAA_MARBUTA", "ARB_SPELL_U2_MIDDLE_HAMZA", "ARB_C20_HAMZA"]);
    expect(options[0].description).toContain("كورس المدرس");
    expect(options[1].description).toContain("الوحدة 2");
    expect(options[1].description).toContain("كتاب الطالب");
    expect(options[2].description).toContain("كورس المدرس");
    expect(options.some(option => option.label.includes("تطبيق") || option.description?.includes("تطبيق إملائي"))).toBe(false);
    expect(getSIECheckpointUnits("ARB_G2_BAC").find(unit => unit.unitNumber === 2)?.branches.find(item => item.branchId === "ARB_SPELLING")?.choices.map(choice => choice.title)).toContain("رسم الهمزة المتوسطة");
    // Legacy exercise records remain addressable for previously saved progress.
    expect(getSIECheckpointChoices("ARB_G2_BAC").some(choice => choice.nodeId === "ARB_SPELL_U1_TAA_MARBUTA")).toBe(true);
  });

  it("uses the student's visible Arabic topic units to match existing tasks without changing progress", () => {
    const visibleNahw = getSIECheckpointProgressBranches("ARB_G2_BAC").find(branch => branch.branchId === "ARB_NAHW");
    expect(visibleNahw?.choices.filter(choice => choice.title.includes("الممنوع من الصرف"))).toHaveLength(1);
    expect(visibleNahw?.choices.find(choice => choice.title.includes("الممنوع من الصرف"))?.nodeId).toBe("ARB_U2_N3");

    const taskMatch = matchSIECheckpointTask(["ARB_G2_BAC"], "نرس الممنوع من الصرف");
    expect(taskMatch).toMatchObject({
      subjectId: "ARB_G2_BAC",
      branchId: "ARB_NAHW",
      nodeId: "ARB_U2_N3",
      confidence: "strong",
    });
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
  it("exposes each English unit's four textbook topics plus Vocabulary and Grammar checkpoints", () => {
    const units = getSIECheckpointUnits("ENG1_G2_BAC");
    const unitOne = units.find(unit => unit.unitNumber === 1);
    expect(unitOne).toBeDefined();
    const choices = unitOne!.branches.flatMap(branch => branch.choices);
    expect(choices.filter(choice => choice.lessonType === "topic").map(choice => choice.lessonNumber)).toEqual(["1.1", "1.2", "1.3", "1.4"]);
    expect(choices.some(choice => choice.lessonType === "vocabulary")).toBe(true);
    expect(choices.some(choice => choice.lessonType === "grammar")).toBe(true);
  });

  it("groups Vocabulary and variable-count Grammar lessons inside each official English unit", () => {
    const units = getSIECheckpointUnits("ENG1_G2_BAC").filter(unit => unit.isOfficialUnit);
    const expectedGrammarCounts = [2, 2, 3, 3, 3, 1, 1, 2, 2, 2];
    expect(units).toHaveLength(10);
    for (let unitNumber = 1; unitNumber <= 10; unitNumber += 1) {
      const unit = units.find(item => item.unitNumber === unitNumber);
      expect(unit).toBeDefined();
      const choices = unit!.branches.flatMap(item => item.choices);
      const topics = choices.filter(choice => choice.lessonType === "topic");
      const vocabulary = choices.filter(choice => choice.lessonType === "vocabulary");
      const grammar = choices.filter(choice => choice.lessonType === "grammar");
      expect(topics).toHaveLength(4);
      expect(topics.map(choice => choice.lessonNumber)).toEqual([unitNumber + ".1", unitNumber + ".2", unitNumber + ".3", unitNumber + ".4"]);
      expect(topics.every(choice => Boolean(choice.title.trim()))).toBe(true);
      expect(vocabulary).toHaveLength(1);
      expect(vocabulary[0]).toMatchObject({ title: "Vocabulary", lessonNumber: "1", unitNumber });
      expect(grammar).toHaveLength(expectedGrammarCounts[unitNumber - 1]);
      expect(grammar.map(choice => choice.lessonNumber)).toEqual(grammar.map((_choice, index) => String(index + 2)));
      expect(grammar.every(choice => Boolean(choice.title.trim()))).toBe(true);
    }
  });
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

  it("organizes English lessons under the ten textbook units, with one Vocabulary lesson and the curriculum Grammar lessons inside each unit", () => {
    const branches = getSIECheckpointBranches("ENG1_G2_BAC");
    expect(branches.map(branch => branch.branchId)).toEqual([
      "ENG_VOCABULARY", "ENG_GRAMMAR", "ENG_GRE", "ENG_TEXTBOOK", "ENG_STORY",
    ]);
    expect(branches.find(branch => branch.branchId === "ENG_VOCABULARY")?.choices).toHaveLength(10);
    expect(branches.find(branch => branch.branchId === "ENG_GRAMMAR")?.choices).toHaveLength(21);
    expect(branches.find(branch => branch.branchId === "ENG_GRE")?.choices).toHaveLength(4);
    expect(branches.find(branch => branch.branchId === "ENG_TEXTBOOK")?.choices).toHaveLength(40);
    expect(branches.find(branch => branch.branchId === "ENG_TEXTBOOK")?.branchTitle).toBe("الوحدات (Units)");
    expect(branches.find(branch => branch.branchId === "ENG_STORY")?.choices).toHaveLength(10);
    expect(branches.find(branch => branch.branchId === "ENG_STORY")?.choices[0].title).toBe("A Dream of Adventure");
    expect(branches.find(branch => branch.branchId === "ENG_VOCABULARY")?.choices[0]).toMatchObject({
      nodeId: "ENG_VOCABULARY_U1", title: "Vocabulary", lessonNumber: "1", lessonType: "vocabulary", unitNumber: 1,
    });
    expect(branches.find(branch => branch.branchId === "ENG_GRAMMAR")?.choices.slice(0, 3).map(choice => ({
      nodeId: choice.nodeId, title: choice.title, lessonNumber: choice.lessonNumber, unitNumber: choice.unitNumber,
    }))).toEqual([
      { nodeId: "ENG_GRAMMAR_U1", title: "Participial Phrases and Relative Clauses", lessonNumber: "2", unitNumber: 1 },
      { nodeId: "ENG_GRAMMAR_U1_2", title: "Conditional Structures", lessonNumber: "3", unitNumber: 1 },
      { nodeId: "ENG_GRAMMAR_U2", title: "Gerunds and Infinitives", lessonNumber: "2", unitNumber: 2 },
    ]);
    expect(branches.find(branch => branch.branchId === "ENG_GRAMMAR")?.choices.at(-1)).toMatchObject({
      nodeId: "ENG_GRAMMAR_U10_2", title: "Quantifiers", lessonNumber: "3", unitNumber: 10,
    });
    expect(branches.find(branch => branch.branchId === "ENG_GRE")?.choices[0].sourceLabel).toContain("خارج المقرر الوزاري");

    const visible = getSIEStudentVisibleBranches("ENG1_G2_BAC");
    expect(visible.map(branch => branch.branchId)).toEqual(["ENG_TEXTBOOK", "ENG_GRE", "ENG_STORY"]);
    expect(visible[0].branchTitle).toBe("الوحدات (Units)");
  });

  it("shows the English lesson number and skill type in progress picker descriptions", () => {
    const vocabulary = getSIECheckpointProgressOptions("ENG1_G2_BAC", "ENG_VOCABULARY");
    const grammar = getSIECheckpointProgressOptions("ENG1_G2_BAC", "ENG_GRAMMAR");
    expect(vocabulary[0].description).toContain("Lesson 1 · Vocabulary");
    expect(vocabulary[0].description).toContain("الوحدة 1");
    expect(grammar[0].description).toContain("Lesson 2 · Grammar");
    expect(grammar[0].description).toContain("الوحدة 1");
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

describe("retired second-language subject", () => {
  it("removes Italian/second foreign language from the subject catalogue and tracks", () => {
    const retiredId = "SECOND_LANGUAGE_G2_BAC_PENDING";
    expect(SIE_SUBJECTS.some(subject => subject.subjectId === retiredId)).toBe(false);
    expect(SIE_TRACKS.every(track =>
      !track.requiredSubjectIds.includes(retiredId)
      && !(track.fixedSubjectIds ?? []).includes(retiredId)
      && !track.electiveOptions.flat().some(subject => subject.subjectId === retiredId)
    )).toBe(true);
  });

  it("makes Psychology the fixed specialization in Arts and Humanities after the removal", () => {
    const arts = SIE_TRACKS.find(track => track.trackId === "BAC_ARTS_HUM")!;
    expect(arts.requiredSubjectIds).toContain("PSYCHOLOGY_G2_BAC_PENDING");
    expect(arts.electiveOptions).toEqual([]);
    expect(validateSIESubjectSelection("EG_BACCALAUREATE", arts.trackId, arts.requiredSubjectIds)).toBe(true);
  });
});


  it("exposes more than six full-year Arabic grammar checkpoints", () => {
    const grammar = getSIECheckpointBranches("ARB_G2_BAC")
      .find(branch => branch.branchId === "ARB_NAHW");
    expect(grammar).toBeDefined();
    expect(grammar!.choices.length).toBeGreaterThan(6);
  });

  it("does not show teacher-course sequence numbering in lesson display labels", () => {
    const choice = getSIECheckpointChoices("ARB_G2_BAC")
      .find(item => typeof item.courseSequenceNumber === "number");
    expect(choice).toBeDefined();
    const label = getSIECheckpointChoiceDisplayLabel(choice!);
    expect(label).not.toContain("من 21");
    expect(label).toContain(choice!.title);
  });

});
