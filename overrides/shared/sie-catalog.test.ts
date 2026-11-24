import { describe, expect, it } from "vitest";
import {
  getSIECheckpointBranches,
  getSIECheckpointChoiceDisplayLabel,
  getSIECheckpointChoiceTypeLabel,
  getSIECheckpointChoices,
} from "./sie-catalog";

describe("Arabic course taxonomy", () => {
  it("separates Arabic lessons into the right learning branches", () => {
    const branches = getSIECheckpointBranches("ARB_G2_BAC");
    expect(branches.map(branch => branch.branchId)).toEqual([
      "ARB_NAHW",
      "ARB_BALAGHA",
      "ARB_READING",
      "ARB_TEXTS",
      "ARB_EXPRESSION",
      "ARB_SPELLING",
      "ARB_LITERATURE",
    ]);
    expect(branches.find(branch => branch.branchId === "ARB_NAHW")?.choices.map(choice => choice.title))
      .toContain("الأسماء الخمسة");
    expect(branches.find(branch => branch.branchId === "ARB_BALAGHA")?.choices.map(choice => choice.title))
      .toEqual([
        "الأسلوب الخبري والأسلوب الإنشائي",
        "الصورة الخيالية",
        "الإيجاز في البلاغة",
        "الإطناب",
      ]);
    expect(branches.find(branch => branch.branchId === "ARB_TEXTS")?.choices.map(choice => choice.title))
      .toContain("العلم نور");
  });

  it("includes all 21 indexed teacher-course lessons with their sequence numbers and source", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    const platformLessons = choices.filter(choice => choice.courseSequenceNumber);
    expect(platformLessons).toHaveLength(21);
    expect(platformLessons.map(choice => choice.courseSequenceNumber).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(choices.find(choice => choice.courseSequenceNumber === 19)).toMatchObject({
      title: "الإطناب",
      lessonType: "rhetoric",
      branchId: "ARB_BALAGHA",
    });
    expect(choices.find(choice => choice.courseSequenceNumber === 9)).toMatchObject({
      title: "التاء المربوطة والهاء المربوطة",
      lessonType: "spelling",
      branchId: "ARB_SPELLING",
    });
  });

  it("keeps all remaining textbook-only Arabic grammar, reading and text checkpoints", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    expect(choices.map(choice => choice.nodeId)).toContain("ARB_U3_N2");
    expect(choices.map(choice => choice.nodeId)).toContain("ARB_U3_L3");
    expect(new Set(choices.map(choice => choice.nodeId)).size).toBe(choices.length);
  });

  it("returns readable Arabic types and source-aware labels", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    const rhetoric = choices.find(choice => choice.courseSequenceNumber === 19)!;
    expect(getSIECheckpointChoiceTypeLabel(rhetoric)).toBe("بلاغة");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("الدرس 19 من 21");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("الفرع: البلاغة");
    expect(getSIECheckpointChoiceDisplayLabel(rhetoric)).toContain("فهرس منصة الشرح");
  });
});

describe("English curriculum selector metadata", () => {
  it("provides all 20 English topics with numbering, type, unit and official A/B section", () => {
    const choices = getSIECheckpointChoices("ENG1_G2_BAC");
    expect(choices).toHaveLength(20);
    expect(choices.find(choice => choice.nodeId === "ENG_U1_SEC_A_T1")).toMatchObject({
      lessonNumber: "1.1",
      unitNumber: 1,
      lessonType: "topic",
      branchId: "ENG_U1_SEC_A",
      branchTitle: "Unit 1 · Section A — Social Reflection",
    });
    expect(choices.find(choice => choice.nodeId === "ENG_U5_SEC_B_T2")?.lessonNumber).toBe("5.4");
  });

  it("shows lesson number, name, type and section in the visible English label", () => {
    const lesson = getSIECheckpointChoices("ENG1_G2_BAC").find(choice => choice.nodeId === "ENG_U1_SEC_A_T1")!;
    const label = getSIECheckpointChoiceDisplayLabel(lesson);
    expect(label).toContain("Lesson 1.1");
    expect(label).toContain("Social Media and Self-Image");
    expect(label).toContain("موضوع (Topic)");
    expect(label).toContain("Section A — Social Reflection");
  });
});
