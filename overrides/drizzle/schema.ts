import {
  boolean,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** هوية المستخدم التي يزوّدها نظام الدخول. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  phone: varchar("phone", { length: 20 }),
  username: varchar("username", { length: 80 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  sessionVersion: int("sessionVersion").default(0).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [
  uniqueIndex("users_username_unique").on(table.username),
]);

export const studentProfiles = mysqlTable(
  "studentProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    studentName: varchar("studentName", { length: 120 }).notNull(),
    educationSystem: mysqlEnum("educationSystem", ["baccalaureate", "general_secondary", "other"]).notNull(),
    gradeYear: varchar("gradeYear", { length: 40 }).notNull(),
    track: varchar("track", { length: 100 }).notNull(),
    subjectsJson: text("subjectsJson").notNull(),
    teacherSelectionsJson: text("teacherSelectionsJson").notNull(),
    selectionJson: text("selectionJson"),
    backlogJson: text("backlogJson").notNull(),
    obstacle: varchar("obstacle", { length: 600 }).notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("student_profiles_user_idx").on(table.userId)]
);

export const goals = mysqlTable(
  "goals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentGoalId: int("parentGoalId"),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    kind: mysqlEnum("kind", ["short", "long"]).default("short").notNull(),
    category: varchar("category", { length: 80 }).default("شخصي").notNull(),
    color: varchar("color", { length: 20 }).default("violet").notNull(),
    targetDate: timestamp("targetDate"),
    status: mysqlEnum("status", ["active", "completed", "paused"])
      .default("active")
      .notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("goals_user_status_idx").on(table.userId, table.status),
    index("goals_user_parent_idx").on(table.userId, table.parentGoalId),
    foreignKey({ columns: [table.parentGoalId], foreignColumns: [table.id], name: "goals_parent_goal_fk" }).onDelete("set null"),
  ]
);

export const books = mysqlTable(
  "books",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    author: varchar("author", { length: 140 }),
    subject: varchar("subject", { length: 100 }).default("دراسة").notNull(),
    coverColor: varchar("coverColor", { length: 20 }).default("violet").notNull(),
    totalPages: int("totalPages").default(0).notNull(),
    completedPages: int("completedPages").default(0).notNull(),
    status: mysqlEnum("status", ["planned", "reading", "completed"])
      .default("planned")
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("books_user_status_idx").on(table.userId, table.status)]
);

export const bookChapters = mysqlTable(
  "bookChapters",
  {
    id: int("id").autoincrement().primaryKey(),
    bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    totalPages: int("totalPages").default(0).notNull(),
    completedPages: int("completedPages").default(0).notNull(),
    status: mysqlEnum("status", ["not_started", "in_progress", "completed"])
      .default("not_started")
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("chapters_book_sort_idx").on(table.bookId, table.sortOrder)]
);

export const libraryAttachments = mysqlTable(
  "libraryAttachments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
    chapterId: int("chapterId").references(() => bookChapters.id, { onDelete: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    fileUrl: text("fileUrl").notNull(),
    mimeType: varchar("mimeType", { length: 160 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("attachments_user_book_idx").on(table.userId, table.bookId),
    index("attachments_chapter_idx").on(table.chapterId),
  ]
);

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    goalId: int("goalId").references(() => goals.id, { onDelete: "set null" }),
    bookId: int("bookId").references(() => books.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull(),
    notes: text("notes"),
    category: varchar("category", { length: 80 }).default("عام").notNull(),
    priority: mysqlEnum("priority", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    estimatedMinutes: int("estimatedMinutes"),
    status: mysqlEnum("status", ["todo", "done"])
      .default("todo")
      .notNull(),
    dueAt: timestamp("dueAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tasks_user_status_due_idx").on(table.userId, table.status, table.dueAt),
    index("tasks_goal_idx").on(table.goalId),
  ]
);

export const taskChangeLogs = mysqlTable(
  "taskChangeLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    previousStatus: mysqlEnum("previousStatus", ["todo", "done"]).notNull(),
    previousCompletedAt: timestamp("previousCompletedAt"),
    nextStatus: mysqlEnum("nextStatus", ["todo", "done"]).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("task_changes_user_created_idx").on(table.userId, table.createdAt)]
);

/** خطوات قصيرة تشرح تنفيذ المهمة الكبيرة وتعرض تقدمها. */
export const taskSubtasks = mysqlTable(
  "taskSubtasks",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    isCompleted: boolean("isCompleted").default(false).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("task_subtasks_task_sort_idx").on(table.taskId, table.sortOrder)]
);

export const routines = mysqlTable(
  "routines",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    period: mysqlEnum("period", ["morning", "evening", "custom"])
      .default("morning")
      .notNull(),
    accent: varchar("accent", { length: 20 }).default("amber").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("routines_user_active_idx").on(table.userId, table.isActive)]
);

export const routineItems = mysqlTable(
  "routineItems",
  {
    id: int("id").autoincrement().primaryKey(),
    routineId: int("routineId").notNull().references(() => routines.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    durationMinutes: int("durationMinutes").default(10).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("routine_items_routine_sort_idx").on(table.routineId, table.sortOrder)]
);

export const routineCompletions = mysqlTable(
  "routineCompletions",
  {
    id: int("id").autoincrement().primaryKey(),
    routineItemId: int("routineItemId").notNull().references(() => routineItems.id, { onDelete: "cascade" }),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("routine_completion_once_per_day_idx").on(table.routineItemId, table.dateKey),
  ]
);

export const studySessions = mysqlTable(
  "studySessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookId: int("bookId").notNull().references(() => books.id, { onDelete: "cascade" }),
    chapterId: int("chapterId").references(() => bookChapters.id, { onDelete: "set null" }),
    step: mysqlEnum("step", ["survey", "question", "read", "recite", "review"])
      .notNull(),
    notes: text("notes"),
    status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("sessions_user_book_idx").on(table.userId, table.bookId)]
);

export const calendarEvents = mysqlTable(
  "calendarEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    type: mysqlEnum("type", ["event", "study", "goal"]).default("event").notNull(),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt"),
    allDay: boolean("allDay").default(false).notNull(),
    color: varchar("color", { length: 20 }).default("violet").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("calendar_events_user_start_idx").on(table.userId, table.startAt)]
);

export const aiPlans = mysqlTable(
  "aiPlans",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    planJson: text("planJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ai_plans_user_created_idx").on(table.userId, table.createdAt)]
);

/** صفحة ملاحظة مستقلة مستوحاة من المساحات المنظمة وقوالب الدراسة. */
export const studyNotes = mysqlTable(
  "studyNotes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    content: text("content").notNull(),
    template: mysqlEnum("template", ["free", "lecture", "sq3r", "review"])
      .default("free")
      .notNull(),
    tags: varchar("tags", { length: 320 }).default("").notNull(),
    isPinned: boolean("isPinned").default(false).notNull(),
    bookId: int("bookId").references(() => books.id, { onDelete: "set null" }),
    chapterId: int("chapterId").references(() => bookChapters.id, { onDelete: "set null" }),
    taskId: int("taskId").references(() => tasks.id, { onDelete: "set null" }),
    goalId: int("goalId").references(() => goals.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("study_notes_user_pinned_updated_idx").on(table.userId, table.isPinned, table.updatedAt),
    index("study_notes_user_template_idx").on(table.userId, table.template),
  ]
);

export const reminderSettings = mysqlTable(
  "reminderSettings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    dailyTime: varchar("dailyTime", { length: 5 }).default("08:00").notNull(),
    timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    nextExecutionAt: timestamp("nextExecutionAt"),
    lastDeliveredDate: varchar("lastDeliveredDate", { length: 10 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("reminder_schedule_uid_idx").on(table.scheduleCronTaskUid)]
);

export const reminderNotifications = mysqlTable(
  "reminderNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    content: text("content").notNull(),
    kind: mysqlEnum("kind", ["task", "event", "routine"]).notNull(),
    sourceId: int("sourceId"),
    scheduledFor: timestamp("scheduledFor").notNull(),
    deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("reminder_notifications_user_read_idx").on(table.userId, table.readAt)]
);

export const studentActivityEvents = mysqlTable(
  "studentActivityEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 60 }).notNull(),
    entityId: varchar("entityId", { length: 100 }),
    summary: varchar("summary", { length: 500 }).notNull(),
    metadataJson: text("metadataJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("student_activity_user_created_idx").on(table.userId, table.createdAt),
    index("student_activity_entity_idx").on(table.entityType, table.entityId),
  ]
);

export const plannerReconciliationJobs = mysqlTable(
  "plannerReconciliationJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    impact: mysqlEnum("impact", ["local", "structural"]).default("structural").notNull(),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
    attempts: int("attempts").default(0).notNull(),
    revision: int("revision").default(1).notNull(),
    nextRunAt: timestamp("nextRunAt").defaultNow().notNull(),
    lockedUntil: timestamp("lockedUntil"),
    lastError: varchar("lastError", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("planner_reconcile_user_unique").on(table.userId),
    index("planner_reconcile_due_idx").on(table.status, table.nextRunAt, table.lockedUntil),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookChapter = typeof bookChapters.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineItem = typeof routineItems.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type LibraryAttachment = typeof libraryAttachments.$inferSelect;
export type ReminderSetting = typeof reminderSettings.$inferSelect;
