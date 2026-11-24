import { describe, expect, it } from "vitest";
import {
  getSIECheckpointBranches,
  getSIECheckpointChoiceDisplayLabel,
  getSIECheckpointChoiceTypeLabel,
  getSIECheckpointChoices,
} from "./sie-catalog";

describe("official checkpoint catalog structure", () => {
  it("separates Arabic reading/texts from grammar branches", () => {
    const branches = getSIECheckpointBranches("ARB_G2_BAC");
    expect(branches.map(branch => branch.branchId)).toEqual(["ARB_NAHW", "ARB_READING"]);
    expect(branches.find(branch => branch.branchId === "ARB_NAHW")?.choices.map(choice => choice.title)).toEqual([
      "الأسماء الخمسة",
      "تابع الأسماء الخمسة",
      "الممنوع من الصرف وعلل منعه",
      "تابع الممنوع من الصرف وعلل منعه",
      "النعت والبدل والتمييز بينهما",
      "العطف",
    ]);
  });

  it("marks Arabic poetry, reading and grammar by type", () => {
    const choices = getSIECheckpointChoices("ARB_G2_BAC");
    expect(choices.find(choice => choice.nodeId === "ARB_U1_L3")?.lessonType).toBe("poetry");
    expect(choices.find(choice => choice.nodeId === "ARB_U1_L1")?.lessonType).toBe("reading");
    expect(choices.find(choice => choice.nodeId === "ARB_U1_N1")?.lessonType).toBe("grammar");
    expect(getSIECheckpointChoiceTypeLabel(choices.find(choice => choice.nodeId === "ARB_U1_L3")!)).toBe("نص شعري");
  });

  it("provides all English topics with numbering, type and official A/B section", () => {
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

  it("shows lesson number, name, type and section in the visible label", () => {
    const lesson = getSIECheckpointChoices("ENG1_G2_BAC").find(choice => choice.nodeId === "ENG_U1_SEC_A_T1")!;
    const label = getSIECheckpointChoiceDisplayLabel(lesson);
    expect(label).toContain("Lesson 1.1");
    expect(label).toContain("Social Media and Self-Image");
    expect(label).toContain("Topic");
    expect(label).toContain("Section A — Social Reflection");
  });
});
