import { describe, expect, it } from "vitest";
import { resolveStudentSubjectIds } from "./student-subjects";

describe("resolveStudentSubjectIds", () => {
  it("prefers canonical IDs stored by onboarding", () => {
    expect(resolveStudentSubjectIds(["اللغة العربية", "التاريخ"], {
      subjectIds: ["ARB_G2_BAC", "HIS_G2_BAC", "UNKNOWN_ID"],
    }, "baccalaureate")).toEqual(["ARB_G2_BAC", "HIS_G2_BAC"]);
  });

  it("resolves legacy Arabic labels for the selected education system", () => {
    expect(resolveStudentSubjectIds(["اللغة العربية", "اللغة الأجنبية الأولى"], {},
      "general_secondary")).toEqual(["ARB_G2_GENERAL", "ENG1_G2_GENERAL"]);
  });

  it("keeps legacy IDs and removes duplicates", () => {
    expect(resolveStudentSubjectIds(["ARB_G2_BAC", "ARB_G2_BAC", "HIS_G2_BAC"], {},
      "baccalaureate")).toEqual(["ARB_G2_BAC", "HIS_G2_BAC"]);
  });
});
