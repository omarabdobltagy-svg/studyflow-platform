import { describe, expect, it } from "vitest";
import { buildExamBlueprintContext, getExamComponentForText, getSubjectExamBlueprint } from "./exam-blueprints";

describe("second-year baccalaureate annual exam planning", () => {
  it("uses the year-end exam as the sole exam target and does not import term-specific English weights", () => {
    const blueprint = getSubjectExamBlueprint("ENG_G2_BAC", "اللغة الإنجليزية");
    expect(blueprint?.subjectKey).toBe("english");
    expect(blueprint?.appliesTo).toBe("annual_baccalaureate_exam");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBeNull();
    expect(blueprint?.components).toEqual([]);
    expect(getExamComponentForText("ENG_G2_BAC", "اللغة الإنجليزية", "القصة story")).toBeNull();
    expect(getExamComponentForText("ENG_G2_BAC", "اللغة الإنجليزية", "القواعد والمفردات")).toBeNull();
  });

  it("does not import the inconsistent term-specific Arabic mark breakdown into annual priorities", () => {
    const blueprint = getSubjectExamBlueprint("ARB_G2_BAC", "اللغة العربية");
    expect(blueprint?.appliesTo).toBe("annual_baccalaureate_exam");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBeNull();
    expect(blueprint?.components).toEqual([]);
    expect(getExamComponentForText("ARB_G2_BAC", "اللغة العربية", "قصة وا إسلاماه والنص الأدبي")).toBeNull();
    expect(getExamComponentForText("ARB_G2_BAC", "اللغة العربية", "النحو")).toBeNull();
  });

  it("keeps annual history and programming paper weights unknown until matching official specifications exist", () => {
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
  });

  it("makes the annual goal and no-first-term-exam rule explicit in the planner context", () => {
    const context = buildExamBlueprintContext([
      { id: "ENG_G2_BAC", name: "اللغة الإنجليزية" },
      { id: "ARB_G2_BAC", name: "اللغة العربية" },
      { id: "HIS_G2_BAC", name: "التاريخ" },
    ]);
    expect(context).toContain("الاستعداد للامتحان السنوي");
    expect(context).toContain("لا يوجد امتحان ترم أول");
    expect(context).toContain("لا تستخدم مواصفات ترم أول");
    expect(context).toContain("لا تخترع توزيع درجات");
    expect(context).toContain("لا توجد أوزان فرعية موثقة");
  });
});
