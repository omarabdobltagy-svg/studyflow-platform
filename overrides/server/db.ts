import { formatStudyMethodNotes } from "./study-method";
import { and, asc, desc, eq, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { storageDelete } from "./storage";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiPlans,
  bookChapters,
  books,
  calendarEvents,
  goals,
  InsertUser,
  libraryAttachments,
  routineCompletions,
  routineItems,
  routines,
  studentActivityEvents,
  plannerReconciliationJobs,
  studentProfiles,
  studySessions,
  taskChangeLogs,
  teacherCourseFacts,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { resolveStudentSubjectIds } from "./student-subjects";
import { matchCompletedPlanSteps } from "./plannerTaskMatching";

let _db: ReturnType<typeof drizzle> | null = null;
let testDbOverride: ReturnType<typeof drizzle> | null | undefined;

export function setDbForTests(database: ReturnType<typeof drizzle> | null | undefined) {
  testDbOverride = database;
}

export async function getDb() {
  if (testDbOverride !== undefined) return testDbOverride;
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] تعذّر الاتصال بقاعدة البيانات:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export function assertTaskRelationOwnership(record: unknown, relation: "goal" | "book") {
  if (record) return;
  if (relation === "goal") throw new Error("لا يمكنك ربط المهمة بهدف غير موجود في مساحتك.");
  throw new Error("لا يمكنك ربط المهمة بكتاب غير موجود في مكتبتك.");
}

export function buildTaskUpdateValues(data: { title: string; notes?: string | null; category?: string; priority?: "low" | "medium" | "high"; dueAt?: Date | null; goalId?: number | null; bookId?: number | null }) {
  return {
    title: data.title,
    notes: data.notes ?? null,
    category: data.category ?? "عام",
    priority: data.priority ?? "medium" as const,
    dueAt: data.dueAt ?? null,
    goalId: data.goalId ?? null,
    bookId: data.bookId ?? null,
  };
}

export function getPreviousTaskStatusForUndo(change: { previousStatus: "todo" | "done"; expiresAt: Date } | undefined, now = new Date()) {
  if (!change || change.expiresAt < now) throw new Error("انتهت مهلة التراجع أو لم تعد العملية متاحة.");
  return change.previousStatus;
}

export function assertAttachmentTargetOwnership(ownedBook: unknown, ownedChapter: unknown) {
  if (!ownedBook) throw new Error("لا يمكن إرفاق ملف بكتاب لا تملكه.");
  if (!ownedChapter) throw new Error("الفصل المحدد لا يتبع لهذا الكتاب.");
}

export function calculateProgress(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

export function clampCompletedPages(completedPages: number, totalPages: number) {
  return Math.max(0, Math.min(Math.max(0, totalPages), completedPages));
}

export function getDateKeyInTimezone(date = new Date(), timeZone = "UTC") {
  let resolvedTimeZone = timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: resolvedTimeZone }).format(date);
  } catch {
    resolvedTimeZone = "UTC";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function analyticsPeriodsForDate(date: Date, now = new Date(), timeZone = "UTC") {
  const dateKey = getDateKeyInTimezone(date, timeZone);
  const todayKey = getDateKeyInTimezone(now, timeZone);
  if (dateKey > todayKey) return [] as Array<"daily" | "weekly" | "monthly">;

  const periods: Array<"daily" | "weekly" | "monthly"> = [];
  if (dateKey === todayKey) periods.push("daily");

  // Weekly analytics use a rolling seven-day window ending on the local current day.
  const windowStart = new Date(`${todayKey}T00:00:00.000Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 6);
  const weekStartKey = windowStart.toISOString().slice(0, 10);
  if (dateKey >= weekStartKey && dateKey <= todayKey) periods.push("weekly");
  if (dateKey.slice(0, 7) === todayKey.slice(0, 7)) periods.push("monthly");
  return periods;
}

/** Compatibility helper for callers that need the narrowest single bucket. */
export function analyticsPeriodForDate(date: Date, now = new Date(), timeZone = "UTC") {
  return analyticsPeriodsForDate(date, now, timeZone)[0] ?? null;
}

export type CalendarDisplayItem = {
  id: string;
  title: string;
  type: "event" | "study" | "goal" | "task";
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  color: string;
  source: "event" | "task" | "routine";
  completed?: boolean;
  priority?: "low" | "medium" | "high";
  routineId?: number;
  routinePeriod?: "morning" | "evening" | "custom";
  routineDate?: string;
  completedCount?: number;
  itemCount?: number;
  routineItems?: Array<{ id: number; title: string; durationMinutes: number; completed: boolean }>;
};

type CalendarEventRow = {
  id: number;
  title: string;
  type: "event" | "study" | "goal";
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  color: string;
};

type ScheduledTaskRow = {
  id: number;
  title: string;
  dueAt: Date | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "done";
};

export function mergeCalendarItems(events: CalendarEventRow[], scheduledTasks: ScheduledTaskRow[]): CalendarDisplayItem[] {
  const calendarItems = [
    ...events.map(event => ({
      id: `event-${event.id}`,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      color: event.color,
      source: "event" as const,
    })),
    ...scheduledTasks.filter(task => task.dueAt).map(task => ({
      id: `task-${task.id}`,
      title: task.title,
      type: "task" as const,
      startAt: task.dueAt as Date,
      endAt: null,
      allDay: true,
      color: task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "sky",
      source: "task" as const,
      completed: task.status === "done",
      priority: task.priority,
    })),
  ];
  return calendarItems.sort((first, second) => first.startAt.getTime() - second.startAt.getTime());
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod", "phone"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  // Preserve an existing user's role during ordinary sign-in. Only assign or
  // change it when an explicit role is supplied or the configured owner ID matches.
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}


export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).limit(1);
  return result[0];
}

export async function createLocalAuthUser(input: { username: string; name: string; passwordHash: string }) {
  const db = await requireDb();
  const openId = "studyflow-user-" + randomUUID();
  await db.insert(users).values({
    openId,
    username: input.username.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    name: input.name.trim(),
    loginMethod: "local",
    role: "user",
    lastSignedIn: new Date(),
  });
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!result[0]) throw new Error("LOCAL_USER_CREATION_FAILED");
  return result[0];
}

export async function touchUserLastSignedIn(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function changeLocalAuthPassword(userId: number, passwordHash: string) {
  const db = await requireDb();
  await db.update(users).set({
    passwordHash,
    sessionVersion: sql`${users.sessionVersion} + 1`,
    lastSignedIn: new Date(),
  }).where(eq(users.id, userId));
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!result[0]) throw new Error("ACCOUNT_NOT_FOUND");
  return result[0];
}

export async function deleteLocalAuthUser(userId: number) {
  const db = await requireDb();
  const attachments = await db.select({ fileKey: libraryAttachments.fileKey })
    .from(libraryAttachments)
    .where(eq(libraryAttachments.userId, userId));
  for (const attachment of attachments) await storageDelete(attachment.fileKey);
  const result = await db.delete(users).where(eq(users.id, userId));
  if (result[0].affectedRows === 0) throw new Error("ACCOUNT_NOT_FOUND");
  return { deletedAttachments: attachments.length };
}

export type StudentProfileInput = {
  studentName: string;
  educationSystem: "baccalaureate" | "general_secondary" | "other";
  gradeYear: string;
  track: string;
  subjects: string[];
  teacherSelections: Record<string, string>;
  backlog: Record<string, number>;
  obstacle: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function getStudentProfile(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  const profile = rows[0];
  if (!profile) return null;
  const subjects = parseJson<string[]>(profile.subjectsJson, []);
  const selection = parseJson<Record<string, unknown>>(profile.selectionJson ?? "{}", {});
  const subjectIds = resolveStudentSubjectIds(
    subjects,
    selection,
    profile.educationSystem as "baccalaureate" | "general_secondary" | "other",
  );
  return {
    ...profile,
    subjects,
    subjectIds,
    teacherSelections: parseJson<Record<string, string>>(profile.teacherSelectionsJson, {}),
    selection,
    backlog: parseJson<Record<string, number>>(profile.backlogJson, {}),
  };
}

export async function listStudentTeacherMonitoringProfiles() {
  const database = await requireDb();
  const rows = await database.select({
    userId: studentProfiles.userId,
    educationSystem: studentProfiles.educationSystem,
    gradeYear: studentProfiles.gradeYear,
    subjectsJson: studentProfiles.subjectsJson,
    teacherSelectionsJson: studentProfiles.teacherSelectionsJson,
    selectionJson: studentProfiles.selectionJson,
  }).from(studentProfiles);
  return rows.map(row => {
    const selection = parseJson<Record<string, unknown>>(row.selectionJson ?? "{}", {});
    const subjects = parseJson<string[]>(row.subjectsJson, []);
    const educationSystem = row.educationSystem as "baccalaureate" | "general_secondary" | "other";
    return {
      userId: row.userId,
      educationSystem,
      gradeYear: row.gradeYear,
      subjectIds: resolveStudentSubjectIds(subjects, selection, educationSystem),
      teacherSelections: parseJson<Record<string, string>>(row.teacherSelectionsJson, {}),
      selection,
    };
  });
}

export async function saveStudentProfile(userId: number, data: StudentProfileInput) {
  const db = await requireDb();
  const values = {
    userId,
    studentName: data.studentName.trim(),
    educationSystem: data.educationSystem,
    gradeYear: data.gradeYear.trim(),
    track: data.track.trim(),
    subjectsJson: JSON.stringify(data.subjects),
    teacherSelectionsJson: JSON.stringify(data.teacherSelections),
    backlogJson: JSON.stringify(data.backlog),
    obstacle: data.obstacle.trim(),
    completedAt: new Date(),
  };
  await db.insert(studentProfiles).values(values).onDuplicateKeyUpdate({ set: values });
  return getStudentProfile(userId);
}


export type SIEOnboardingInput = {
  studentName: string;
  phone: string;
  educationSystem: "baccalaureate" | "general_secondary";
  gradeYear: string;
  track: string;
  subjects: string[];
  teacherSelections: Record<string, string>;
  selection: Record<string, unknown>;
};

export async function updateStudentProfileSelection(userId: number, selection: Record<string, unknown>) {
  const database = await requireDb();
  const result = await database.update(studentProfiles)
    .set({ selectionJson: JSON.stringify(selection) })
    .where(eq(studentProfiles.userId, userId));
  if (result[0].affectedRows === 0) throw new Error("ملف الطالب غير موجود.");
}

/** Saves student-entered backlog data without replacing unrelated profile fields. */
export async function updateStudentLearningBaseline(
  userId: number,
  updates: { backlog: Record<string, number>; removeBacklogKeys?: string[]; obstacle?: string }
) {
  const database = await requireDb();
  const profile = await getStudentProfile(userId);
  if (!profile) throw new Error("ملف الطالب غير موجود.");
  const backlog = { ...profile.backlog };
  for (const key of updates.removeBacklogKeys ?? []) delete backlog[key];
  Object.assign(backlog, updates.backlog);
  await database.update(studentProfiles)
    .set({
      backlogJson: JSON.stringify(backlog),
      ...(updates.obstacle === undefined ? {} : { obstacle: updates.obstacle.trim().slice(0, 600) }),
    })
    .where(eq(studentProfiles.userId, userId));
  return getStudentProfile(userId);
}


export async function saveSIEOnboarding(userId: number, data: SIEOnboardingInput) {
  const db = await requireDb();
  const existingProfile = await getStudentProfile(userId);
  const existingSelection = (existingProfile?.selection ?? {}) as Record<string, unknown>;
  const mergedSelection = { ...existingSelection, ...data.selection };
  const studentName = data.studentName.trim();
  const phone = data.phone.trim();
  await db.update(users).set({ name: studentName, phone }).where(eq(users.id, userId));

  const values = {
    userId,
    studentName,
    educationSystem: data.educationSystem,
    gradeYear: data.gradeYear.trim(),
    track: data.track.trim(),
    subjectsJson: JSON.stringify(data.subjects),
    teacherSelectionsJson: JSON.stringify(data.teacherSelections),
    selectionJson: JSON.stringify(mergedSelection),
    backlogJson: JSON.stringify({}),
    obstacle: "",
    completedAt: new Date(),
  };
  // A profile edit must not erase the student's accumulated backlog, notes,
  // obstacle history, or original completion timestamp.
  const updateSet = {
    studentName: values.studentName,
    educationSystem: values.educationSystem,
    gradeYear: values.gradeYear,
    track: values.track,
    subjectsJson: values.subjectsJson,
    teacherSelectionsJson: values.teacherSelectionsJson,
    selectionJson: values.selectionJson,
  };
  await db.insert(studentProfiles).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return getStudentProfile(userId);
}

export type TeacherCourseFactsInput = {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  educationSystem: string;
  gradeYear: string;
  availableModes: Array<"center" | "online">;
  homeworkPolicy: "yes" | "no" | "varies" | "unknown";
  homeworkRequiredBeforeNextLecture: "yes" | "no" | "varies" | "unknown";
  preLectureExamRequired: "yes" | "no" | "varies" | "unknown";
  evidence: Array<{ title: string; url: string; source: string; excerpt?: string; publishedAt?: string }>;
  confidence: "low" | "medium" | "high";
  verificationStatus: "verified" | "partial" | "insufficient_evidence" | "research_failed";
  checkedAt: Date;
  expiresAt: Date;
};

export async function getTeacherCourseFacts(input: Pick<TeacherCourseFactsInput, "teacherId" | "subjectId" | "educationSystem" | "gradeYear">) {
  const database = await requireDb();
  const rows = await database.select().from(teacherCourseFacts).where(and(
    eq(teacherCourseFacts.teacherId, input.teacherId),
    eq(teacherCourseFacts.subjectId, input.subjectId),
    eq(teacherCourseFacts.educationSystem, input.educationSystem),
    eq(teacherCourseFacts.gradeYear, input.gradeYear),
  )).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    availableModes: parseJson<Array<"center" | "online">>(row.availableModesJson, []),
    evidence: parseJson<TeacherCourseFactsInput["evidence"]>(row.evidenceJson, []),
    isStale: row.expiresAt.getTime() <= Date.now(),
  };
}

export async function upsertTeacherCourseFacts(input: TeacherCourseFactsInput) {
  const database = await requireDb();
  const values = {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    subjectId: input.subjectId,
    educationSystem: input.educationSystem,
    gradeYear: input.gradeYear,
    availableModesJson: JSON.stringify(input.availableModes),
    homeworkPolicy: input.homeworkPolicy,
    homeworkRequiredBeforeNextLecture: input.homeworkRequiredBeforeNextLecture,
    preLectureExamRequired: input.preLectureExamRequired,
    evidenceJson: JSON.stringify(input.evidence),
    confidence: input.confidence,
    verificationStatus: input.verificationStatus,
    checkedAt: input.checkedAt,
    expiresAt: input.expiresAt,
  };
  await database.insert(teacherCourseFacts).values(values).onDuplicateKeyUpdate({
    set: {
      teacherName: values.teacherName,
      availableModesJson: values.availableModesJson,
      homeworkPolicy: values.homeworkPolicy,
      homeworkRequiredBeforeNextLecture: values.homeworkRequiredBeforeNextLecture,
      preLectureExamRequired: values.preLectureExamRequired,
      evidenceJson: values.evidenceJson,
      confidence: values.confidence,
      verificationStatus: values.verificationStatus,
      checkedAt: values.checkedAt,
      expiresAt: values.expiresAt,
      updatedAt: new Date(),
    },
  });
  return getTeacherCourseFacts(input);
}

export async function listTasks(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.status), asc(tasks.dueAt), desc(tasks.createdAt));
}

export async function createTask(
  userId: number,
  data: {
    title: string;
    notes?: string | null;
    category?: string;
    priority?: "low" | "medium" | "high";
    dueAt?: Date | null;
    goalId?: number | null;
    bookId?: number | null;
  }
) {
  const db = await requireDb();
  if (data.goalId) {
    const linkedGoal = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, data.goalId), eq(goals.userId, userId))).limit(1);
    assertTaskRelationOwnership(linkedGoal[0], "goal");
  }
  if (data.bookId) {
    const linkedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, data.bookId), eq(books.userId, userId))).limit(1);
    assertTaskRelationOwnership(linkedBook[0], "book");
  }
  await db.insert(tasks).values({
    userId,
    title: data.title,
    notes: data.notes ?? null,
    category: data.category ?? "عام",
    priority: data.priority ?? "medium",
    dueAt: data.dueAt ?? null,
    goalId: data.goalId ?? null,
    bookId: data.bookId ?? null,
  });
}

export async function toggleTask(userId: number, taskId: number, done: boolean) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const current = await tx.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
    if (!current[0]) throw new Error("المهمة غير موجودة أو لا تملك تعديلها.");
    const nextStatus = done ? "done" as const : "todo" as const;
    if (current[0].status === nextStatus) return null;
    const changedAt = new Date();
    await tx.update(tasks).set({ status: nextStatus, completedAt: done ? changedAt : null }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const result = await tx.insert(taskChangeLogs).values({
      userId,
      taskId,
      previousStatus: current[0].status,
      previousCompletedAt: current[0].completedAt ?? null,
      nextStatus,
      expiresAt,
    });
    return { changeId: Number(result[0].insertId), expiresAt };
  });
}

export async function undoTaskChange(userId: number, changeId: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const change = await tx.select().from(taskChangeLogs).where(and(eq(taskChangeLogs.id, changeId), eq(taskChangeLogs.userId, userId))).limit(1);
    const previousStatus = getPreviousTaskStatusForUndo(change[0]);
    const updateResult = await tx.update(tasks).set({
      status: previousStatus,
      completedAt: previousStatus === "done" ? change[0].previousCompletedAt ?? null : null,
    }).where(and(eq(tasks.id, change[0].taskId), eq(tasks.userId, userId)));
    if (updateResult[0].affectedRows === 0) throw new Error("تعذّر العثور على المهمة لاستعادة حالتها السابقة.");
    await tx.delete(taskChangeLogs).where(eq(taskChangeLogs.id, changeId));
  });
}

export async function updateTask(userId: number, taskId: number, data: { title: string; notes?: string | null; category?: string; priority?: "low" | "medium" | "high"; dueAt?: Date | null; goalId?: number | null; bookId?: number | null }) {
  const db = await requireDb();
  const current = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1);
  if (!current[0]) throw new Error("المهمة غير موجودة أو لا تملك تعديلها.");
  if (data.goalId) assertTaskRelationOwnership((await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, data.goalId), eq(goals.userId, userId))).limit(1))[0], "goal");
  if (data.bookId) assertTaskRelationOwnership((await db.select({ id: books.id }).from(books).where(and(eq(books.id, data.bookId), eq(books.userId, userId))).limit(1))[0], "book");
  await db.update(tasks).set(buildTaskUpdateValues(data)).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function deleteTask(userId: number, taskId: number) {
  const db = await requireDb();
  const result = await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("المهمة غير موجودة أو لا تملك حذفها.");
}

export async function listGoals(userId: number) {
  const db = await requireDb();
  const [goalRows, taskRows] = await Promise.all([
    db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.status), asc(goals.targetDate)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
  ]);
  return goalRows.map(goal => {
    const relatedTasks = taskRows.filter(task => task.goalId === goal.id);
    const completed = relatedTasks.filter(task => task.status === "done").length;
    return {
      ...goal,
      taskCount: relatedTasks.length,
      completedTaskCount: completed,
      progress: calculateProgress(completed, relatedTasks.length),
    };
  });
}

export async function createGoal(
  userId: number,
  data: {
    title: string;
    description?: string | null;
    kind?: "short" | "long";
    category?: string;
    color?: string;
    targetDate?: Date | null;
    initialSteps?: { title: string; estimatedMinutes: number }[];
  }
) {
  const db = await requireDb();
  const steps = (data.initialSteps ?? [])
    .map(step => ({
      title: step.title.trim(),
      estimatedMinutes: Math.min(300, Math.max(1, Math.round(step.estimatedMinutes || 25))),
    }))
    .filter(step => step.title.length > 0);

  return db.transaction(async tx => {
    const inserted = await tx.insert(goals).values({
      userId,
      title: data.title.trim(),
      description: data.description ?? null,
      kind: data.kind ?? "short",
      category: data.category ?? "شخصي",
      color: data.color ?? "teal",
      targetDate: data.targetDate ?? null,
    });
    const goalId = Number(inserted[0].insertId);
    if (steps.length) {
      await tx.insert(tasks).values(steps.map((step, index) => ({
        userId,
        goalId,
        title: step.title,
        notes: null,
        category: data.category ?? "عام",
        priority: "medium" as const,
        estimatedMinutes: step.estimatedMinutes,
        dueAt: data.targetDate ?? null,
      })));
    }
    return { goalId, initialTaskCount: steps.length };
  });
}

export type ApprovedPlanStep = {
  day: number;
  title: string;
  detail: string;
  minutes: number;
  category: string;
  priority?: "critical" | "high" | "medium" | "low";
  existingTask?: { id: number; title: string; status: "todo" | "done"; confidence: "exact" | "strong" };
  resourceRecommendation?: { title: string; url: string; teacherName?: string; reason: string };
  scheduleState?: "scheduled" | "deferred";
  dayIndex?: number | null;
  dateOffsetDays?: number | null;
  scheduleNote?: string;
};

export function normalizeApprovedPlanSteps(steps: ApprovedPlanStep[]) {
  return steps
    .map((step, index) => ({
      ...step,
      day: Number.isFinite(step.day) && step.day > 0 ? Math.floor(step.day) : index + 1,
      title: step.title.trim(),
      detail: step.detail.trim(),
      minutes: Math.min(480, Math.max(5, Math.round(step.minutes || 25))),
      category: step.category.trim() || "دراسة",
    }))
    .filter(step => step.title.length > 0);
}

export function schedulePlanStepDates(
  startDate: string,
  steps: Array<{ minutes: number; dayIndex?: number | null; dateOffsetDays?: number | null; scheduleState?: "scheduled" | "deferred" }>,
  dailyMinutes: number,
  daysPerWeek = 7,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("تاريخ بداية الخطة غير صالح.");
  const parsedStart = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== startDate) throw new Error("تاريخ بداية الخطة غير صالح.");
  const capacity = Math.min(600, Math.max(20, Math.round(dailyMinutes)));
  const weeklyDays = Math.min(7, Math.max(5, Math.round(daysPerWeek)));
  let studyDayIndex = 0;
  let usedMinutes = 0;
  return steps.map(step => {
    if (step.scheduleState === "deferred") return null;
    const dueAt = new Date(parsedStart);
    if (Number.isInteger(step.dateOffsetDays) && (step.dateOffsetDays ?? -1) >= 0) {
      dueAt.setUTCDate(dueAt.getUTCDate() + (step.dateOffsetDays as number));
      return dueAt;
    }
    const duration = Math.min(480, Math.max(5, Math.round(step.minutes || 25)));
    if (usedMinutes > 0 && usedMinutes + duration > capacity) {
      studyDayIndex += 1;
      usedMinutes = 0;
    }
    const calendarOffset = studyDayIndex + Math.floor(studyDayIndex / weeklyDays) * (7 - weeklyDays);
    dueAt.setUTCDate(dueAt.getUTCDate() + calendarOffset);
    usedMinutes += duration;
    return dueAt;
  });
}

/**
 * Inserts the actionable steps of the daily plan into the student's task list.
 * Existing unfinished tasks and tasks already scheduled for today/future are
 * reused instead of duplicated. Completed past tasks may be scheduled again.
 */
export async function approvePlanAsGoalTree(
  userId: number,
  plan: { title: string; summary: string; steps: ApprovedPlanStep[] },
  schedule?: { startDate: string; dailyMinutes: number },
  routine?: { name: string; period: "morning" | "evening" | "custom"; accent?: string; items: Array<{ title: string; durationMinutes: number }> }
) {
  const db = await requireDb();
  const steps = normalizeApprovedPlanSteps(plan.steps);
  if (!plan.title.trim() || steps.length === 0) {
    throw new Error("لا يمكن اعتماد خطة بلا عنوان ومراحل عملية.");
  }
  const dueDates = schedule ? schedulePlanStepDates(schedule.startDate, steps, schedule.dailyMinutes) : [];

  return db.transaction(async tx => {
    const parentInsert = await tx.insert(goals).values({
      userId,
      title: plan.title.trim(),
      description: plan.summary.trim() || "خطة دراسية معتمدة من المخطط.",
      kind: "long",
      category: "خطة تدريبية",
      color: "indigo",
      sortOrder: 0,
    });
    const parentGoalId = Number(parentInsert[0].insertId);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const stageInsert = await tx.insert(goals).values({
        userId,
        parentGoalId,
        title: `المرحلة ${index + 1}: ${step.title}`,
        description: step.detail || "مهمة من الخطة المعتمدة.",
        kind: "short",
        category: "مرحلة تدريبية",
        color: "indigo",
        targetDate: dueDates[index] ?? null,
        sortOrder: index + 1,
      });
      const stageGoalId = Number(stageInsert[0].insertId);
      await tx.insert(tasks).values({
        userId,
        goalId: stageGoalId,
        title: step.title,
        notes: step.detail || `مهمة من خطة «${plan.title.trim()}».`,
        category: step.category,
        priority: step.priority === "critical" || step.priority === "high" ? "high" as const
          : step.priority === "low" ? "low" as const : "medium" as const,
        estimatedMinutes: null,
        dueAt: dueDates[index] ?? null,
      });
    }

    let routineId: number | null = null;
    if (routine && routine.items.length > 0) {
      const routineInsert = await tx.insert(routines).values({
        userId,
        name: routine.name.trim(),
        period: routine.period,
        accent: routine.accent ?? "amber",
        isActive: true,
      });
      routineId = Number(routineInsert[0].insertId);
      await tx.insert(routineItems).values(routine.items.map((item, index) => ({
        routineId: routineId!,
        title: item.title.trim(),
        durationMinutes: item.durationMinutes,
        sortOrder: index,
        isActive: true,
      })));
    }

    return { parentGoalId, stageCount: steps.length, taskCount: steps.length, ...(routineId !== null ? { routineId } : {}) };
  });
}

/**
 * Keeps one persistent daily-plan goal tree for each student.
 * Completed matching steps are preserved; unfinished steps are refreshed in place,
 * so reopening the home page never clones the same day's tasks.
 */
export async function syncDailyPlanGoalTree(
  userId: number,
  plan: {
    title: string;
    summary: string;
    steps: Array<{
      day: string;
      title: string;
      detail: string;
      studyMethod?: { stages: Array<{ title: string; instruction: string; reason: string; optional?: boolean }>; completionCriteria: string; teacherPolicyNote?: string };
      minutes: number;
      category: string;
      priority?: "critical" | "high" | "medium" | "low";
      existingTask?: { id: number; title: string; status: "todo" | "done"; confidence: "exact" | "strong" };
      resourceRecommendation?: { title: string; url: string; teacherName?: string; reason: string };
      scheduleState?: "scheduled" | "deferred";
      dayIndex?: number | null;
      dateOffsetDays?: number | null;
      scheduleNote?: string;
      plannerTaskId?: number;
      plannerTaskStatus?: "todo" | "done";
    }>;
  },
  schedule: { startDate: string; dailyMinutes: number; daysPerWeek?: number },
  identity: { goalTitle?: string; goalCategory?: string; supersedeCategories?: string[] } = {},
) {
  const db = await requireDb();
  const goalTitle = identity.goalTitle?.trim() || "خطة StudyFlow اليومية";
  const goalCategory = identity.goalCategory?.trim() || "خطة يومية";
  const steps = normalizeApprovedPlanSteps(plan.steps.map((step, index) => ({
    ...step,
    day: index + 1,
  })));
  if (!plan.title.trim() || steps.length === 0) {
    throw new Error("لا يمكن إنشاء مهام يومية من خطة بلا خطوات عملية.");
  }
  const dueDates = steps.map(() => null);
  const taskNotes = (step: typeof steps[number]) => [
    step.detail,
    ...(step.studyMethod ? [formatStudyMethodNotes(step.studyMethod)] : []),
    ...(step.scheduleNote ? [step.scheduleNote] : []),
    ...(step.resourceRecommendation ? [
      "مشاهدة إضافية موصى بها من " + (step.resourceRecommendation.teacherName || "المدرس") + ": " + step.resourceRecommendation.title,
      step.resourceRecommendation.url,
      "سبب التوصية: " + step.resourceRecommendation.reason,
    ] : []),
  ].filter(Boolean).join("\n\n");

  return db.transaction(async tx => {
    // Retire open tasks from older AI-generated plans before writing the new one.
    // Completed tasks remain as historical evidence; manually created tasks are untouched.
    const supersedeCategories = [...new Set(identity.supersedeCategories ?? [goalCategory])];
    const previousParents = await tx.select().from(goals).where(and(
      eq(goals.userId, userId),
      inArray(goals.category, supersedeCategories),
      isNull(goals.parentGoalId),
    ));
    for (const previousParent of previousParents) {
      if (previousParent.title === goalTitle && previousParent.category === goalCategory) continue;
      const previousStages = await tx.select().from(goals).where(and(
        eq(goals.userId, userId),
        eq(goals.parentGoalId, previousParent.id),
      ));
      const previousStageIds = previousStages.map(stage => stage.id);
      if (!previousStageIds.length) {
        await tx.delete(goals).where(and(eq(goals.id, previousParent.id), eq(goals.userId, userId)));
        continue;
      }
      const previousTasks = await tx.select().from(tasks).where(and(
        eq(tasks.userId, userId),
        inArray(tasks.goalId, previousStageIds),
      ));
      await tx.delete(tasks).where(and(
        eq(tasks.userId, userId),
        inArray(tasks.goalId, previousStageIds),
        eq(tasks.status, "todo"),
      ));
      const stagesWithCompletedWork = new Set(previousTasks.filter(task => task.status === "done").map(task => task.goalId));
      for (const stage of previousStages) {
        if (!stagesWithCompletedWork.has(stage.id)) {
          await tx.delete(goals).where(and(eq(goals.id, stage.id), eq(goals.userId, userId)));
        } else {
          await tx.update(goals).set({ status: "completed" }).where(and(eq(goals.id, stage.id), eq(goals.userId, userId)));
        }
      }
      if (stagesWithCompletedWork.size === 0) {
        await tx.delete(goals).where(and(eq(goals.id, previousParent.id), eq(goals.userId, userId)));
      } else {
        await tx.update(goals).set({ status: "paused" }).where(and(eq(goals.id, previousParent.id), eq(goals.userId, userId)));
      }
    }

    const existingParents = await tx.select().from(goals).where(and(
      eq(goals.userId, userId),
      eq(goals.title, goalTitle),
      eq(goals.category, goalCategory),
      isNull(goals.parentGoalId),
    )).limit(1);

    let parentGoalId: number;
    if (existingParents[0]) {
      parentGoalId = existingParents[0].id;
      await tx.update(goals).set({
        description: plan.summary.trim() || "خطة يومية مبنية على ملف الدراسة والتراكم.",
        targetDate: null,
        status: "active",
        color: "gold",
      }).where(and(eq(goals.id, parentGoalId), eq(goals.userId, userId)));
    } else {
      const parentInsert = await tx.insert(goals).values({
        userId,
        title: goalTitle,
        description: plan.summary.trim() || "خطة دراسية مبنية على ملف الدراسة والتراكم.",
        kind: "long",
        category: goalCategory,
        color: "gold",
        targetDate: null,
        status: "active",
        sortOrder: -100,
      });
      parentGoalId = Number(parentInsert[0].insertId);
    }

    const stageRows = await tx.select().from(goals).where(and(
      eq(goals.userId, userId),
      eq(goals.parentGoalId, parentGoalId),
    )).orderBy(asc(goals.sortOrder), asc(goals.createdAt));
    const stageIds = stageRows.map(stage => stage.id);
    const taskRows = stageIds.length
      ? await tx.select().from(tasks).where(and(
          eq(tasks.userId, userId),
          inArray(tasks.goalId, stageIds),
        )).orderBy(asc(tasks.createdAt))
      : [];
    const tasksByStage = new Map<number, typeof taskRows>();
    for (const task of taskRows) {
      if (task.goalId === null) continue;
      const current = tasksByStage.get(task.goalId) ?? [];
      current.push(task);
      tasksByStage.set(task.goalId, current);
    }

    const completedTasks = taskRows.filter(task => task.status === "done");
    const completedMatches = matchCompletedPlanSteps(steps, completedTasks);
    const consumedCompletedIds = new Set(completedMatches.preservedCompletedTaskIds);
    const pendingStepIndexes = new Set(completedMatches.pendingIndexes);
    const pendingSteps = steps
      .map((step, index) => ({ step, index }))
      .filter(({ index }) => pendingStepIndexes.has(index));

    const completedStageIds = new Set(stageRows.filter(stage =>
      (tasksByStage.get(stage.id) ?? []).some(task => task.status === "done")
    ).map(stage => stage.id));
    const pendingStages = stageRows.filter(stage => !completedStageIds.has(stage.id));

    // Remove obsolete unfinished stages only. Completed work remains as history.
    for (const obsolete of pendingStages.slice(pendingSteps.length)) {
      await tx.delete(tasks).where(and(
        eq(tasks.userId, userId),
        eq(tasks.goalId, obsolete.id),
        eq(tasks.status, "todo"),
      ));
      await tx.delete(goals).where(and(eq(goals.id, obsolete.id), eq(goals.userId, userId)));
    }

    let refreshedTaskCount = 0;
    let createdTaskCount = 0;
    const taskLinks: Array<{ planStepIndex: number; taskId: number; status: "todo" | "done" }> = [];
    for (let index = 0; index < pendingSteps.length; index += 1) {
      const { step, index: sourceIndex } = pendingSteps[index];
      const dueAt = dueDates[sourceIndex] ?? null;
      const priority = step.priority === "critical" || step.priority === "high"
        ? "high" as const
        : step.priority === "low" ? "low" as const : "medium" as const;
      const stage = pendingStages[index];
      const linkedExistingTask = step.existingTask
        ? (await tx.select({ id: tasks.id, status: tasks.status })
            .from(tasks)
            .where(and(eq(tasks.id, step.existingTask.id), eq(tasks.userId, userId)))
            .limit(1))[0]
        : undefined;

      if (stage) {
        await tx.update(goals).set({
          title: `مهمة: ${step.title}`,
          description: [step.detail, step.scheduleNote].filter(Boolean).join("\n\n"),
          targetDate: dueAt,
          status: "active",
          sortOrder: 100 + index,
          color: "gold",
        }).where(and(eq(goals.id, stage.id), eq(goals.userId, userId)));

        const task = (tasksByStage.get(stage.id) ?? []).find(item => item.status === "todo");
        if (task && linkedExistingTask && task.id !== linkedExistingTask.id) {
          await tx.delete(tasks).where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));
        }
        if (task && !linkedExistingTask) {
          await tx.update(tasks).set({
            title: step.title,
            notes: taskNotes(step),
            category: step.category || "دراسة",
            priority,
            estimatedMinutes: null,
            dueAt,
          }).where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));
          refreshedTaskCount += 1;
          taskLinks.push({ planStepIndex: sourceIndex, taskId: task.id, status: "todo" });
          continue;
        }

        if (!linkedExistingTask) {
          const taskInsert = await tx.insert(tasks).values({
            userId,
            goalId: stage.id,
            title: step.title,
            notes: taskNotes(step),
            category: step.category || "دراسة",
            priority,
            estimatedMinutes: null,
            dueAt,
          });
          createdTaskCount += 1;
          taskLinks.push({ planStepIndex: sourceIndex, taskId: Number(taskInsert[0].insertId), status: "todo" });
        } else {
          taskLinks.push({ planStepIndex: sourceIndex, taskId: linkedExistingTask.id, status: linkedExistingTask.status });
        }
        continue;
      }

      const stageInsert = await tx.insert(goals).values({
        userId,
        parentGoalId,
        title: `مهمة: ${step.title}`,
        description: step.detail,
        kind: "short",
        category: "مهمة دراسية",
        color: "gold",
        targetDate: dueAt,
        status: "active",
        sortOrder: 100 + index,
      });
      const stageGoalId = Number(stageInsert[0].insertId);
      if (!linkedExistingTask) {
        const taskInsert = await tx.insert(tasks).values({
          userId,
          goalId: stageGoalId,
          title: step.title,
          notes: taskNotes(step),
          category: step.category || "دراسة",
          priority,
          estimatedMinutes: null,
          dueAt,
        });
        createdTaskCount += 1;
        taskLinks.push({ planStepIndex: sourceIndex, taskId: Number(taskInsert[0].insertId), status: "todo" });
      } else {
        taskLinks.push({ planStepIndex: sourceIndex, taskId: linkedExistingTask.id, status: linkedExistingTask.status });
      }
    }

    for (const stageId of completedStageIds) {
      await tx.update(goals).set({ status: "completed" }).where(and(
        eq(goals.id, stageId),
        eq(goals.userId, userId),
      ));
    }

    return {
      parentGoalId,
      taskCount: pendingSteps.length,
      createdTaskCount,
      refreshedTaskCount,
      preservedCompletedTaskCount: consumedCompletedIds.size,
      taskLinks,
    };
  });
}

export async function setGoalStatus(userId: number, goalId: number, status: "active" | "completed" | "paused") {
  const db = await requireDb();
  await db.update(goals).set({ status }).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
}

export async function updateGoal(userId: number, goalId: number, data: { title: string; description?: string | null; kind?: "short" | "long"; category?: string; color?: string; targetDate?: Date | null; status?: "active" | "completed" | "paused" }) {
  const db = await requireDb();
  const result = await db.update(goals).set({ title: data.title, description: data.description ?? null, kind: data.kind ?? "short", category: data.category ?? "شخصي", color: data.color ?? "violet", targetDate: data.targetDate ?? null, status: data.status ?? "active" }).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الهدف غير موجود أو لا تملك تعديله.");
}

export async function deleteGoal(userId: number, goalId: number) {
  const db = await requireDb();
  const childGoals = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.parentGoalId, goalId), eq(goals.userId, userId))).limit(1);
  if (childGoals.length) throw new Error("لا يمكن حذف الهدف الرئيسي قبل حذف مراحله التابعة أو نقلها.");
  const result = await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الهدف غير موجود أو لا تملك حذفه.");
}

export async function listBooks(userId: number) {
  const db = await requireDb();
  const [bookRows, chapterRows] = await Promise.all([
    db.select().from(books).where(eq(books.userId, userId)).orderBy(asc(books.status), desc(books.updatedAt)),
    db.select().from(bookChapters),
  ]);
  return bookRows.map(book => {
    const chapters = chapterRows.filter(chapter => chapter.bookId === book.id);
    const totalPages = chapters.length ? chapters.reduce((sum, chapter) => sum + chapter.totalPages, 0) : book.totalPages;
    const completedPages = chapters.length ? chapters.reduce((sum, chapter) => sum + chapter.completedPages, 0) : book.completedPages;
    return {
      ...book,
      chapterCount: chapters.length,
      progress: calculateProgress(completedPages, totalPages),
    };
  });
}

export async function getBookDetail(userId: number, bookId: number) {
  const db = await requireDb();
  const book = await db.select().from(books).where(and(eq(books.id, bookId), eq(books.userId, userId))).limit(1);
  if (!book[0]) return null;
  const [chapters, sessions, attachments] = await Promise.all([
    db.select().from(bookChapters).where(eq(bookChapters.bookId, bookId)).orderBy(asc(bookChapters.sortOrder)),
    db.select().from(studySessions).where(and(eq(studySessions.userId, userId), eq(studySessions.bookId, bookId))).orderBy(desc(studySessions.createdAt)),
    db.select().from(libraryAttachments).where(and(eq(libraryAttachments.userId, userId), eq(libraryAttachments.bookId, bookId))).orderBy(desc(libraryAttachments.createdAt)),
  ]);
  const completedSteps = new Set(sessions.filter(session => session.status === "completed").map(session => session.step));
  const totalPages = chapters.length ? chapters.reduce((sum, chapter) => sum + chapter.totalPages, 0) : book[0].totalPages;
  const completedPages = chapters.length ? chapters.reduce((sum, chapter) => sum + chapter.completedPages, 0) : book[0].completedPages;
  return {
    ...book[0],
    chapters,
    sessions,
    attachments: attachments.map(({ fileKey: _fileKey, fileUrl: _storedFileUrl, ...attachment }) => ({
      ...attachment,
      fileUrl: `/library-attachments/${attachment.id}/download`,
    })),
    completedSteps: Array.from(completedSteps),
    progress: calculateProgress(completedPages, totalPages),
  };
}

export async function createBook(
  userId: number,
  data: { title: string; author?: string | null; subject?: string; totalPages?: number; coverColor?: string }
) {
  const db = await requireDb();
  const result = await db.insert(books).values({
    userId,
    title: data.title,
    author: data.author ?? null,
    subject: data.subject ?? "دراسة",
    totalPages: data.totalPages ?? 0,
    coverColor: data.coverColor ?? "amber",
  });
  return Number(result[0].insertId);
}

export async function updateBook(
  userId: number,
  bookId: number,
  data: { title: string; author?: string | null; subject?: string; totalPages?: number; coverColor?: string; notes?: string | null }
) {
  const db = await requireDb();
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن تعديل كتاب لا تملكه.");
  await db.update(books).set({
    title: data.title,
    author: data.author ?? null,
    subject: data.subject ?? "دراسة",
    totalPages: data.totalPages ?? 0,
    coverColor: data.coverColor ?? "violet",
    notes: data.notes ?? null,
  }).where(eq(books.id, bookId));
}

export async function deleteBook(userId: number, bookId: number) {
  const db = await requireDb();
  const result = await db.delete(books).where(and(eq(books.id, bookId), eq(books.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("لم نعثر على الكتاب أو لا تملك حذفه.");
}

export async function addChapter(
  userId: number,
  data: { bookId: number; title: string; totalPages?: number }
) {
  const db = await requireDb();
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, data.bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن تعديل كتاب لا تملكه.");
  const chapters = await db.select({ sortOrder: bookChapters.sortOrder }).from(bookChapters).where(eq(bookChapters.bookId, data.bookId)).orderBy(desc(bookChapters.sortOrder)).limit(1);
  await db.insert(bookChapters).values({
    bookId: data.bookId,
    title: data.title,
    totalPages: data.totalPages ?? 0,
    sortOrder: (chapters[0]?.sortOrder ?? -1) + 1,
  });
}

export async function updateChapterProgress(userId: number, chapterId: number, completedPages: number) {
  const db = await requireDb();
  const chapter = await db.select().from(bookChapters).where(eq(bookChapters.id, chapterId)).limit(1);
  if (!chapter[0]) throw new Error("الفصل غير موجود.");
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, chapter[0].bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن تعديل هذا الفصل.");
  const pages = clampCompletedPages(completedPages, chapter[0].totalPages);
  await db
    .update(bookChapters)
    .set({ completedPages: pages, status: pages >= chapter[0].totalPages ? "completed" : pages > 0 ? "in_progress" : "not_started" })
    .where(eq(bookChapters.id, chapterId));
}

export async function updateChapter(
  userId: number,
  chapterId: number,
  data: { title: string; totalPages: number; completedPages: number; notes?: string | null }
) {
  const db = await requireDb();
  const chapter = await db.select().from(bookChapters).where(eq(bookChapters.id, chapterId)).limit(1);
  if (!chapter[0]) throw new Error("الفصل غير موجود.");
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, chapter[0].bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن تعديل هذا الفصل.");
  const totalPages = Math.max(0, data.totalPages);
  const completedPages = clampCompletedPages(data.completedPages, totalPages);
  await db.update(bookChapters).set({
    title: data.title,
    totalPages,
    completedPages,
    notes: data.notes ?? null,
    status: completedPages >= totalPages && totalPages > 0 ? "completed" : completedPages > 0 ? "in_progress" : "not_started",
  }).where(eq(bookChapters.id, chapterId));
}

export async function deleteChapter(userId: number, chapterId: number) {
  const db = await requireDb();
  const chapter = await db.select({ id: bookChapters.id, bookId: bookChapters.bookId }).from(bookChapters).where(eq(bookChapters.id, chapterId)).limit(1);
  if (!chapter[0]) throw new Error("الفصل غير موجود.");
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, chapter[0].bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن حذف هذا الفصل.");
  await db.delete(bookChapters).where(eq(bookChapters.id, chapterId));
}

export async function getActiveStudySession(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "active")))
    .orderBy(desc(studySessions.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function startStudySession(
  userId: number,
  data: { bookId: number; chapterId?: number | null; step: "survey" | "question" | "read" | "recite" | "review" }
) {
  const db = await requireDb();
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, data.bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن بدء جلسة لكتاب غير مملوك.");
  if (data.chapterId) {
    const chapter = await db.select({ id: bookChapters.id }).from(bookChapters).where(and(eq(bookChapters.id, data.chapterId), eq(bookChapters.bookId, data.bookId))).limit(1);
    if (!chapter[0]) throw new Error("الفصل المحدد لا يتبع لهذا الكتاب.");
  }
  const activeSessions = await db.select({ id: studySessions.id }).from(studySessions).where(and(eq(studySessions.userId, userId), eq(studySessions.status, "active"))).limit(1);
  if (activeSessions.length) throw new Error("لديك جلسة مذاكرة مفتوحة بالفعل. أنهِها أو استكملها أولًا.");
  const startedAt = new Date();
  const result = await db.insert(studySessions).values({
    userId,
    bookId: data.bookId,
    chapterId: data.chapterId ?? null,
    step: data.step,
    status: "active",
  });
  return { sessionId: Number(result[0].insertId), startedAt };
}

export async function finishStudySession(userId: number, sessionId: number, notes?: string | null) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const rows = await tx.select().from(studySessions).where(and(
      eq(studySessions.id, sessionId),
      eq(studySessions.userId, userId),
      eq(studySessions.status, "active"),
    )).limit(1);
    const session = rows[0];
    if (!session) throw new Error("جلسة المذاكرة غير موجودة أو تم إنهاؤها بالفعل.");
    const completedAt = new Date();
    const startedAt = new Date(session.createdAt);
    const durationSeconds = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1_000));
    const result = await tx.update(studySessions).set({
      status: "completed",
      completedAt,
      notes: notes?.trim() || session.notes || null,
    }).where(and(
      eq(studySessions.id, sessionId),
      eq(studySessions.userId, userId),
      eq(studySessions.status, "active"),
    ));
    if (result[0].affectedRows === 0) throw new Error("تم إنهاء جلسة المذاكرة بالفعل من مكان آخر.");
    return { durationSeconds, completedAt };
  });
}

export async function completeStudyStep(
  userId: number,
  data: { bookId: number; chapterId?: number | null; step: "survey" | "question" | "read" | "recite" | "review"; notes?: string | null }
) {
  const db = await requireDb();
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, data.bookId), eq(books.userId, userId))).limit(1);
  if (!ownedBook[0]) throw new Error("لا يمكن بدء جلسة لكتاب غير مملوك.");
  if (data.chapterId) {
    const chapter = await db.select({ id: bookChapters.id }).from(bookChapters)
      .where(and(eq(bookChapters.id, data.chapterId), eq(bookChapters.bookId, data.bookId))).limit(1);
    if (!chapter[0]) throw new Error("الفصل المحدد لا يتبع لهذا الكتاب.");
  }
  await db.insert(studySessions).values({
    userId,
    bookId: data.bookId,
    chapterId: data.chapterId ?? null,
    step: data.step,
    notes: data.notes ?? null,
    status: "completed",
    completedAt: new Date(),
  });
}

export async function assertLibraryAttachmentTarget(userId: number, bookId: number, chapterId?: number | null) {
  const db = await requireDb();
  const ownedBook = await db.select({ id: books.id }).from(books).where(and(eq(books.id, bookId), eq(books.userId, userId))).limit(1);
  if (chapterId) {
    const chapter = await db.select({ id: bookChapters.id }).from(bookChapters).where(and(eq(bookChapters.id, chapterId), eq(bookChapters.bookId, bookId))).limit(1);
    assertAttachmentTargetOwnership(ownedBook[0], chapter[0]);
  } else {
    assertAttachmentTargetOwnership(ownedBook[0], true);
  }
}

export async function getLibraryAttachmentForDownload(userId: number, attachmentId: number) {
  const db = await requireDb();
  const rows = await db.select({
    id: libraryAttachments.id,
    fileKey: libraryAttachments.fileKey,
    fileName: libraryAttachments.fileName,
    mimeType: libraryAttachments.mimeType,
    sizeBytes: libraryAttachments.sizeBytes,
  })
    .from(libraryAttachments)
    .where(and(eq(libraryAttachments.id, attachmentId), eq(libraryAttachments.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function addLibraryAttachment(
  userId: number,
  data: { bookId: number; chapterId?: number | null; fileName: string; fileKey: string; fileUrl: string; mimeType: string; sizeBytes: number }
): Promise<number> {
  await assertLibraryAttachmentTarget(userId, data.bookId, data.chapterId);
  const db = await requireDb();
  const result = await db.insert(libraryAttachments).values({ ...data, userId, chapterId: data.chapterId ?? null });
  return Number(result[0].insertId);
}

export async function deleteLibraryAttachment(userId: number, attachmentId: number) {
  const db = await requireDb();
  const result = await db.delete(libraryAttachments).where(and(eq(libraryAttachments.id, attachmentId), eq(libraryAttachments.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("لم نعثر على هذا المرفق أو لا تملك حذفه.");
}

export async function listRoutines(userId: number, timeZone = "UTC") {
  const db = await requireDb();
  const routineRows = await db.select().from(routines).where(eq(routines.userId, userId)).orderBy(asc(routines.period));
  if (!routineRows.length) return [];
  const routineIds = routineRows.map(routine => routine.id);
  const items = await db.select().from(routineItems).where(inArray(routineItems.routineId, routineIds)).orderBy(asc(routineItems.sortOrder));
  const itemIds = items.map(item => item.id);
  const completions = itemIds.length
    ? await db.select().from(routineCompletions).where(and(inArray(routineCompletions.routineItemId, itemIds), eq(routineCompletions.dateKey, getDateKeyInTimezone(new Date(), timeZone))))
    : [];
  const completedIds = new Set(completions.map(completion => completion.routineItemId));
  return routineRows.map(routine => ({
    ...routine,
    items: items.filter(item => item.routineId === routine.id).map(item => ({
      ...item,
      completedToday: routine.isActive && item.isActive && completedIds.has(item.id),
    })),
  }));
}

export async function createRoutine(
  userId: number,
  data: { name: string; period: "morning" | "evening" | "custom"; accent?: string; items: { title: string; durationMinutes?: number }[] }
) {
  const db = await requireDb();
  const result = await db.insert(routines).values({ userId, name: data.name, period: data.period, accent: data.accent ?? "amber" });
  const routineId = Number(result[0].insertId);
  if (data.items.length) {
    await db.insert(routineItems).values(data.items.map((item, index) => ({
      routineId,
      title: item.title,
      durationMinutes: item.durationMinutes ?? 10,
      sortOrder: index,
    })));
  }
  return routineId;
}


export async function toggleRoutineItem(userId: number, itemId: number, done: boolean, timeZone = "UTC") {
  const db = await requireDb();
  const item = await db.select().from(routineItems).where(eq(routineItems.id, itemId)).limit(1);
  if (!item[0]) throw new Error("فقرة الروتين غير موجودة.");
  const ownedRoutine = await db.select({ id: routines.id, isActive: routines.isActive }).from(routines).where(and(eq(routines.id, item[0].routineId), eq(routines.userId, userId))).limit(1);
  if (!ownedRoutine[0]) throw new Error("لا يمكن تعديل هذا الروتين.");
  if (!ownedRoutine[0].isActive || !item[0].isActive) throw new Error("لا يمكن تسجيل خطوة في روتين أو خطوة غير نشطة.");
  const dateKey = getDateKeyInTimezone(new Date(), timeZone);
  if (done) {
    await db.insert(routineCompletions).values({ routineItemId: itemId, dateKey }).onDuplicateKeyUpdate({ set: { completedAt: new Date() } });
  } else {
    await db.delete(routineCompletions).where(and(eq(routineCompletions.routineItemId, itemId), eq(routineCompletions.dateKey, dateKey)));
  }
}

export async function updateRoutine(
  userId: number,
  routineId: number,
  data: {
    name: string;
    period: "morning" | "evening" | "custom";
    accent: string;
    isActive: boolean;
    items?: { title: string; durationMinutes?: number }[];
  }
) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const current = await tx.select({ id: routines.id })
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
      .limit(1);
    if (!current[0]) throw new Error("الروتين غير موجود أو لا تملك تعديله.");

    await tx.update(routines).set({
      name: data.name,
      period: data.period,
      accent: data.accent,
      isActive: data.isActive,
    }).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));

    if (data.items) {
      const oldItems = await tx.select({ id: routineItems.id })
        .from(routineItems)
        .where(eq(routineItems.routineId, routineId));
      if (oldItems.length) {
        // Keep completion history intact; deactivate old steps and add a fresh ordered set.
        await tx.update(routineItems)
          .set({ isActive: false })
          .where(inArray(routineItems.id, oldItems.map(item => item.id)));
      }
      const nextItems = data.items.filter(item => item.title.trim().length > 0);
      if (nextItems.length) {
        await tx.insert(routineItems).values(nextItems.map((item, index) => ({
          routineId,
          title: item.title.trim(),
          durationMinutes: item.durationMinutes ?? 10,
          sortOrder: index,
          isActive: true,
        })));
      }
    }
  });
}

export async function deleteRoutine(userId: number, routineId: number) {
  const db = await requireDb();
  const result = await db.delete(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الروتين غير موجود أو لا تملك حذفه.");
}

export async function listCalendarEvents(userId: number, timeZone = "Africa/Cairo") {
  const db = await requireDb();
  const [events, scheduledTasks, routineRows] = await Promise.all([
    db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    listRoutines(userId, timeZone),
  ]);

  const calendarItems = mergeCalendarItems(events, scheduledTasks);
  const activeRoutines = routineRows
    .filter(routine => routine.isActive)
    .map(routine => ({ ...routine, items: routine.items.filter(item => item.isActive) }))
    .filter(routine => routine.items.length > 0);

  // The current routine model represents daily morning/evening/custom routines,
  // but it has no weekday or clock-time fields. Keep them as all-day daily
  // commitments until the student explicitly configures a time.
  const routineItems: CalendarDisplayItem[] = [];
  const todayKey = getDateKeyInTimezone(new Date(), timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));

  for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
    const date = new Date(cursor);
    date.setUTCDate(cursor.getUTCDate() + dayOffset);
    const dateKey = getDateKeyInTimezone(date, timeZone);
    const startAt = new Date(`${dateKey}T12:00:00.000Z`);

    for (const routine of activeRoutines) {
      const completedCount = dayOffset === 0
        ? routine.items.filter(item => item.completedToday).length
        : 0;
      routineItems.push({
        id: `routine-${routine.id}-${dateKey}`,
        title: routine.name,
        type: "study",
        startAt,
        endAt: null,
        allDay: true,
        color: routine.period === "morning" ? "amber" : routine.period === "evening" ? "rose" : "stone",
        source: "routine",
        routineId: routine.id,
        routinePeriod: routine.period,
        routineDate: dateKey,
        completed: routine.items.length > 0 && completedCount === routine.items.length,
        completedCount,
        itemCount: routine.items.length,
        routineItems: routine.items.map(item => ({
          id: item.id,
          title: item.title,
          durationMinutes: item.durationMinutes,
          completed: dayOffset === 0 ? item.completedToday : false,
        })),
      });
    }
  }

  return [...calendarItems, ...routineItems].sort((first, second) =>
    new Date(first.startAt as Date).getTime() - new Date(second.startAt as Date).getTime()
  );
}

export async function createCalendarEvent(
  userId: number,
  data: { title: string; type?: "event" | "study" | "goal"; startAt: Date; endAt?: Date | null; allDay?: boolean; color?: string }
) {
  const db = await requireDb();
  await db.insert(calendarEvents).values({
    userId,
    title: data.title,
    type: data.type ?? "event",
    startAt: data.startAt,
    endAt: data.endAt ?? null,
    allDay: data.allDay ?? false,
    color: data.color ?? "violet",
  });
}

export async function updateCalendarEvent(userId: number, eventId: number, data: { title: string; type: "event" | "study" | "goal"; startAt: Date; endAt?: Date | null; allDay: boolean; color: string }) {
  const db = await requireDb();
  const result = await db.update(calendarEvents).set({ ...data, endAt: data.endAt ?? null }).where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الموعد غير موجود أو لا تملك تعديله.");
}

export async function deleteCalendarEvent(userId: number, eventId: number) {
  const db = await requireDb();
  const result = await db.delete(calendarEvents).where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الموعد غير موجود أو لا تملك حذفه.");
}

export async function saveAiPlan(userId: number, data: { prompt: string; title: string; planJson: string }) {
  const db = await requireDb();
  await db.insert(aiPlans).values({ userId, prompt: data.prompt, title: data.title, planJson: data.planJson });
}

export async function listAiPlans(userId: number) {
  const db = await requireDb();
  return db.select().from(aiPlans).where(eq(aiPlans.userId, userId)).orderBy(desc(aiPlans.createdAt)).limit(12);
}

export async function deleteAiPlan(userId: number, planId: number) {
  const db = await requireDb();
  const result = await db.delete(aiPlans).where(and(eq(aiPlans.id, planId), eq(aiPlans.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الخطة غير موجودة أو لا تملك حذفها.");
}

/**
 * Deletes one student's AI plan history and only the goal trees created by
 * the AI planner. Manually created goals/tasks and learning progress are kept.
 */
export async function deleteAllAiPlansAndGoalTrees(userId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const userGoals = await tx.select().from(goals).where(eq(goals.userId, userId));
    const aiRootCategories = new Set(["خطة يومية", "خطة ذكية", "خطة تدريبية"]);
    const aiRootTitles = new Set([
      "خطة StudyFlow اليومية",
      "خطة StudyFlow الذكية الحالية",
    ]);
    const goalIds = new Set<number>(
      userGoals
        .filter(goal => (goal.parentGoalId === null || goal.parentGoalId === undefined) && (
          aiRootCategories.has(goal.category) || aiRootTitles.has(goal.title)
        ))
        .map(goal => goal.id),
    );

    // Include every descendant stage, not only one level deep.
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const goal of userGoals) {
        if (goal.parentGoalId !== null && goalIds.has(goal.parentGoalId) && !goalIds.has(goal.id)) {
          goalIds.add(goal.id);
          expanded = true;
        }
      }
    }

    const ownedGoalIds = [...goalIds];
    let deletedTasks = 0;
    let deletedGoals = 0;
    if (ownedGoalIds.length > 0) {
      const taskRows = await tx.select({ id: tasks.id }).from(tasks).where(and(
        eq(tasks.userId, userId),
        inArray(tasks.goalId, ownedGoalIds),
      ));
      deletedTasks = taskRows.length;
      await tx.delete(tasks).where(and(
        eq(tasks.userId, userId),
        inArray(tasks.goalId, ownedGoalIds),
      ));
      // Delete descendants before parents to remain safe even if the
      // self-referencing goal relation uses RESTRICT instead of CASCADE.
      for (const goalId of [...ownedGoalIds].reverse()) {
        const goalResult = await tx.delete(goals).where(and(
          eq(goals.userId, userId),
          eq(goals.id, goalId),
        ));
        deletedGoals += Number(goalResult[0]?.affectedRows ?? 0);
      }
    }

    const planResult = await tx.delete(aiPlans).where(eq(aiPlans.userId, userId));
    return {
      deletedPlans: Number(planResult[0]?.affectedRows ?? 0),
      deletedTasks,
      deletedGoals,
    };
  });
}

export async function getLatestAiPlanByPromptPrefix(userId: number, prefix: string) {
  const db = await requireDb();
  const rows = await db.select()
    .from(aiPlans)
    .where(and(eq(aiPlans.userId, userId), like(aiPlans.prompt, prefix + "%")))
    .orderBy(desc(aiPlans.createdAt), desc(aiPlans.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateAiPlanContent(userId: number, planId: number, planJson: string) {
  const db = await requireDb();
  const result = await db.update(aiPlans)
    .set({ planJson })
    .where(and(eq(aiPlans.id, planId), eq(aiPlans.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("خطة الدراسة المطلوب تحديثها غير موجودة.");
}

export async function updateAiPlanPrompt(userId: number, planId: number, prompt: string) {
  const db = await requireDb();
  const result = await db.update(aiPlans)
    .set({ prompt })
    .where(and(eq(aiPlans.id, planId), eq(aiPlans.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("خطة الدراسة المطلوب تحديثها غير موجودة.");
}

export async function enqueuePlannerReconciliationJob(input: {
  userId: number;
  impact: "local" | "structural";
  eventType: string;
}) {
  const db = await requireDb();
  const nextRunAt = new Date(Date.now() + 1_500);
  await db.insert(plannerReconciliationJobs).values({
    userId: input.userId,
    impact: input.impact,
    eventType: input.eventType.slice(0, 80),
    status: "queued",
    attempts: 0,
    revision: 1,
    nextRunAt,
    lockedUntil: null,
    lastError: null,
  }).onDuplicateKeyUpdate({
    set: {
      impact: sql`IF(${plannerReconciliationJobs.impact} = 'structural' OR VALUES(impact) = 'structural', 'structural', 'local')`,
      eventType: input.eventType.slice(0, 80),
      attempts: sql`IF(${plannerReconciliationJobs.status} = 'running', ${plannerReconciliationJobs.attempts}, 0)`,
      nextRunAt,
      lockedUntil: sql`IF(${plannerReconciliationJobs.status} = 'running', ${plannerReconciliationJobs.lockedUntil}, NULL)`,
      status: sql`IF(${plannerReconciliationJobs.status} = 'running', 'running', 'queued')`,
      revision: sql`${plannerReconciliationJobs.revision} + 1`,
      lastError: null,
    },
  });
}

/** Atomically lease due jobs so multiple application replicas cannot run the same event. */
export async function claimPlannerReconciliationJobs(limit = 3, leaseMs = 8 * 60 * 1_000) {
  const db = await requireDb();
  const now = new Date();
  return db.transaction(async tx => {
    const due = await tx.select()
      .from(plannerReconciliationJobs)
      .where(and(
        lte(plannerReconciliationJobs.nextRunAt, now),
        or(
          and(
            eq(plannerReconciliationJobs.status, "queued"),
            or(
              isNull(plannerReconciliationJobs.lockedUntil),
              lt(plannerReconciliationJobs.lockedUntil, now),
            ),
          ),
          and(
            eq(plannerReconciliationJobs.status, "running"),
            lt(plannerReconciliationJobs.lockedUntil, now),
          ),
        ),
      ))
      .orderBy(asc(plannerReconciliationJobs.nextRunAt), asc(plannerReconciliationJobs.id))
      .limit(Math.max(1, Math.min(10, Math.trunc(limit))))
      .for("update");

    const lockedUntil = new Date(now.getTime() + leaseMs);
    for (const job of due) {
      await tx.update(plannerReconciliationJobs).set({
        status: "running",
        attempts: job.attempts + 1,
        lockedUntil,
      }).where(eq(plannerReconciliationJobs.id, job.id));
    }
    return due.map(job => ({ ...job, status: "running" as const, attempts: job.attempts + 1, lockedUntil }));
  });
}

async function requeuePlannerJobAfterConcurrentChange(jobId: number, completedRevision: number) {
  const db = await requireDb();
  const current = (await db.select({
    revision: plannerReconciliationJobs.revision,
    status: plannerReconciliationJobs.status,
  }).from(plannerReconciliationJobs)
    .where(eq(plannerReconciliationJobs.id, jobId))
    .limit(1))[0];
  if (!current || current.status !== "running" || current.revision <= completedRevision) return false;

  const result = await db.update(plannerReconciliationJobs).set({
    status: "queued",
    attempts: 0,
    nextRunAt: new Date(Date.now() + 1_500),
    lockedUntil: null,
    lastError: null,
  }).where(and(
    eq(plannerReconciliationJobs.id, jobId),
    eq(plannerReconciliationJobs.revision, current.revision),
    eq(plannerReconciliationJobs.status, "running"),
  ));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function completePlannerReconciliationJob(jobId: number, revision: number) {
  const db = await requireDb();
  const result = await db.update(plannerReconciliationJobs).set({
    status: "completed",
    lockedUntil: null,
    lastError: null,
  }).where(and(
    eq(plannerReconciliationJobs.id, jobId),
    eq(plannerReconciliationJobs.revision, revision),
    eq(plannerReconciliationJobs.status, "running"),
  ));
  if (Number(result[0]?.affectedRows ?? 0) > 0) return true;

  // A newer event arrived while this revision was executing. Requeue it now,
  // instead of leaving it behind the previous worker's lease timeout.
  await requeuePlannerJobAfterConcurrentChange(jobId, revision);
  return false;
}

export async function failPlannerReconciliationJob(input: {
  jobId: number;
  revision: number;
  attempts: number;
  error: string;
}) {
  const db = await requireDb();
  const delayMs = Math.min(5 * 60 * 1_000, 5_000 * (2 ** Math.max(0, input.attempts - 1)));
  const terminal = input.attempts >= 5;
  const result = await db.update(plannerReconciliationJobs).set({
    status: terminal ? "failed" : "queued",
    nextRunAt: new Date(Date.now() + delayMs),
    lockedUntil: null,
    lastError: input.error.slice(0, 500),
  }).where(and(
    eq(plannerReconciliationJobs.id, input.jobId),
    eq(plannerReconciliationJobs.revision, input.revision),
    eq(plannerReconciliationJobs.status, "running"),
  ));
  if (Number(result[0]?.affectedRows ?? 0) > 0) return true;

  await requeuePlannerJobAfterConcurrentChange(input.jobId, input.revision);
  return false;
}

export async function recordStudentActivityEvent(input: {
  userId: number;
  eventType: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await requireDb();
  const metadataJson = JSON.stringify(input.metadata ?? {});
  const safeMetadata = metadataJson.length <= 8_000 ? metadataJson : "{}";
  const result = await db.insert(studentActivityEvents).values({
    userId: input.userId,
    eventType: input.eventType.slice(0, 80),
    entityType: input.entityType.slice(0, 60),
    entityId: input.entityId == null ? null : String(input.entityId).slice(0, 100),
    summary: input.summary.slice(0, 500),
    metadataJson: safeMetadata,
  });
  return Number(result[0].insertId);
}

export async function listRecentStudentActivityEvents(userId: number, limit = 30) {
  const db = await requireDb();
  const rows = await db.select()
    .from(studentActivityEvents)
    .where(eq(studentActivityEvents.userId, userId))
    .orderBy(desc(studentActivityEvents.createdAt), desc(studentActivityEvents.id))
    .limit(Math.max(1, Math.min(100, Math.trunc(limit))));
  return rows.reverse().map(row => ({
    id: row.id,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: (() => {
      try { return JSON.parse(row.metadataJson || "{}") as Record<string, unknown>; }
      catch { return {}; }
    })(),
    createdAt: row.createdAt,
  }));
}

export async function getDashboard(userId: number, timeZone = "UTC") {
  const [taskRows, goalRows, bookRows, routineRows, eventRows] = await Promise.all([
    listTasks(userId),
    listGoals(userId),
    listBooks(userId),
    listRoutines(userId, timeZone),
    listCalendarEvents(userId),
  ]);
  const activeTasks = taskRows.filter(task => task.status === "todo");
  const activeRoutineRows = routineRows.filter(routine => routine.isActive);
  const activeRoutineItems = activeRoutineRows.flatMap(routine => routine.items).filter(item => item.isActive);
  const routineItemsTotal = activeRoutineItems.length;
  const routineItemsCompleted = activeRoutineItems.filter(item => item.completedToday).length;
  return {
    tasks: activeTasks.slice(0, 6),
    taskStats: { total: taskRows.length, completed: taskRows.filter(task => task.status === "done").length, remaining: activeTasks.length },
    goalStats: { active: goalRows.filter(goal => goal.status === "active").length, total: goalRows.length },
    bookStats: { total: bookRows.length },
    goals: goalRows.filter(goal => goal.status === "active").slice(0, 4),
    books: bookRows.slice(0, 4),
    routines: routineRows,
    routineStats: { total: routineItemsTotal, completed: routineItemsCompleted },
    events: eventRows.filter(event => event.startAt >= new Date()).slice(0, 6),
  };
}


/** أرقام وصفية من سجلات المهام فقط؛ لا تدّعي قياس الإتقان الأكاديمي. */
export async function getStudyAnalytics(userId: number, timeZone = "UTC") {
  const rows = await listTasks(userId);
  const now = new Date();
  const buckets = { daily: { completed: 0 }, weekly: { completed: 0 }, monthly: { completed: 0 } };
  const subjects = new Map<string, { total: number; completed: number; overdue: number }>();

  for (const task of rows) {
    const subject = task.category || "عام";
    const current = subjects.get(subject) ?? { total: 0, completed: 0, overdue: 0 };
    current.total += 1;
    if (task.status === "done") current.completed += 1;
    if (task.status === "todo" && task.dueAt && task.dueAt.getTime() < now.getTime()) current.overdue += 1;
    subjects.set(subject, current);

    if (task.status === "done" && task.completedAt) {
      for (const bucket of analyticsPeriodsForDate(new Date(task.completedAt), now, timeZone)) {
        buckets[bucket].completed += 1;
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    timeZone,
    disclaimer: "تعرض الفترات عدد المهام التي سُجّل إكمالها خلالها. التقدم حسب المادة يعرض الحالة الحالية للمهام، ولا يقيس الإتقان الأكاديمي.",
    periods: buckets,
    subjects: Array.from(subjects.entries()).map(([name, value]) => ({ name, ...value, rate: value.total ? Math.round((value.completed / value.total) * 100) : 0 })).sort((a, b) => b.total - a.total),
  };
}
