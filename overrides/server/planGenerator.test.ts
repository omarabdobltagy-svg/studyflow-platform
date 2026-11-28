import { describe, expect, it } from "vitest";
import {
  applyCurriculumPrioritySignals,
  getStudentPlanningFocusWeight,
  applyDailyPlanDepth,
  applyPlannerCurriculumCoverageGuard,
  applyPlannerProgressGuard,
  buildPlannerProgressSnapshot,
  applyTeacherLedPlanningGuard,
  getDailyPlanFeasibilityNote,
  parseGeneratedPlan,
  interleavePlannerItemsBySubject,
} from "./planGenerator";
import { getSIECheckpointBranches, getSIECheckpointProgressBranches } from "@shared/sie-catalog";
import {
  mergeLegacyLinearBranchProgress,
  selectLegacyLinearFrontier,
} from "@shared/sie-learning-progress";

describe("student-aware near-term curriculum focus", () => {
  it("reduces story and GRE practice weight without lowering core grammar, vocabulary, or Arabic texts", () => {
    expect(getStudentPlanningFocusWeight("ARB_G2_BAC", "ARB_LITERATURE", "القصة")).toBe(0.42);
    expect(getStudentPlanningFocusWeight("ENG1_G2_BAC", "ENG_STORY", "Story")).toBe(0.42);
    expect(getStudentPlanningFocusWeight("ARB_G2_BAC", "ARB_TEXTS", "النصوص")).toBe(1);
    expect(getStudentPlanningFocusWeight("ENG1_G2_BAC", "ENG_GRAMMAR", "Grammar")).toBe(1);
    expect(getStudentPlanningFocusWeight("ENG1_G2_BAC", "ENG_VOCABULARY", "Vocabulary")).toBe(1);
    expect(getStudentPlanningFocusWeight(null, null, "GRE Exercises")).toBe(0.42);
    expect(getStudentPlanningFocusWeight("ENG1_G2_BAC", "ENG_STORY", "The Lost World", true)).toBe(1);
    expect(getStudentPlanningFocusWeight(null, "ENG_GRE", "مهمة GRE موجودة بالفعل", true)).toBe(1);
  });

  it("does not downgrade a confirmed teacher obligation just because it mentions a story or GRE", () => {
    expect(getStudentPlanningFocusWeight("ENG1_G2_BAC", "ENG_STORY", "Story homework")).toBe(1);
    expect(getStudentPlanningFocusWeight(null, null, "GRE assignment due tomorrow")).toBe(1);
  });
});

describe("complete daily plan coverage", () => {
  it("keeps more than eighteen candidate tasks instead of silently truncating the plan", () => {
    const steps = Array.from({ length: 24 }, (_, index) => ({
      day: "",
      title: "مهمة تراكمية " + (index + 1),
      detail: "مهمة اختبارية للتحقق من عدم اقتطاع المتراكم.",
      minutes: 20,
      category: "تراكم",
      priority: "medium",
      difficulty: "unknown",
      lessonSize: "unknown",
      sourcePages: [],
    }));
    const plan = {
      title: "خطة اختبار تغطية",
      summary: "اختبار اكتمال التغطية.",
      durationLabel: "اختبار",
      steps,
      habits: [],
    } as any;
    const profile = { subjectIds: [], selection: {} } as any;

    const result = applyDailyPlanDepth(plan, profile, []);

    expect(result.steps).toHaveLength(24);
    expect(new Set(result.steps.map(step => step.title)).size).toBe(24);
  });
});

describe("actual accumulated daily backlog scope", () => {
  const subjectId = "ENG1_G2_BAC";
  const grammar = getSIECheckpointProgressBranches(subjectId).find(branch => branch.branchId === "ENG_GRAMMAR")!;

  const emptyPlan = () => ({
    title: "خطة المتراكم الفعلي",
    summary: "اختبار نطاق التراكم.",
    durationLabel: "اختبار",
    steps: [],
    habits: [],
  } as any);

  it("includes reached and teacher-covered lessons but excludes curriculum beyond the teacher frontier", () => {
    const choices = grammar.choices;
    const now = "2026-11-27T00:00:00.000Z";
    const profile = {
      subjectIds: [subjectId],
      selection: {
        learningCourseProgress: {
          [subjectId]: {
            branches: {
              [grammar.branchId]: {
                lastCompletedLessonId: choices[1].nodeId,
                studentFrontierConfirmedAt: now,
                lessonStateModelVersion: 1,
                teacherTeachingFrontierId: choices[4].nodeId,
                teacherFrontierConfirmedAt: now,
                lessonStates: {
                  [choices[0].nodeId]: { state: "studied", updatedAt: now },
                },
              },
            },
          },
        },
      },
    } as any;

    const result = applyDailyPlanDepth(emptyPlan(), profile, []);
    const plannedIds = result.steps.flatMap(step => step.curriculumNodeIds ?? []);

    // Reaching the explanation frontier does not mean the lesson was studied.
    // The reached-but-unstudied lesson stays in the backlog alongside newer
    // lessons inside the teacher's coverage range.
    expect(plannedIds).toContain(choices[1].nodeId);
    for (const choice of choices.slice(2, 5)) {
      expect(plannedIds).toContain(choice.nodeId);
    }
    expect(plannedIds).not.toContain(choices[0].nodeId);
    expect(plannedIds).not.toContain(choices[5].nodeId);
  });

  it("excludes an explicitly recorded lesson that is beyond the teacher coverage frontier", () => {
    const choices = grammar.choices;
    const now = "2026-11-27T00:00:00.000Z";
    const profile = {
      subjectIds: [subjectId],
      selection: {
        learningCourseProgress: {
          [subjectId]: {
            branches: {
              [grammar.branchId]: {
                lastCompletedLessonId: choices[1].nodeId,
                studentFrontierConfirmedAt: now,
                lessonStateModelVersion: 1,
                teacherTeachingFrontierId: choices[4].nodeId,
                teacherFrontierConfirmedAt: now,
                lessonStates: {
                  [choices[5].nodeId]: { state: "needs_review", updatedAt: now },
                },
              },
            },
          },
        },
      },
    } as any;

    const result = applyDailyPlanDepth(emptyPlan(), profile, []);
    const plannedIds = result.steps.flatMap(step => step.curriculumNodeIds ?? []);

    expect(plannedIds).toContain(choices[2].nodeId);
    expect(plannedIds).toContain(choices[4].nodeId);
    expect(plannedIds).not.toContain(choices[5].nodeId);
  });

  it("does not fabricate a one-lesson backlog when the student's position is unknown", () => {
    const choices = grammar.choices;
    const now = "2026-11-27T00:00:00.000Z";
    const profile = {
      subjectIds: [subjectId],
      selection: {
        learningCourseProgress: {
          [subjectId]: {
            branches: {
              [grammar.branchId]: {
                lastCompletedLessonId: "__UNKNOWN__",
                teacherTeachingFrontierId: choices[4].nodeId,
                teacherFrontierConfirmedAt: now,
              },
            },
          },
        },
      },
    } as any;

    const result = applyDailyPlanDepth(emptyPlan(), profile, []);
    const plannedIds = result.steps.flatMap(step => step.curriculumNodeIds ?? []);

    expect(plannedIds).not.toContain(choices[0].nodeId);
    expect(plannedIds).not.toContain(choices[1].nodeId);
    expect(plannedIds).not.toContain(choices[2].nodeId);
    expect(plannedIds).not.toContain(choices[3].nodeId);
    expect(plannedIds).not.toContain(choices[4].nodeId);
  });
});

describe("official English curriculum sequence", () => {
  it("labels the Unit 1 Conditional Structures checkpoint as Lesson 4 & 5", () => {
    const branches = getSIECheckpointBranches("ENG1_G2_BAC");
    const grammar = branches.find(branch => branch.branchId === "ENG_GRAMMAR");
    const conditional = grammar?.choices.find(choice => choice.nodeId === "ENG_GRAMMAR_U1_2");

    expect(conditional?.lessonNumber).toBe("4 & 5");
  });

  it("does not expose GRE as an English curriculum branch", () => {
    const branches = getSIECheckpointBranches("ENG1_G2_BAC");
    expect(branches.some(branch => branch.branchId === "ENG_GRE")).toBe(false);
  });
});

describe("unknown curriculum position safety", () => {
  it("does not classify an entire legacy linear subject as accumulated when the student position is unknown", () => {
    const branch = getSIECheckpointProgressBranches("HIS_G2_BAC")[0];
    expect(branch.choices.length).toBeGreaterThan(1);

    const snapshot = buildPlannerProgressSnapshot({
      subjectIds: ["HIS_G2_BAC"],
      selection: {},
    } as any);
    const progress = snapshot.branches.get("HIS_G2_BAC:" + branch.branchId);

    expect(progress?.eligibleChoices).toHaveLength(1);
    expect(progress?.eligibleChoices[0]).toMatchObject({
      nodeId: branch.choices[0].nodeId,
      learningState: "not_recorded",
    });
    expect(snapshot.eligibleNodeIds.size).toBe(1);
  });
});

describe("English and History legacy progress resolution", () => {
  const choices = [
    { nodeId: "HIS_U1_1" },
    { nodeId: "HIS_U1_2" },
    { nodeId: "HIS_U2_1" },
    { nodeId: "HIS_U3_1" },
  ];

  it("keeps legacy student and school positions when a current History row contains only teacher position", () => {
    const merged = mergeLegacyLinearBranchProgress(
      choices,
      { teacherTeachingFrontierId: "HIS_U2_1", teacherFrontierConfirmedAt: "2026-11-27T00:00:00.000Z" },
      { lastCompletedLessonId: "HIS_U1_2", schoolClassFrontierId: "HIS_U3_1" },
    );
    expect(merged.lastCompletedLessonId).toBe("HIS_U1_2");
    expect(merged.teacherTeachingFrontierId).toBe("HIS_U2_1");
    expect(merged.schoolClassFrontierId).toBe("HIS_U3_1");
  });

  it("preserves a deliberately confirmed unknown position instead of substituting an old value", () => {
    const merged = mergeLegacyLinearBranchProgress(
      choices,
      { lastCompletedLessonId: "__UNKNOWN__", studentFrontierConfirmedAt: "2026-11-27T00:00:00.000Z" },
      { lastCompletedLessonId: "HIS_U1_2" },
    );
    expect(merged.lastCompletedLessonId).toBe("__UNKNOWN__");
  });

  it("prefers valid consolidated positions and ignores invalid or cross-curriculum legacy IDs", () => {
    const merged = mergeLegacyLinearBranchProgress(
      choices,
      { lastCompletedLessonId: "HIS_U2_1" },
      { lastCompletedLessonId: "OTHER_SUBJECT_NODE" },
    );
    expect(merged.lastCompletedLessonId).toBe("HIS_U2_1");
    expect(selectLegacyLinearFrontier(choices, [
      { lastCompletedLessonId: "HIS_U1_2" },
      { lastCompletedLessonId: "OTHER_SUBJECT_NODE" },
      { lastCompletedLessonId: "HIS_U2_1" },
    ], "lastCompletedLessonId")).toBe("HIS_U2_1");
  });

  it("does not borrow another teacher's position when no teacher is selected", () => {
    expect(selectLegacyLinearFrontier(choices, [
      { teacherId: "teacher-a", teacherTeachingFrontierId: "HIS_U3_1" },
      { teacherId: "teacher-b", teacherTeachingFrontierId: "HIS_U2_1" },
      { teacherTeachingFrontierId: "HIS_U1_2" },
    ], "teacherTeachingFrontierId", { teacherOnly: true })).toBe("HIS_U1_2");
  });

  it("uses only the currently selected teacher's legacy position", () => {
    expect(selectLegacyLinearFrontier(choices, [
      { teacherId: "old-teacher", teacherTeachingFrontierId: "HIS_U3_1" },
      { teacherId: "current-teacher", teacherTeachingFrontierId: "HIS_U1_2" },
    ], "teacherTeachingFrontierId", { teacherOnly: true, teacherId: "current-teacher" }))
      .toBe("HIS_U1_2");
  });
});

describe("daily plan subject coverage", () => {
  it("interleaves curriculum tasks across selected subjects before repeating a subject", () => {
    const items = [
      { subjectId: "ARB_G2_BAC", title: "نحو 1" },
      { subjectId: "ARB_G2_BAC", title: "نحو 2" },
      { subjectId: "ARB_G2_BAC", title: "نحو 3" },
      { subjectId: "ENG1_G2_BAC", title: "English 1" },
      { subjectId: "ENG1_G2_BAC", title: "English 2" },
      { subjectId: "HIS_G2_BAC", title: "تاريخ 1" },
      { subjectId: "PROG_AI_G2_BAC", title: "برمجة 1" },
    ];
    const ordered = interleavePlannerItemsBySubject(
      items,
      ["ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC"],
      item => item.subjectId,
    );
    expect(ordered.slice(0, 4).map(item => item.subjectId)).toEqual([
      "ARB_G2_BAC", "ENG1_G2_BAC", "HIS_G2_BAC", "PROG_AI_G2_BAC",
    ]);
    expect(ordered.slice(4).map(item => item.title)).toEqual(["نحو 2", "English 2", "نحو 3"]);
  });

  it("keeps unlinked obligations after distributing curriculum-linked items", () => {
    const items = [
      { subjectId: "ARB_G2_BAC", title: "مهمة العربي" },
      { subjectId: null, title: "مهمة عامة" },
      { subjectId: "ENG1_G2_BAC", title: "مهمة الإنجليزي" },
    ];
    const ordered = interleavePlannerItemsBySubject(
      items,
      ["ARB_G2_BAC", "ENG1_G2_BAC"],
      item => item.subjectId,
    );
    expect(ordered.map(item => item.title)).toEqual(["مهمة العربي", "مهمة الإنجليزي", "مهمة عامة"]);
  });
});

describe("annual plan curriculum coverage and progress alignment", () => {
  it("uses explicit study confirmations before treating earlier Arabic grammar lessons as completed", () => {
    const nahwChoices = getSIECheckpointProgressBranches("ARB_G2_BAC")
      .find(branch => branch.branchId === "ARB_NAHW")!.choices;
    const selectedIndex = nahwChoices.findIndex(choice => choice.nodeId === "ARB_U2_N3");
    const lessonStates = Object.fromEntries(nahwChoices.slice(0, selectedIndex + 1).map(choice => [
      choice.nodeId,
      { state: "studied", source: "student_self_report" },
    ]));
    const profile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        learningCourseProgress: {
          ARB_G2_BAC: {
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "ARB_U2_N1",
                teacherTeachingFrontierId: "ARB_U3_N1",
                lessonStateModelVersion: 1,
                lessonStates,
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
          title: "النعت",
          detail: "متابعة شرح المدرس للموضوع.",
          minutes: 45,
          category: "النحو",
          curriculumNodeIds: ["ARB_U3_N1_NAAT"],
        },
        {
          day: "اليوم 1",
          title: "البدل",
          detail: "متابعة شرح المدرس للموضوع.",
          minutes: 45,
          category: "النحو",
          curriculumNodeIds: ["ARB_U3_N1_BADAL"],
        },
      ],
      habits: [],
    }));

    const progressGuarded = applyPlannerProgressGuard(plan, profile);
    const covered = applyPlannerCurriculumCoverageGuard(progressGuarded, profile);
    const ranked = applyCurriculumPrioritySignals(covered, profile);
    const grammarIds = ranked.steps.flatMap(step => step.curriculumNodeIds)
      .filter(id => /^ARB_U[123]_N[123]$/.test(id) || id === "ARB_U3_N1_NAAT" || id === "ARB_U3_N1_BADAL");

    expect(grammarIds).toEqual(["ARB_U3_N1_NAAT", "ARB_U3_N1_BADAL", "ARB_U3_N2"]);
    const nextGrammarStep = ranked.steps.find(step => step.curriculumNodeIds.includes("ARB_U3_N1_NAAT"));
    const nextStepIndex = ranked.steps.findIndex(step => step.curriculumNodeIds.includes("ARB_U3_N1_NAAT"));
    const followingGrammarIndex = ranked.steps.findIndex(step => step.curriculumNodeIds.includes("ARB_U3_N1_BADAL"));
    expect(nextStepIndex).toBeGreaterThanOrEqual(0);
    expect(nextStepIndex).toBeLessThan(followingGrammarIndex);
    expect(nextGrammarStep?.priorityReason).toContain("الخطوة التالية مباشرة");
    expect(nextGrammarStep?.priorityReason).toContain("الفجوة الحالية: 2");
  });

  it("keeps an individually missed middle lesson eligible after the teacher frontier has moved forward", () => {
    const nahwChoices = getSIECheckpointBranches("ARB_G2_BAC")
      .find(branch => branch.branchId === "ARB_NAHW")!.choices;
    const frontierIndex = nahwChoices.findIndex(choice => choice.nodeId === "ARB_U3_N1_BADAL");
    const lessonStates: Record<string, { state: string; source: string }> = Object.fromEntries(
      nahwChoices.slice(0, frontierIndex + 1).map(choice => [
        choice.nodeId,
        { state: "studied", source: "student_self_report" },
      ]),
    );
    lessonStates["ARB_U2_N3"] = { state: "not_watched", source: "student_self_report" };

    const profile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        learningCourseProgress: {
          ARB_G2_BAC: {
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "ARB_U3_N1_BADAL",
                teacherTeachingFrontierId: "ARB_U3_N2",
                lessonStateModelVersion: 1,
                lessonStates,
              },
            },
          },
        },
      },
    } as any;
    const plan = parseGeneratedPlan(JSON.stringify({
      title: "تعويض درس فائت",
      summary: "خطة تعويض درس فائت في منتصف فرع النحو.",
      durationLabel: "مهام مرنة",
      steps: [
        {
          day: "",
          title: "تعويض درس الممنوع من الصرف",
          detail: "راجع شرح المدرس لهذا الدرس الذي فاتك.",
          minutes: 0,
          category: "النحو",
          curriculumNodeIds: ["ARB_U2_N3"],
        },
        {
          day: "",
          title: "إعادة مذاكرة درس مكتمل",
          detail: "هذا الدرس مؤكد أنه مكتمل.",
          minutes: 0,
          category: "النحو",
          curriculumNodeIds: ["ARB_U2_N2"],
        },
      ],
      habits: [],
    }));

    const guarded = applyPlannerProgressGuard(plan, profile);
    expect(guarded.steps.map(step => step.curriculumNodeIds)).toEqual([["ARB_U2_N3"]]);
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

describe("daily plan feasibility disclosure", () => {
  it("reports when the generated work extends beyond the selected horizon", () => {
    const note = getDailyPlanFeasibilityNote({
      requiredStudyDays: 6,
      horizonDays: 7,
      dailyMinutes: 120,
      daysPerWeek: 5,
      steps: [{ title: "مراجعة التاريخ", minutes: 50 }],
    });
    expect(note).toContain("التوزيع يحتاج 6 أيام دراسة");
    expect(note).toContain("تتيح نافذة 7 أيام");
    expect(note).toContain("لم نحذف مهامًا");
  });

  it("flags sessions that exceed daily capacity without changing their estimates", () => {
    const steps = [
      { title: "محاضرة طويلة", minutes: 150 },
      { title: "حل تدريبات", minutes: 45 },
    ];
    const note = getDailyPlanFeasibilityNote({
      requiredStudyDays: 2,
      horizonDays: 7,
      dailyMinutes: 90,
      daysPerWeek: 6,
      steps,
    });
    expect(note).toContain("«محاضرة طويلة» (150 دقيقة)");
    expect(note).toContain("يلزم تقسيم هذه الجلسات");
    expect(steps[0].minutes).toBe(150);
  });

  it("does not raise a capacity warning when all work fits", () => {
    const note = getDailyPlanFeasibilityNote({
      requiredStudyDays: 4,
      horizonDays: 7,
      dailyMinutes: 120,
      daysPerWeek: 5,
      steps: [{ title: "قراءة", minutes: 60 }, { title: "حل", minutes: 45 }],
    });
    expect(note).toContain("تقدير الجدوى");
    expect(note).not.toContain("تنبيه الجدوى");
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
