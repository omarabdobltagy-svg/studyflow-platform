export type StudyViewMode = "units" | "lessons";
export type ProgressGuideViewState = {
  setupCoachmarkVersion: number;
  progressPickerGuideCompletedAt?: string | null;
  progressGuideDismissed: boolean;
  hasVisibleBranches: boolean;
  studyViewMode: StudyViewMode;
};

/** Open lesson view once for first-run guidance, never after explicit dismissal. */
export function shouldForceLessonViewForProgressGuide(state: ProgressGuideViewState): boolean {
  return state.setupCoachmarkVersion >= 1
    && !state.progressPickerGuideCompletedAt
    && !state.progressGuideDismissed
    && state.hasVisibleBranches
    && state.studyViewMode === "units";
}

export function normalizeStudySearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/ـ/g, "").replace(/\s+/g, " ").trim();
}
