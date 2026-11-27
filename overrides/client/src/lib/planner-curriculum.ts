import { displayBranchTitle, displayCurriculumTitle } from "@/lib/curriculum-display";
import {
  getSIECheckpointProgressBranches,
  getSIECheckpointUnits,
  getSIESubject,
  matchSIECheckpointTask,
} from "@shared/sie-catalog";

export type PlannerCurriculumReference = {
  subjectId: string;
  subject: string;
  branch: string;
  lesson: string;
  unitId?: string;
  unitNumber?: number;
  unitTitle?: string;
  isOfficialUnit: boolean;
  lessonNumber?: string;
  courseSequenceNumber?: number;
  lessonType?: string;
};

export type PlannerMapEntry<TStep> = {
  step: TStep;
  index: number;
};

export type PlannerMapLane<TStep> = {
  key: string;
  title: string;
  subjectId?: string;
  unitId?: string;
  unitNumber?: number;
  unitTitle?: string;
  isOfficialUnit: boolean;
  branchLabels: string[];
  items: Array<PlannerMapEntry<TStep> & { curriculum: PlannerCurriculumReference | null }>;
};

type CurriculumStepLike = {
  curriculumNodeIds?: string[] | null;
  title?: string | null;
  detail?: string | null;
  category?: string | null;
};

function locateNode(subjectId: string, nodeId: string): PlannerCurriculumReference | null {
  const branches = getSIECheckpointProgressBranches(subjectId);
  for (const branch of branches) {
    const choice = branch.choices.find(item => item.nodeId === nodeId);
    if (!choice) continue;
    const unit = getSIECheckpointUnits(subjectId).find(item =>
      item.branches.some(unitBranch => unitBranch.choices.some(unitChoice => unitChoice.nodeId === nodeId))
    );
    return {
      subjectId,
      subject: getSIESubject(subjectId)?.nameAr ?? "مادة دراسية",
      branch: displayBranchTitle(branch.branchTitle),
      lesson: displayCurriculumTitle(choice.title),
      ...(unit ? { unitId: unit.unitId } : {}),
      ...(unit?.unitNumber ?? choice.unitNumber
        ? { unitNumber: unit?.unitNumber ?? choice.unitNumber }
        : {}),
      ...(unit?.unitTitle ?? choice.unitTitle
        ? { unitTitle: unit?.unitTitle ?? choice.unitTitle }
        : {}),
      isOfficialUnit: Boolean(unit?.isOfficialUnit),
      ...(choice.lessonNumber ? { lessonNumber: choice.lessonNumber } : {}),
      ...(choice.courseSequenceNumber ? { courseSequenceNumber: choice.courseSequenceNumber } : {}),
      ...(choice.lessonType ? { lessonType: choice.lessonType } : {}),
    };
  }
  return null;
}

export function getPlannerStepCurriculum<TStep extends CurriculumStepLike>(
  step: TStep,
  subjectIds: string[],
): PlannerCurriculumReference | null {
  const nodeIds = step.curriculumNodeIds ?? [];
  for (const subjectId of subjectIds) {
    for (const nodeId of nodeIds) {
      const curriculum = locateNode(subjectId, nodeId);
      if (curriculum) return curriculum;
    }
  }
  const match = matchSIECheckpointTask(subjectIds, [step.title ?? "", step.detail ?? "", step.category ?? ""].join(" "));
  return match ? locateNode(match.subjectId, match.nodeId) : null;
}

export function buildPlannerCurriculumLanes<TStep extends CurriculumStepLike>(
  entries: PlannerMapEntry<TStep>[],
  subjectIds: string[],
): PlannerMapLane<TStep>[] {
  const lanes = new Map<string, PlannerMapLane<TStep>>();
  for (const entry of entries) {
    const curriculum = getPlannerStepCurriculum(entry.step, subjectIds);
    const key = curriculum
      ? curriculum.subjectId + "::" + (curriculum.unitId || "BRANCH::" + curriculum.branch)
      : "__GENERAL_TASKS__";
    const title = curriculum
      ? curriculum.subject + (curriculum.unitNumber
        ? " · الوحدة " + curriculum.unitNumber.toLocaleString("ar-EG") + (curriculum.unitTitle ? " — " + curriculum.unitTitle : "")
        : curriculum.branch ? " · " + curriculum.branch : "")
      : "التزامات ومهام أخرى";
    let lane = lanes.get(key);
    if (!lane) {
      lane = {
        key,
        title,
        subjectId: curriculum?.subjectId,
        unitId: curriculum?.unitId,
        unitNumber: curriculum?.unitNumber,
        unitTitle: curriculum?.unitTitle,
        isOfficialUnit: Boolean(curriculum?.isOfficialUnit),
        branchLabels: [],
        items: [],
      };
      lanes.set(key, lane);
    }
    if (curriculum?.branch && !lane.branchLabels.includes(curriculum.branch)) {
      lane.branchLabels.push(curriculum.branch);
    }
    lane.items.push({ ...entry, curriculum });
  }
  return [...lanes.values()];
}
