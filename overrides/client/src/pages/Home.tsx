import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import ExamMissionScene from "@/components/ExamMissionScene";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { getNextOpenPlanStep } from "@/lib/plan-actions";
import { getPlannerStepCurriculum } from "@/lib/planner-curriculum";
import { displayCurriculumTitle } from "@/lib/curriculum-display";
import { CAIRO_BAC_EXAM_CALENDAR_NOTICE, getUpcomingCairoSecondYearBaccalaureateExams } from "@shared/cairo-baccalaureate-exam-calendar";
import { getSIEStudentVisibleBranches, getSIECheckpointProgressBranches, getSIESubject, matchSIECheckpointTask, normalizeSIECheckpointFrontier } from "@shared/sie-catalog";
import { formatTime12Hour, getCalendarDaysBetween, getDateKeyInTimeZone } from "@shared/date-time";
import {
  ArrowLeft, BarChart3, BookOpenText, CalendarDays, Check, CheckCircle2, Clock3,
  Compass, GraduationCap, ListChecks, Loader2, MessageCircle,
  Play, RefreshCw, Sparkles, Target, Timer, X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useServerClock } from "@/lib/server-clock";

type Priority = {
  subjectId: string; subjectName: string; branchId: string; branchTitle: string;
  gapCount: number; pointLabel: string; nextLesson: { nodeId: string; title: string } | null;
  source?: "daily_plan" | "progress" | "task";
  priority?: string;
  priorityScore?: number;
  priorityReason?: string;
  taskId?: number;
  taskTitle?: string;
  planStepTitle?: string;
  planStepDetail?: string;
  planStepCategory?: string;
};
type ExternalSession = {
  sessionId: string; subjectId: string; branchId: string; lessonId: string;
  startedAt: string; status: "active" | "completed";
};

const cairoDate = (value: Date | null) => value
  ? new Intl.DateTimeFormat("ar-EG", {
      weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo",
    }).format(value)
  : "جارٍ مزامنة التاريخ والوقت من الخادم";

function durationLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60];
  return parts.map(part => String(part).padStart(2, "0")).join(":");
}

function dueLabel(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { now: serverNow, status: serverClockStatus, refresh: refreshServerClock } = useServerClock();
  const summary = trpc.dashboard.summary.useQuery({ timeZone: "Africa/Cairo" }, { enabled: Boolean(user) && !authLoading });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { enabled: Boolean(user) && !authLoading });
  const learning = trpc.learning.get.useQuery(undefined, { enabled: Boolean(user) && !authLoading });
  const profile = trpc.studentProfile.get.useQuery(undefined, { enabled: Boolean(user) && !authLoading });
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [welcomeGuideStep, setWelcomeGuideStep] = useState(0);
  const completeWelcomeGuide = trpc.studentProfile.completeWelcomeGuide.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      setShowWelcomeGuide(false);
    },
    onError: error => toast.error(error.message || "تعذّر حفظ إكمال إزاي تبدأ؟."),
  });
  const dailyPlan = trpc.plans.currentDaily.useQuery(undefined, {
    enabled: Boolean(user) && !authLoading,
    staleTime: 10_000,
    refetchInterval: query => query.state.data?.needsRefresh ? 1_500 : !query.state.data?.plan ? 15_000 : 180_000,
    refetchOnWindowFocus: true, retry: 1,
  });
  const activeSessionQuery = trpc.learning.activeExternalSession.useQuery(undefined, {
    enabled: Boolean(user) && !authLoading,
    refetchInterval: query => query.state.data ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const selection = (profile.data?.selection ?? {}) as Record<string, any>;
    if (profile.isSuccess && profile.data
      && !selection.welcomeGuideCompletedAt
      && Number(selection.setupCoachmarkVersion ?? 0) < 1) {
      setShowWelcomeGuide(true);
    }
  }, [profile.isSuccess, (profile.data?.selection as Record<string, any> | undefined)?.welcomeGuideCompletedAt]);

  // Refresh the profile after the daily-plan query finishes its automatic public teacher scan.
  useEffect(() => {
    if (dailyPlan.data?.generatedAt) void profile.refetch();
  }, [dailyPlan.data?.generatedAt]);


  const autoPlanStarted = useRef(false);
  const ensurePlan = trpc.plans.ensureDaily.useMutation({
    onSuccess: () => {
      void Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.tasks.list.invalidate(),
      ]);
    },
    onError: error => toast.error("تعذّر تجهيز خريطة المذاكرة تلقائيًا: " + error.message, { duration: 7_000 }),
  });

  useEffect(() => {
    if (autoPlanStarted.current || ensurePlan.isPending || profile.isLoading || profile.isError
      || !profile.data?.subjectIds?.length || dailyPlan.isLoading || dailyPlan.isError || !dailyPlan.data) return;
    if (dailyPlan.data.plan || dailyPlan.data.generatedAt || dailyPlan.data.needsRefresh) return;
    autoPlanStarted.current = true;
    ensurePlan.mutate({ forceRebuild: false });
  }, [
    profile.data?.subjectIds,
    profile.isLoading,
    profile.isError,
    dailyPlan.data,
    dailyPlan.isLoading,
    dailyPlan.isError,
    ensurePlan.isPending,
  ]);
  const startSession = trpc.learning.startExternalSession.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.learning.activeExternalSession.invalidate(), utils.learning.get.invalidate()]);
      toast.success("بدأت جلسة المذاكرة وتم تسجيل وقت البداية.");
    },
    onError: error => toast.error(error.message || "تعذّر بدء الجلسة."),
  });
  const [markComplete, setMarkComplete] = useState(false);
  const [showFinishSessionDialog, setShowFinishSessionDialog] = useState(false);
  const finishSession = trpc.learning.finishExternalSession.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.learning.activeExternalSession.invalidate(), utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(), utils.dashboard.summary.invalidate(),
      ]);
      toast.success(result.lessonMarkedCompleted ? "انتهت الجلسة وتم تحديث تقدم الدرس." : "انتهت الجلسة وتم حفظ مدتها.");
      setMarkComplete(false);
      setShowFinishSessionDialog(false);
    },
    onError: error => toast.error(error.message || "تعذّر إنهاء الجلسة."),
  });

  const session = (activeSessionQuery.data ?? null) as ExternalSession | null;
  const sessionInfo = useMemo(() => sessionLesson(session), [session]);

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
    const step = getNextOpenPlanStep(dailyPlan.data?.plan?.steps as any[] | undefined);
    if (!step) return null;
    const curriculumNodeIds = Array.isArray(step.curriculumNodeIds) ? step.curriculumNodeIds : [];
    const subjectIds = profile.data?.subjectIds ?? [];
    const inferredTaskMatch = curriculumNodeIds.length === 0
      ? matchSIECheckpointTask(subjectIds, [step.title, step.detail || "", step.category || ""].join(" "))
      : null;
    const orderedSubjectIds = inferredTaskMatch
      ? [inferredTaskMatch.subjectId]
      : subjectIds;
    const targetNodeIds = curriculumNodeIds.length
      ? curriculumNodeIds
      : inferredTaskMatch ? [inferredTaskMatch.nodeId] : [];
    for (const subjectId of orderedSubjectIds) {
      for (const branch of getSIECheckpointProgressBranches(subjectId)) {
        const nextChoice = branch.choices.find(choice => targetNodeIds.includes(choice.nodeId));
        if (!nextChoice) continue;
        const gap = (learning.data as any)?.gapByBranch?.[subjectId]?.[branch.branchId];
        return {
          subjectId,
          subjectName: getSIESubject(subjectId)?.nameAr ?? subjectId,
          branchId: branch.branchId,
          branchTitle: branch.branchId === "ARB_READING" ? "نصوص الوحدة" : branch.branchTitle,
          gapCount: typeof gap?.gapCount === "number" ? gap.gapCount : 0,
          pointLabel: branch.branchType === "official_section" ? "موضوع" : "درس",
          nextLesson: { nodeId: nextChoice.nodeId, title: nextChoice.title },
          source: "daily_plan",
          priority: step.priority ?? "medium",
          priorityScore: typeof step.priorityScore === "number" ? step.priorityScore : undefined,
          priorityReason: step.priorityReason ?? step.detail,
        };
      }
    }

    // A plan may begin with an open obligation that is not linked to a curriculum
    // node. Show that exact same first action instead of inventing another lesson.
    return {
      subjectId: "__PLAN_STEP__",
      subjectName: "خطة المذاكرة",
      branchId: "__PLAN_STEP__",
      branchTitle: step.category || "خطوة تنفيذ",
      gapCount: 0,
      pointLabel: "خطوة",
      nextLesson: null,
      source: "daily_plan",
      priority: step.priority ?? "medium",
      priorityScore: typeof step.priorityScore === "number" ? step.priorityScore : undefined,
      priorityReason: step.detail,
      planStepTitle: step.title,
      planStepDetail: step.detail,
      planStepCategory: step.category,
    };
  }, [dailyPlan.data?.plan?.steps, profile.data?.subjectIds, learning.data]);

  // The active daily plan is the source of truth. Do not let a separate task
  // heuristic replace its first unfinished action on the dashboard.
  const activePriority = dailyPlan.data?.needsRefresh
    ? null
    : dailyPlan.data?.plan
      ? dailyPlanPriority
      : taskPriority ?? nextTopicInTaskBranch ?? priority;
  const plan = dailyPlan.data?.plan;
  const homeStudySteps = plan?.steps ?? [];
  const homeDoneSteps = homeStudySteps.filter((step: any) =>
    step.plannerTaskStatus === "done" || step.existingTask?.status === "done"
  ).length;
  const homeStudyProgress = homeStudySteps.length ? Math.round(homeDoneSteps / homeStudySteps.length * 100) : 0;
  const homeNextStep = getNextOpenPlanStep(homeStudySteps as any[] | undefined);
  const completedMonthlyExamKeys = useMemo(() => {
    const values = ((profile.data?.selection as Record<string, any> | undefined)?.monthlyExamCompletions ?? {}) as Record<string, unknown>;
    return Object.entries(values).filter(([, completedAt]) => Boolean(completedAt)).map(([key]) => key);
  }, [profile.data?.selection]);
  const markMonthlyExamCompleted = trpc.studentProfile.markMonthlyExamCompleted.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("اتسجل انتهاء الامتحان، وشلنا بطاقته من الاختبارات القادمة.");
    },
    onError: error => toast.error(error.message || "تعذّر تسجيل انتهاء الامتحان."),
  });
  const cairoExamDate = serverNow ? getDateKeyInTimeZone(serverNow, "Africa/Cairo") : null;
  const upcomingExams = useMemo(
    () => serverNow ? getUpcomingCairoSecondYearBaccalaureateExams(profile.data, serverNow, completedMonthlyExamKeys) : [],
    [profile.data?.educationSystem, profile.data?.gradeYear, profile.data?.subjectIds, cairoExamDate, serverNow, completedMonthlyExamKeys],
  );
  const daysUntilExam = (date: string) => cairoExamDate ? Math.max(0, getCalendarDaysBetween(cairoExamDate, date)) : 0;
  const homeNextStepIndex = homeNextStep ? homeStudySteps.indexOf(homeNextStep) : -1;
  const taskCount = summary.data?.taskStats.total ?? 0;
  const completed = summary.data?.taskStats.completed ?? 0;
  const remaining = summary.data?.taskStats.remaining ?? 0;
  const completion = taskCount ? Math.round(completed / taskCount * 100) : 0;
  const startedAt = session?.startedAt ? Date.parse(session.startedAt) : NaN;
  const elapsed = serverNow && Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((serverNow.getTime() - startedAt) / 1000))
    : 0;
  const firstName = profile.data?.studentName?.trim().split(/\s+/)[0] || user?.name?.trim().split(/\s+/)[0] || "بك";

  const openStudySteps = (subjectId: string, branchId: string, lessonId: string) => {
    const params = new URLSearchParams({ subject: subjectId, branch: branchId, lesson: lessonId });
    setLocation("/sq3r?" + params.toString());
  };
  const finishCurrentSession = () => {
    if (session) setShowFinishSessionDialog(true);
  };
  const confirmFinishCurrentSession = () => {
    if (session) finishSession.mutate({ sessionId: session.sessionId, markLessonCompleted: markComplete });
  };
  const finishTimeLabel = serverNow ? formatTime12Hour(serverNow, "ar-EG", "Africa/Cairo") : "—";

  const welcomeGuide = [
    {
      title: "سجّل بياناتك الدراسية",
      body: "اختار الصف والمسار والمواد، ثم حدّد مدرس كل مادة ومواعيد حصصه. تقدر تعدّل البيانات دي لاحقًا.",
      action: "فتح الملف الدراسي",
      path: "/settings",
      icon: GraduationCap,
    },
    {
      title: "حدّد موضعك وموضع المدرس",
      body: "اختار آخر درس ذاكرته، وسجّل آخر درس شرحه المدرس لو تعرفه. هنفصل بين تقدمك الشخصي وبين مرجع المدرس.",
      action: "فتح المذاكرة والتقدم",
      path: "/study",
      icon: BookOpenText,
    },
    {
      title: "راجع أولويات خطتك",
      body: "الخطة ترتّب المتراكم والدروس الجديدة حسب الأولوية والاختبارات ومواعيد المدرسين. راجع التوزيع قبل اعتماده.",
      action: "فتح خطة المذاكرة",
      path: "/planner",
      icon: Sparkles,
    },
    {
      title: "ابدأ من خريطة اليوم",
      body: "افتح أول خطوة مفتوحة، ذاكر من مصدرها، ثم سجّل تقدمك بعد ما تخلص. بعد الحصة هنطلب منك تأكيد ما شرحه المدرس عند الحاجة.",
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
            <p className="text-sm font-medium text-muted-foreground">{cairoDate(serverNow)}</p>
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

        {summary.isError && <QueryErrorNotice onRetry={() => void summary.refetch()} label="تعذّر تحميل مهامك. أعد المحاولة؛ بياناتك لم تُحذف." />}
        {learning.isError && <QueryErrorNotice onRetry={() => void learning.refetch()} label="تعذّر تحميل تقدم المنهج. يمكنك متابعة مهامك أثناء إعادة المحاولة." />}
        {dailyPlan.isError && <QueryErrorNotice onRetry={() => void dailyPlan.refetch()} label="تعذّر تحميل خطة اليوم." />}
        {session && (
          <section className="sf-active-study-session overflow-hidden rounded-3xl border border-primary/30 bg-primary/5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Timer className="size-5" /></span>
                <div><p className="text-sm font-bold">جلسة مذاكرة جارية</p><p className="text-xs text-muted-foreground">الوقت محسوب من بداية الجلسة</p></div>
              </div>
              <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">نشطة الآن</Badge>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{sessionInfo?.subject}</p>
                <h3 className="mt-1 text-lg font-bold">{sessionInfo?.lesson}</h3>
                <p className="mt-1 text-sm text-muted-foreground">كمّل مذاكرتك أو افتح خطوات الفهم والاسترجاع، ثم أنهِ الجلسة لحفظ مدتها.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="rounded-xl" onClick={() => openStudySteps(session.subjectId, session.branchId, session.lessonId)}>خطوات المذاكرة <ArrowLeft className="size-4" /></Button>
                  <span className="text-xs text-muted-foreground">عند الإنهاء ستختار هل الدرس اكتمل أم تحفظ الوقت فقط.</span>
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

        <AnimatePresence>
          {showFinishSessionDialog && session && (
            <motion.div
              className="sf-session-finish-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              role="presentation"
              onClick={event => {
                if (event.target === event.currentTarget && !finishSession.isPending) setShowFinishSessionDialog(false);
              }}
            >
              <motion.section
                className="sf-session-finish-dialog"
                role="dialog" aria-modal="true" aria-labelledby="sf-session-finish-title"
                initial={{ opacity: 0, y: 24, scale: .97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: .98 }}
                transition={{ duration: .22, ease: "easeOut" }}
              >
                <header className="sf-session-finish-header">
                  <div className="sf-session-finish-heading">
                    <span className="sf-session-finish-mark"><CheckCircle2 className="size-5" /></span>
                    <div>
                      <span>مراجعة الجلسة</span>
                      <h2 id="sf-session-finish-title">خلصت مذاكرتك؟</h2>
                      <p>{sessionInfo?.subject} · {sessionInfo?.lesson}</p>
                    </div>
                  </div>
                  <button type="button" className="sf-session-finish-close" aria-label="إغلاق" disabled={finishSession.isPending} onClick={() => setShowFinishSessionDialog(false)}>
                    <X className="size-4" />
                  </button>
                </header>
                <div className="sf-session-finish-stats">
                  <div><span><Clock3 className="size-4" /> الوقت المسجل</span><strong dir="ltr">{durationLabel(elapsed)}</strong></div>
                  <div><span>وقت الإنهاء</span><strong>{finishTimeLabel}</strong></div>
                </div>
                <div className="sf-session-finish-question">
                  <strong>حدّد حالة الدرس قبل الحفظ</strong>
                  <p>اختَر ما حدث فعلًا. لن نضع علامة اكتمال على الدرس من دون اختيارك.</p>
                </div>
                <div className="sf-session-finish-options" role="group" aria-label="حالة الدرس بعد الجلسة">
                  <button type="button" aria-pressed={markComplete} className={markComplete ? "is-selected" : ""} onClick={() => setMarkComplete(true)}>
                    <span className="sf-session-finish-option-icon"><CheckCircle2 className="size-5" /></span>
                    <span><b>أنهيت الدرس</b><small>احفظ الوقت وسجّل الدرس كمكتمل في تقدمك.</small></span>
                    <i>{markComplete ? <Check className="size-4" /> : null}</i>
                  </button>
                  <button type="button" aria-pressed={!markComplete} className={!markComplete ? "is-selected" : ""} onClick={() => setMarkComplete(false)}>
                    <span className="sf-session-finish-option-icon"><Timer className="size-5" /></span>
                    <span><b>احفظ الوقت فقط</b><small>احتفظ بمدة الجلسة، واترك حالة الدرس كما هي.</small></span>
                    <i>{!markComplete ? <Check className="size-4" /> : null}</i>
                  </button>
                </div>
                <footer className="sf-session-finish-footer">
                  <Button type="button" variant="outline" disabled={finishSession.isPending} onClick={() => setShowFinishSessionDialog(false)}>العودة للجلسة</Button>
                  <Button type="button" disabled={finishSession.isPending} onClick={confirmFinishCurrentSession}>
                    {finishSession.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} حفظ وإنهاء الجلسة
                  </Button>
                </footer>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

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
              {learning.isLoading || dailyPlan.isLoading ? (
                <div className="mt-8 space-y-3"><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="h-8 w-3/4 animate-pulse rounded bg-muted" /><div className="h-4 w-full animate-pulse rounded bg-muted" /></div>
              ) : dailyPlan.data?.needsRefresh ? (
                <div className="mt-6 rounded-2xl bg-muted/45 p-5">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-background text-primary"><RefreshCw className="size-5 animate-spin" /></span>
                  <h3 className="mt-4 text-lg font-bold">بنحدّث أولوياتك من بياناتك الأخيرة</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">لن نعرض درسًا قديمًا كخطوة قادمة أثناء إعادة بناء الخطة.</p>
                  <Button variant="outline" onClick={() => setLocation("/planner")} className="mt-4 rounded-xl">افتح خريطة خطة المذاكرة <ArrowLeft className="size-4" /></Button>
                </div>
              ) : activePriority?.nextLesson || activePriority?.planStepTitle ? (
                <>
                  <p className="mt-6 text-xs font-semibold text-muted-foreground">{activePriority.subjectName}</p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{activePriority.nextLesson?.title ?? activePriority.planStepTitle}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    {activePriority.source === "task"
                      ? "لديك مهمة مفتوحة بالفعل لهذا الموضوع؛ سنوجّهك إلى المهمة الموجودة بدل إنشاء نسخة مكررة."
                      : activePriority.source === "daily_plan"
                        ? activePriority.planStepDetail ?? "دي أول خطوة غير مكتملة في خطة المذاكرة الحالية."
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
                    {activePriority.nextLesson && (
                      <>
                        <Button
                          onClick={() => startSession.mutate({ subjectId: activePriority.subjectId, branchId: activePriority.branchId, lessonId: activePriority.nextLesson!.nodeId })}
                          disabled={Boolean(session) || startSession.isPending}
                          className="rounded-xl px-5"
                        >
                          {startSession.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                          {session ? "أنهِ الجلسة الحالية أولًا" : "ابدأ جلسة مذاكرة"}
                        </Button>
                        <Button variant="outline" onClick={() => openStudySteps(activePriority.subjectId, activePriority.branchId, activePriority.nextLesson!.nodeId)} className="rounded-xl">افتح تقدم الموضوع</Button>
                      </>
                    )}
                    {activePriority.taskId && <Button variant="outline" onClick={() => setLocation("/tasks")} className="rounded-xl">فتح المهمة الموجودة</Button>}
                    {activePriority.source === "daily_plan" && <Button variant="outline" onClick={() => setLocation("/planner")} className="rounded-xl">افتح الخطوة في خريطة الخطة</Button>}
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

        <section className="sf-daily-plan-card sf-home-study-map">
          <header className="sf-home-study-map-header">
            <div className="sf-home-study-map-title">
              <span>أولوياتك اليوم</span>
              <h3>خريطة مذاكرة اليوم</h3>
              </div>
            <Button variant="outline" size="sm" className="sf-home-study-map-open" onClick={() => setLocation("/planner")}>
              الخريطة الكاملة <ArrowLeft className="size-4" />
            </Button>
          </header>
          {dailyPlan.isLoading ? (
            <div className="sf-home-study-map-loading" aria-busy="true">
              <div /><div /><div />
            </div>
          ) : plan ? (
            <div className="sf-home-study-map-body">
              <div className="sf-home-study-map-summary">
                <div className="sf-home-study-map-progress">
                  <div className="sf-home-study-map-progress-copy">
                    <span>تقدم تنفيذ الخطة</span>
                    <strong>{homeDoneSteps.toLocaleString("ar-EG")} <small>من {homeStudySteps.length.toLocaleString("ar-EG")}</small></strong>
                  </div>
                  <b>{homeStudyProgress.toLocaleString("ar-EG")}%</b>
                </div>
                <Progress value={homeStudyProgress} className="sf-home-study-map-progress-rail" />
              </div>
              {homeStudySteps.length ? (
                <div className="sf-home-study-path" aria-label="تسلسل خطوات المذاكرة اليوم">
                  {homeStudySteps.slice(0, 6).map((step: any, index: number) => {
                    const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
                    const isNext = index === homeNextStepIndex;
                    const curriculum = getPlannerStepCurriculum(step, profile.data?.subjectIds ?? []);
                    const nodeId = step.curriculumNodeIds?.[0];
                    const branch = curriculum && nodeId
                      ? getSIECheckpointProgressBranches(curriculum.subjectId).find(item => item.choices.some(choice => choice.nodeId === nodeId))
                      : null;
                    const isEnglishCurriculum = curriculum?.subjectId === "ENG1_G2_BAC";
                    const unitTitle = isEnglishCurriculum ? curriculum?.unitTitle : displayCurriculumTitle(curriculum?.unitTitle);
                    const unitLabel = isEnglishCurriculum && curriculum?.unitNumber
                      ? "Unit " + curriculum.unitNumber + (unitTitle ? " — " + unitTitle : "")
                      : curriculum?.unitNumber
                        ? "الوحدة " + curriculum.unitNumber.toLocaleString("ar-EG")
                        : unitTitle || "";
                    const lessonLabel = curriculum?.subjectId === "ENG1_G2_BAC"
                      ? curriculum.branchId === "ENG_VOCABULARY" ? "Lesson 1 — Vocabulary"
                        : curriculum.branchId === "ENG_GRAMMAR" ? "Lesson " + (curriculum.lessonNumber || "2") + " — Grammar"
                          : curriculum.lessonNumber ? "Lesson " + curriculum.lessonNumber : ""
                      : curriculum?.lessonNumber ? "الدرس " + curriculum.lessonNumber : "";
                    const displayStepTitle = curriculum?.subjectId === "ENG1_G2_BAC" ? curriculum.lesson : step.title;
                    return (
                      <article key={step.plannerTaskId ?? step.existingTask?.id ?? step.sourceStepIndex ?? index}
                        className={"sf-home-study-step " + (step.examFocus ? "is-exam-focus " : "") + (isDone ? "is-done" : isNext ? "is-next" : "is-upcoming")}
                        data-testid={"home-study-step-" + index}>
                        <div className="sf-home-study-step-marker" aria-hidden="true">
                          {isDone ? <CheckCircle2 className="size-4" /> : <span>{(index + 1).toLocaleString("ar-EG")}</span>}
                        </div>
                        <div className="sf-home-study-step-content">
                          <div className="sf-home-study-step-meta">
                            <Badge variant="secondary">{step.category || "خطوة دراسية"}</Badge>
                            {typeof step.minutes === "number" && step.minutes > 0 && <span><Clock3 className="size-3.5" />{step.minutes.toLocaleString("ar-EG")} دقيقة</span>}
                            {step.day && <span>{step.day}</span>}
                            {isDone ? <strong>مكتملة</strong> : isNext ? <strong>ابدأ من هنا</strong> : <span>قادمة</span>}
                          </div>
                          {(unitLabel || lessonLabel) && (
                            <div className="sf-home-study-step-curriculum" aria-label="موضع الدرس في المنهج">
                              {unitLabel && <span>{unitLabel}</span>}
                              {lessonLabel && <span>{lessonLabel}</span>}
                            </div>
                          )}
                          <h4>{displayStepTitle}</h4>
                          {step.detail && <p>{step.detail}</p>}
                          {Array.isArray(step.studyMethod?.stages) && step.studyMethod.stages.length > 0 && (
                            <ol className="sf-home-study-step-stages" aria-label="مراحل تنفيذ المهمة">
                              {step.studyMethod.stages.slice(0, 3).map((stage: any, stageIndex: number) => (
                                <li key={stageIndex}>
                                  <span>{(stageIndex + 1).toLocaleString("ar-EG")}</span>
                                  <b>{stage.title}</b>
                                </li>
                              ))}
                            </ol>
                          )}
                          {curriculum && branch && nodeId && (
                            <a className="sf-home-study-step-action"
                              href={"/study?subject=" + encodeURIComponent(curriculum.subjectId)
                                + "&branch=" + encodeURIComponent(branch.branchId)
                                + "&lesson=" + encodeURIComponent(nodeId)}>
                              افتح الدرس <ArrowLeft className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="sf-home-study-map-empty">
                  <CheckCircle2 className="size-8" />
                  <strong>الخطة جاهزة، لكن مفيش خطوات ظاهرة لليوم حاليًا.</strong>
                  <span>افتح الخطة الكاملة لمراجعة توزيعك وتحديثه.</span>
                </div>
              )}
              <footer className="sf-home-study-map-footer">
                <div>
                  <strong>{homeNextStep ? "الخطوة التالية: " + homeNextStep.title : "أنهيت كل خطوات الخطة الحالية"}</strong>
                  <span>{homeNextStep ? "افتح الخطوة، نفّذها من مصدرها، وبعدها سجّل ما أنجزته." : "انتهت خطوات اليوم؛ افتح الخطة الكاملة لمراجعة الأيام القادمة."}</span>
                </div>
                <Button onClick={() => setLocation("/planner")} className="rounded-xl">
                  كل خطوات الخطة <ArrowLeft className="size-4" />
                </Button>
              </footer>
              {dailyPlan.data?.needsRefresh && (
                <div className="sf-home-study-map-sync" role="status" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" />
                  <div>
                    <strong>الخريطة بتُعاد مواءمتها</strong>
                    <span>وصل تحديث في تقدمك أو مواعيدك؛ لن نعرض الترتيب القديم كأنه نهائي.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="sf-home-study-map-empty" role="status" aria-live="polite">
              {profile.data?.subjectIds?.length ? (
                <>
                  <Loader2 className="size-8 animate-spin" />
                  <strong>{ensurePlan.isPending ? "بنرتّب أولويات اليوم" : "خريطة اليوم قيد التجهيز"}</strong>
                  <p>هنعرض لك أول مهمة واضحة، ثم باقي الخطوات المرتبطة بموضعك في المنهج.</p>
                </>
              ) : (
                <>
                  <Sparkles className="size-8" />
                  <strong>ابدأ بإعداد ملفك الدراسي</strong>
                  <p>اختَر موادك ومدرسيك ومواعيد الحصص؛ بعدها نقدر نحدد أولوياتك بدقة.</p>
                  <Button onClick={() => setLocation("/settings/academic")} variant="outline" className="rounded-xl">إكمال الملف الدراسي <ArrowLeft className="size-4" /></Button>
                </>
              )}
            </div>
          )}
        </section>

        {!serverNow && (
          <section className="app-card flex flex-wrap items-center justify-between gap-3 p-4" role="status" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {serverClockStatus === "unavailable"
                ? "تعذرت مزامنة التاريخ والوقت من الخادم؛ لم نستخدم ساعة جهازك."
                : "جارٍ مزامنة التاريخ والوقت من خادم StudyFlow."}
            </p>
            {serverClockStatus === "unavailable" && (
              <Button type="button" size="sm" variant="outline" onClick={() => void refreshServerClock()}>
                إعادة المحاولة
              </Button>
            )}
          </section>
        )}
        {upcomingExams.length > 0 && (
          <ExamMissionScene
            exam={upcomingExams[0]}
            daysUntil={daysUntilExam(upcomingExams[0].date)}
            upcomingExams={upcomingExams}
          />
        )}
        {upcomingExams.length > 0 && (
          <section className="sf-home-exam-calendar" aria-labelledby="sf-home-exam-calendar-title">
            <header className="sf-home-exam-calendar-header">
              <div>
                <span className="sf-sp-eyebrow">مواعيد الاختبارات</span>
                <h3 id="sf-home-exam-calendar-title">اختباراتك القادمة</h3>
                <p>المواعيد المنشورة للمواد الموجودة في ملفك. راجع إعلان المدرسة للتأكيد النهائي.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="sf-home-exam-calendar-status">مواعيد مقترحة</span>
                <Button type="button" variant="outline" size="sm" className="rounded-full"
                  onClick={() => setLocation("/planner")}>افتح خطة المذاكرة</Button>
              </div>
            </header>
            <div className="sf-home-exam-calendar-track">
              {upcomingExams.map((exam, index) => {
                const days = daysUntilExam(exam.date);
                const dateLabel = new Intl.DateTimeFormat("ar-EG", {
                  day: "numeric", month: "long", timeZone: "Africa/Cairo",
                }).format(new Date(exam.date + "T12:00:00Z"));
                return (
                  <article key={exam.subjectId} className={"sf-home-exam-item" + (days === 0 ? " is-exam-today" : days === 1 ? " is-exam-tomorrow" : "")} data-exam-date={exam.date}>
                    <div className="sf-home-exam-item-date">
                      <span>{exam.dayName}</span>
                      <strong>{dateLabel}</strong>
                    </div>
                    <div className="sf-home-exam-item-subject">
                      <span className="sf-home-exam-index">{(index + 1).toLocaleString("ar-EG")}</span>
                      <b>{exam.subjectName}</b>
                      <small>{exam.category === "specialization" ? "مادة تخصصية حسب مسارك" : "مادة أساسية مضافة للمجموع"}</small>
                    </div>
                    <span className="sf-home-exam-countdown">
                      {days === 0 ? "اليوم" : days === 1 ? "غدًا" : "بعد " + days.toLocaleString("ar-EG") + " يوم"}
                    </span>
                    {days === 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="sf-home-exam-complete"
                        disabled={markMonthlyExamCompleted.isPending}
                        onClick={() => markMonthlyExamCompleted.mutate({ subjectId: exam.subjectId, date: exam.date })}
                      >
                        {markMonthlyExamCompleted.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                        خلصت الامتحان
                      </Button>
                    )}
                    <div className="sf-home-exam-scope sf-home-exam-scope-evidence" data-testid={"home-exam-scope-" + exam.subjectId}>
                      <div className="sf-home-exam-scope-heading">
                        <span>نطاق الامتحان</span>
                        <b>لا يوجد توثيق كافٍ</b>
                      </div>
                      <p className="sf-home-exam-scope-empty">لم نعثر حتى الآن على تصريح رسمي أو إعلان واضح من المدرس يحدد الدروس الداخلة في هذا الامتحان. لن نعرض موضوعات تخمينية أو نعتمد على آخر درس شرحه المدرس باعتباره نطاقًا للامتحان.</p>
                    </div>
                  </article>
                );
              })}
            </div>
            <footer className="sf-home-exam-calendar-footer">
              <p>جدول مديرية القاهرة المقترح وليس تأكيدًا من مدرستك. نطاق الامتحان لن يظهر إلا عند توفر تصريح واضح من مصدر رسمي أو من المدرس مع رابط وتاريخ للمصدر.</p>
            </footer>
          </section>
        )}
</div>
        <AnimatePresence>
          {showWelcomeGuide && (
            <motion.div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              role="dialog" aria-modal="true" aria-labelledby="welcome-guide-title"
              onClick={event => { if (event.target === event.currentTarget) setShowWelcomeGuide(false); }}
            >
              <motion.section
                className="relative w-full max-w-xl overflow-hidden rounded-[1.8rem] border border-border bg-card text-card-foreground shadow-[0_40px_130px_-45px_rgba(0,0,0,.95)]"
                initial={{ opacity: 0, y: 28, scale: .96, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 16, scale: .98, filter: "blur(6px)" }}
                transition={{ duration: .38, ease: [.22, 1, .36, 1] }}
              >
                <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
                <header className="relative flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
                  <div>
                    <p className="text-[10px] font-bold tracking-[.2em] text-primary">ابدأ هنا</p>
                    <h2 id="welcome-guide-title" className="mt-2 text-xl font-bold sm:text-2xl">أهلاً بك في StudyFlow</h2>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">٤ خطوات تضبط بيها المنصة وتبدأ مذاكرتك.</p>
                  </div>
                  <button type="button" onClick={() => finishWelcomeGuide()} className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-white">تخطي</button>
                </header>
                <div className="relative px-5 py-6 sm:px-7">
                  <div className="mb-5 flex items-center gap-2">
                    {welcomeGuide.map((item, index) => (
                      <button type="button" key={item.title} onClick={() => setWelcomeGuideStep(index)}
                        aria-label={"الخطوة " + (index + 1)}
                        className={"h-1.5 flex-1 rounded-full transition-all duration-300 " + (index <= welcomeGuideStep ? "bg-primary" : "bg-white/15")} />
                    ))}
                    <span className="mr-1 text-[10px] tabular-nums text-muted-foreground">{welcomeGuideStep + 1}/4</span>
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
                          <div className="flex size-14 items-center justify-center rounded-2xl border border-[#D1B77B]/25 bg-primary/10 text-primary">
                            <StepIcon className="size-7" />
                          </div>
                          <h3 className="mt-5 text-xl font-bold leading-8">{step.title}</h3>
                          <p className="mt-3 text-sm leading-8 text-muted-foreground">{step.body}</p>
                          <Button type="button" variant="outline" className="mt-5 rounded-xl border-border bg-muted/40 text-foreground hover:bg-muted"
                            onClick={() => { setShowWelcomeGuide(false); completeWelcomeGuide.mutate(undefined, { onSuccess: () => setLocation(step.path) }); }}>
                            {step.action} <ArrowLeft className="size-4" />
                          </Button>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>
                <footer className="relative flex items-center justify-between border-t border-white/10 px-5 py-4 sm:px-7">
                  <Button type="button" variant="ghost" className="text-muted-foreground hover:bg-white/10 hover:text-white"
                    disabled={welcomeGuideStep === 0} onClick={() => setWelcomeGuideStep(value => Math.max(0, value - 1))}>
                    السابق
                  </Button>
                  {welcomeGuideStep < welcomeGuide.length - 1 ? (
                    <Button type="button" className="rounded-xl bg-primary text-[#251D1B] hover:bg-[#E1C48A]" onClick={() => setWelcomeGuideStep(value => Math.min(welcomeGuide.length - 1, value + 1))}>
                      التالي <ArrowLeft className="size-4" />
                    </Button>
                  ) : (
                    <Button type="button" className="rounded-xl bg-primary text-[#251D1B] hover:bg-[#E1C48A]" disabled={completeWelcomeGuide.isPending}
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
