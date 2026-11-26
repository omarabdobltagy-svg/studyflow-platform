import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { getSIEStudentVisibleBranches, getSIECheckpointProgressBranches, getSIESubject, matchSIECheckpointTask, normalizeSIECheckpointFrontier } from "@shared/sie-catalog";
import {
  ArrowLeft, BarChart3, BookOpenText, CalendarDays, Check, CheckCircle2,
  Compass, GraduationCap, ListChecks, Loader2, MessageCircle,
  Play, RefreshCw, Sparkles, Target, Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

type Priority = {
  subjectId: string; subjectName: string; branchId: string; branchTitle: string;
  gapCount: number; pointLabel: string; nextLesson: { nodeId: string; title: string } | null;
  source?: "daily_plan" | "progress" | "task";
  priority?: string;
  priorityScore?: number;
  priorityReason?: string;
  taskId?: number;
  taskTitle?: string;
};
type ExternalSession = {
  sessionId: string; subjectId: string; branchId: string; lessonId: string;
  startedAt: string; status: "active" | "completed";
};

const cairoDate = () => new Intl.DateTimeFormat("ar-EG", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo",
}).format(new Date());

function durationLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60];
  return parts.map(part => String(part).padStart(2, "0")).join(":");
}

function dueLabel(value: Date | string | null | undefined) {
  if (!value) return "بدون موعد محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "بدون موعد محدد";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", timeZone: "Africa/Cairo" }).format(date);
}

function sessionLesson(session: ExternalSession | null) {
  if (!session) return null;
  const branch = getSIECheckpointProgressBranches(session.subjectId).find(item => item.branchId === session.branchId);
  const normalizedLessonId = normalizeSIECheckpointFrontier(session.subjectId, session.branchId, session.lessonId);
  const lesson = branch?.choices.find(item => item.nodeId === normalizedLessonId);
  return {
    subject: getSIESubject(session.subjectId)?.nameAr ?? session.subjectId,
    branch: branch?.branchTitle ?? "مسار دراسي",
    lesson: lesson?.title ?? "جلسة مذاكرة",
  };
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const summary = trpc.dashboard.summary.useQuery({ timeZone: "Africa/Cairo" });
  const tasksQuery = trpc.tasks.list.useQuery();
  const learning = trpc.learning.get.useQuery();
  const profile = trpc.studentProfile.get.useQuery();
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [welcomeGuideStep, setWelcomeGuideStep] = useState(0);
  const completeWelcomeGuide = trpc.studentProfile.completeWelcomeGuide.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      setShowWelcomeGuide(false);
    },
    onError: error => toast.error(error.message || "تعذّر حفظ إكمال دليل البداية."),
  });
  const dailyPlan = trpc.plans.currentDaily.useQuery(undefined, {
    staleTime: 10_000,
    refetchInterval: query => query.state.data?.needsRefresh || !query.state.data?.plan ? 15_000 : 180_000,
    refetchOnWindowFocus: true, retry: 1,
  });
  const activeSessionQuery = trpc.learning.activeExternalSession.useQuery(undefined, {
    refetchInterval: query => query.state.data ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (profile.isSuccess && profile.data && !((profile.data.selection as Record<string, any> | undefined)?.welcomeGuideCompletedAt)) {
      setShowWelcomeGuide(true);
    }
  }, [profile.isSuccess, (profile.data?.selection as Record<string, any> | undefined)?.welcomeGuideCompletedAt]);

  // Refresh the profile after the daily-plan query finishes its automatic public teacher scan.
  useEffect(() => {
    if (dailyPlan.data?.generatedAt) void profile.refetch();
  }, [dailyPlan.data?.generatedAt]);


  const ensurePlan = trpc.plans.ensureDaily.useMutation({
    onSuccess: result => {
      void utils.plans.currentDaily.invalidate();
      void utils.dashboard.summary.invalidate();
      void utils.tasks.list.invalidate();
      toast.success(result.generated ? "تم تجهيز خطة اليوم وتحديث المهام." : "خطة اليوم جاهزة.");
    },
    onError: error => toast.error("تعذّر تجهيز الخطة: " + error.message),
  });
  const toggleTask = trpc.tasks.toggle.useMutation({
    onSuccess: () => {
      void utils.dashboard.summary.invalidate();
      void utils.tasks.list.invalidate();
      void utils.plans.currentDaily.invalidate();
    },
    onError: error => toast.error(error.message || "تعذّر تحديث المهمة."),
  });
  const startSession = trpc.learning.startExternalSession.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.learning.activeExternalSession.invalidate(), utils.learning.get.invalidate()]);
      toast.success("بدأت جلسة المذاكرة وتم تسجيل وقت البداية.");
    },
    onError: error => toast.error(error.message || "تعذّر بدء الجلسة."),
  });
  const [markComplete, setMarkComplete] = useState(false);
  const finishSession = trpc.learning.finishExternalSession.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.learning.activeExternalSession.invalidate(), utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(), utils.dashboard.summary.invalidate(),
      ]);
      toast.success(result.lessonMarkedCompleted ? "انتهت الجلسة وتم تحديث تقدم الدرس." : "انتهت الجلسة وتم حفظ مدتها.");
      setMarkComplete(false);
    },
    onError: error => toast.error(error.message || "تعذّر إنهاء الجلسة."),
  });

  const [now, setNow] = useState(Date.now());
  const session = (activeSessionQuery.data ?? null) as ExternalSession | null;
  const sessionInfo = useMemo(() => sessionLesson(session), [session]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session?.sessionId]);

  const priority = useMemo<Priority | null>(() => {
    const gaps = ((learning.data as any)?.gapByBranch ?? {}) as Record<string, Record<string, any>>;
    const lessonStateByBranch = ((learning.data as any)?.lessonStateByBranch ?? {}) as Record<string, Record<string, any>>;
    const candidates = Object.entries(gaps).flatMap(([subjectId, subjectGaps]) =>
      getSIECheckpointProgressBranches(subjectId).flatMap(branch => {
        const gap = subjectGaps[branch.branchId];
        if (gap?.referencePosition === null || gap?.referencePosition === undefined) return [];
        const lessonState = lessonStateByBranch[subjectId]?.[branch.branchId];
        const stateBacklog = lessonState && Number(lessonState.lessonStateModelVersion ?? 0) >= 1
          ? Number(lessonState.teacherCoveredNotStudiedCount || 0) + Number(lessonState.teacherCoveredNeedsReviewCount || 0)
          : null;
        const backlogCount = stateBacklog !== null
          ? stateBacklog
          : gap?.status === "calculated" && typeof gap.gapCount === "number" ? gap.gapCount : 0;
        if (backlogCount <= 0) return [];
        const byNode = (lessonState?.byNode ?? {}) as Record<string, string>;
        const teacherCovered = branch.choices.slice(0, gap.referencePosition);
        const next = teacherCovered.find(choice =>
          byNode[choice.nodeId] === "not_watched"
          || byNode[choice.nodeId] === "watched_only"
          || byNode[choice.nodeId] === "needs_review"
        ) ?? (typeof gap.studentPosition === "number" ? branch.choices[gap.studentPosition] : undefined);
        return [{
          subjectId, subjectName: getSIESubject(subjectId)?.nameAr ?? subjectId,
          branchId: branch.branchId, branchTitle: branch.branchId === "ARB_READING" ? "نصوص الوحدة" : branch.branchTitle, gapCount: backlogCount,
          pointLabel: branch.branchType === "official_section" ? "موضوع" : "درس",
          nextLesson: next ? { nodeId: next.nodeId, title: next.title } : null,
          ratio: gap.referencePosition > 0 ? backlogCount / gap.referencePosition : 0,
        }];
      })
    );
    const first = candidates.sort((a, b) => b.ratio - a.ratio)[0];
    return first ? {
      subjectId: first.subjectId, subjectName: first.subjectName, branchId: first.branchId,
      branchTitle: first.branchTitle, gapCount: first.gapCount, pointLabel: first.pointLabel,
      nextLesson: first.nextLesson,
      source: "progress" as const,
    } : null;
  }, [learning.data]);

  const mappedOpenTasks = useMemo(() => {
    const subjectIds = profile.data?.subjectIds ?? [];
    return (tasksQuery.data ?? [])
      .filter((task: any) => task.status === "todo")
      .flatMap((task: any) => {
        const match = matchSIECheckpointTask(subjectIds, [task.title, task.notes || ""].join(" "));
        if (!match) return [];
        const branch = getSIECheckpointProgressBranches(match.subjectId)
          .find(item => item.branchId === match.branchId);
        const gap = (learning.data as any)?.gapByBranch?.[match.subjectId]?.[match.branchId];
        if (!branch || typeof gap?.studentPosition !== "number") return [];
        const topicIndex = branch.choices.findIndex(item => item.nodeId === match.nodeId);
        if (topicIndex < 0) return [];
        return [{
          task,
          match,
          branch,
          gap,
          topicIndex,
          isNext: topicIndex === gap.studentPosition,
          isAlreadyCompleted: topicIndex < gap.studentPosition,
        }];
      });
  }, [tasksQuery.data, profile.data?.subjectIds, learning.data]);

  const taskPriority = useMemo<Priority | null>(() => {
    const candidates = mappedOpenTasks.filter(item => item.isNext);
    candidates.sort((left, right) => {
      const urgency = (value: string) => value === "high" ? 3 : value === "medium" ? 2 : 1;
      const byPriority = urgency(right.task.priority || "medium") - urgency(left.task.priority || "medium");
      if (byPriority) return byPriority;
      const leftDue = left.task.dueAt ? new Date(left.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const rightDue = right.task.dueAt ? new Date(right.task.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return leftDue - rightDue;
    });
    const item = candidates[0];
    if (!item) return null;
    return {
      subjectId: item.match.subjectId,
      subjectName: getSIESubject(item.match.subjectId)?.nameAr ?? item.match.subjectId,
      branchId: item.match.branchId,
      branchTitle: item.match.branchTitle,
      gapCount: item.gap.gapCount ?? 0,
      pointLabel: item.branch.branchType === "official_section" ? "موضوع" : "درس",
      nextLesson: { nodeId: item.match.nodeId, title: item.match.title },
      source: "task",
      priority: item.task.priority ?? "medium",
      taskId: item.task.id,
      taskTitle: item.task.title,
      priorityReason: "مهمة موجودة بالفعل في قائمة مهامك ومرتبطة بالموضوع التالي في هذا الفرع.",
    };
  }, [mappedOpenTasks]);

  const nextTopicInTaskBranch = useMemo<Priority | null>(() => {
    const candidates = mappedOpenTasks.flatMap(item => {
      if (!item.isAlreadyCompleted) return [];
      const nextChoice = item.branch.choices[item.gap.studentPosition];
      if (!nextChoice) return [];
      return [{
        subjectId: item.match.subjectId,
        subjectName: getSIESubject(item.match.subjectId)?.nameAr ?? item.match.subjectId,
        branchId: item.match.branchId,
        branchTitle: item.match.branchTitle,
        gapCount: item.gap.gapCount ?? 0,
        pointLabel: item.branch.branchType === "official_section" ? "موضوع" : "درس",
        nextLesson: { nodeId: nextChoice.nodeId, title: nextChoice.title },
        source: "progress" as const,
        priority: item.task.priority ?? "medium",
        priorityReason: "وجدنا مهمة مفتوحة لموضوع مسجل بالفعل كمكتمل؛ لم نعد إسنادها. الأولوية تنتقل للموضوع التالي في نفس الفرع.",
      }];
    });
    candidates.sort((left, right) => {
      const urgency = (value?: string) => value === "high" ? 3 : value === "medium" ? 2 : 1;
      return urgency(right.priority) - urgency(left.priority);
    });
    return candidates[0] ?? null;
  }, [mappedOpenTasks]);

  const dailyPlanPriority = useMemo<Priority | null>(() => {
    const steps = dailyPlan.data?.plan?.steps ?? [];
    const subjectIds = profile.data?.subjectIds ?? [];
    for (const step of steps as any[]) {
      const curriculumNodeIds = Array.isArray(step.curriculumNodeIds) ? step.curriculumNodeIds : [];
      for (const subjectId of subjectIds) {
        for (const branch of getSIECheckpointProgressBranches(subjectId)) {
          const gap = (learning.data as any)?.gapByBranch?.[subjectId]?.[branch.branchId];
          if (typeof gap?.studentPosition !== "number" || gap.referencePosition === null
            || gap.referencePosition <= gap.studentPosition) continue;
          const nextChoice = branch.choices[gap.studentPosition];
          if (!nextChoice || !curriculumNodeIds.includes(nextChoice.nodeId)) continue;
          return {
            subjectId,
            subjectName: getSIESubject(subjectId)?.nameAr ?? subjectId,
            branchId: branch.branchId,
            branchTitle: branch.branchId === "ARB_READING" ? "نصوص الوحدة" : branch.branchTitle,
            gapCount: gap.gapCount ?? 0,
            pointLabel: branch.branchType === "official_section" ? "موضوع" : "درس",
            nextLesson: { nodeId: nextChoice.nodeId, title: nextChoice.title },
            source: "daily_plan",
            priority: step.priority ?? "medium",
            priorityScore: typeof step.priorityScore === "number" ? step.priorityScore : undefined,
            priorityReason: step.priorityReason,
          };
        }
      }
    }
    return null;
  }, [dailyPlan.data, profile.data?.subjectIds, learning.data]);

  const activePriority = taskPriority ?? nextTopicInTaskBranch ?? (dailyPlan.data?.needsRefresh
    ? priority ?? dailyPlanPriority
    : dailyPlanPriority ?? priority);
  const completedTaskProgressConflicts = mappedOpenTasks.filter(item => item.isAlreadyCompleted);

  const teacherScheduleAnnouncements = useMemo(() => {
    const selection = (profile.data?.selection ?? {}) as Record<string, any>;
    const updates = Array.isArray(selection.teacherPublicUpdates) ? selection.teacherPublicUpdates : [];
    return updates
      .filter((update: any) =>
        update.confidence === "high"
        && ["lecture_cancelled", "class_suspended", "schedule_changed"].includes(update.announcementType)
      )
      .sort((left: any, right: any) => Date.parse(String(right.publishedAt)) - Date.parse(String(left.publishedAt)))
      .slice(0, 4) as Array<{
        externalId: string;
        teacherId: string;
        teacherName: string;
        sourceType: "youtube" | "facebook";
        title: string;
        description: string;
        url: string;
        publishedAt: string;
        announcementType: "lecture_cancelled" | "class_suspended" | "schedule_changed";
        confidence: "high";
        affectedDate?: string;
      }>;
  }, [profile.data?.selection]);

  const plan = dailyPlan.data?.plan;
  const tasks = summary.data?.tasks ?? [];
  const taskCount = summary.data?.taskStats.total ?? 0;
  const completed = summary.data?.taskStats.completed ?? 0;
  const remaining = summary.data?.taskStats.remaining ?? 0;
  const completion = taskCount ? Math.round(completed / taskCount * 100) : 0;
  const startedAt = session?.startedAt ? Date.parse(session.startedAt) : NaN;
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const firstName = profile.data?.studentName?.trim().split(/\s+/)[0] || user?.name?.trim().split(/\s+/)[0] || "بك";

  const openStudySteps = (subjectId: string, branchId: string, lessonId: string) => {
    const params = new URLSearchParams({ subject: subjectId, branch: branchId, lesson: lessonId });
    setLocation("/sq3r?" + params.toString());
  };
  const finishCurrentSession = () => {
    if (session) finishSession.mutate({ sessionId: session.sessionId, markLessonCompleted: markComplete });
  };

  const welcomeGuide = [
    {
      title: "خلّي StudyFlow يعرف نظامك الدراسي",
      body: "من الملف الدراسي اختار الصف والمسار والمواد والمدرس لكل مادة، وسجّل مواعيد المحاضرات الأسبوعية أو حدّد إن المواعيد غير ثابتة. تقدر تعدّل البيانات دي في أي وقت.",
      action: "فتح الملف الدراسي",
      path: "/settings",
      icon: GraduationCap,
    },
    {
      title: "سجّل آخر نقطة وصلت لها",
      body: "في صفحة المذاكرة اختار المادة والوحدة، وبعدها حدّد آخر موضوع أنهيته وموضع المدرس. المنصة تحسب المتراكم داخل كل فرع وتبدأ من الموضوع التالي، وتقدر تفتح تفاصيل الدروس وقت ما تحتاج.",
      action: "فتح المذاكرة والتقدم",
      path: "/study",
      icon: BookOpenText,
    },
    {
      title: "خلّي الخطة ترتّب القديم والجديد",
      body: "الخطة الذكية توازن بين المهام المتراكمة والاستعداد للمحاضرة القادمة حسب جدول المدرس. تقدر تختار التركيز على المتراكم أو مواكبة المدرس، وتراجع التوزيع قبل اعتماد المهام.",
      action: "فتح خطة المذاكرة",
      path: "/planner",
      icon: Sparkles,
    },
    {
      title: "ابدأ من خطوة واحدة",
      body: "لو فيه مهمة جاهزة ابدأ بها من مساحة اليوم. سجّل جلسة المذاكرة، وحدّث تقدم الدرس بعد ما تخلص. لو المدرس أعلن تغييرًا واضحًا في الموعد، المنصة تستخدم الإعلان في إعادة ترتيب الخطة.",
      action: "ابدأ من مساحة اليوم",
      path: "/",
      icon: Play,
    },
  ];
  const finishWelcomeGuide = (path?: string) => {
    completeWelcomeGuide.mutate(undefined, {
      onSuccess: () => {
        if (path && path !== "/") setLocation(path);
      },
    });
  };

  return (
    <DashboardLayout
      title="مساحة اليوم"
      description="اعرف أولويتك، ابدأ المذاكرة، وتابع تقدمك من مكان واحد."
      action={<Button onClick={() => setLocation("/planner")} className="gap-2 rounded-xl"><Sparkles className="size-4" />خطة المذاكرة</Button>}
    >
      <div className="space-y-6 pb-6">
        <header className="sf-home-greeting flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{cairoDate()}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">أهلًا {firstName}، نبدأ بإيه النهارده؟</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              ابدأ بخطوة واحدة واضحة. خطتك ومهامك وتقدمك موجودين هنا من غير ما تحتاج تدور بينهم.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { setWelcomeGuideStep(0); setShowWelcomeGuide(true); }}>
              <Compass className="size-4" /> دليل البداية
            </Button>
            <Badge variant="outline" className="rounded-full px-3 py-1.5 text-xs">مساحتك الدراسية</Badge>
          </div>
        </header>

        {teacherScheduleAnnouncements.length > 0 && (
          <section className="overflow-hidden rounded-[1.6rem] border border-[#C9ED62]/25 bg-[#141B12] text-[#F1F0E8] shadow-[0_24px_70px_-48px_rgba(0,0,0,.8)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[#C9ED62]/15 text-[#C9ED62]"><CalendarDays className="size-4" /></span>
                <div><h3 className="text-sm font-bold">تحديثات مهمة من المدرسين</h3><p className="mt-0.5 text-[10px] text-[#AAB09E]">إعلانات عامة واضحة تم التحقق من نوعها</p></div>
              </div>
              <Badge className="rounded-full border border-[#C9ED62]/25 bg-[#C9ED62]/10 text-[#DCE8B7]">{teacherScheduleAnnouncements.length} جديد</Badge>
            </div>
            <div className="divide-y divide-white/10">
              {teacherScheduleAnnouncements.map(update => (
                <article key={update.externalId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#C9ED62]">{update.announcementType === "lecture_cancelled" ? "إلغاء محاضرة" : update.announcementType === "class_suspended" ? "توقف / راحة من المحاضرات" : "تغيير موعد محاضرة"} · {update.teacherName}</p>
                    <p className="mt-1 text-sm font-bold">{update.title}</p>
                    {update.description && update.description !== update.title && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#B9C1AF]">{update.description}</p>}
                    {update.affectedDate && <p className="mt-1 text-[10px] text-[#AAB09E]">التاريخ المذكور: {update.affectedDate}</p>}
                  </div>
                  <a href={update.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#C9ED62]/25 bg-white/[.04] px-3 py-2 text-[11px] font-bold text-[#DCE8B7] hover:bg-white/[.08]">فتح المصدر <ArrowLeft className="size-3" /></a>
                </article>
              ))}
            </div>
          </section>
        )}

        {summary.isError && <QueryErrorNotice onRetry={() => void summary.refetch()} label="تعذّر تحميل مهامك. أعد المحاولة؛ بياناتك لم تُحذف." />}
        {learning.isError && <QueryErrorNotice onRetry={() => void learning.refetch()} label="تعذّر تحميل تقدم المنهج. يمكنك متابعة مهامك أثناء إعادة المحاولة." />}
        {dailyPlan.isError && <QueryErrorNotice onRetry={() => void dailyPlan.refetch()} label="تعذّر تحميل خطة اليوم." />}
        {completedTaskProgressConflicts.length > 0 && (
          <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.045] p-4">
            <h3 className="text-sm font-bold">فيه مهام مرتبطة بموضوعات مسجلة كمكتملة</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">المهمة المفتوحة لا تعني أن الموضوع مكتمل، وموضع التقدم لا يتغير بمجرد وجود مهمة. راجع الموضع أو حالة المهمة حتى لا تتعارض البيانات.</p>
            <div className="mt-2 space-y-1">
              {completedTaskProgressConflicts.slice(0,3).map(item => (
                <p key={item.task.id} className="text-xs">{item.task.title} — {item.match.title}</p>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={() => setLocation("/study")}>مراجعة مواضع التقدم</Button>
          </section>
        )}

        {session && (
          <section className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Timer className="size-5" /></span>
                <div><p className="text-sm font-bold">جلسة مذاكرة جارية</p><p className="text-xs text-muted-foreground">الوقت محسوب من بداية الجلسة</p></div>
              </div>
              <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">نشطة الآن</Badge>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{sessionInfo?.subject} · {sessionInfo?.branch}</p>
                <h3 className="mt-1 text-lg font-bold">{sessionInfo?.lesson}</h3>
                <p className="mt-1 text-sm text-muted-foreground">كمّل مذاكرتك أو افتح خطوات الفهم والاسترجاع، ثم أنهِ الجلسة لحفظ مدتها.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="rounded-xl" onClick={() => openStudySteps(session.subjectId, session.branchId, session.lessonId)}>خطوات المذاكرة <ArrowLeft className="size-4" /></Button>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <label htmlFor="mark-session-lesson" className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <input id="mark-session-lesson" type="checkbox" checked={markComplete} onChange={event => setMarkComplete(event.target.checked)} className="size-4 accent-primary" />
                      سجّل الدرس كمكتمل
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex min-w-[175px] flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-background p-4">
                <span className="text-xs font-medium text-muted-foreground">الوقت المنقضي</span>
                <strong dir="ltr" className="font-mono text-3xl font-bold tabular-nums">{durationLabel(elapsed)}</strong>
                <Button onClick={finishCurrentSession} disabled={finishSession.isPending} className="w-full rounded-xl">
                  {finishSession.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}إنهاء الجلسة
                </Button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
          <section className="sf-next-action-card relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-primary/50 to-transparent" />
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Target className="size-4" />أولويتك الدراسية</div>
                {activePriority && (
                  activePriority.source === "task"
                    ? <Badge variant="secondary">مهمة مفتوحة مرتبطة بالموضوع التالي</Badge>
                    : activePriority.source === "daily_plan"
                      ? <Badge variant="secondary">من خطة اليوم · {activePriority.priority === "critical" ? "عاجلة" : activePriority.priority === "high" ? "عالية" : activePriority.priority === "low" ? "مرنة" : "متوسطة"}</Badge>
                      : <Badge variant="secondary">{activePriority.gapCount} {activePriority.pointLabel} في الفجوة</Badge>
                )}
              </div>
              {learning.isLoading || (dailyPlan.isLoading && !priority) ? (
                <div className="mt-8 space-y-3"><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="h-8 w-3/4 animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /></div>
              ) : activePriority?.nextLesson ? (
                <>
                  <p className="mt-6 text-xs font-semibold text-muted-foreground">{activePriority.subjectName} · {activePriority.branchTitle}</p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{activePriority.nextLesson.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    {activePriority.source === "task"
                      ? "لديك مهمة مفتوحة بالفعل لهذا الموضوع؛ سنوجّهك إلى المهمة الموجودة بدل إنشاء نسخة مكررة."
                      : "دي الخطوة التالية حسب موضعك المسجل وموضع التدريس. ابدأ جلسة، وبعدها حدّث تقدمك الفعلي."}
                  </p>
                  {activePriority.priorityReason && (
                    <p className="mt-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs leading-6 text-muted-foreground">
                      سبب ترتيبها: {activePriority.priorityReason}
                      {activePriority.priorityScore !== undefined ? " · " + activePriority.priorityScore + "/100" : ""}
                    </p>
                  )}
                  {activePriority.taskTitle && <p className="mt-2 text-xs text-muted-foreground">المهمة المسجلة: {activePriority.taskTitle}</p>}
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button
                      onClick={() => startSession.mutate({ subjectId: activePriority.subjectId, branchId: activePriority.branchId, lessonId: activePriority.nextLesson!.nodeId })}
                      disabled={Boolean(session) || startSession.isPending}
                      className="rounded-xl px-5"
                    >
                      {startSession.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                      {session ? "أنهِ الجلسة الحالية أولًا" : "ابدأ جلسة مذاكرة"}
                    </Button>
                    {activePriority.taskId && <Button variant="outline" onClick={() => setLocation("/tasks")} className="rounded-xl">فتح المهمة الموجودة</Button>}
                    <Button variant="outline" onClick={() => openStudySteps(activePriority.subjectId, activePriority.branchId, activePriority.nextLesson!.nodeId)} className="rounded-xl">افتح تقدم الموضوع</Button>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-2xl bg-muted/45 p-5">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-background text-primary"><GraduationCap className="size-5" /></span>
                  <h3 className="mt-4 text-lg font-bold">لسه مفيش أولوية محسوبة</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">سجّل آخر موضوع وصلت له وموضع المدرس في المادة علشان نحدد الخطوة التالية بدقة.</p>
                  <Button variant="outline" onClick={() => setLocation("/study")} className="mt-4 rounded-xl">تحديث تقدمك الدراسي <ArrowLeft className="size-4" /></Button>
                </div>
              )}
            </div>
          </section>

          <section className="sf-progress-card rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4 text-primary" />إنجازك</div>
              <span className="text-xs text-muted-foreground">{completion}%</span>
            </div>
            <div className="mt-5 flex items-end gap-2"><strong className="text-4xl font-bold tabular-nums">{completed}</strong><span className="pb-1 text-sm text-muted-foreground">من {taskCount} مهمة مكتملة</span></div>
            <Progress value={completion} className="mt-4 h-2" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">متبقي</p><strong className="mt-1 block text-xl font-bold tabular-nums">{remaining}</strong></div>
              <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">أهداف نشطة</p><strong className="mt-1 block text-xl font-bold tabular-nums">{summary.data?.goalStats.active ?? "—"}</strong></div>
            </div>
            <Button variant="ghost" className="mt-4 w-full justify-between rounded-xl" onClick={() => setLocation("/tasks")}>عرض كل المهام <ArrowLeft className="size-4" /></Button>
          </section>
        </div>

        <section className="sf-daily-plan-card overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div><p className="text-xs font-semibold text-muted-foreground">تخطيط تلقائي</p><h3 className="mt-1 text-lg font-bold">{plan?.title ?? "خطة المذاكرة"}</h3></div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setLocation("/planner")}>تفاصيل الخطة <ArrowLeft className="size-4" /></Button>
          </div>
          {dailyPlan.isLoading ? (
            <div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /></div>
          ) : plan ? (
            <div className="p-5 sm:p-6">
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {plan.steps.slice(0, 3).map((step: any, index: number) => (
                  <article key={index} className="rounded-2xl border border-border/75 bg-background p-4">
                    <div className="flex items-center justify-between gap-2"><Badge variant="secondary" className="max-w-[70%] truncate">{step.category}</Badge></div>
                    <h4 className="mt-3 font-semibold leading-6">{step.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">{step.detail}</p>
                  </article>
                ))}
              </div>
              {dailyPlan.data?.needsRefresh && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5">
                  <p className="text-xs leading-5 text-muted-foreground">تغير تقدمك أو مهامك منذ آخر إنشاء للخطة؛ الأولوية القديمة لن تُعرض باعتبارها الحالية.</p>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => ensurePlan.mutate()} disabled={ensurePlan.isPending}>
                    {ensurePlan.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    تحديث خطة اليوم
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 p-5 sm:p-6">
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {profile.data?.subjectIds?.length
                  ? "لا توجد خطة معتمدة حاليًا. افتح خطة المذاكرة لتكوين المقترح ومراجعته؛ بعد اعتماده ستظهر خطواته ومهامه هنا."
                  : "أكمل المواد ومواعيد المحاضرات في ملفك الدراسي؛ بعدها ستتكوّن خطة المذاكرة تلقائيًا عند دخولك."}
              </p>
              {profile.data?.subjectIds?.length ? (
                <Button onClick={() => setLocation("/planner")} variant="outline" className="rounded-xl">
                  إنشاء خطة المذاكرة <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => setLocation("/settings/academic")} variant="outline" className="rounded-xl">
                  إكمال الملف الدراسي <ArrowLeft className="size-4" />
                </Button>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
          <section className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div><p className="text-xs font-semibold text-muted-foreground">ابدأ بالتنفيذ</p><h3 className="mt-1 text-lg font-bold">المهام القادمة</h3></div>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")}>الكل <ArrowLeft className="size-4" /></Button>
            </div>
            <div className="divide-y divide-border/70">
              {summary.isLoading ? (
                <div className="space-y-3 p-5"><div className="h-5 w-3/4 animate-pulse rounded bg-muted" /><div className="h-5 w-1/2 animate-pulse rounded bg-muted" /></div>
              ) : tasks.length ? tasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-4">
                  <button type="button" onClick={() => toggleTask.mutate({ id: task.id, done: true })} disabled={toggleTask.isPending} aria-label={"إكمال " + task.title} className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"><Check className="size-3.5" /></button>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.category || "مهمة دراسية"} · {dueLabel(task.dueAt)}</p></div>
                  <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="shrink-0">{task.priority === "high" ? "مهمة" : task.priority === "medium" ? "متوسطة" : "مرنة"}</Badge>
                </div>
              )) : (
                <div className="p-5 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-600" /><p className="mt-2 font-semibold">مفيش مهام معلّقة</p><p className="mt-1 text-xs text-muted-foreground">راجع خطتك أو أضف مهمة جديدة.</p></div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold"><Compass className="size-4 text-primary" />وصول سريع</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "خريطة المنهج", description: "المواد والدروس", path: "/learning-map", icon: GraduationCap },
                { label: "المساعد الدراسي", description: "اسأل وافهم", path: "/assistant", icon: MessageCircle },
                { label: "مكتبتك", description: "الكتب والمصادر", path: "/books", icon: BookOpenText },
                { label: "التقويم", description: "مواعيدك", path: "/calendar", icon: CalendarDays },
              ].map(item => (
                <button key={item.path} type="button" onClick={() => setLocation(item.path)} className="group rounded-2xl border border-border bg-background p-3 text-right transition hover:border-primary/40 hover:bg-muted/45">
                  <item.icon className="size-5 text-primary" /><span className="mt-3 block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-[11px] text-muted-foreground">{item.description}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-muted/45 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-primary" />ملفك الدراسي</div>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{profile.data ? String(profile.data.subjectIds.length) + " مواد داخل مسارك الدراسي." : "جارٍ تحميل ملفك الدراسي."}</p>
              <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => setLocation("/settings")}>إدارة الملف <ArrowLeft className="size-4" /></Button>
            </div>
          </section>
        </div>
      </div>
        <AnimatePresence>
          {showWelcomeGuide && (
            <motion.div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-[#070A06]/75 p-4 backdrop-blur-md"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              role="dialog" aria-modal="true" aria-labelledby="welcome-guide-title"
              onClick={event => { if (event.target === event.currentTarget) setShowWelcomeGuide(false); }}
            >
              <motion.section
                className="relative w-full max-w-xl overflow-hidden rounded-[1.8rem] border border-[#C9ED62]/25 bg-[#151C13] text-[#F1F0E8] shadow-[0_40px_130px_-45px_rgba(0,0,0,.95)]"
                initial={{ opacity: 0, y: 28, scale: .96, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 16, scale: .98, filter: "blur(6px)" }}
                transition={{ duration: .38, ease: [.22, 1, .36, 1] }}
              >
                <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[#C9ED62]/10 blur-3xl" />
                <header className="relative flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.2em] text-[#C9ED62]">YOUR FIRST 4 STEPS</p>
                    <h2 id="welcome-guide-title" className="mt-2 text-xl font-bold sm:text-2xl">أهلاً بك في StudyFlow</h2>
                    <p className="mt-1 text-xs leading-6 text-[#AAB09E]">دليل عملي سريع يوضح تبدأ منين وإزاي تخلي المنصة تشتغل معاك.</p>
                  </div>
                  <button type="button" onClick={() => finishWelcomeGuide()} className="rounded-lg px-2 py-1 text-xs text-[#AAB09E] transition hover:bg-white/10 hover:text-white">تخطي</button>
                </header>
                <div className="relative px-5 py-6 sm:px-7">
                  <div className="mb-5 flex items-center gap-2">
                    {welcomeGuide.map((item, index) => (
                      <button type="button" key={item.title} onClick={() => setWelcomeGuideStep(index)}
                        aria-label={"الخطوة " + (index + 1)}
                        className={"h-1.5 flex-1 rounded-full transition-all duration-300 " + (index <= welcomeGuideStep ? "bg-[#C9ED62]" : "bg-white/15")} />
                    ))}
                    <span className="mr-1 text-[10px] tabular-nums text-[#AAB09E]">{welcomeGuideStep + 1}/4</span>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {(() => {
                      const step = welcomeGuide[welcomeGuideStep];
                      const StepIcon = step.icon;
                      return (
                        <motion.div key={welcomeGuideStep}
                          initial={{ opacity: 0, x: 18, filter: "blur(4px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: -18, filter: "blur(4px)" }}
                          transition={{ duration: .27, ease: "easeOut" }}
                        >
                          <div className="flex size-14 items-center justify-center rounded-2xl border border-[#C9ED62]/25 bg-[#C9ED62]/10 text-[#C9ED62]">
                            <StepIcon className="size-7" />
                          </div>
                          <h3 className="mt-5 text-xl font-bold leading-8">{step.title}</h3>
                          <p className="mt-3 text-sm leading-8 text-[#C0C7B4]">{step.body}</p>
                          <Button type="button" variant="outline" className="mt-5 rounded-xl border-[#C9ED62]/30 bg-white/[.04] text-[#DCE8B7] hover:bg-white/[.08] hover:text-white"
                            onClick={() => { setShowWelcomeGuide(false); completeWelcomeGuide.mutate(undefined, { onSuccess: () => setLocation(step.path) }); }}>
                            {step.action} <ArrowLeft className="size-4" />
                          </Button>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>
                <footer className="relative flex items-center justify-between border-t border-white/10 px-5 py-4 sm:px-7">
                  <Button type="button" variant="ghost" className="text-[#C0C7B4] hover:bg-white/10 hover:text-white"
                    disabled={welcomeGuideStep === 0} onClick={() => setWelcomeGuideStep(value => Math.max(0, value - 1))}>
                    السابق
                  </Button>
                  {welcomeGuideStep < welcomeGuide.length - 1 ? (
                    <Button type="button" className="rounded-xl bg-[#C9ED62] text-[#111510] hover:bg-[#D8F27C]" onClick={() => setWelcomeGuideStep(value => Math.min(welcomeGuide.length - 1, value + 1))}>
                      التالي <ArrowLeft className="size-4" />
                    </Button>
                  ) : (
                    <Button type="button" className="rounded-xl bg-[#C9ED62] text-[#111510] hover:bg-[#D8F27C]" disabled={completeWelcomeGuide.isPending}
                      onClick={() => finishWelcomeGuide()}>
                      {completeWelcomeGuide.isPending ? "جارٍ الحفظ..." : "إنهاء الدليل"}
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                </footer>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
    </DashboardLayout>
  );
}
