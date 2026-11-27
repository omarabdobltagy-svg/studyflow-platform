import { getSIESubject, getSIETeacher } from "@shared/sie-catalog";

type PlannerTeacherSession = {
  key: string;
  subjectId: string;
  teacherName: string;
  subjectName: string;
  dateLabel: string;
  time: string;
  sortDate: string;
  dateOffsetDays: number;
};

export function getPlannerTeacherSessions(profile?: {
  subjectIds?: string[];
  teacherSelections?: Record<string, string>;
  selection?: unknown;
} | null, now = new Date()): PlannerTeacherSession[] {
  if (!profile?.subjectIds?.length) return [];
  const selection = (profile.selection ?? {}) as Record<string, any>;
  const schedules = (selection.teacherSchedules ?? {}) as Record<string, Array<{ dayOfWeek: number; startTime: string }>>;
  const teacherChoices = (selection.teacherChoices ?? profile.teacherSelections ?? {}) as Record<string, string>;
  const customTeacherNames = (selection.customTeacherNames ?? {}) as Record<string, string>;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(now);
  const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const todayIndex = weekdayIndex[weekday] ?? 0;
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  const base = new Date(today + "T12:00:00.000Z");
  const sessions: PlannerTeacherSession[] = [];

  for (const subjectId of profile.subjectIds) {
    const slots = schedules[subjectId];
    if (!Array.isArray(slots)) continue;
    const subjectName = getSIESubject(subjectId)?.nameAr ?? subjectId;
    const teacherId = teacherChoices[subjectId] ?? profile.teacherSelections?.[subjectId] ?? "";
    const teacherName = getSIETeacher(teacherId)?.nameAr || customTeacherNames[subjectId] || "مدرس المادة";
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
      });
    }
  }
  return sessions.sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.time.localeCompare(b.time));
}
