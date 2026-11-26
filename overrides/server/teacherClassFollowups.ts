import { getSIECheckpointProgressBranches } from "@shared/sie-catalog";

export const TEACHER_CLASS_FOLLOWUP_TIMEZONE = "Africa/Cairo";
export const TEACHER_CLASS_FOLLOWUP_DELAY_MS = 2 * 60 * 60 * 1_000;

export type TeacherScheduleSlot = { dayOfWeek: number; startTime: string };
export type TeacherClassFollowupRecord = {
  status?: "answered" | "auto_processed" | "cancelled";
  answeredAt?: string;
  outcome?: "covered" | "no_new_topics" | "cancelled";
  branchFrontiers?: Record<string, string>;
  snoozedUntil?: string;
  nextSessionAt?: string;
  nextCalendarEventId?: number;
};
export type DueTeacherClassFollowup = {
  key: string;
  subjectId: string;
  classDate: string;
  dayOfWeek: number;
  startTime: string;
  classStartAt: Date;
  dueAt: Date;
  nextSessionAt: Date;
  requiresTopicSelection: boolean;
};

function zonedParts(date: Date, timeZone = TEACHER_CLASS_FOLLOWUP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function getDateKeyInZone(date: Date, timeZone = TEACHER_CLASS_FOLLOWUP_TIMEZONE): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Convert a wall-clock time in a named IANA timezone to a UTC instant. */
export function zonedLocalTimeToUtc(
  dateKey: string,
  time: string,
  timeZone = TEACHER_CLASS_FOLLOWUP_TIMEZONE,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Invalid local class date or time.");
  }
  const targetAsUtc = Date.parse(`${dateKey}T${time}:00.000Z`);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00.000Z`,
    );
    const adjustment = targetAsUtc - representedAsUtc;
    if (!adjustment) break;
    candidate += adjustment;
  }
  return new Date(candidate);
}

/** Only language subjects use the post-class branch checklist requested by the student. */
export function requiresBranchCheckinForSubject(subjectId: string, branchCount: number): boolean {
  return branchCount > 1 && /^(?:ENG|ENGLISH|ARB|ARABIC)/i.test(subjectId.trim());
}

export function buildTeacherClassFollowupKey(
  subjectId: string,
  classDate: string,
  dayOfWeek: number,
  startTime: string,
): string {
  return [subjectId, classDate, dayOfWeek, startTime].join("|");
}

function getNextOccurrence(slot: TeacherScheduleSlot, after: Date): Date {
  const localToday = getDateKeyInZone(after);
  const base = new Date(`${localToday}T12:00:00.000Z`);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDate = new Date(base);
    candidateDate.setUTCDate(candidateDate.getUTCDate() + offset);
    if (candidateDate.getUTCDay() !== slot.dayOfWeek) continue;
    const dateKey = candidateDate.toISOString().slice(0, 10);
    const candidate = zonedLocalTimeToUtc(dateKey, slot.startTime);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  throw new Error("Unable to resolve the next teacher session.");
}

function getNextSubjectOccurrence(slots: TeacherScheduleSlot[], after: Date): Date {
  const validSlots = slots.filter(slot =>
    Number.isInteger(slot.dayOfWeek) && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime)
  );
  const candidates = validSlots.map(slot => getNextOccurrence(slot, after).getTime());
  if (!candidates.length) throw new Error("No valid upcoming teacher sessions are configured.");
  return new Date(Math.min(...candidates));
}

function getLatestScheduledOccurrence(slot: TeacherScheduleSlot, now: Date): Date | null {
  const localToday = getDateKeyInZone(now);
  const base = new Date(`${localToday}T12:00:00.000Z`);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateDate = new Date(base);
    candidateDate.setUTCDate(candidateDate.getUTCDate() - offset);
    if (candidateDate.getUTCDay() !== slot.dayOfWeek) continue;
    const candidate = zonedLocalTimeToUtc(candidateDate.toISOString().slice(0, 10), slot.startTime);
    if (candidate.getTime() <= now.getTime()) return candidate;
  }
  return null;
}

export function getDueTeacherClassFollowups(input: {
  subjectIds: readonly string[];
  teacherSchedules: Record<string, TeacherScheduleSlot[]>;
  records?: Record<string, TeacherClassFollowupRecord>;
  now?: Date;
}): DueTeacherClassFollowup[] {
  const now = input.now ?? new Date();
  const records = input.records ?? {};
  const due: DueTeacherClassFollowup[] = [];

  for (const subjectId of input.subjectIds) {
    const slots = input.teacherSchedules[subjectId];
    if (!Array.isArray(slots)) continue;
    const branches = getSIECheckpointProgressBranches(subjectId);
    const requiresTopicSelection = requiresBranchCheckinForSubject(subjectId, branches.length);

    for (const slot of slots) {
      if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime)) continue;

      const classStartAt = getLatestScheduledOccurrence(slot, now);
      if (!classStartAt) continue;
      const dueAt = new Date(classStartAt.getTime() + TEACHER_CLASS_FOLLOWUP_DELAY_MS);
      if (dueAt.getTime() > now.getTime()) continue;

      const classDate = getDateKeyInZone(classStartAt);
      const key = buildTeacherClassFollowupKey(subjectId, classDate, slot.dayOfWeek, slot.startTime);
      const record = records[key];
      if (record?.status === "answered" || record?.status === "auto_processed" || record?.status === "cancelled") continue;
      if (record?.snoozedUntil && new Date(record.snoozedUntil).getTime() > now.getTime()) continue;

      due.push({
        key,
        subjectId,
        classDate,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        classStartAt,
        dueAt,
        nextSessionAt: getNextSubjectOccurrence(slots, classStartAt),
        requiresTopicSelection,
      });
    }
  }

  return due.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
}
