import { describe, expect, it } from "vitest";
import { getSIECheckpointUnits } from "@shared/sie-catalog";
import { buildPlannerCurriculumLanes, getPlannerStepCurriculum } from "./planner-curriculum";

describe("planner curriculum map hierarchy", () => {
  it("groups Arabic lessons by their real textbook unit, not one flat subject branch", () => {
    const units = getSIECheckpointUnits("ARB_G2_BAC").filter(unit => unit.isOfficialUnit);
    const first = units.find(unit => unit.unitNumber === 1)!;
    const second = units.find(unit => unit.unitNumber === 2)!;
    const firstUnitChoices = first.branches.flatMap(branch => branch.choices);
    const firstChoice = firstUnitChoices[0];
    const anotherBranchChoice = first.branches.find(branch =>
      branch.branchId !== first.branches[0]?.branchId && branch.choices.length > 0
    )?.choices[0];
    expect(firstChoice).toBeDefined();
    const entries = [
      { index: 0, step: { title: firstChoice.title, curriculumNodeIds: [firstChoice.nodeId] } },
      ...(anotherBranchChoice ? [{ index: 1, step: { title: anotherBranchChoice.title, curriculumNodeIds: [anotherBranchChoice.nodeId] } }] : []),
      { index: 2, step: { title: second.branches[0].choices[0].title, curriculumNodeIds: [second.branches[0].choices[0].nodeId] } },
    ];
    const lanes = buildPlannerCurriculumLanes(entries, ["ARB_G2_BAC"]);

    expect(lanes).toHaveLength(2);
    expect(lanes[0].title).toContain("الوحدة 1");
    expect(lanes[0].items).toHaveLength(anotherBranchChoice ? 2 : 1);
    expect(lanes[1].title).toContain("الوحدة 2");
  });

  it("preserves English unit, lesson number and Vocabulary/Grammar branch labels", () => {
    const units = getSIECheckpointUnits("ENG1_G2_BAC").filter(unit => unit.isOfficialUnit);
    const unitOne = units.find(unit => unit.unitNumber === 1)!;
    const choices = unitOne.branches.flatMap(branch => branch.choices);
    const vocabulary = choices.find(choice => choice.lessonType === "vocabulary");
    const grammar = choices.find(choice => choice.lessonType === "grammar");
    expect(vocabulary).toBeDefined();
    expect(grammar).toBeDefined();

    const vocabularyRef = getPlannerStepCurriculum({ curriculumNodeIds: [vocabulary!.nodeId] }, ["ENG1_G2_BAC"]);
    const grammarRef = getPlannerStepCurriculum({ curriculumNodeIds: [grammar!.nodeId] }, ["ENG1_G2_BAC"]);
    expect(vocabularyRef).toMatchObject({ unitNumber: 1, lessonNumber: vocabulary!.lessonNumber, lessonType: "vocabulary" });
    expect(grammarRef).toMatchObject({ unitNumber: 1, lessonNumber: grammar!.lessonNumber, lessonType: "grammar" });

    const lanes = buildPlannerCurriculumLanes([
      { index: 0, step: { curriculumNodeIds: [vocabulary!.nodeId], title: vocabulary!.title } },
      { index: 1, step: { curriculumNodeIds: [grammar!.nodeId], title: grammar!.title } },
    ], ["ENG1_G2_BAC"]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].title).toContain("الوحدة 1");
    expect(lanes[0].branchLabels.length).toBeGreaterThan(1);
  });

  it("keeps teacher-course streams outside official textbook units as separate lanes", () => {
    const units = getSIECheckpointUnits("ARB_G2_BAC");
    const course = units.find(unit => !unit.isOfficialUnit && unit.lessonCount > 0)!;
    const choice = course.branches[0].choices[0];
    const lanes = buildPlannerCurriculumLanes([
      { index: 0, step: { curriculumNodeIds: [choice.nodeId], title: choice.title } },
    ], ["ARB_G2_BAC"]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].isOfficialUnit).toBe(false);
    expect(lanes[0].title).toContain(course.title);
  });

  it("retains a separate general lane for manual tasks without a curriculum match", () => {
    const lanes = buildPlannerCurriculumLanes([
      { index: 0, step: { title: "مهمة شخصية", detail: "بدون ربط منهجي" } },
    ], ["ARB_G2_BAC"]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].key).toBe("__GENERAL_TASKS__");
    expect(lanes[0].title).toBe("التزامات ومهام أخرى");
  });
});
