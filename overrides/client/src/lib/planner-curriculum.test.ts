import { describe, expect, it } from "vitest";
import { getSIECheckpointUnits, getSIESubject } from "@shared/sie-catalog";
import { buildPlannerCurriculumLanes, getPlannerStepCurriculum, getTeacherSessionPreparationSteps } from "./planner-curriculum";

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
    expect(lanes[0].title).toContain("الوحدة");
    expect(lanes[0].unitNumber).toBe(1);
    expect(lanes[0].items).toHaveLength(anotherBranchChoice ? 2 : 1);
    expect(lanes[1].title).toContain("الوحدة");
    expect(lanes[1].unitNumber).toBe(2);
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
    expect(lanes[0].title).toContain("الوحدة");
    expect(lanes[0].unitNumber).toBe(1);
    expect(lanes[0].branchLabels.length).toBeGreaterThan(1);
  });

  it("preserves linear unit/chapter sequences for History and Programming", () => {
    for (const subjectId of ["HIS_G2_BAC", "PROG_AI_G2_BAC"]) {
      const units = getSIECheckpointUnits(subjectId).filter(unit => unit.lessonCount > 0);
      expect(units.length).toBeGreaterThan(1);
      const entries = units.slice(0, 2).map((unit, index) => {
        const choice = unit.branches.flatMap(branch => branch.choices)[0];
        expect(choice).toBeDefined();
        return { index, step: { title: choice.title, curriculumNodeIds: [choice.nodeId] } };
      });
      const lanes = buildPlannerCurriculumLanes(entries, [subjectId]);
      expect(lanes).toHaveLength(2);
      expect(lanes[0].unitId).not.toBe(lanes[1].unitId);
      expect(lanes[0].items[0].curriculum?.lesson).toBeTruthy();
      expect(lanes[1].items[0].curriculum?.lesson).toBeTruthy();
    }
  });

  it("keeps teacher-course streams under their subject without exposing internal branch names", () => {
    const units = getSIECheckpointUnits("ARB_G2_BAC");
    const course = units.find(unit => !unit.isOfficialUnit && unit.lessonCount > 0)!;
    const choice = course.branches[0].choices[0];
    const lanes = buildPlannerCurriculumLanes([
      { index: 0, step: { curriculumNodeIds: [choice.nodeId], title: choice.title } },
    ], ["ARB_G2_BAC"]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].isOfficialUnit).toBe(false);
    expect(lanes[0].title).toBe(getSIESubject("ARB_G2_BAC")?.nameAr);
    expect(lanes[0].title).not.toContain(course.title);
    expect(lanes[0].branchLabels).toContain(lanes[0].items[0].curriculum?.branch);
  });


  it("links a scheduled English class to existing unfinished backlog, without inventing future topics", () => {
    const grammar = getSIECheckpointUnits("ENG1_G2_BAC")
      .flatMap(unit => unit.branches)
      .find(branch => branch.branchId === "ENG_GRAMMAR")!;
    const choice = grammar.choices[0];
    const steps = [
      {
        title: "واجب جرامر مسجل",
        detail: "راجع ملاحظات المدرس المسجلة.",
        category: "واجب",
        phaseId: "backlog",
        existingTask: { id: 41, status: "todo" as const },
        curriculumNodeIds: [choice.nodeId],
        dateOffsetDays: 1,
      },
      {
        title: "مهمة مكتملة",
        detail: "تم إنهاؤها.",
        category: "واجب",
        phaseId: "backlog",
        plannerTaskStatus: "done" as const,
        existingTask: { id: 42, status: "done" as const },
        curriculumNodeIds: [choice.nodeId],
        dateOffsetDays: 0,
      },
      {
        title: "موضوع لا يعرفه النظام بعد",
        detail: "لا يوجد عنوان موثوق للمحاضرة القادمة.",
        category: "موعد حصة",
        phaseId: "teacher_sync",
      },
      {
        title: "واجب لاحق للحصة",
        detail: "موعده بعد المحاضرة.",
        category: "واجب",
        phaseId: "backlog",
        existingTask: { id: 43, status: "todo" as const },
        curriculumNodeIds: [choice.nodeId],
        dateOffsetDays: 5,
      },
    ];

    const preparation = getTeacherSessionPreparationSteps(steps, "ENG1_G2_BAC", ["ENG1_G2_BAC"], 2, 2);
    expect(preparation).toHaveLength(1);
    expect(preparation[0].title).toBe("واجب جرامر مسجل");
  });

  it("does not attach another subject's backlog to the current teacher session", () => {
    const arabic = getSIECheckpointUnits("ARB_G2_BAC")
      .flatMap(unit => unit.branches)
      .find(branch => branch.choices.length > 0)!;
    const choice = arabic.choices[0];
    const steps = [{
      title: choice.title,
      detail: "تفاصيل",
      category: "تراكم",
      existingTask: { id: 50, status: "todo" as const },
      curriculumNodeIds: [choice.nodeId],
    }];
    expect(getTeacherSessionPreparationSteps(steps, "ENG1_G2_BAC", ["ARB_G2_BAC", "ENG1_G2_BAC"])).toHaveLength(0);
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
