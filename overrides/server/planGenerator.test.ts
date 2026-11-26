import { describe, expect, it } from "vitest";
import {
  applyCurriculumPrioritySignals,
  applyPlannerCurriculumCoverageGuard,
  applyPlannerProgressGuard,
  applyTeacherLedPlanningGuard,
  parseGeneratedPlan,
} from "./planGenerator";
import { getSIECheckpointBranches } from "@shared/sie-catalog";

describe("annual plan curriculum coverage and progress alignment", () => {
  it("treats the selected Arabic grammar topic as fully completed and puts the teacher's next topic first", () => {
    const profile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        learningCourseProgress: {
          ARB_G2_BAC: {
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "ARB_U2_N1",
                teacherTeachingFrontierId: "ARB_U3_N1",
              },
            },
          },
        },
      },
    } as any;
    const plan = parseGeneratedPlan(JSON.stringify({
      title: "خريطة النحو",
      summary: "خريطة متابعة النحو.",
      durationLabel: "أيام",
      steps: [
        {
          day: "اليوم 1",
          title: "العطف",
          detail: "متابعة شرح المدرس للموضوع.",
          minutes: 45,
          category: "النحو",
          curriculumNodeIds: ["ARB_U3_N2"],
        },
        {
          day: "اليوم 1",
          title: "النعت والبدل",
          detail: "متابعة شرح المدرس للموضوع.",
          minutes: 45,
          category: "النحو",
          curriculumNodeIds: ["ARB_U3_N1_NAAT_BADAL"],
        },
        {
          day: "اليوم 1",
          title: "التمييز",
          detail: "متابعة شرح المدرس للموضوع.",
          minutes: 45,
          category: "النحو",
          curriculumNodeIds: ["ARB_U3_N1_TAMYIZ"],
        },
      ],
      habits: [],
    }));

    const progressGuarded = applyPlannerProgressGuard(plan, profile);
    const covered = applyPlannerCurriculumCoverageGuard(progressGuarded, profile);
    const ranked = applyCurriculumPrioritySignals(covered, profile);
    const grammarIds = ranked.steps.flatMap(step => step.curriculumNodeIds)
      .filter(id => /^ARB_U[123]_N[123]$/.test(id) || id === "ARB_U3_N1_NAAT_BADAL" || id === "ARB_U3_N1_TAMYIZ");

    expect(grammarIds).toEqual(["ARB_U3_N1_NAAT_BADAL", "ARB_U3_N1_TAMYIZ", "ARB_U3_N2"]);
    const nextGrammarStep = ranked.steps.find(step => step.curriculumNodeIds.includes("ARB_U3_N1_NAAT_BADAL"));
    const nextStepIndex = ranked.steps.findIndex(step => step.curriculumNodeIds.includes("ARB_U3_N1_NAAT_BADAL"));
    const followingGrammarIndex = ranked.steps.findIndex(step => step.curriculumNodeIds.includes("ARB_U3_N1_TAMYIZ"));
    expect(nextStepIndex).toBeGreaterThanOrEqual(0);
    expect(nextStepIndex).toBeLessThan(followingGrammarIndex);
    expect(nextGrammarStep?.priorityReason).toContain("الخطوة التالية مباشرة");
    expect(nextGrammarStep?.priorityReason).toContain("الفجوة الحالية: 2");
  });

  it("covers all remaining programming chapters, including chapters 5–7, once", () => {
    const profile = {
      subjectIds: ["PROG_AI_G2_BAC"],
      selection: {},
    } as any;
    const firstChapterNode = getSIECheckpointBranches("PROG_AI_G2_BAC")[0].choices[0].nodeId;
    const plan = parseGeneratedPlan(JSON.stringify({
      title: "خريطة البرمجة",
      summary: "خريطة المقرر بالكامل.",
      durationLabel: "أيام",
      steps: [{
        day: "اليوم 1",
        title: "بداية المقرر",
        detail: "متابعة شرح المدرس وقراءة الكتاب.",
        minutes: 45,
        category: "البرمجة والذكاء الاصطناعي",
        curriculumNodeIds: [firstChapterNode],
      }],
      habits: [],
    }));

    const covered = applyPlannerCurriculumCoverageGuard(plan, profile);
    const ids = covered.steps.flatMap(step => step.curriculumNodeIds);
    const officialIds = getSIECheckpointBranches("PROG_AI_G2_BAC")[0].choices.map(choice => choice.nodeId);
    const laterChapters = officialIds.filter(id => /^PROG_[5-7]_/.test(id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(officialIds));
    expect(laterChapters.length).toBeGreaterThan(0);
    for (const id of laterChapters) expect(ids).toContain(id);
  });
});

describe("AI planner response normalization", () => {
  it("accepts a valid plan with fewer than three eligible tasks", () => {
    const plan = parseGeneratedPlan(JSON.stringify({
      title: "خطة مراجعة العربي",
      summary: "خطة مركزة على الدروس المتبقية مع وقت للحل والاسترجاع.",
      durationLabel: "يومان",
      steps: [
        {
          day: "اليوم 1",
          title: "الممنوع من الصرف",
          detail: "فهم القاعدة والأمثلة من الكتاب ثم كتابة ملخص.",
          minutes: 45,
          category: "العربي",
        },
        {
          day: "اليوم 2",
          title: "تطبيقات على القاعدة",
          detail: "حل تدريبات متنوعة وتصحيح الأخطاء.",
          minutes: 35,
          category: "العربي",
        },
      ],
      habits: [],
    }));

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]).toMatchObject({
      title: "الممنوع من الصرف",
      minutes: 45,
      curriculumNodeIds: [],
      priority: "medium",
      difficulty: "unknown",
    });
  });

  it("normalizes common task aliases and missing optional metadata", () => {
    const plan = parseGeneratedPlan(JSON.stringify({
      name: "خطة أسبوعية",
      description: "خطة منظمة تتعامل مع الدروس غير المكتملة.",
      tasks: [{
        name: "مراجعة التاريخ",
        description: "قراءة الدرس وتحديد الأفكار الأساسية ثم استرجاعها.",
        durationMinutes: "50",
        subject: "التاريخ",
      }],
      review: "اذكر ثلاث أفكار أساسية من الدرس دون فتح الكتاب.",
    }));

    expect(plan.title).toBe("خطة أسبوعية");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      title: "مراجعة التاريخ",
      minutes: 50,
      category: "التاريخ",
      day: "اليوم 1",
    });
    expect(plan.habits).toEqual([]);
    expect(plan).not.toHaveProperty("reviewQuestion");
  });

  it("preserves actionable task details and evidence for the plan details view", () => {
    const plan = parseGeneratedPlan(JSON.stringify({
      title: "خطة تنفيذ واضحة",
      summary: "خطة تعرض سبب كل خطوة ومصادرها.",
      durationLabel: "3 أيام",
      steps: [{
        day: "اليوم الأول",
        title: "تطبيقات على الهمزة",
        detail: "اقرأ القاعدة، ثم حل تطبيقات الكتاب، وبعدها راجع مواضع الخطأ.",
        minutes: 40,
        category: "الإملاء",
        priority: "high",
        priorityReason: "هذا التطبيق مرتبط بموضوع لم يثبت إتقانه بعد.",
        priorityEvidenceConfidence: "high",
        difficulty: "hard",
        lessonSize: "medium",
        difficultyBasis: "student_report",
        difficultyConfidence: "high",
        printedPageRange: [70, 72],
        sourcePages: [70, 71, 72],
      }],
      habits: [],
    }));
    expect(plan.steps[0]).toMatchObject({
      detail: "اقرأ القاعدة، ثم حل تطبيقات الكتاب، وبعدها راجع مواضع الخطأ.",
      minutes: 40,
      priorityReason: "هذا التطبيق مرتبط بموضوع لم يثبت إتقانه بعد.",
      priorityEvidenceConfidence: "high",
      difficulty: "hard",
      lessonSize: "medium",
      difficultyBasis: "student_report",
      difficultyConfidence: "high",
      printedPageRange: [70, 72],
      sourcePages: [70, 71, 72],
    });
  });

  it("removes model-generated self-tests while preserving teacher-led study tasks", () => {
    const parsed = parseGeneratedPlan(JSON.stringify({
      title: "خطة متابعة",
      summary: "خطة لمتابعة شرح المدرس والمواد المسجلة في الملف.",
      durationLabel: "يومان",
      steps: [
        { day: "اليوم 1", title: "متابعة المحاضرة", detail: "مشاهدة شرح المدرس المسجل للدرس.", minutes: 40, category: "محاضرة" },
        { day: "اليوم 2", title: "اختبار ذاتي", detail: "حل اختبار قصير من أسئلة ينشئها النظام.", minutes: 30, category: "اختبار" },
      ],
      habits: [{ title: "تجهيز جلسة الدراسة", cue: "جهّز الكتاب والملاحظات قبل بدء المحاضرة." }],
    }));
    const guarded = applyTeacherLedPlanningGuard(parsed);
    expect(guarded.steps.map(step => step.title)).toEqual(["متابعة المحاضرة"]);
    expect(guarded.habits).toHaveLength(1);
    expect(guarded).not.toHaveProperty("reviewQuestion");
  });

  it("rejects a plan made entirely of AI-generated assessments", () => {
    const parsed = parseGeneratedPlan(JSON.stringify({
      title: "خطة اختبار",
      summary: "خطة تحتوي على تقييمات ينشئها النظام.",
      durationLabel: "يوم",
      steps: [
        { day: "اليوم 1", title: "اختبار ذاتي", detail: "حل اختبار قصير.", minutes: 30, category: "اختبار" },
      ],
      habits: [],
    }));
    expect(() => applyTeacherLedPlanningGuard(parsed)).toThrow("المسودة المقترحة تعتمد");
  });

  it("does not fabricate an empty task list", () => {
    expect(() => parseGeneratedPlan(JSON.stringify({
      title: "خطة فارغة",
      summary: "هذه خطة لا تحتوي على أي مهام.",
      durationLabel: "يوم",
      steps: [],
      habits: [],
    }))).toThrow();
  });
});
