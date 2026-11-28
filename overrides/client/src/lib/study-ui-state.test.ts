import { describe, expect, it } from "vitest";
import { normalizeStudySearch, shouldForceLessonViewForProgressGuide } from "./study-ui-state";

describe("Study page progress guide state", () => {
  const base = {
    setupCoachmarkVersion: 1,
    progressPickerGuideCompletedAt: null,
    progressGuideDismissed: false,
    hasVisibleBranches: true,
    studyViewMode: "units" as const,
  };

  it("opens lesson view for first-run guidance", () => {
    expect(shouldForceLessonViewForProgressGuide(base)).toBe(true);
  });

  it("does not trap the student in lessons after choosing remind me later", () => {
    expect(shouldForceLessonViewForProgressGuide({ ...base, progressGuideDismissed: true })).toBe(false);
  });

  it("does not reopen after guide completion", () => {
    expect(shouldForceLessonViewForProgressGuide({ ...base, progressPickerGuideCompletedAt: "2026-11-28T12:00:00.000Z" })).toBe(false);
  });

  it("does not force lessons if a curriculum branch is unavailable", () => {
    expect(shouldForceLessonViewForProgressGuide({ ...base, hasVisibleBranches: false })).toBe(false);
  });
});

describe("Study page Arabic search", () => {
  it("normalizes Arabic variants, diacritics and repeated whitespace", () => {
    expect(normalizeStudySearch("  أَحْمَد   وَفَاطِمَة  ")).toBe("احمد وفاطمه");
  });

  it("keeps English lesson identifiers searchable", () => {
    expect(normalizeStudySearch("Lesson   03 Vocabulary")).toBe("lesson 03 vocabulary");
  });
});
