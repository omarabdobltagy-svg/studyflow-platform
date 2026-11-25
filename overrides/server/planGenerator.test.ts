import { describe, expect, it } from "vitest";
import { applyTeacherLedPlanningGuard, parseGeneratedPlan } from "./planGenerator";

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
