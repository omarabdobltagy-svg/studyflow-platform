import { and, asc, desc, eq, inArray } from "drizzle-orm";
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
  studentProfiles,
  studySessions,
  taskChangeLogs,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
};

export function mergeCalendarItems(events: CalendarEventRow[], scheduledTasks: ScheduledTaskRow[]) {
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


/**
 * Creates the single local StudyFlow account, or adopts the only existing user row.
 * Reusing the existing row preserves every study record linked by userId.
 * If multiple identities exist, refuse to guess which account owns the data.
 */
export async function ensureLocalAuthUser(name: string) {
  const db = await requireDb();
  const openId = "studyflow-local-owner";
  const localRows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  if (localRows[0]) {
    await db.update(users).set({
      name,
      loginMethod: "local",
      role: "admin",
      lastSignedIn: new Date(),
    }).where(eq(users.id, localRows[0].id));
  } else {
    const existingRows = await db.select().from(users).orderBy(asc(users.id)).limit(2);
    if (existingRows.length > 1) {
      throw new Error("MULTIPLE_EXISTING_USERS");
    }
    if (existingRows.length === 1) {
      // Keep the existing user id so profiles, tasks, books and other records remain linked.
      await db.update(users).set({
        openId,
        name,
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      }).where(eq(users.id, existingRows[0].id));
    } else {
      await db.insert(users).values({
        openId,
        name,
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      });
    }
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!result[0]) throw new Error("LOCAL_USER_CREATION_FAILED");
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
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
  return {
    ...profile,
    subjects: parseJson<string[]>(profile.subjectsJson, []),
    teacherSelections: parseJson<Record<string, string>>(profile.teacherSelectionsJson, {}),
    selection: parseJson<Record<string, unknown>>(profile.selectionJson ?? "{}", {}),
    backlog: parseJson<Record<string, number>>(profile.backlogJson, {}),
  };
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

export async function saveSIEOnboarding(userId: number, data: SIEOnboardingInput) {
  const db = await requireDb();
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
    selectionJson: JSON.stringify(data.selection),
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
  }
) {
  const db = await requireDb();
  await db.insert(goals).values({
    userId,
    title: data.title,
    description: data.description ?? null,
    kind: data.kind ?? "short",
    category: data.category ?? "شخصي",
    color: data.color ?? "violet",
    targetDate: data.targetDate ?? null,
  });
}

export type ApprovedPlanStep = {
  day: number;
  title: string;
  detail: string;
  minutes: number;
  category: string;
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

export function schedulePlanStepDates(startDate: string, steps: Array<{ minutes: number }>, dailyMinutes: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("تاريخ بداية الخطة غير صالح.");
  const parsedStart = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== startDate) throw new Error("تاريخ بداية الخطة غير صالح.");
  const capacity = Math.min(600, Math.max(20, Math.round(dailyMinutes)));
  let dayOffset = 0;
  let usedMinutes = 0;
  return steps.map(step => {
    const duration = Math.min(480, Math.max(5, Math.round(step.minutes || 25)));
    if (usedMinutes > 0 && usedMinutes + duration > capacity) {
      dayOffset += 1;
      usedMinutes = 0;
    }
    const dueAt = new Date(parsedStart);
    dueAt.setUTCDate(dueAt.getUTCDate() + dayOffset);
    usedMinutes += duration;
    return dueAt;
  });
}

export async function approvePlanAsGoalTree(
  userId: number,
  plan: { title: string; summary: string; steps: ApprovedPlanStep[] },
  schedule?: { startDate: string; dailyMinutes: number }
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
        description: step.detail || `جلسة اليوم ${step.day} من الخطة المعتمدة.`,
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
        notes: step.detail || `جلسة اليوم ${step.day} من خطة «${plan.title.trim()}».`,
        category: step.category,
        priority: "medium",
        estimatedMinutes: step.minutes,
        dueAt: dueDates[index] ?? null,
      });
    }

    return { parentGoalId, stageCount: steps.length, taskCount: steps.length };
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
  await db.insert(books).values({
    userId,
    title: data.title,
    author: data.author ?? null,
    subject: data.subject ?? "دراسة",
    totalPages: data.totalPages ?? 0,
    coverColor: data.coverColor ?? "violet",
  });
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

export async function updateRoutine(userId: number, routineId: number, data: { name: string; period: "morning" | "evening" | "custom"; accent: string; isActive: boolean }) {
  const db = await requireDb();
  const result = await db.update(routines).set(data).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الروتين غير موجود أو لا تملك تعديله.");
}

export async function deleteRoutine(userId: number, routineId: number) {
  const db = await requireDb();
  const result = await db.delete(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
  if (result[0].affectedRows === 0) throw new Error("الروتين غير موجود أو لا تملك حذفه.");
}

export async function listCalendarEvents(userId: number) {
  const db = await requireDb();
  const [events, scheduledTasks] = await Promise.all([
    db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, "todo"))),
  ]);
  return mergeCalendarItems(events, scheduledTasks);
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
