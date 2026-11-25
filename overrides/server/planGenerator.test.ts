import { describe, expect, it } from "vitest";
import { parseGeneratedPlan } from "./planGenerator";

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
      reviewQuestion: "ما العلامة التي تميز الاسم الممنوع من الصرف؟",
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
    expect(plan.reviewQuestion).toContain("ثلاث أفكار");
  });

  it("does not fabricate an empty task list", () => {
    expect(() => parseGeneratedPlan(JSON.stringify({
      title: "خطة فارغة",
      summary: "هذه خطة لا تحتوي على أي مهام.",
      durationLabel: "يوم",
      steps: [],
      habits: [],
      reviewQuestion: "ما الذي ستراجعه؟",
    }))).toThrow();
  });
});
