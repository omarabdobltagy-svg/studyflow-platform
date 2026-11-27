import { describe, expect, it } from "vitest";
import { getPlannerTeacherSessions, getTeacherLectureDuration, groupPlannerTeacherSessions, mergeSuggestedTeacherScheduleSlots } from "./teacher-sessions";

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


describe("teacher lecture time ranges", () => {
  it("preserves an optional end time when merging suggested weekdays", () => {
    expect(mergeSuggestedTeacherScheduleSlots(
      [{ dayOfWeek: 0, startTime: "09:00", endTime: "10:30" }],
      [{ dayOfWeek: 0, startTime: "09:00" }, { dayOfWeek: 3, startTime: "09:00" }],
    )).toEqual([
      { dayOfWeek: 0, startTime: "09:00", endTime: "10:30" },
      { dayOfWeek: 3, startTime: "09:00" },
    ]);
  });

  it("returns the lecture end time to planner session cards", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      selection: {
        teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
        teacherSchedules: {
          ENG1_G2_BAC: [
            { dayOfWeek: 0, startTime: "21:00", endTime: "22:30" },
            { dayOfWeek: 3, startTime: "21:00" },
          ],
        },
      },
    };
    const sessions = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    expect(sessions.find(item => item.sortDate === "2026-11-29")?.endTime).toBe("22:30");
    expect(sessions.find(item => item.sortDate === "2026-12-02")?.endTime).toBeUndefined();
  });

  it("ignores an invalid end time without dropping a valid start appointment", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      selection: {
        teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
        teacherSchedules: {
          ENG1_G2_BAC: [{ dayOfWeek: 0, startTime: "21:00", endTime: "29:90" }],
        },
      },
    };
    const sessions = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    expect(sessions.find(item => item.sortDate === "2026-11-29")).toMatchObject({ time: "21:00" });
    expect(sessions.find(item => item.sortDate === "2026-11-29")?.endTime).toBeUndefined();
  });
});


describe("getTeacherLectureDuration", () => {
  it("calculates lecture duration from start and end", () => {
    expect(getTeacherLectureDuration("09:00", "10:30")).toContain("١ ساعة و ٣٠ دقيقة");
  });

  it("supports a lecture that finishes after midnight", () => {
    const result = getTeacherLectureDuration("23:30", "01:00");
    expect(result).toContain("١ ساعة و ٣٠ دقيقة");
    expect(result).toContain("لليوم التالي");
  });

  it("does not invent a duration when no end time has been selected", () => {
    expect(getTeacherLectureDuration("09:00")).toBeNull();
  });

  it("warns when start and end times are identical", () => {
    expect(getTeacherLectureDuration("09:00", "09:00")).toBe("وقت النهاية لازم يختلف عن البداية");
  });

  it("rejects malformed time values", () => {
    expect(getTeacherLectureDuration("29:00", "30:00")).toBeNull();
  });
});


describe("legacy teacher schedule maps and weekly groups", () => {
  it("uses profile-level schedule slots when selection has no entries", () => {
    const profile = {
      subjectIds: ["ENG1_G2_BAC"],
      teacherSelections: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" },
      selection: { teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" }, teacherSchedules: {} },
      teacherSchedules: { ENG1_G2_BAC: [
        { dayOfWeek: 0, startTime: "21:00" },
        { dayOfWeek: 3, startTime: "21:00" },
      ] },
    };
    const result = getPlannerTeacherSessions(profile, new Date("2026-11-27T12:00:00.000Z"));
    expect(result).toHaveLength(2);
    expect(result.map(item => item.dayOfWeek)).toEqual([0, 3]);
  });

  it("groups both Sunday and Wednesday appointments for the same teacher", () => {
    const result = getPlannerTeacherSessions({
      subjectIds: ["ENG1_G2_BAC"],
      selection: { teacherChoices: { ENG1_G2_BAC: "T_EN_MAHMOUD_RADWAN" }, teacherSchedules: {
        ENG1_G2_BAC: [
          { dayOfWeek: 0, startTime: "21:00", endTime: "22:30" },
          { dayOfWeek: 3, startTime: "21:00", endTime: "22:30" },
        ],
      } },
    }, new Date("2026-11-27T12:00:00.000Z"));
    const groups = groupPlannerTeacherSessions(result);
    expect(groups).toHaveLength(1);
    expect(groups[0].sessions.map(item => item.dayOfWeek)).toEqual([0, 3]);
    expect(groups[0].sessions.map(item => item.endTime)).toEqual(["22:30", "22:30"]);
  });
});
