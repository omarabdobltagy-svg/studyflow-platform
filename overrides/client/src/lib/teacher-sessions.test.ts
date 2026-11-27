import { describe, expect, it } from "vitest";
import { getPlannerTeacherSessions, mergeSuggestedTeacherScheduleSlots } from "./teacher-sessions";

describe("getPlannerTeacherSessions", () => {
  it("keeps both default weekly sessions for one teacher", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      teacherSelections: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
      selection: {
        teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
        teacherSchedules: {
          ENG1_G2_BAC: [
            { dayOfWeek: 0, startTime: "21:00" },
            { dayOfWeek: 3, startTime: "21:00" },
          ],
        },
      },
    };
    const sessions = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    expect(sessions).toHaveLength(2);
    expect(sessions.map(session => session.time)).toEqual(["21:00", "21:00"]);
    expect(new Set(sessions.map(session => session.sortDate)).size).toBe(2);
  });

  it("does not truncate more than eight saved sessions and backfills any missing default weekday", () => {
    const profile = {
      subjectIds: ["ARB_G2_BAC", "ENG1_G2_BAC"],
      teacherSelections: {
        ARB_G2_BAC: "T_AR_MOHAMED_SALAH",
        ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN",
      },
      selection: {
        teacherChoices: {
          ARB_G2_BAC: "T_AR_MOHAMED_SALAH",
          ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN",
        },
        teacherSchedules: {
          ARB_G2_BAC: [
            { dayOfWeek: 0, startTime: "09:00" },
            { dayOfWeek: 0, startTime: "10:00" },
            { dayOfWeek: 0, startTime: "11:00" },
            { dayOfWeek: 0, startTime: "12:00" },
            { dayOfWeek: 0, startTime: "13:00" },
          ],
          ENG1_G2_BAC: [
            { dayOfWeek: 3, startTime: "17:00" },
            { dayOfWeek: 3, startTime: "18:00" },
            { dayOfWeek: 3, startTime: "19:00" },
            { dayOfWeek: 3, startTime: "20:00" },
          ],
        },
      },
    };
    const sessions = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    // Nine saved slots plus the missing Sunday default for Englishawy.
    expect(sessions).toHaveLength(10);
  });
});


describe("mergeSuggestedTeacherScheduleSlots", () => {
  it("fills a missing weekday on an older one-slot schedule", () => {
    expect(mergeSuggestedTeacherScheduleSlots(
      [{ dayOfWeek: 0, startTime: "21:00" }],
      [{ dayOfWeek: 0, startTime: "21:00" }, { dayOfWeek: 3, startTime: "21:00" }],
    )).toEqual([
      { dayOfWeek: 0, startTime: "21:00" },
      { dayOfWeek: 3, startTime: "21:00" },
    ]);
  });

  it("preserves a student-edited time on an existing default weekday", () => {
    expect(mergeSuggestedTeacherScheduleSlots(
      [{ dayOfWeek: 0, startTime: "20:30" }],
      [{ dayOfWeek: 0, startTime: "21:00" }, { dayOfWeek: 3, startTime: "21:00" }],
    )).toEqual([
      { dayOfWeek: 0, startTime: "20:30" },
      { dayOfWeek: 3, startTime: "21:00" },
    ]);
  });

  it("does not reintroduce defaults when lecture times are marked unfixed", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      teacherSelections: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
      selection: {
        teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
        teacherScheduleUnfixedSubjectIds: ["ENG1_G2_BAC"],
        teacherSchedules: { ENG1_G2_BAC: [] },
      },
    };
    expect(getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"))).toHaveLength(0);
  });

  it("shows both suggested weekdays for a legacy profile that saved only one", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      selection: {
        teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
        teacherSchedules: { ENG1_G2_BAC: [{ dayOfWeek: 0, startTime: "21:00" }] },
      },
    };
    const sessions = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    expect(sessions).toHaveLength(2);
    expect(sessions.map(item => item.time)).toEqual(["21:00", "21:00"]);
    expect(new Set(sessions.map(item => item.sortDate)).size).toBe(2);
  });
});
