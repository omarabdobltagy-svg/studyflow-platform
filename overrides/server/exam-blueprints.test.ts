import { describe, expect, it } from "vitest";
import {
  buildExamBlueprintContext,
  getExamComponentForText,
  getSubjectExamBlueprint,
  SECOND_YEAR_BAC_EXAM_WINDOW_2026_2027,
} from "./exam-blueprints";

describe("second-year Baccalaureate exam planning", () => {
  const subjectIds = [
    ["ARB_G2_BAC", "اللغة العربية"],
    ["ENG1_G2_BAC", "اللغة الإنجليزية"],
    ["HIS_G2_BAC", "التاريخ المصري"],
    ["PROG_AI_G2_BAC", "البرمجة والذكاء الاصطناعي"],
  ] as const;

  it("does not invent paper format, question counts, or branch weights for any subject", () => {
    for (const [id, name] of subjectIds) {
      const blueprint = getSubjectExamBlueprint(id, name);
      expect(blueprint).not.toBeNull();
      expect(blueprint?.annualSubjectMarks).toBe(100);
      expect(blueprint?.paperMarks).toBeNull();
      expect(blueprint?.durationMinutes).toBeNull();
      expect(blueprint?.mcqShare).toBeNull();
      expect(blueprint?.essayShare).toBeNull();
      expect(blueprint?.components).toEqual([]);
      expect(getExamComponentForText(id, name, "قواعد ونصوص وقصة وتعبير")).toBeNull();
    }
  });

  it("keeps qualitative third-year skill inspiration separate from second-year exam specifications", () => {
    const context = buildExamBlueprintContext(subjectIds.map(([id, name]) => ({ id, name })));
    expect(context).toContain("لا توجد حتى الآن نماذج استرشادية أو مواصفة تفصيلية معتمدة");
    expect(context).toContain("عدد الأسئلة: غير معروف");
    expect(context).toContain("توزيع الاختياري والمقالي: غير معروف");
    expect(context).toContain("الاستلهام النوعي فقط");
    expect(context).toContain("Grammar وVocabulary");
    expect(context).toContain("لا يحوّل هذا الاستلهام إلى اختبارات أو أسئلة");
    expect(context).not.toContain("50% اختيار من متعدد و50% مقالي");
    expect(context).not.toContain("مايو 2027");
    expect(context).not.toContain("يوليو 2027");
  });

  it("uses the user-confirmed approximate exam window and readiness target", () => {
    expect(SECOND_YEAR_BAC_EXAM_WINDOW_2026_2027).toMatchObject({
      academicYear: "2026/2027",
      start: "2027-06-12",
      end: "2027-06-22",
      planningReadyBy: "2027-06-11",
      precision: "approximate_user_confirmed",
      source: "user_confirmed",
    });
    const context = buildExamBlueprintContext(subjectIds.map(([id, name]) => ({ id, name })));
    expect(context).toContain("12 يونيو 2027");
    expect(context).toContain("22 يونيو 2027");
    expect(context).toContain("11 يونيو 2027");
  });
});
