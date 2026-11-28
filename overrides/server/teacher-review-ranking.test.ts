import { describe, expect, it } from "vitest";
import { rankTeacherReviewCandidates } from "./teacher-review-ranking";

describe("teacher review candidate ranking", () => {
  it("prioritizes the student's selected teacher before a verified alternative", () => {
    const selectedTeacher = {
      externalId: "youtube:selected",
      isSelectedTeacher: true,
      verificationState: "description_verified",
      matchedSignals: 1,
      publishedAt: "2026-11-20T10:00:00.000Z",
    };
    const verifiedAlternative = {
      externalId: "youtube:alternative",
      isSelectedTeacher: false,
      verificationState: "content_verified",
      matchedSignals: 4,
      publishedAt: "2026-11-27T10:00:00.000Z",
    };

    expect(rankTeacherReviewCandidates([verifiedAlternative, selectedTeacher]).map(item => item.externalId))
      .toEqual(["youtube:selected", "youtube:alternative"]);
  });

  it("ranks verification strength, curriculum signals, and recency within the same teacher group", () => {
    const lessVerified = {
      externalId: "youtube:description",
      isSelectedTeacher: true,
      verificationState: "description_verified",
      matchedSignals: 6,
      publishedAt: "2026-11-28T10:00:00.000Z",
    };
    const fullyVerified = {
      externalId: "youtube:content",
      isSelectedTeacher: true,
      verificationState: "content_verified",
      matchedSignals: 1,
      publishedAt: "2026-11-20T10:00:00.000Z",
    };

    expect(rankTeacherReviewCandidates([lessVerified, fullyVerified]).map(item => item.externalId))
      .toEqual(["youtube:content", "youtube:description"]);
  });

  it("keeps invalid publish dates from disrupting deterministic ranking", () => {
    const older = {
      externalId: "youtube:older",
      isSelectedTeacher: false,
      verificationState: "description_verified",
      matchedSignals: 2,
      publishedAt: "2026-11-20T10:00:00.000Z",
    };
    const missingDate = {
      externalId: "youtube:undated",
      isSelectedTeacher: false,
      verificationState: "description_verified",
      matchedSignals: 2,
      publishedAt: "not-a-date",
    };

    expect(rankTeacherReviewCandidates([missingDate, older]).map(item => item.externalId))
      .toEqual(["youtube:older", "youtube:undated"]);
  });
});
