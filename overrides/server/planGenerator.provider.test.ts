import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  invokeNvidiaLLM: vi.fn(),
  saveAiPlan: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
  invokeNvidiaLLM: mocks.invokeNvidiaLLM,
}));

vi.mock("./db", () => ({
  getStudentProfile: vi.fn(),
  saveAiPlan: mocks.saveAiPlan,
}));

vi.mock("./textbook-retrieval", () => ({
  formatTextbookEvidence: () => "",
  retrieveTextbookEvidence: () => ({ passages: [], coverageNotes: [] }),
}));

import { applyPlannerProgressGuard, generatePersonalPlan, parseGeneratedPlan } from "./planGenerator";

const validPlan = {
  title: "خطة مراجعة التاريخ",
  summary: "خطة متابعة مركزة تتوزع على يومين بين شرح المدرس ومراجعة الملاحظات المسجلة.",
  durationLabel: "3 أيام",
  steps: [
    { day: "اليوم الأول", title: "متابعة شرح الوحدة الأولى", detail: "مشاهدة محاضرة المدرس المسجلة وتدوين الملاحظات المرتبطة بالدرس.", minutes: 45, category: "محاضرة" },
    { day: "اليوم الثاني", title: "مراجعة ملاحظات المدرس", detail: "الرجوع إلى الصفحات والملاحظات التي شرحها المدرس وتجهيز أي استفسار للحصة القادمة.", minutes: 50, category: "متابعة المدرس" },
  ],
  habits: [{ title: "تجهيز جلسة الدراسة", cue: "جهّز الكتاب والملاحظات قبل بدء المحاضرة." }],
};

const validResponse = {
  choices: [{
    index: 0,
    message: { role: "assistant", content: JSON.stringify(validPlan) },
    finish_reason: "stop",
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveAiPlan.mockResolvedValue(undefined);
});

describe("generated plan JSON parser", () => {
  it("extracts a fenced JSON object after explanatory text and ignores braces inside strings", () => {
    const planWithBraces = {
      ...validPlan,
      steps: validPlan.steps.map((step, index) => ({
        ...step,
        detail: index === 0 ? "اكتب الرمز {A} داخل الملخص ثم اشرح الفكرة." : step.detail,
      })),
    };
    const jsonWithTrailingComma = JSON.stringify(planWithBraces).replace(/}$/, ",}");
    const fence = String.fromCharCode(96).repeat(3);
    const response = "مثال غير صالح: {\"hint\":\"ignore this object\"}\nإليك الخطة المطلوبة:\n\n" + fence + "json\n" + jsonWithTrailingComma + "\n" + fence;
    const parsed = parseGeneratedPlan(response);
    expect(parsed).toMatchObject(planWithBraces);
    expect(parsed.steps[0].difficulty).toBe("unknown");
    expect(parsed.steps[0].lessonSize).toBe("unknown");
  });

  it("treats null printed page ranges as unavailable metadata", () => {
    const planWithNullPageRanges = {
      ...validPlan,
      steps: validPlan.steps.map(step => ({ ...step, printedPageRange: null })),
    };

    const parsed = parseGeneratedPlan(JSON.stringify(planWithNullPageRanges));

    expect(parsed.steps.every(step => step.printedPageRange === undefined)).toBe(true);
  });

  it("does not accept an incomplete JSON object", () => {
    expect(() => parseGeneratedPlan('{"title":"خطة ناقصة"')).toThrow("تعذّر تحويل الخطة الذكية");
  });

  it("accepts a complete multi-subject plan with 14 steps and detailed Arabic content", () => {
    const expandedPlan = {
      ...validPlan,
      title: "خطة مراجعة شاملة للترم الأول",
      summary: ("خطة مفصلة توزع التراكم على عدة أيام، وتراعي حجم الدروس وموضع المدرس وموضع الطالب، وتحدد متابعة المحاضرات والملاحظات والواجبات التي عيّنها المدرس. ").repeat(5),
      steps: Array.from({ length: 14 }, (_, index) => ({
        day: "اليوم " + (Math.floor(index / 3) + 1),
        title: "مهمة الدرس " + (index + 1),
        detail: "تابع شرح المدرس المرتبط بهذا الدرس، وراجع الصفحات والملاحظات التي حددها، وأكمل الواجب الذي سجله المدرس إن كان موجودًا.",
        minutes: 35,
        category: "فهم وتطبيق",
        priority: index < 3 ? "high" : "medium",
        difficulty: index % 3 === 0 ? "hard" : "medium",
        lessonSize: index % 4 === 0 ? "large" : "medium",
        sourcePages: [12 + index],
      })),
      habits: [],
    };
    const parsed = parseGeneratedPlan(JSON.stringify(expandedPlan));
    expect(parsed.steps).toHaveLength(14);
    expect(parsed.steps[0].priority).toBe("high");
    expect(parsed.steps[0].sourcePages).toEqual([12]);
    expect(parsed.summary.length).toBeGreaterThan(500);
  });
});

describe("planner completed-curriculum guard", () => {
  const profile = {
    subjectIds: ["ARB_G2_BAC"],
    selection: {
      learningCourseProgress: {
        ARB_G2_BAC: {
          branches: {
            ARB_NAHW: {
              lastCompletedLessonId: "ARB_U2_N1",
              teacherTeachingFrontierId: "ARB_U3_N2",
              schoolClassFrontierId: "__UNKNOWN__",
            },
          },
        },
      },
    },
  } as any;

  const step = (title: string, nodeId: string) => ({
    day: "اليوم 1",
    title,
    detail: "افهم الفكرة ثم حل التدريبات المرتبطة بالدرس وسجل الأخطاء.",
    minutes: 35,
    category: "مذاكرة",
    curriculumNodeIds: [nodeId],
    priority: "high" as const,
    difficulty: "medium" as const,
    lessonSize: "medium" as const,
    difficultyBasis: "student_report" as const,
    difficultyConfidence: "high" as const,
    sourcePages: [],
  });

  it("blocks the last completed lesson but permits the next distinct nahw checkpoints", () => {
    const plan = {
      ...validPlan,
      steps: [
        step("الممنوع من الصرف وعلل منعه", "ARB_U2_N1"),
        step("تابع الممنوع من الصرف وعلل منعه", "ARB_U2_N2"),
        step("تطبيق على الممنوع من الصرف وعلل منعه", "ARB_U2_N3"),
        step("النعت والبدل والتمييز بينهما", "ARB_U3_N1"),
        step("العطف", "ARB_U3_N2"),
      ],
    };

    const guarded = applyPlannerProgressGuard(plan as any, profile);

    expect(guarded.steps.map(item => item.curriculumNodeIds)).toEqual([
      ["ARB_U3_N1"],
      ["ARB_U3_N2"],
    ]);
  });

  it("falls back to the saved subject frontier when the branch unknown value is unconfirmed", () => {
    const legacyProfile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        learningCourseProgress: {
          ARB_G2_BAC: {
            lastCompletedLessonId: "ARB_U2_N1",
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "__UNKNOWN__",
                // No studentFrontierConfirmedAt: this is a legacy placeholder, not an explicit unknown.
              },
            },
          },
        },
      },
    } as any;
    const plan = {
      ...validPlan,
      steps: [
        step("الممنوع من الصرف وعلل منعه", "ARB_U2_N1"),
        step("تابع الممنوع من الصرف وعلل منعه", "ARB_U2_N2"),
        step("العطف", "ARB_U3_N2"),
      ],
    };

    const guarded = applyPlannerProgressGuard(plan as any, legacyProfile);

    expect(guarded.steps.map(item => item.curriculumNodeIds)).toEqual([
      ["ARB_U3_N2"],
    ]);
  });

  it("falls back from an unconfirmed unknown subject record to a valid legacy teacher frontier", () => {
    const legacyProfile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        teacherFrontiers: { ARB_G2_BAC: "ARB_U2_N1" },
        learningCourseProgress: {
          ARB_G2_BAC: {
            lastCompletedLessonId: "__UNKNOWN__",
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "__UNKNOWN__",
              },
            },
          },
        },
      },
    } as any;
    const plan = {
      ...validPlan,
      steps: [
        step("الممنوع من الصرف وعلل منعه", "ARB_U2_N1"),
        step("تابع الممنوع من الصرف وعلل منعه", "ARB_U2_N2"),
        step("العطف", "ARB_U3_N2"),
      ],
    };

    const guarded = applyPlannerProgressGuard(plan as any, legacyProfile);

    expect(guarded.steps.map(item => item.curriculumNodeIds)).toEqual([
      ["ARB_U3_N2"],
    ]);
  });

  it("does not replace an explicitly confirmed unknown branch position with legacy subject data", () => {
    const confirmedUnknownProfile = {
      subjectIds: ["ARB_G2_BAC"],
      selection: {
        learningCourseProgress: {
          ARB_G2_BAC: {
            lastCompletedLessonId: "ARB_U2_N1",
            branches: {
              ARB_NAHW: {
                lastCompletedLessonId: "__UNKNOWN__",
                studentFrontierConfirmedAt: "2026-11-25T12:00:00.000Z",
              },
            },
          },
        },
      },
    } as any;
    const plan = {
      ...validPlan,
      steps: [
        step("الممنوع من الصرف وعلل منعه", "ARB_U2_N3"),
        step("العطف", "ARB_U3_N2"),
      ],
    };

    const guarded = applyPlannerProgressGuard(plan as any, confirmedUnknownProfile);

    expect(guarded.steps.map(item => item.curriculumNodeIds)).toEqual([
      ["ARB_U2_N3"],
      ["ARB_U3_N2"],
    ]);
  });

  it("blocks a completed lesson mention when a model omits curriculum IDs", () => {
    const plan = {
      ...validPlan,
      steps: [
        { ...step("مراجعة الممنوع من الصرف وعلل منعه من البداية", "ARB_U2_N1"), curriculumNodeIds: [] },
        { ...step("حل تدريبات على درس تالٍ", "ARB_U3_N1"), curriculumNodeIds: [] },
      ],
    };

    const guarded = applyPlannerProgressGuard(plan as any, profile);

    expect(guarded.steps).toHaveLength(1);
    expect(guarded.steps[0].title).toBe("حل تدريبات على درس تالٍ");
  });

  it("refuses to save a plan made entirely of completed curriculum tasks", () => {
    const plan = {
      ...validPlan,
      steps: [
        step("الممنوع من الصرف وعلل منعه", "ARB_U2_N1"),
        step("إعادة مذاكرة الدرس المكتمل", "ARB_U2_N1"),
        step("اختبار على الدرس المكتمل", "ARB_U2_N1"),
      ],
    };

    expect(() => applyPlannerProgressGuard(plan as any, profile))
      .toThrow("الخطة المقترحة تضمنت دروسًا مكتملة");
  });
});

describe("smart planner NVIDIA fallback", () => {
  it("switches to NVIDIA when the primary provider reports exhausted credits", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error(
      'LLM invoke failed: 402 Payment Required – {"error":{"message":"Insufficient credits"}}'
    ));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    const result = await generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false,
      { dailyMinutes: 120 }
    );

    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    const nvidiaRequest = mocks.invokeNvidiaLLM.mock.calls[0][0];
    expect(nvidiaRequest.maxTokens).toBe(6_144);
    expect(nvidiaRequest.response_format).toEqual({ type: "json_object" });
    expect(result.title).toBe(validPlan.title);
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("switches to NVIDIA when the primary returns HTTP 200 but exhausts its output budget", async () => {
    mocks.invokeLLM.mockResolvedValue({
      model: "deepseek/deepseek-v4.1-flash-1017",
      choices: [{
        index: 0,
        message: { role: "assistant", content: "" },
        finish_reason: "length",
      }],
      usage: { prompt_tokens: 2_100, completion_tokens: 1_400, total_tokens: 3_500 },
    });
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false,
      { dailyMinutes: 120 }
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("switches to NVIDIA when primary HTTP 200 content is invalid JSON", async () => {
    mocks.invokeLLM.mockResolvedValue({
      model: "deepseek/test-model",
      choices: [{
        index: 0,
        message: { role: "assistant", content: '{"title":"unfinished"' },
        finish_reason: "length",
      }],
      usage: { prompt_tokens: 500, completion_tokens: 1_400, total_tokens: 1_900 },
    });
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("keeps the primary provider when it returns a complete valid plan", async () => {
    mocks.invokeLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).not.toHaveBeenCalled();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("does not save a plan when NVIDIA returns empty content", async () => {
    mocks.invokeLLM.mockResolvedValue({
      model: "deepseek/test-model",
      choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "length" }],
    });
    mocks.invokeNvidiaLLM.mockResolvedValue({
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "length" }],
    });

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).rejects.toThrow("لم يصل محتوى نهائي من المزوّد");

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).not.toHaveBeenCalled();
  });

  it("switches to NVIDIA for an explicit insufficient-quota 429 response", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error(
      'LLM invoke failed: 429 Too Many Requests – {"error":{"code":"insufficient_quota"}}'
    ));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("uses NVIDIA when the primary key is not configured", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("AI_API_KEY is not configured"));
    mocks.invokeNvidiaLLM.mockResolvedValue(validResponse);

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).resolves.toMatchObject({ title: validPlan.title });

    expect(mocks.invokeNvidiaLLM).toHaveBeenCalledOnce();
    expect(mocks.saveAiPlan).toHaveBeenCalledOnce();
  });

  it("does not use NVIDIA for an unrelated primary-provider server error", async () => {
    mocks.invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 500 Internal Server Error"));

    await expect(generatePersonalPlan(
      7,
      "أحتاج خطة لمراجعة التاريخ وحل الأسئلة خلال ثلاثة أيام.",
      false
    )).rejects.toThrow("خدمة المزوّد الأساسي تواجه عطلًا مؤقتًا");

    expect(mocks.invokeNvidiaLLM).not.toHaveBeenCalled();
    expect(mocks.saveAiPlan).not.toHaveBeenCalled();
  });
});
