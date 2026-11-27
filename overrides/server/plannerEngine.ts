export type PlannerEventImpact = "none" | "local" | "structural";

export type PlannerLearningState = "not_recorded" | "not_watched" | "watched_only" | "studied" | "needs_review";

/** Unwatched explanations precede every revision-only lesson. */
export function getPlannerLearningStatePriority(state: PlannerLearningState): number {
  switch (state) {
    case "not_watched": return 0;
    case "not_recorded": return 1;
    case "watched_only":
    case "needs_review": return 2;
    case "studied": return 3;
  }
}

export type PlannerScheduleSettings = {
  dailyMinutes: number;
  daysPerWeek: 5 | 6 | 7;
  horizonDays: 7 | 14;
  maxSessionMinutes?: number;
  /** Keeps hard/large lesson blocks on their own study day. */
  isolateHeavySteps?: boolean;
};

export type ScheduledPlanStep<T> = T & {
  day: string;
  dayIndex: number | null;
  dateOffsetDays: number | null;
  scheduleState: "scheduled" | "deferred";
  scheduleNote?: string;
  sourceTitle: string;
  sourceStepIndex: number;
  segmentIndex: number;
  segmentCount: number;
};

export type PlannerScheduleStats = {
  availableStudyDays: number;
  studyDaysUsed: number;
  scheduledMinutes: number;
  deferredMinutes: number;
  deferredSteps: number;
  maxDailyLoadMinutes: number;
  maxSessionMinutes: number;
};

export type PlannerQualityReport = {
  score: number;
  status: "ready" | "partial" | "blocked";
  blockers: string[];
  warnings: string[];
  stats: PlannerScheduleStats;
};

/** Leaves a small daily recovery buffer instead of filling every available minute. */
export function getDailyPlanningCapacity(dailyMinutes: number, reservePercent = 15): number {
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 20 || dailyMinutes > 600) {
    throw new Error("dailyMinutes must be an integer between 20 and 600.");
  }
  if (!Number.isInteger(reservePercent) || reservePercent < 0 || reservePercent > 40) {
    throw new Error("reservePercent must be an integer between 0 and 40.");
  }
  return Math.max(20, Math.floor(dailyMinutes * (100 - reservePercent) / 100));
}

export function getAvailableStudyDays(settings: Pick<PlannerScheduleSettings, "horizonDays" | "daysPerWeek">): number {
  const weeks = Math.floor(settings.horizonDays / 7);
  const remainingDays = settings.horizonDays % 7;
  return weeks * settings.daysPerWeek + Math.min(settings.daysPerWeek, remainingDays);
}

function getCalendarOffset(studyDayIndex: number, daysPerWeek: number): number {
  return studyDayIndex + Math.floor(studyDayIndex / daysPerWeek) * (7 - daysPerWeek);
}

/**
 * Deterministic capacity scheduler. It preserves every source step, breaks
 * oversized work into bounded sessions, respects weekly rest days, and marks
 * work outside the selected horizon as deferred rather than overbooking it.
 */
export function schedulePlanSteps<T extends {
  title: string;
  detail: string;
  minutes: number;
  category: string;
  existingTask?: unknown;
  curriculumNodeIds?: string[];
}>(steps: readonly T[], settings: PlannerScheduleSettings): {
  steps: Array<ScheduledPlanStep<T>>;
  stats: PlannerScheduleStats;
} {
  if (!Number.isInteger(settings.dailyMinutes) || settings.dailyMinutes < 20 || settings.dailyMinutes > 600) {
    throw new Error("dailyMinutes must be an integer between 20 and 600.");
  }
  if (![5, 6, 7].includes(settings.daysPerWeek)) throw new Error("daysPerWeek must be 5, 6, or 7.");
  if (![7, 14].includes(settings.horizonDays)) throw new Error("horizonDays must be 7 or 14.");
  const availableStudyDays = getAvailableStudyDays(settings);
  const maxSessionMinutes = Math.min(settings.maxSessionMinutes ?? 90, 90, settings.dailyMinutes);
  if (!Number.isInteger(maxSessionMinutes) || maxSessionMinutes < 20) {
    throw new Error("maxSessionMinutes must allow sessions of at least 20 minutes.");
  }

  const scheduled: Array<ScheduledPlanStep<T>> = [];
  const dayLoads = new Map<number, number>();
  let studyDayIndex = 0;
  let usedMinutes = 0;
  let scheduledMinutes = 0;
  let deferredMinutes = 0;
  let deferredSteps = 0;

  const moveToNextDay = () => {
    studyDayIndex += 1;
    usedMinutes = 0;
  };

  steps.forEach((step, sourceStepIndex) => {
    const sourceTitle = step.title.trim();
    const metadata = step as T & { difficulty?: string; lessonSize?: string };
    const isolateHeavyStep = settings.isolateHeavySteps === true
      && (metadata.difficulty === "hard" || metadata.lessonSize === "large");
    if (isolateHeavyStep && usedMinutes > 0 && studyDayIndex < availableStudyDays) {
      moveToNextDay();
    }
    const totalMinutes = Math.max(5, Math.min(480, Math.round(step.minutes)));
    let remaining = totalMinutes;
    const sourceParts: Array<{
      minutes: number;
      dayIndex: number;
      dateOffsetDays: number;
    }> = [];

    while (remaining > 0 && studyDayIndex < availableStudyDays) {
      const remainingCapacity = settings.dailyMinutes - usedMinutes;
      if (remainingCapacity <= 0) {
        moveToNextDay();
        continue;
      }
      if (remainingCapacity < 20 && remaining > remainingCapacity) {
        moveToNextDay();
        continue;
      }

      const minutes = Math.min(remaining, maxSessionMinutes, remainingCapacity);
      if (minutes < 20 && remaining > minutes) {
        moveToNextDay();
        continue;
      }

      sourceParts.push({
        minutes,
        dayIndex: studyDayIndex + 1,
        dateOffsetDays: getCalendarOffset(studyDayIndex, settings.daysPerWeek),
      });
      remaining -= minutes;
      usedMinutes += minutes;
      scheduledMinutes += minutes;
      dayLoads.set(studyDayIndex + 1, (dayLoads.get(studyDayIndex + 1) ?? 0) + minutes);
      if (remaining > 0 && usedMinutes >= settings.dailyMinutes) moveToNextDay();
    }

    const hasDeferredRemainder = remaining > 0;
    const segmentCount = sourceParts.length + (hasDeferredRemainder ? 1 : 0);
    sourceParts.forEach((part, partIndex) => {
      const firstPart = partIndex === 0;
      const isSplit = segmentCount > 1;
      scheduled.push({
        ...step,
        title: isSplit ? `${sourceTitle} — الجزء ${partIndex + 1}/${segmentCount}` : sourceTitle,
        detail: isSplit
          ? `${step.detail} (جلسة ${partIndex + 1} من ${segmentCount}؛ ${part.minutes} دقيقة)`
          : step.detail,
        minutes: part.minutes,
        day: `اليوم ${part.dayIndex}`,
        dayIndex: part.dayIndex,
        dateOffsetDays: part.dateOffsetDays,
        scheduleState: "scheduled",
        sourceTitle,
        sourceStepIndex,
        segmentIndex: partIndex + 1,
        segmentCount,
        ...(firstPart ? {} : { existingTask: undefined, curriculumNodeIds: [] }),
      });
    });

    if (isolateHeavyStep && sourceParts.length > 0 && studyDayIndex < availableStudyDays) {
      moveToNextDay();
    }

    if (hasDeferredRemainder) {
      deferredMinutes += remaining;
      deferredSteps += 1;
      scheduled.push({
        ...step,
        title: sourceParts.length > 0 ? `${sourceTitle} — الجزء المؤجل` : sourceTitle,
        detail: step.detail,
        minutes: remaining,
        day: "بعد الفترة المحددة",
        dayIndex: null,
        dateOffsetDays: null,
        scheduleState: "deferred",
        scheduleNote: "لم تتسع الفترة المحددة لهذه الدقائق دون تجاوز وقتك اليومي؛ احتُفظ بها خارج الجدول بدل ضغط يومك.",
        sourceTitle,
        sourceStepIndex,
        segmentIndex: sourceParts.length + 1,
        segmentCount,
        ...(sourceParts.length > 0 ? { existingTask: undefined, curriculumNodeIds: [] } : {}),
      });
    }
  });

  const stats: PlannerScheduleStats = {
    availableStudyDays,
    studyDaysUsed: dayLoads.size,
    scheduledMinutes,
    deferredMinutes,
    deferredSteps,
    maxDailyLoadMinutes: Math.max(0, ...dayLoads.values()),
    maxSessionMinutes,
  };
  return { steps: scheduled, stats };
}

export function evaluatePlanQuality<T extends {
  title: string;
  category: string;
  minutes: number;
  scheduleState?: "scheduled" | "deferred";
  dayIndex?: number | null;
  sourceTitle?: string;
  sourceStepIndex?: number;
}>(steps: readonly T[], settings: PlannerScheduleSettings, stats?: PlannerScheduleStats): PlannerQualityReport {
  const scheduleStats = stats ?? {
    availableStudyDays: getAvailableStudyDays(settings),
    studyDaysUsed: new Set(steps.filter(step => step.scheduleState !== "deferred" && step.dayIndex).map(step => step.dayIndex)).size,
    scheduledMinutes: steps.filter(step => step.scheduleState !== "deferred").reduce((sum, step) => sum + step.minutes, 0),
    deferredMinutes: steps.filter(step => step.scheduleState === "deferred").reduce((sum, step) => sum + step.minutes, 0),
    deferredSteps: steps.filter(step => step.scheduleState === "deferred").length,
    maxDailyLoadMinutes: 0,
    maxSessionMinutes: Math.min(settings.maxSessionMinutes ?? 90, 90, settings.dailyMinutes),
  };
  const blockers: string[] = [];
  const warnings: string[] = [];
  const loads = new Map<number, number>();

  for (const step of steps) {
    if (step.scheduleState === "deferred") continue;
    if (!step.dayIndex || step.dayIndex < 1 || step.dayIndex > scheduleStats.availableStudyDays) {
      blockers.push(`خطوة خارج نافذة الجدولة: ${step.title}`);
    }
    if (step.minutes > scheduleStats.maxSessionMinutes) {
      blockers.push(`جلسة أطول من الحد الأقصى: ${step.title}`);
    }
    if (step.dayIndex) loads.set(step.dayIndex, (loads.get(step.dayIndex) ?? 0) + step.minutes);
  }

  for (const [dayIndex, minutes] of loads) {
    if (minutes > settings.dailyMinutes) {
      blockers.push(`اليوم ${dayIndex} يتجاوز الوقت اليومي (${minutes}/${settings.dailyMinutes} دقيقة).`);
    }
  }

  const sourceSteps = new Map<string, Set<number>>();
  for (const step of steps) {
    if (step.scheduleState === "deferred") continue;
    const normalizedTitle = (step.sourceTitle ?? step.title).trim().toLocaleLowerCase("ar");
    const key = normalizedTitle + "::" + step.category.trim().toLocaleLowerCase("ar");
    const identities = sourceSteps.get(key) ?? new Set<number>();
    identities.add(step.sourceStepIndex ?? steps.indexOf(step));
    sourceSteps.set(key, identities);
  }
  for (const [key, identities] of sourceSteps) {
    if (identities.size > 1) warnings.push(`توجد خطوات متكررة بالعنوان والتصنيف نفسيهما: ${key.split("::")[0]}`);
  }

  if (scheduleStats.deferredMinutes > 0) {
    warnings.push(`تم الاحتفاظ بـ${scheduleStats.deferredMinutes} دقيقة خارج الفترة المحددة بدل تجاوز سعتك اليومية.`);
  }
  if (steps.length === 0) blockers.push("الخطة لا تحتوي على خطوات قابلة للتنفيذ.");

  const status: PlannerQualityReport["status"] = blockers.length > 0
    ? "blocked"
    : scheduleStats.deferredMinutes > 0
      ? "partial"
      : "ready";
  const totalMinutes = scheduleStats.scheduledMinutes + scheduleStats.deferredMinutes;
  const deferredPenalty = totalMinutes > 0 ? Math.round((scheduleStats.deferredMinutes / totalMinutes) * 55) : 0;
  const score = Math.max(0, Math.min(100, 100 - deferredPenalty - warnings.length * 4 - blockers.length * 35));

  return { score, status, blockers, warnings, stats: scheduleStats };
}

export function classifyPlannerEventImpact(eventType: string, entityType?: string): PlannerEventImpact {
  const event = eventType.trim().toLowerCase();
  const entity = (entityType ?? "").trim().toLowerCase();
  if (["ui.opened", "plan.viewed", "activity.read", "notification.read"].includes(event)) return "none";
  if ((event === "task.completed" || event === "task.reopened") && (entity === "" || entity === "task")) return "local";
  if (event.startsWith("task.") || event.startsWith("curriculum.") || event.startsWith("teacher.")
    || event.startsWith("calendar.") || event.startsWith("profile.") || event.startsWith("planner.")
    || event.startsWith("goal.") || event.startsWith("book.") || event.startsWith("routine.")) return "structural";
  return "structural";
}

export function combinePlannerEventImpacts(impacts: readonly PlannerEventImpact[]): PlannerEventImpact {
  if (impacts.includes("structural")) return "structural";
  if (impacts.includes("local")) return "local";
  return "none";
}
