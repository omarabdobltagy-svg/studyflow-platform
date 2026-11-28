import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

describe("Study page UI regression contract", () => {
  it("keeps every custom Study control represented in the Liquid Glass stylesheet", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const studyPage = readFileSync(resolve(directory, "../pages/Study.tsx"), "utf8");
    const glassStyles = readFileSync(resolve(directory, "../liquid-glass.css"), "utf8");
    const requiredSelectors = [
      "sf-study-hero",
      "sf-study-subject-selector",
      "sf-study-subject-option",
      "sf-study-curriculum-card",
      "sf-study-progress-card",
      "sf-study-view-tabs",
      "sf-study-view-count",
      "sf-study-unit-count",
      "sf-english-unit-lessons",
      "sf-english-lesson-row-stacked",
      "sf-english-lesson-copy",
      "sf-english-lesson-sequence",
      "sf-english-lesson-name",
      "sf-english-section-tag",
      "sf-progress-coach-float",
      "sf-progress-coach-kicker",
      "sf-progress-coach-actions",
      "sf-progress-position-pickers",
      "sf-lesson-state-panel",
      "sf-lesson-frontier-badge",
    ];

    expect(studyPage).toContain('data-testid="study-page"');
    expect(studyPage).toContain('data-testid="study-overview"');
    for (const selector of requiredSelectors) {
      expect(studyPage).toContain(selector);
      expect(glassStyles).toContain("." + selector);
    }
  });

  it("uses scoped mobile layout and black smoke motion with a reduced-motion fallback", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const glassStyles = readFileSync(resolve(directory, "../liquid-glass.css"), "utf8");
    expect(glassStyles).toContain(".sf-study-hero");
    expect(glassStyles).toContain("@media (max-width:640px)");
    expect(glassStyles).toContain("sf-black-smoke-drift");
    expect(glassStyles).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
