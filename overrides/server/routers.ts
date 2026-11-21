import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { SIE_CATALOG_META, SIE_SYSTEMS, getSIEEducationSystem, getSIESubject, getSIETeacher, getSIETeachersForSubject, getSIETrack, validateSIESubjectSelection } from "@shared/sie-catalog";
import {
  addChapter,
  addLibraryAttachment,
  assertLibraryAttachmentTarget,
  approvePlanAsGoalTree,
  completeStudyStep,
  createBook,
  createCalendarEvent,
  createGoal,
  createRoutine,
  createTask,
  deleteBook,
  deleteChapter,
  deleteLibraryAttachment,
  deleteGoal,
  deleteRoutine,
  deleteTask,
  deleteCalendarEvent,
  getBookDetail,
  getDashboard,
  getStudyAnalytics,
  getStudentProfile,
  startStudySession,
  finishStudySession,
  getActiveStudySession,
  listAiPlans,
  listBooks,
  listCalendarEvents,
  listGoals,
  listRoutines,
  listTasks,
  saveStudentProfile,
  saveSIEOnboarding,
  setGoalStatus,
  toggleRoutineItem,
  toggleTask,
  updateBook,
  updateCalendarEvent,
  updateChapter,
  updateChapterProgress,
  updateGoal,
  updateRoutine,
  updateTask,
  undoTaskChange,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { generatePersonalPlan } from "./planGenerator";
import { storagePut } from "./storage";
import { decodeAndValidateAttachment } from "./attachments";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { callDataApi } from "./_core/dataApi";
import { invokeLLM } from "./_core/llm";
import { createReminderCron, getReminderPreferences, listReminderNotifications, markReminderRead, saveReminderPreferences, saveReminderSchedule } from "./reminders";

const dateInput = z.coerce.date().nullable().optional();
const timeZoneInput = z.string().trim().min(1).max(80).refine(value => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "المنطقة الزمنية غير صالحة.");
const attachmentInput = z.object({
  bookId: z.number().int().positive(),
  chapterId: z.number().int().positive().nullable().optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  contentBase64: z.string().min(1).max(11_184_812),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ?? null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  studentProfile: router({
    get: protectedProcedure.query(({ ctx }) => getStudentProfile(ctx.user.id)),
    save: protectedProcedure
      .input(z.object({
        studentName: z.string().trim().min(2).max(120),
        educationSystem: z.enum(["baccalaureate", "general_secondary", "other"]),
        gradeYear: z.string().trim().min(1).max(40),
        track: z.string().trim().min(1).max(100),
        subjects: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
        teacherSelections: z.record(z.string(), z.string().trim().min(1).max(120)).default({}),
        backlog: z.record(z.string(), z.number().int().min(0).max(999)).default({}),
        obstacle: z.string().trim().min(2).max(600),
      }))
      .mutation(({ ctx, input }) => saveStudentProfile(ctx.user.id, input)),
    complete: protectedProcedure
      .input(z.object({
        studentName: z.string().trim().min(2).max(120),
        phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "رقم الهاتف يجب أن يكون بالصيغة الدولية."),
        systemId: z.enum(["EG_BACCALAUREATE", "EG_GENERAL_SECONDARY"]),
        trackId: z.string().trim().min(1).max(80),
        subjectIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
        teacherSelections: z.record(z.string(), z.string().trim().min(1).max(80)).default({}),
        skippedTeacherSubjectIds: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = getSIETrack(input.trackId);
        const system = SIE_SYSTEMS.find(item => item.systemId === input.systemId);
        if (!system || !track || track.systemId !== input.systemId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اختيار النظام أو المسار غير صحيح." });
        }
        if (!validateSIESubjectSelection(input.systemId, input.trackId, input.subjectIds)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اختيارات المواد لا تطابق المسار المحدد." });
        }
        for (const [subjectId, teacherId] of Object.entries(input.teacherSelections)) {
          if (!input.subjectIds.includes(subjectId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "تم إرسال مدرس لمادة غير مختارة." });
          }
          const teacher = getSIETeacher(teacherId);
          const eligible = getSIETeachersForSubject(subjectId, input.systemId);
          if (!teacher || !teacher.subjectIds.includes(subjectId) || !eligible.some(item => item.teacherId === teacherId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "اختيار المدرس لا يطابق المادة أو النظام الدراسي." });
          }
        }
        for (const subjectId of input.skippedTeacherSubjectIds) {
          if (!input.subjectIds.includes(subjectId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "اختيار تأجيل المدرس لا يطابق مادة في الملف." });
          }
        }
        const subjectNames = input.subjectIds.map(id => {
          const subject = getSIESubject(id);
          if (!subject) throw new TRPCError({ code: "BAD_REQUEST", message: "توجد مادة غير معروفة في الاختيارات." });
          return subject.nameAr;
        });
        const teacherChoices = Object.fromEntries(input.subjectIds.map(id => [
          id,
          input.teacherSelections[id] ?? "__SKIP__",
        ]));
        return saveSIEOnboarding(ctx.user.id, {
          studentName: input.studentName,
          phone: input.phone,
          educationSystem: getSIEEducationSystem(input.systemId),
          gradeYear: SIE_CATALOG_META.gradeYear,
          track: track.nameAr,
          subjects: subjectNames,
          teacherSelections: input.teacherSelections,
          selection: {
            packageVersion: SIE_CATALOG_META.packageVersion,
            systemId: input.systemId,
            academicYear: SIE_CATALOG_META.academicYear,
            gradeId: SIE_CATALOG_META.gradeId,
            trackId: track.trackId,
            electiveSubjectId: track.electiveOptions.length ? (input.subjectIds.find(id => !track.requiredSubjectIds.includes(id)) ?? null) : null,
            subjectIds: input.subjectIds,
            teacherChoices,
            teacherProgressState: Object.fromEntries(Object.entries(input.teacherSelections).map(([subjectId, teacherId]) => [subjectId, {
              teacherId,
              studentAttendedFrontier: "unlocated",
              status: "unlocated",
            }])),
            completedAt: new Date().toISOString(),
          },
        });
      }),
  }),

  teachers: router({
    research: protectedProcedure
      .input(z.object({ subject: z.string().trim().min(2).max(80), track: z.string().trim().min(1).max(100) }))
      .mutation(async ({ input }) => {
        const result = await callDataApi("Youtube/search", { query: { gl: "EG", hl: "ar", q: `أفضل مدرس ${input.subject} ${input.track}` } }) as { items?: Array<Record<string, unknown>>; videos?: Array<Record<string, unknown>> };
        const items = Array.isArray(result?.items) ? result.items : Array.isArray(result?.videos) ? result.videos : [];
        const candidates = items.reduce<Array<{ name: string; url: string }>>((list, item) => {
          const name = String(item.channelTitle ?? item.channel_name ?? item.title ?? "").trim();
          if (!name || list.some(candidate => candidate.name === name)) return list;
          list.push({ name, url: String(item.url ?? item.link ?? item.videoUrl ?? "").trim() });
          return list;
        }, []).slice(0, 5);
        return { subject: input.subject, source: "YouTube", candidates };
      }),
  }),

  dashboard: router({
    summary: protectedProcedure
      .input(z.object({ timeZone: timeZoneInput }).optional())
      .query(({ ctx, input }) => getDashboard(ctx.user.id, input?.timeZone ?? "UTC")),
    analytics: protectedProcedure
      .input(z.object({ timeZone: timeZoneInput }).optional())
      .query(({ ctx, input }) => getStudyAnalytics(ctx.user.id, input?.timeZone ?? "UTC")),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(6_000) })).min(1).max(20),
      }))
      .mutation(async ({ ctx, input }) => {
        const [profile, taskRows, goalRows, bookRows, routineRows, calendarRows] = await Promise.all([
          getStudentProfile(ctx.user.id),
          listTasks(ctx.user.id),
          listGoals(ctx.user.id),
          listBooks(ctx.user.id),
          listRoutines(ctx.user.id, "Africa/Cairo"),
          listCalendarEvents(ctx.user.id),
        ]);
        const dateLabel = (value: Date | string | null | undefined) => {
          if (!value) return "بلا موعد";
          const date = value instanceof Date ? value : new Date(value);
          return Number.isNaN(date.getTime()) ? "موعد غير محدد" : new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeZone: "Africa/Cairo" }).format(date);
        };
        const profileContext = profile
          ? `اسم الطالب: ${profile.studentName}\nالنظام: ${profile.educationSystem}\nالصف/السنة: ${profile.gradeYear}\nالمسار: ${profile.track}\nالمواد: ${profile.subjects.join("، ")}\nالتراكم المسجل: ${Object.entries(profile.backlog).map(([subject, count]) => `${subject}: ${count}`).join("، ") || "لا يوجد مسجل"}\nالعائق المعلن: ${profile.obstacle}`
          : "لم يكتمل ملف الطالب بعد.";
        const appContext = [
          `المهام غير المكتملة: ${taskRows.filter(task => task.status !== "done").slice(0, 12).map(task => `- ${task.title} (${task.category}, ${task.priority}, ${dateLabel(task.dueAt)})`).join("\n") || "لا توجد مهام غير مكتملة مسجلة."}`,
          `الأهداف النشطة: ${goalRows.filter(goal => goal.status === "active").slice(0, 8).map(goal => `- ${goal.title} (${goal.progress}%، ${goal.completedTaskCount}/${goal.taskCount})`).join("\n") || "لا توجد أهداف نشطة."}`,
          `المكتبة: ${bookRows.slice(0, 8).map(book => `- ${book.title} — ${book.subject} (${book.progress}%)`).join("\n") || "لا توجد كتب مسجلة."}`,
          `الروتين النشط: ${routineRows.filter(routine => routine.isActive).slice(0, 6).map(routine => `- ${routine.name}: ${routine.items.filter(item => item.isActive).map(item => `${item.title}${item.completedToday ? " ✓" : ""}`).join("، ")}`).join("\n") || "لا يوجد روتين نشط."}`,
          `المواعيد القادمة: ${calendarRows.filter(event => new Date(event.startAt).getTime() >= Date.now()).slice(0, 8).map(event => `- ${event.title} (${dateLabel(event.startAt)})`).join("\n") || "لا توجد مواعيد قادمة مسجلة."}`,
        ].join("\n\n");
        const context = `${profileContext}\n\nحالة التطبيق الحالية (قد تتغير بعد تحديث الصفحة):\n${appContext}`;
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `أنت مساعد StudyFlow العربي. أجب مباشرة دون عبارة مثل «جاري صياغة السؤال». كن عمليًا ومختصرًا، واقترح خطوة واحدة قابلة للتنفيذ أولًا. استخدم سياق التطبيق كبيانات حالية لا كحقائق دائمة؛ إذا كانت البيانات ناقصة فاسأل بدل التخمين. لا تنشئ أو تعدّل مهامًا أو خططًا أو عادات ولا تدّعِ أنك نفذت إجراءً؛ اطلب موافقة صريحة ووجّه الطالب إلى الصفحة المناسبة. لا تدّعي معرفة أخبار أو مواعيد مدرسين دون مصدر. لا تعرض مرفقات أو بيانات خاصة غير لازمة. بيانات الطالب والتطبيق:\n${context}` },
            ...input.messages.slice(-20),
          ],
          model: process.env.OPENROUTER_MODEL || undefined,
          maxTokens: 900,
        });
        const content = response.choices[0]?.message?.content;
        return { content: typeof content === "string" ? content : "لم أتمكن من تكوين رد الآن. جرّب مرة أخرى." };
      }),
  }),

  tasks: router({
    list: protectedProcedure.query(({ ctx }) => listTasks(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1, "اكتب عنوان المهمة.").max(220),
        notes: z.string().trim().max(2_000).nullable().optional(),
        category: z.string().trim().min(1).max(80).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueAt: dateInput,
        goalId: z.number().int().positive().nullable().optional(),
        bookId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(({ ctx, input }) => createTask(ctx.user.id, input)),
    toggle: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), done: z.boolean() }))
      .mutation(({ ctx, input }) => toggleTask(ctx.user.id, input.id, input.done)),
    undo: protectedProcedure
      .input(z.object({ changeId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => undoTaskChange(ctx.user.id, input.changeId)),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(220),
        notes: z.string().trim().max(2_000).nullable().optional(),
        category: z.string().trim().min(1).max(80),
        priority: z.enum(["low", "medium", "high"]),
        dueAt: dateInput,
        goalId: z.number().int().positive().nullable().optional(),
        bookId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(({ ctx, input }) => updateTask(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteTask(ctx.user.id, input.id)),
  }),

  goals: router({
    list: protectedProcedure.query(({ ctx }) => listGoals(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1, "اكتب عنوان الهدف.").max(180),
        description: z.string().trim().max(2_000).nullable().optional(),
        kind: z.enum(["short", "long"]).optional(),
        category: z.string().trim().min(1).max(80).optional(),
        color: z.string().trim().min(1).max(20).optional(),
        targetDate: dateInput,
      }))
      .mutation(({ ctx, input }) => createGoal(ctx.user.id, input)),
    setStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "completed", "paused"]) }))
      .mutation(({ ctx, input }) => setGoalStatus(ctx.user.id, input.id, input.status)),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(180),
        description: z.string().trim().max(2_000).nullable().optional(),
        kind: z.enum(["short", "long"]),
        category: z.string().trim().min(1).max(80),
        color: z.string().trim().min(1).max(20),
        targetDate: dateInput,
        status: z.enum(["active", "completed", "paused"]),
      }))
      .mutation(({ ctx, input }) => updateGoal(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteGoal(ctx.user.id, input.id)),
  }),

  books: router({
    list: protectedProcedure.query(({ ctx }) => listBooks(ctx.user.id)),
    detail: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ ctx, input }) => getBookDetail(ctx.user.id, input.id)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1, "اكتب عنوان الكتاب.").max(180),
        author: z.string().trim().max(140).nullable().optional(),
        subject: z.string().trim().min(1).max(100).optional(),
        totalPages: z.number().int().min(0).max(100_000).optional(),
        coverColor: z.string().trim().min(1).max(20).optional(),
      }))
      .mutation(({ ctx, input }) => createBook(ctx.user.id, input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(180),
        author: z.string().trim().max(140).nullable().optional(),
        subject: z.string().trim().min(1).max(100),
        totalPages: z.number().int().min(0).max(100_000),
        coverColor: z.string().trim().min(1).max(20),
        notes: z.string().trim().max(12_000).nullable().optional(),
      }))
      .mutation(({ ctx, input }) => updateBook(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteBook(ctx.user.id, input.id)),
    addChapter: protectedProcedure
      .input(z.object({ bookId: z.number().int().positive(), title: z.string().trim().min(1).max(180), totalPages: z.number().int().min(0).max(100_000).optional() }))
      .mutation(({ ctx, input }) => addChapter(ctx.user.id, input)),
    updateChapterProgress: protectedProcedure
      .input(z.object({ chapterId: z.number().int().positive(), completedPages: z.number().int().min(0).max(100_000) }))
      .mutation(({ ctx, input }) => updateChapterProgress(ctx.user.id, input.chapterId, input.completedPages)),
    updateChapter: protectedProcedure
      .input(z.object({
        chapterId: z.number().int().positive(),
        title: z.string().trim().min(1).max(180),
        totalPages: z.number().int().min(0).max(100_000),
        completedPages: z.number().int().min(0).max(100_000),
        notes: z.string().trim().max(12_000).nullable().optional(),
      }))
      .mutation(({ ctx, input }) => updateChapter(ctx.user.id, input.chapterId, input)),
    deleteChapter: protectedProcedure
      .input(z.object({ chapterId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteChapter(ctx.user.id, input.chapterId)),
    uploadAttachment: protectedProcedure
      .input(attachmentInput)
      .mutation(async ({ ctx, input }) => {
        const binary = decodeAndValidateAttachment(input.contentBase64, input.mimeType);
        // Validate ownership before writing any bytes to object storage.
        await assertLibraryAttachmentTarget(ctx.user.id, input.bookId, input.chapterId);
        const safeName = input.fileName.replace(/[^\w.\- \u0600-\u06FF]/g, "_").slice(0, 180) || "attachment";
        const stored = await storagePut(`library/${ctx.user.id}/${input.bookId}/${Date.now()}_${safeName}`, binary, input.mimeType);
        const attachmentId = await addLibraryAttachment(ctx.user.id, {
          bookId: input.bookId,
          chapterId: input.chapterId,
          fileName: input.fileName,
          fileKey: stored.key,
          fileUrl: "",
          mimeType: input.mimeType,
          sizeBytes: binary.length,
        });
        return { attachmentId, url: `/library-attachments/${attachmentId}/download` };
      }),
    deleteAttachment: protectedProcedure
      .input(z.object({ attachmentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteLibraryAttachment(ctx.user.id, input.attachmentId)),
  }),

  study: router({
    activeSession: protectedProcedure.query(({ ctx }) => getActiveStudySession(ctx.user.id)),
    startSession: protectedProcedure
      .input(z.object({
        bookId: z.number().int().positive(),
        chapterId: z.number().int().positive().nullable().optional(),
        step: z.enum(["survey", "question", "read", "recite", "review"]),
      }))
      .mutation(({ ctx, input }) => startStudySession(ctx.user.id, input)),
    finishSession: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), notes: z.string().trim().max(4_000).nullable().optional() }))
      .mutation(({ ctx, input }) => finishStudySession(ctx.user.id, input.sessionId, input.notes)),
    completeStep: protectedProcedure
      .input(z.object({
        bookId: z.number().int().positive(),
        chapterId: z.number().int().positive().nullable().optional(),
        step: z.enum(["survey", "question", "read", "recite", "review"]),
        notes: z.string().trim().max(4_000).nullable().optional(),
      }))
      .mutation(({ ctx, input }) => completeStudyStep(ctx.user.id, input)),
  }),

  routines: router({
    list: protectedProcedure
      .input(z.object({ timeZone: timeZoneInput }).optional())
      .query(({ ctx, input }) => listRoutines(ctx.user.id, input?.timeZone ?? "UTC")),
    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(120),
        period: z.enum(["morning", "evening", "custom"]),
        accent: z.string().trim().min(1).max(20).optional(),
        items: z.array(z.object({ title: z.string().trim().min(1).max(180), durationMinutes: z.number().int().min(1).max(300).optional() })).max(20),
      }))
      .mutation(({ ctx, input }) => createRoutine(ctx.user.id, input)),
    toggleItem: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), done: z.boolean(), timeZone: timeZoneInput.optional() }))
      .mutation(({ ctx, input }) => toggleRoutineItem(ctx.user.id, input.id, input.done, input.timeZone ?? "UTC")),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(120), period: z.enum(["morning", "evening", "custom"]), accent: z.string().trim().min(1).max(20), isActive: z.boolean() }))
      .mutation(({ ctx, input }) => updateRoutine(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteRoutine(ctx.user.id, input.id)),
  }),

  calendar: router({
    list: protectedProcedure.query(({ ctx }) => listCalendarEvents(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(180),
        type: z.enum(["event", "study", "goal"]).optional(),
        startAt: z.coerce.date(),
        endAt: dateInput,
        allDay: z.boolean().optional(),
        color: z.string().trim().min(1).max(20).optional(),
      }))
      .mutation(({ ctx, input }) => createCalendarEvent(ctx.user.id, input)),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(180), type: z.enum(["event", "study", "goal"]), startAt: z.coerce.date(), endAt: dateInput, allDay: z.boolean(), color: z.string().trim().min(1).max(20) }))
      .mutation(({ ctx, input }) => updateCalendarEvent(ctx.user.id, input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteCalendarEvent(ctx.user.id, input.id)),
  }),

  reminders: router({
    settings: protectedProcedure.query(({ ctx }) => getReminderPreferences(ctx.user.id)),
    notifications: protectedProcedure.query(({ ctx }) => listReminderNotifications(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markReminderRead(ctx.user.id, input.id)),
    configure: protectedProcedure.input(z.object({ enabled: z.boolean(), dailyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "اكتب الوقت بصيغة 24 ساعة."), timezone: timeZoneInput })).mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const existing = await getReminderPreferences(userId);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      // Validate the timezone and derive the schedule before persisting any change.
      const cron = createReminderCron(input.dailyTime, input.timezone);

      if (!input.enabled) {
        if (existing.scheduleCronTaskUid) {
          await updateHeartbeatJob(existing.scheduleCronTaskUid, { enable: false }, sessionToken);
        }
        try {
          await saveReminderPreferences(userId, input);
        } catch (error) {
          // Keep the previous active schedule if the preference write fails.
          if (existing.scheduleCronTaskUid && existing.enabled) {
            try {
              await updateHeartbeatJob(existing.scheduleCronTaskUid, {
                cron: createReminderCron(existing.dailyTime, existing.timezone),
                path: "/api/scheduled/daily-reminder",
                payload: {},
                description: "تذكير يومي من مسار التعلّم",
                enable: true,
              }, sessionToken);
            } catch (rollbackError) {
              console.error("[Reminders] Failed to restore the previous schedule:", rollbackError);
            }
          }
          throw error;
        }
        return getReminderPreferences(userId);
      }

      let scheduleUid = existing.scheduleCronTaskUid;
      let nextExecutionAt: string | null | undefined;
      try {
        if (scheduleUid) {
          const job = await updateHeartbeatJob(scheduleUid, {
            cron,
            path: "/api/scheduled/daily-reminder",
            payload: {},
            description: "تذكير يومي من مسار التعلّم",
            enable: true,
          }, sessionToken);
          nextExecutionAt = job.nextExecutionAt;
        } else {
          const job = await createHeartbeatJob({
            name: `studyflow-reminder-${userId}`,
            cron,
            path: "/api/scheduled/daily-reminder",
            payload: {},
            description: "تذكير يومي من مسار التعلّم",
          }, sessionToken);
          scheduleUid = job.taskUid;
          nextExecutionAt = job.nextExecutionAt;
        }

        // Upsert the preferences row first so a first-time user has a row for
        // the schedule UID update. If the following write fails, the catch block
        // compensates the scheduler and restores the previous preference state.
        await saveReminderPreferences(userId, input);
        await saveReminderSchedule(userId, scheduleUid, nextExecutionAt ? new Date(nextExecutionAt) : null);
      } catch (error) {
        // Compensate the external scheduler if a later database write fails.
        if (existing.scheduleCronTaskUid) {
          try {
            await updateHeartbeatJob(existing.scheduleCronTaskUid, {
              cron: createReminderCron(existing.dailyTime, existing.timezone),
              path: "/api/scheduled/daily-reminder",
              payload: {},
              description: "تذكير يومي من مسار التعلّم",
              enable: existing.enabled,
            }, sessionToken);
            await saveReminderSchedule(userId, existing.scheduleCronTaskUid, existing.nextExecutionAt ?? null);
          } catch (rollbackError) {
            console.error("[Reminders] Failed to restore the previous schedule:", rollbackError);
          }
        } else if (scheduleUid) {
          try {
            await updateHeartbeatJob(scheduleUid, { enable: false }, sessionToken);
            await saveReminderSchedule(userId, null, null);
          } catch (rollbackError) {
            console.error("[Reminders] Failed to disable the newly-created schedule:", rollbackError);
          }
        }
        try {
          await saveReminderPreferences(userId, {
            enabled: existing.enabled,
            dailyTime: existing.dailyTime,
            timezone: existing.timezone,
          });
        } catch (rollbackError) {
          console.error("[Reminders] Failed to restore the previous reminder preferences:", rollbackError);
        }
        throw error;
      }

      return getReminderPreferences(userId);
    }),
  }),

  plans: router({
    list: protectedProcedure.query(({ ctx }) => listAiPlans(ctx.user.id)),
    generate: protectedProcedure
      .input(z.object({ prompt: z.string().trim().min(12, "أضف تفاصيل أكثر قليلًا حتى تكون الخطة مناسبة.").max(2_000), includeStudentProfile: z.boolean().default(true) }))
      .mutation(({ ctx, input }) => generatePersonalPlan(ctx.user.id, input.prompt, input.includeStudentProfile)),
    approve: protectedProcedure
      .input(z.object({
        plan: z.object({
          title: z.string().trim().min(3).max(100),
          summary: z.string().trim().max(500),
          steps: z.array(z.object({
            day: z.string().trim().min(1).max(30),
            title: z.string().trim().min(2).max(120),
            detail: z.string().trim().max(350),
            minutes: z.number().int().min(5).max(480),
            category: z.string().trim().min(2).max(60),
          })).min(1).max(10),
        }),
        schedule: z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          dailyMinutes: z.number().int().min(20).max(600),
        }).optional(),
      }))
      .mutation(({ ctx, input }) => approvePlanAsGoalTree(ctx.user.id, {
        title: input.plan.title,
        summary: input.plan.summary,
        steps: input.plan.steps.map((step, index) => ({ ...step, day: index + 1 })),
      }, input.schedule)),
  }),
});

export type AppRouter = typeof appRouter;
