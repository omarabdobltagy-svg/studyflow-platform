import { describe, expect, it } from "vitest";
import { getPlannerTeacherSessions } from "./teacher-sessions";

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

  it("does not truncate when there are more than eight future sessions", () => {
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
    expect(sessions).toHaveLength(9);
  });
});
