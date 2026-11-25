import { describe, expect, it } from "vitest";
import { buildExamBlueprintContext, getExamComponentForText, getSubjectExamBlueprint } from "./exam-blueprints";

describe("second-year baccalaureate annual exam planning", () => {
  it("uses the annual exam format without importing term-specific English weights", () => {
    const blueprint = getSubjectExamBlueprint("ENG_G2_BAC", "اللغة الإنجليزية");
    expect(blueprint?.subjectKey).toBe("english");
    expect(blueprint?.appliesTo).toBe("annual_baccalaureate_exam");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBeNull();
    expect(blueprint?.mcqShare).toBe(0.5);
    expect(blueprint?.essayShare).toBe(0.5);
    expect(blueprint?.components).toEqual([]);
    expect(getExamComponentForText("ENG_G2_BAC", "اللغة الإنجليزية", "القصة story")).toBeNull();
    expect(getExamComponentForText("ENG_G2_BAC", "اللغة الإنجليزية", "القواعد والمفردات")).toBeNull();
  });

  it("does not import term-specific Arabic mark breakdown into annual priorities", () => {
    const blueprint = getSubjectExamBlueprint("ARB_G2_BAC", "اللغة العربية");
    expect(blueprint?.appliesTo).toBe("annual_baccalaureate_exam");
    expect(blueprint?.annualSubjectMarks).toBe(100);
    expect(blueprint?.paperMarks).toBeNull();
    expect(blueprint?.mcqShare).toBe(0.5);
    expect(blueprint?.essayShare).toBe(0.5);
    expect(blueprint?.components).toEqual([]);
    expect(getExamComponentForText("ARB_G2_BAC", "اللغة العربية", "قصة وا إسلاماه والنص الأدبي")).toBeNull();
    expect(getExamComponentForText("ARB_G2_BAC", "اللغة العربية", "النحو")).toBeNull();
  });

  it("applies the verified annual paper format to history and programming without inventing unit weights", () => {
    const history = getSubjectExamBlueprint("HIS_G2_BAC", "التاريخ المصري");
    const programming = getSubjectExamBlueprint("PROG_AI_G2_BAC", "البرمجة والذكاء الاصطناعي");
    for (const blueprint of [history, programming]) {
      expect(blueprint?.annualSubjectMarks).toBe(100);
      expect(blueprint?.paperMarks).toBeNull();
      expect(blueprint?.mcqShare).toBe(0.5);
      expect(blueprint?.essayShare).toBe(0.5);
      expect(blueprint?.components).toEqual([]);
    }
  });

  it("makes the May mandatory first attempt and July optional attempt explicit", () => {
    const context = buildExamBlueprintContext([
      { id: "ENG_G2_BAC", name: "اللغة الإنجليزية" },
      { id: "ARB_G2_BAC", name: "اللغة العربية" },
      { id: "HIS_G2_BAC", name: "التاريخ" },
      { id: "PROG_AI_G2_BAC", name: "البرمجة والذكاء الاصطناعي" },
    ]);
    expect(context).toContain("الاستعداد للامتحان السنوي");
    expect(context).toContain("لا يوجد امتحان ترم أول");
    expect(context).toContain("50% اختيار من متعدد و50% مقالي");
    expect(context).toContain("مايو 2027");
    expect(context).toContain("يوليو 2027");
    expect(context).toContain("لا تستخدم مواصفات ترم أول");
    expect(context).toContain("لا تخترع توزيع درجات");
    expect(context).toContain("لا توجد أوزان فرعية موثقة");
  });
});
