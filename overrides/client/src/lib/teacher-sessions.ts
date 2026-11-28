import { getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { getDateKeyInTimeZone } from "@shared/date-time";

// endTime is accepted only for older saved profiles; it is intentionally ignored.
export type TeacherScheduleSlot = { dayOfWeek: number; startTime: string; endTime?: string };

const isValidClockTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isValidTeacherScheduleSlot = (slot: Partial<TeacherScheduleSlot>): slot is TeacherScheduleSlot =>
  Number.isInteger(slot.dayOfWeek) && Number(slot.dayOfWeek) >= 0 && Number(slot.dayOfWeek) <= 6
  && isValidClockTime(slot.startTime);

/** Fill missing default weekdays without overriding a time the student has changed. */
export function mergeSuggestedTeacherScheduleSlots(
  existing: TeacherScheduleSlot[] | undefined,
  suggested: TeacherScheduleSlot[] | undefined,
): TeacherScheduleSlot[] {
  const merged = (Array.isArray(existing) ? existing : []).filter(isValidTeacherScheduleSlot)
    .map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
    }));
  const occupiedDays = new Set(merged.map(slot => slot.dayOfWeek));
  for (const slot of Array.isArray(suggested) ? suggested : []) {
    if (!isValidTeacherScheduleSlot(slot) || occupiedDays.has(slot.dayOfWeek)) continue;
    merged.push({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime });
    occupiedDays.add(slot.dayOfWeek);
  }
  return merged.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

export type PlannerTeacherSession = {
  key: string;
  subjectId: string;
  teacherName: string;
  subjectName: string;
  dateLabel: string;
  time: string;
  sortDate: string;
  dateOffsetDays: number;
  dayOfWeek: number;
};

export function getPlannerTeacherSessions(profile?: {
  subjectIds?: string[];
  teacherSelections?: Record<string, string>;
  selection?: unknown;
  teacherSchedules?: Record<string, TeacherScheduleSlot[]>;
} | null, now = new Date()): PlannerTeacherSession[] {
  if (!profile?.subjectIds?.length) return [];
  const rawSelection = profile.selection ?? {};
  const selection = (typeof rawSelection === "string"
    ? (() => { try { return JSON.parse(rawSelection) as Record<string, any>; } catch { return {}; } })()
    : rawSelection) as Record<string, any>;
  const rootSchedules = profile.teacherSchedules ?? {};
  const selectedSchedules = (selection.teacherSchedules ?? {}) as Record<string, TeacherScheduleSlot[]>;
  const schedules = { ...rootSchedules, ...selectedSchedules };
  const teacherChoices = {
    ...((profile.teacherSelections ?? {}) as Record<string, string>),
    ...((selection.teacherChoices ?? {}) as Record<string, string>),
  };
  const customTeacherNames = (selection.customTeacherNames ?? {}) as Record<string, string>;
  const unfixedSubjects = new Set<string>([
    ...(Array.isArray(selection.teacherScheduleUnfixedSubjectIds) ? selection.teacherScheduleUnfixedSubjectIds : []),
    ...Object.entries((selection.teacherScheduleUnfixed ?? {}) as Record<string, boolean>)
      .filter(([, value]) => Boolean(value)).map(([subjectId]) => subjectId),
  ]);
  const today = getDateKeyInTimeZone(now, "Africa/Cairo");
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(now);
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayIndex = weekdayIndex[weekday] ?? 0;
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  const base = new Date(today + "T12:00:00.000Z");
  const sessions: PlannerTeacherSession[] = [];

  for (const subjectId of profile.subjectIds) {
    const subjectName = getSIESubject(subjectId)?.nameAr ?? subjectId;
    const teacherId = teacherChoices[subjectId] ?? "";
    const teacher = getSIETeacher(teacherId);
    const savedSlots = Array.isArray(schedules[subjectId]) ? schedules[subjectId] : [];
    const suggestedSlots = unfixedSubjects.has(subjectId) ? [] : teacher?.suggestedDefaultSchedule ?? [];
    const slots = mergeSuggestedTeacherScheduleSlots(savedSlots, suggestedSlots);
    if (!slots.length) continue;
    const teacherName = teacher?.nameAr || customTeacherNames[subjectId] || "مدرس المادة";
    for (const slot of slots) {
      if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6
        || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(slot.startTime)) continue;
      let offset = (slot.dayOfWeek - todayIndex + 7) % 7;
      if (offset === 0 && slot.startTime <= currentTime) offset = 7;
      const date = new Date(base);
      date.setUTCDate(date.getUTCDate() + offset);
      const sortDate = date.toISOString().slice(0, 10);
      const sessionDate = new Date(sortDate + "T12:00:00.000Z");
      const todayDate = new Date(today + "T12:00:00.000Z");
      const dateOffsetDays = Math.max(0, Math.round((sessionDate.getTime() - todayDate.getTime()) / 86_400_000));
      sessions.push({
        key: subjectId + "-" + slot.dayOfWeek + "-" + slot.startTime + "-" + sortDate,
        subjectId,
        teacherName,
        subjectName,
        dateLabel: new Intl.DateTimeFormat("ar-EG", {
          timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long",
        }).format(date),
        time: slot.startTime,
        sortDate,
        dateOffsetDays,
        dayOfWeek: slot.dayOfWeek,
      });
    }
  }
  return sessions.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.time.localeCompare(b.time));
}


export type PlannerTeacherSessionGroup = {
  key: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  sessions: PlannerTeacherSession[];
};

/**
 * Return date/time pairs that have more than one lesson beginning at exactly
 * the same Cairo wall-clock time. This intentionally does not infer duration
 * or overlap because the current profile schema does not persist reliable ends.
 */
export function getTeacherSessionConflictKeys(
  sessions: readonly Pick<PlannerTeacherSession, "sortDate" | "time">[],
): Set<string> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const key = session.sortDate + "::" + session.time;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

export function groupPlannerTeacherSessions(sessions: PlannerTeacherSession[]): PlannerTeacherSessionGroup[] {
  const groups = new Map<string, PlannerTeacherSessionGroup>();
  for (const session of sessions) {
    const key = session.subjectId + "::" + session.teacherName;
    const group = groups.get(key);
    if (group) group.sessions.push(session);
    else groups.set(key, {
      key, subjectId: session.subjectId, subjectName: session.subjectName,
      teacherName: session.teacherName, sessions: [session],
    });
  }
  return [...groups.values()].map(group => ({
    ...group,
    sessions: group.sessions.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)),
  })).sort((a, b) => a.sessions[0].sortDate.localeCompare(b.sessions[0].sortDate)
    || a.sessions[0].time.localeCompare(b.sessions[0].time));
}
