import { describe, expect, it } from "vitest";
import { buildExamBlueprintContext, getSubjectExamBlueprint } from "./exam-blueprints";

describe("second-year baccalaureate exam blueprints", () => {
  it("uses the current first-term English component marks without promoting the story", () => {
    const blueprint = getSubjectExamBlueprint("ENG_G2_BAC", "اللغة الإنجليزية");
    expect(blueprint?.subjectKey).toBe("english");
    expect(blueprint?.appliesTo).toBe("first_term_2026_2027");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBe(30);
    expect(blueprint?.components.map(component => component.marks)).toEqual([8, 7, 4, 3, 8]);
    expect(blueprint?.components.find(component => component.id === "story")?.assessmentShare).toBe(0.1);
    expect(blueprint?.components.find(component => component.id === "vocabulary_grammar")?.assessmentShare)
      .toBeCloseTo(8 / 30);
  });

  it("does not invent Arabic component marks when the breakdown is not verified", () => {
    const blueprint = getSubjectExamBlueprint("ARB_G2_BAC", "اللغة العربية");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBe(60);
    expect(blueprint?.components.length).toBeGreaterThan(0);
    expect(blueprint?.components.every(component => component.marks === null && component.assessmentShare === null))
      .toBe(true);
    expect(blueprint?.unverified.some(note => note.includes("59 لا 60"))).toBe(true);
  });

  it("keeps history and programming unit weights unknown instead of treating units as equal official weights", () => {
    const history = getSubjectExamBlueprint("HIS_G2_BAC", "التاريخ المصري");
    const programming = getSubjectExamBlueprint("PROG_AI_G2_BAC", "البرمجة والذكاء الاصطناعي");
    expect(history?.annualSubjectMarks).toBe(100);
    expect(programming?.annualSubjectMarks).toBe(100);
    expect(history?.paperMarks).toBeNull();
    expect(programming?.paperMarks).toBeNull();
    expect(history?.mcqShare).toBeNull();
    expect(programming?.mcqShare).toBeNull();
    expect(history?.components).toEqual([]);
    expect(programming?.components).toEqual([]);
    expect(history?.status).toBe("partial_official_evidence");
    expect(programming?.status).toBe("partial_official_evidence");
  });

  it("makes the period limitation explicit in planner context", () => {
    const context = buildExamBlueprintContext([
      { id: "ENG_G2_BAC", name: "اللغة الإنجليزية" },
      { id: "HIS_G2_BAC", name: "التاريخ" },
    ]);
    expect(context).toContain("الفصل الأول 2026/2027 فقط");
    expect(context).toContain("لا تنقلها إلى النهائي السنوي");
    expect(context).toContain("لا تخترع توزيع درجات");
    expect(context).toContain("لا توجد أوزان فرعية موثقة");
  });
});
