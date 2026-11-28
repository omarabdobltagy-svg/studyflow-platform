export type PlannerMemoryConfidence = "high" | "medium" | "low" | "unknown";
export type PlannerEvidenceFreshness = "fresh" | "aging" | "stale" | "unknown";

const EVIDENCE_FRESHNESS_WINDOWS_DAYS: Record<string, { freshThroughDays: number; agingThroughDays: number }> = {
  student_frontier: { freshThroughDays: 14, agingThroughDays: 45 },
  teacher_frontier: { freshThroughDays: 14, agingThroughDays: 30 },
  school_frontier: { freshThroughDays: 14, agingThroughDays: 30 },
  sq3r_learning_signal: { freshThroughDays: 30, agingThroughDays: 90 },
  teacher_class_schedule: { freshThroughDays: 14, agingThroughDays: 60 },
  teacher_public_update: { freshThroughDays: 7, agingThroughDays: 30 },
  open_task: { freshThroughDays: 14, agingThroughDays: 60 },
  completed_task: { freshThroughDays: 30, agingThroughDays: 90 },
  calendar_commitment: { freshThroughDays: 7, agingThroughDays: 30 },
  active_goal: { freshThroughDays: 30, agingThroughDays: 90 },
  study_routine: { freshThroughDays: 14, agingThroughDays: 60 },
  study_resource: { freshThroughDays: 30, agingThroughDays: 120 },
};

export type PlannerEvidence<T = unknown> = {
  kind: string;
  subjectId?: string;
  branchId?: string;
  entityId?: string;
  value: T;
  provenance: {
    source: string;
    observedAt: string | null;
    confidence: PlannerMemoryConfidence;
    freshness: PlannerEvidenceFreshness;
    ageDays: number | null;
  };
};

export type PlannerMemorySnapshot = {
  version: 2;
  capturedAt: string;
  student: {
    educationSystem: string;
    gradeYear: string;
    track: string;
    subjectIds: string[];
  };
  studyConditions: Record<string, unknown>;
  curriculumEvidence: PlannerEvidence[];
  learningSignals: PlannerEvidence[];
  teacherSignals: PlannerEvidence[];
  teacherSchedule: PlannerEvidence[];
  openTasks: PlannerEvidence[];
  completedTasks: PlannerEvidence[];
  calendar: PlannerEvidence[];
  activeGoals: PlannerEvidence[];
  availableBooks: PlannerEvidence[];
  routines: PlannerEvidence[];
  sourceCoverage: {
    profileAvailable: boolean;
    taskRecords: number;
    calendarRecords: number;
    teacherScheduleRecords: number;
    curriculumFrontierRecords: number;
    routineRecords: number;
  };
};

type PlannerMemoryInput = {
  profile: {
    educationSystem?: string | null;
    gradeYear?: string | null;
    track?: string | null;
    subjectIds?: string[] | null;
    selection?: unknown;
  } | null;
  tasks?: Array<Record<string, any>>;
  goals?: Array<Record<string, any>>;
  calendar?: Array<Record<string, any>>;
  routines?: Array<Record<string, any>>;
  books?: Array<Record<string, any>>;
  now?: Date;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function safeTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function confidenceFromFrontier(value: unknown, confirmedAt: unknown, level: "student" | "teacher" | "school"): PlannerMemoryConfidence {
  if (typeof value !== "string" || !value || value === "__UNKNOWN__" || value === "__NOT_STARTED__") return "unknown";
  if (safeTimestamp(confirmedAt)) return "high";
  return level === "student" ? "medium" : "low";
}

function classifyEvidenceFreshness(
  kind: string,
  observedAt: unknown,
  now: Date,
): { freshness: PlannerEvidenceFreshness; ageDays: number | null } {
  const timestamp = safeTimestamp(observedAt);
  if (!timestamp) return { freshness: "unknown", ageDays: null };

  const ageMs = now.getTime() - Date.parse(timestamp);
  // Future timestamps beyond small clock skew are not treated as fresh evidence.
  if (!Number.isFinite(ageMs) || ageMs < -5 * 60 * 1_000) {
    return { freshness: "unknown", ageDays: null };
  }

  const ageDays = Math.floor(Math.max(0, ageMs) / 86_400_000);
  const windows = EVIDENCE_FRESHNESS_WINDOWS_DAYS[kind] ?? {
    freshThroughDays: 14,
    agingThroughDays: 60,
  };
  const freshness: PlannerEvidenceFreshness = ageDays <= windows.freshThroughDays
    ? "fresh"
    : ageDays <= windows.agingThroughDays
      ? "aging"
      : "stale";
  return { freshness, ageDays };
}

function evidence<T>(
  kind: string,
  value: T,
  source: string,
  confidence: PlannerMemoryConfidence,
  observedAt: unknown,
  extra: Pick<PlannerEvidence, "subjectId" | "branchId" | "entityId"> = {},
  now = new Date(),
): PlannerEvidence<T> {
  return {
    kind,
    ...extra,
    value,
    provenance: {
      source,
      observedAt: safeTimestamp(observedAt),
      confidence,
      ...classifyEvidenceFreshness(kind, observedAt, now),
    },
  };
}

export function buildPlannerMemorySnapshot(input: PlannerMemoryInput): PlannerMemorySnapshot {
  const now = input.now ?? new Date();
  const profile = input.profile;
  const selection = asRecord(profile?.selection);
  const subjects = Array.isArray(profile?.subjectIds) ? profile!.subjectIds! : [];
  const conditions = asRecord(selection.studyConditions);
  const courseProgress = asRecord(selection.learningCourseProgress);
  const legacyFrontiers = asRecord(selection.teacherFrontiers);
  const teacherProgressState = asRecord(selection.teacherProgressState);
  const lessonProgress = {
    ...asRecord(selection.subjectLessonProgress),
    ...asRecord(selection.sq3rProgress),
  };

  const curriculumEvidence: PlannerEvidence[] = [];
  const learningSignals: PlannerEvidence[] = [];
  const teacherSignals: PlannerEvidence[] = [];
  const teacherSchedule: PlannerEvidence[] = [];

  for (const subjectId of subjects) {
    const course = asRecord(courseProgress[subjectId]);
    const branches = asRecord(course.branches);
    const teacherState = asRecord(teacherProgressState[subjectId]);
    for (const [branchId, raw] of Object.entries(branches)) {
      const branch = asRecord(raw);
      const explicitStudentFrontier = branch.lastCompletedLessonId;
      const studentFrontier = explicitStudentFrontier === "__UNKNOWN__" && branch.studentFrontierConfirmedAt
        ? "__UNKNOWN__"
        : typeof explicitStudentFrontier === "string" && explicitStudentFrontier
          ? explicitStudentFrontier
          : (typeof course.lastCompletedLessonId === "string" ? course.lastCompletedLessonId : null)
            ?? (typeof legacyFrontiers[subjectId] === "string" ? legacyFrontiers[subjectId] : null)
            ?? (typeof teacherState.studentAttendedFrontier === "string" ? teacherState.studentAttendedFrontier : "__UNKNOWN__");

      const explicitTeacherFrontier = branch.teacherTeachingFrontierId;
      const teacherFrontier = explicitTeacherFrontier === "__UNKNOWN__" && branch.teacherFrontierConfirmedAt
        ? "__UNKNOWN__"
        : typeof explicitTeacherFrontier === "string" && explicitTeacherFrontier
          ? explicitTeacherFrontier
          : (typeof course.teacherTeachingFrontierId === "string" ? course.teacherTeachingFrontierId : "__UNKNOWN__");

      const explicitSchoolFrontier = branch.schoolClassFrontierId;
      const schoolFrontier = explicitSchoolFrontier === "__UNKNOWN__" && branch.schoolFrontierConfirmedAt
        ? "__UNKNOWN__"
        : typeof explicitSchoolFrontier === "string" && explicitSchoolFrontier
          ? explicitSchoolFrontier
          : (typeof course.schoolClassFrontierId === "string" ? course.schoolClassFrontierId : "__UNKNOWN__");
      if (studentFrontier !== "__UNKNOWN__" && studentFrontier !== "__NOT_STARTED__") {
        curriculumEvidence.push(evidence(
          "student_frontier",
          studentFrontier,
          "student_profile.learningCourseProgress",
          confidenceFromFrontier(studentFrontier, branch.studentFrontierConfirmedAt, "student"),
          branch.studentFrontierConfirmedAt ?? branch.updatedAt,
          { subjectId, branchId },
          now,
        ));
      }
      if (teacherFrontier !== "__UNKNOWN__" && teacherFrontier !== "__NOT_STARTED__") {
        curriculumEvidence.push(evidence(
          "teacher_frontier",
          teacherFrontier,
          "student_profile.teacher_progress",
          confidenceFromFrontier(teacherFrontier, branch.teacherFrontierConfirmedAt, "teacher"),
          branch.teacherFrontierConfirmedAt ?? branch.updatedAt,
          { subjectId, branchId },
          now,
        ));
      }
      if (schoolFrontier !== "__UNKNOWN__" && schoolFrontier !== "__NOT_STARTED__") {
        curriculumEvidence.push(evidence(
          "school_frontier",
          schoolFrontier,
          "student_profile.school_progress",
          confidenceFromFrontier(schoolFrontier, branch.schoolFrontierConfirmedAt, "school"),
          branch.schoolFrontierConfirmedAt ?? branch.updatedAt,
          { subjectId, branchId },
          now,
        ));
      }
    }

    const subjectLessons = asRecord(lessonProgress[subjectId]);
    for (const [lessonId, raw] of Object.entries(subjectLessons)) {
      const lesson = asRecord(raw);
      const completedSteps = Array.isArray(lesson.completedSteps) ? [...new Set(lesson.completedSteps)] : [];
      if (!completedSteps.length && !lesson.difficulty) continue;
      learningSignals.push(evidence(
        "sq3r_learning_signal",
        {
          completedSteps,
          isFullyCompleted: completedSteps.length === 5,
          difficulty: typeof lesson.difficulty === "string" ? lesson.difficulty : "unknown",
          difficultyConfidence: lesson.difficultyConfidence ?? "unknown",
        },
        "student_profile.sq3rProgress",
        lesson.difficulty ? "high" : "medium",
        lesson.updatedAt ?? lesson.completedAt,
        { subjectId, entityId: lessonId },
        now,
      ));
    }
  }

  const schedules = asRecord(selection.teacherSchedules);
  for (const [subjectId, slots] of Object.entries(schedules)) {
    if (!subjects.includes(subjectId) || !Array.isArray(slots)) continue;
    for (const slot of slots) {
      if (!slot || typeof slot !== "object") continue;
      const schedule = slot as Record<string, unknown>;
      const dayOfWeek = Number(schedule.dayOfWeek);
      const startTime = String(schedule.startTime ?? "");
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) continue;
      teacherSchedule.push(evidence(
        "teacher_class_schedule",
        { dayOfWeek, startTime },
        "student_profile.teacherSchedules",
        "medium",
        schedule.updatedAt ?? schedule.createdAt,
        { subjectId },
        now,
      ));
    }
  }

  const rawTeacherUpdates = Array.isArray(selection.teacherPublicUpdates) ? selection.teacherPublicUpdates : [];
  for (const update of rawTeacherUpdates.slice(-20)) {
    const row = asRecord(update);
    const confidence = row.confidence === "high" || row.isVerified === true ? "high"
      : row.confidence === "medium" ? "medium" : "low";
    if (!row.title || !row.announcementType) continue;
    teacherSignals.push(evidence(
      "teacher_public_update",
      {
        teacherId: row.teacherId ?? null,
        teacherName: row.teacherName ?? null,
        announcementType: row.announcementType,
        title: String(row.title).slice(0, 180),
        affectedDate: row.affectedDate ?? null,
        url: row.url ?? null,
      },
      "teacher_public_updates",
      confidence,
      row.publishedAt,
      {},
      now,
    ));
  }

  const taskRows = input.tasks ?? [];
  const taskEvidence = (task: Record<string, any>, kind: string) => evidence(
    kind,
    {
      title: String(task.title ?? "").slice(0, 180),
      status: task.status === "done" ? "done" : "todo",
      category: String(task.category ?? "عام").slice(0, 80),
      priority: task.priority ?? "medium",
      estimatedMinutes: Math.max(5, Math.min(600, Number(task.estimatedMinutes) || 25)),
      dueAt: safeTimestamp(task.dueAt),
      goalId: task.goalId ?? null,
    },
    "tasks",
    "high",
    task.updatedAt ?? task.completedAt ?? task.createdAt,
    { entityId: String(task.id ?? "") },
    now,
  );

  const routineEvidence = (input.routines ?? [])
    .filter(routine => Boolean(routine.isActive))
    .slice(0, 20)
    .map(routine => {
      const items = Array.isArray(routine.items) ? routine.items : [];
      return evidence(
        "study_routine",
        {
          name: String(routine.name ?? "").slice(0, 120),
          period: routine.period ?? "custom",
          items: items.filter((item: Record<string, any>) => Boolean(item.isActive)).slice(0, 24).map((item: Record<string, any>) => ({
            title: String(item.title ?? "").slice(0, 160),
            durationMinutes: Math.max(1, Math.min(240, Number(item.durationMinutes) || 10)),
            completedToday: Boolean(item.completedToday),
          })),
        },
        "routines",
        "high",
        routine.updatedAt ?? routine.createdAt,
        { entityId: String(routine.id ?? "") },
        now,
      );
    });

  const calendarEvidence = (input.calendar ?? [])
    .filter(event => {
      const start = safeTimestamp(event.startAt);
      return start && new Date(start).getTime() >= now.getTime() - 3_600_000;
    })
    .slice(0, 24)
    .map(event => evidence(
      "calendar_commitment",
      {
        title: String(event.title ?? "").slice(0, 160),
        type: event.type ?? "event",
        startAt: safeTimestamp(event.startAt),
        endAt: safeTimestamp(event.endAt),
        allDay: Boolean(event.allDay),
      },
      "calendar_events",
      "high",
      event.updatedAt ?? event.createdAt,
      { entityId: String(event.id ?? "") },
      now,
    ));

  return {
    version: 2,
    capturedAt: now.toISOString(),
    student: {
      educationSystem: String(profile?.educationSystem ?? "unknown"),
      gradeYear: String(profile?.gradeYear ?? "unknown"),
      track: String(profile?.track ?? "unknown"),
      subjectIds: subjects.slice(0, 12),
    },
    studyConditions: {
      dailyMinutes: Number(conditions.dailyMinutes) || null,
      daysPerWeek: [5, 6, 7].includes(Number(conditions.daysPerWeek)) ? Number(conditions.daysPerWeek) : null,
      energyLevel: conditions.energyLevel ?? "unknown",
      moraleLevel: conditions.moraleLevel ?? "unknown",
      resourceConstraints: typeof conditions.resourceConstraints === "string" ? conditions.resourceConstraints.slice(0, 300) : "",
    },
    curriculumEvidence: curriculumEvidence.slice(0, 120),
    learningSignals: learningSignals.slice(0, 80),
    teacherSignals: teacherSignals.slice(-12),
    teacherSchedule,
    openTasks: taskRows.filter(task => task.status !== "done").slice(0, 40).map(task => taskEvidence(task, "open_task")),
    completedTasks: taskRows.filter(task => task.status === "done").slice(-15).map(task => taskEvidence(task, "completed_task")),
    calendar: calendarEvidence,
    activeGoals: (input.goals ?? []).filter(goal => goal.status === "active").slice(0, 20).map(goal => evidence(
      "active_goal",
      { title: String(goal.title ?? "").slice(0, 160), targetDate: safeTimestamp(goal.targetDate), progress: Number(goal.progress) || 0 },
      "goals",
      "high",
      goal.updatedAt ?? goal.createdAt,
      { entityId: String(goal.id ?? "") },
      now,
    )),
    routines: routineEvidence,
    availableBooks: (input.books ?? []).slice(0, 20).map(book => evidence(
      "study_resource",
      { title: String(book.title ?? "").slice(0, 160), subject: book.subject ?? "دراسة", status: book.status ?? "planned" },
      "books",
      "high",
      book.updatedAt ?? book.createdAt,
      { entityId: String(book.id ?? "") },
      now,
    )),
    sourceCoverage: {
      profileAvailable: Boolean(profile),
      taskRecords: taskRows.length,
      calendarRecords: calendarEvidence.length,
      teacherScheduleRecords: teacherSchedule.length,
      curriculumFrontierRecords: curriculumEvidence.length,
      routineRecords: routineEvidence.length,
    },
  };
}

export function formatPlannerMemorySnapshot(snapshot: PlannerMemorySnapshot): string {
  return JSON.stringify(snapshot);
}
