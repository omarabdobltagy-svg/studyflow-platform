import { describe, expect, it } from "vitest";
import {
  buildTeacherClassFollowupKey,
  requiresBranchCheckinForSubject,
  getDateKeyInZone,
  getDueTeacherClassFollowups,
  zonedLocalTimeToUtc,
} from "./teacherClassFollowups";

describe("teacher class follow-ups", () => {
  it("asks for branch details only for Arabic and English", () => {
    expect(requiresBranchCheckinForSubject("ARB_G2_BAC", 3)).toBe(true);
    expect(requiresBranchCheckinForSubject("ENG1_G2_BAC", 2)).toBe(true);
    expect(requiresBranchCheckinForSubject("HIS_G2_BAC", 4)).toBe(false);
    expect(requiresBranchCheckinForSubject("PROG_AI_G2_BAC", 7)).toBe(false);
    expect(requiresBranchCheckinForSubject("HIS_G2_BAC", 1)).toBe(false);
  });

  it("converts a Cairo wall-clock session to the matching UTC instant", () => {
    const local = zonedLocalTimeToUtc("2026-11-26", "18:00");
    expect(local.toISOString()).toBe("2026-11-26T16:00:00.000Z");
    expect(getDateKeyInZone(local)).toBe("2026-11-26");
  });

  it("creates one follow-up exactly two hours after a recorded weekly lesson", () => {
    const now = new Date("2026-11-26T20:01:00.000Z"); // 22:01 in Cairo
    const due = getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 4, startTime: "18:00" }] },
      now,
    });
    expect(due).toHaveLength(1);
    expect(due[0].classDate).toBe("2026-11-26");
    expect(due[0].classStartAt.toISOString()).toBe("2026-11-26T16:00:00.000Z");
    expect(due[0].dueAt.toISOString()).toBe("2026-11-26T18:00:00.000Z");
    expect(due[0].nextSessionAt.toISOString()).toBe("2026-12-03T16:00:00.000Z");
  });

  it("schedules the next class across all configured weekly slots", () => {
    const due = getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: {
        ENG1_G2_BAC: [
          { dayOfWeek: 4, startTime: "18:00" },
          { dayOfWeek: 6, startTime: "15:00" },
        ],
      },
      now: new Date("2026-11-26T20:01:00.000Z"),
    });
    expect(due).toHaveLength(1);
    expect(due[0].nextSessionAt.toISOString()).toBe("2026-11-28T13:00:00.000Z");
  });

  it("does not reopen an unanswered class from a previous week", () => {
    const due = getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 4, startTime: "18:00" }] },
      now: new Date("2026-12-03T12:00:00.000Z"),
    });
    expect(due).toHaveLength(0);
  });

  it("does not ask before the two-hour point", () => {
    const due = getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 4, startTime: "18:00" }] },
      now: new Date("2026-11-26T17:59:00.000Z"),
    });
    expect(due).toHaveLength(0);
  });

  it("does not repeat an answered or snoozed class check-in", () => {
    const now = new Date("2026-11-26T20:01:00.000Z");
    const key = buildTeacherClassFollowupKey("ENG1_G2_BAC", "2026-11-26", 4, "18:00");
    expect(getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 4, startTime: "18:00" }] },
      records: { [key]: { status: "answered", answeredAt: now.toISOString() } },
      now,
    })).toHaveLength(0);
    expect(getDueTeacherClassFollowups({
      subjectIds: ["ENG1_G2_BAC"],
      teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 4, startTime: "18:00" }] },
      records: { [key]: { snoozedUntil: "2026-11-26T22:00:00.000Z" } },
      now,
    })).toHaveLength(0);
  });
});
