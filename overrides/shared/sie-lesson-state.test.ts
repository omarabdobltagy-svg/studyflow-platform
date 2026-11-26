import { describe, expect, it } from "vitest";
import {
  getEffectiveStudentLessonState,
  getStudentLessonStateLabel,
  isStudentLessonStudyComplete,
  summarizeStudentLessonStates,
} from "./sie-lesson-state";

const choices = [
  { nodeId: "NAHW_1" },
  { nodeId: "NAHW_2" },
  { nodeId: "NAHW_3" },
  { nodeId: "NAHW_4" },
];

describe("student lesson learning states", () => {
  it("keeps watched-only lessons separate from studied lessons in the new state model", () => {
    expect(getEffectiveStudentLessonState({
      choices, nodeId: "NAHW_2", studentFrontierId: "NAHW_3", lessonStateModelVersion: 1,
    })).toBe("watched_only");
    expect(isStudentLessonStudyComplete("watched_only")).toBe(false);
  });

  it("does not assume a student has or has not watched anything before a position is recorded", () => {
    expect(getEffectiveStudentLessonState({
      choices, nodeId: "NAHW_2", studentFrontierId: "__UNKNOWN__", lessonStateModelVersion: 1,
    })).toBe("not_recorded");
  });

  it("preserves old inclusive frontiers as completed for legacy profiles", () => {
    expect(getEffectiveStudentLessonState({
      choices, nodeId: "NAHW_2", studentFrontierId: "NAHW_3",
    })).toBe("studied");
    expect(isStudentLessonStudyComplete("studied")).toBe(true);
  });

  it("allows a missed lesson in the middle of an otherwise watched sequence", () => {
    expect(getEffectiveStudentLessonState({
      choices,
      nodeId: "NAHW_2",
      studentFrontierId: "NAHW_4",
      lessonStateModelVersion: 1,
      saved: { state: "not_watched" },
    })).toBe("not_watched");
    expect(getEffectiveStudentLessonState({
      choices,
      nodeId: "NAHW_3",
      studentFrontierId: "NAHW_4",
      lessonStateModelVersion: 1,
    })).toBe("watched_only");
  });

  it("distinguishes study with retention confidence from study that needs review", () => {
    expect(getEffectiveStudentLessonState({
      choices, nodeId: "NAHW_1", studentFrontierId: "NAHW_4",
      lessonStateModelVersion: 1, saved: { state: "studied" },
    })).toBe("studied");
    expect(getEffectiveStudentLessonState({
      choices, nodeId: "NAHW_2", studentFrontierId: "NAHW_4",
      lessonStateModelVersion: 1, saved: { state: "needs_review" },
    })).toBe("needs_review");
  });

  it("returns an actionable summary across watched, missed, studied and review states", () => {
    expect(summarizeStudentLessonStates(["not_watched", "watched_only", "studied", "needs_review"])).toEqual({
      total: 4, notRecorded: 0, notWatched: 1, watchedOnly: 1, studied: 1, needsReview: 1,
    });
    expect(getStudentLessonStateLabel("watched_only")).toBe("شاهد الشرح فقط");
  });
});
