import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  getSIECheckpointProgressBranches,
  getSIEStudentVisibleBranches,
  getSIESubject,
  matchSIECheckpointTask,
} from "@shared/sie-catalog";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type PlanningMode = "smart" | "backlog" | "teacher_sync";
type GenerationProgress = {
  status: "running" | "complete" | "failed";
  currentStage: "profile" | "curriculum" | "model" | "validation" | "saving" | "complete";
  completedStages: Array<"profile" | "curriculum" | "model" | "validation" | "saving" | "complete">;
  detail: string;
  updatedAt: number;
  error?: string;
};
type PlanStep = {
  day: string;
  title: string;
  detail: string;
  minutes: number;
  category: string;
  priority?: "critical" | "high" | "medium" | "low";
  priorityScore?: number;
  priorityReason?: string;
  priorityEvidenceConfidence?: "low" | "medium" | "high";
  curriculumNodeIds?: string[];
  existingTask?: { id: number; title: string; status: "todo" | "done"; confidence: "exact" | "strong" };
  resourceRecommendation?: { title: string; url: string; teacherName?: string; reason: string };
  difficulty?: "easy" | "medium" | "hard" | "unknown";
  lessonSize?: "small" | "medium" | "large" | "unknown";
  difficultyBasis?: "student_report" | "curriculum_profile" | "unknown";
  difficultyConfidence?: "low" | "medium" | "high";
  printedPageRange?: [number, number];
  sourcePages?: number[];
  scheduleState?: "scheduled" | "deferred";
  dayIndex?: number | null;
  dateOffsetDays?: number | null;
  scheduleNote?: string;
  sourceTitle?: string;
  sourceStepIndex?: number;
  segmentIndex?: number;
  segmentCount?: number;
  plannerTaskId?: number;
  plannerTaskStatus?: "todo" | "done";
};
type PlanQuality = {
  score: number;
  status: "ready" | "partial" | "blocked";
  blockers: string[];
  warnings: string[];
  stats: {
    availableStudyDays: number;
    studyDaysUsed: number;
    scheduledMinutes: number;
    deferredMinutes: number;
    deferredSteps: number;
    maxDailyLoadMinutes: number;
    maxSessionMinutes: number;
  };
};
type PlanView = {
  title: string;
  summary: string;
  durationLabel: string;
  steps: PlanStep[];
  habits: { title: string; cue: string }[];
  quality?: PlanQuality;
  memorySnapshot?: Record<string, any>;
  // Export component compatibility only; deliberately blank so no AI self-test is created.
  reviewQuestion: string;
  taskSync?: { parentGoalId: number; stageCount: number; taskCount: number; routineId?: number | null };
};
const DAILY_SNAPSHOT_PREFIX = "SIE_DAILY_PLAN_V4:";
const DAILY_PLAN_DRAFT_PREFIX = "SIE_DAILY_PLAN_DRAFT_V1:";
const ANNUAL_PLAN_PREFIX = "SIE_ANNUAL_PLAN_V1:";
const STUDY_PLAN_PREFIX = "SIE_STUDY_PLAN_V2:";
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const initialPrompt = "كوّن لي خطة مذاكرة عملية للفترة القادمة. استخدم المهام الحالية وآخر موضع مكتمل وجدول حصص المدرسين، ووازن بين إنهاء المتراكم والاستعداد للمحاضرات الجديدة. لا تنشئ اختبارات أو أسئلة أو واجبات من عندك.";
const planningModeOptions: Array<{ value: PlanningMode; title: string; description: string; marker: string }> = [
  { value: "smart", title: "الخطة الذكية", description: "تخلّص المتراكم، وفي نفس الوقت تجهّزك لشرح المدرس القادم.", marker: "الموصى بها" },
  { value: "backlog", title: "المتراكم أولًا", description: "ركّز على المهام المفتوحة والفجوات المؤكدة قبل إضافة الجديد.", marker: "تركيز" },
  { value: "teacher_sync", title: "مواكبة المدرس", description: "حضّر للموضوع القادم قبل موعد الحصة وحافظ على متابعة الجديد.", marker: "استمرارية" },
];
function formatStudyDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} دقيقة`;
  const hoursLabel = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : `${hours} ساعات`;
  return remainder ? `${hoursLabel} و${remainder} دقيقة` : hoursLabel;
}

function parseSavedPlan(record: { planJson: string }): PlanView | null {
  try {
    const saved = JSON.parse(record.planJson) as Partial<PlanView>;
    if (!saved || typeof saved.title !== "string" || !Array.isArray(saved.steps) || saved.steps.length === 0) return null;
    return {
      title: saved.title,
      summary: typeof saved.summary === "string" ? saved.summary : "خطة دراسية مبنية على ملفك وتقدمك.",
      durationLabel: typeof saved.durationLabel === "string" ? saved.durationLabel : "مدة مرنة",
      steps: saved.steps.map((raw: any, index) => ({
        day: typeof raw.day === "string" ? raw.day : `اليوم ${index + 1}`,
        title: typeof raw.title === "string" ? raw.title : "مهمة دراسية",
        detail: typeof raw.detail === "string" ? raw.detail : "نفّذ المهمة ثم سجّل تقدمك.",
        minutes: Number.isFinite(Number(raw.minutes)) ? Math.max(5, Math.min(480, Math.round(Number(raw.minutes)))) : 30,
        category: typeof raw.category === "string" ? raw.category : "دراسة",
        ...raw,
      })),
      habits: Array.isArray(saved.habits) ? saved.habits : [],
      quality: saved.quality,
      memorySnapshot: saved.memorySnapshot,
      reviewQuestion: "",
    };
  } catch {
    return null;
  }
}

export default function Planner() {
  const utils = trpc.useUtils();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const planningMode: PlanningMode = "smart";
  const [horizonDays, setHorizonDays] = useState<7 | 14>(7);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [daysPerWeek, setDaysPerWeek] = useState<5 | 6 | 7>(6);
  const [approved, setApproved] = useState(false);
  const [loadedSavedDraft, setLoadedSavedDraft] = useState(false);
  const historyInitialized = useRef(false);
  const plannerPreferencesInitialized = useRef(false);

  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const learning = trpc.learning.get.useQuery(undefined, { staleTime: 15_000 });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15_000 });
  const activeDailyPlan = trpc.plans.currentDaily.useQuery(undefined, {
    enabled: !profile.isLoading && !profile.isError && Boolean(profile.data?.subjectIds?.length),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.plan ? 15_000 : query.state.data?.needsRefresh ? 30_000 : false,
  });

  const progressPreview = useMemo(() => {
    const subjects = profile.data?.subjectIds ?? [];
    const gaps = (learning.data as any)?.gapByBranch ?? {};
    return subjects.flatMap(subjectId =>
      getSIEStudentVisibleBranches(subjectId).map(branch => {
        const gap = gaps[subjectId]?.[branch.branchId];
        const nextIndex = gap?.studentPosition;
        const next = typeof nextIndex === "number" ? branch.choices[nextIndex] : null;
        return {
          key: subjectId + "::" + branch.branchId,
          subject: getSIESubject(subjectId)?.nameAr ?? subjectId,
          branch: branch.branchTitle,
          lastCompleted: gap?.studentFrontierTitle || (nextIndex === 0 ? "لم يبدأ بعد" : "غير محدد"),
          next: next?.title ?? (gap?.studentPosition === branch.choices.length ? "اكتمل الفرع" : "غير محدد"),
          gapCount: gap?.gapCount ?? null,
          reference: gap?.referenceFrontierTitle ?? "غير مسجل",
        };
      })
    );
  }, [profile.data?.subjectIds, learning.data]);

  const mappedOpenTasks = useMemo(() => {
    const subjects = profile.data?.subjectIds ?? [];
    return (tasksQuery.data ?? [])
      .filter((task: any) => task.status !== "done")
      .map((task: any) => ({
        task,
        match: matchSIECheckpointTask(subjects, [task.title, task.notes || ""].join(" ")),
      }));
  }, [tasksQuery.data, profile.data?.subjectIds]);
  const curriculumLinkedTasks = mappedOpenTasks.filter(item => item.match);
  const taskProgressConflicts = curriculumLinkedTasks.filter(({ task, match }) => {
    if (!match) return false;
    const branch = getSIECheckpointProgressBranches(match.subjectId).find(item => item.branchId === match.branchId);
    const gap = (learning.data as any)?.gapByBranch?.[match.subjectId]?.[match.branchId];
    const index = branch?.choices.findIndex(choice => choice.nodeId === match.nodeId) ?? -1;
    return index >= 0 && typeof gap?.studentPosition === "number" && index < gap.studentPosition;
  });
  const isPreflightReady = !profile.isLoading && !learning.isLoading && !tasksQuery.isLoading
    && !profile.isError && !learning.isError && !tasksQuery.isError;

  const savedPlans = useMemo(() => (history.data || [])
    .flatMap(record => {
      const saved = parseSavedPlan(record);
      const prompt = String(record.prompt || "");
      const isLegacyAnnualPlan = prompt.startsWith(ANNUAL_PLAN_PREFIX)
        || saved?.title.includes("الخطة السنوية")
        || saved?.title.includes("الخطة القديمة");
      const isDailyPlanRecord = prompt.startsWith(DAILY_SNAPSHOT_PREFIX);
      const isUncommittedAutoDraft = prompt.startsWith(DAILY_PLAN_DRAFT_PREFIX);
      const isLegacyApprovedRecord = prompt.startsWith(STUDY_PLAN_PREFIX)
        && /^[a-f0-9]{32}:$/.test(prompt.slice(STUDY_PLAN_PREFIX.length));
      if (!saved || isLegacyAnnualPlan || isDailyPlanRecord || isUncommittedAutoDraft || isLegacyApprovedRecord) return [];
      return [{ id: record.id, createdAt: record.createdAt, plan: saved }];
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [history.data]);

  useEffect(() => {
    if (profile.isLoading || profile.isError || plannerPreferencesInitialized.current || !profile.data) return;
    const selection = (profile.data.selection ?? {}) as Record<string, any>;
    const conditions = (selection.studyConditions ?? {}) as Record<string, unknown>;
    const configuredMinutes = Number(conditions.dailyMinutes);
    const configuredDays = Number(conditions.daysPerWeek);
    if (Number.isFinite(configuredMinutes) && configuredMinutes >= 20 && configuredMinutes <= 600) {
      setDailyMinutes(Math.trunc(configuredMinutes));
    }
    if (configuredDays === 5 || configuredDays === 6 || configuredDays === 7) {
      setDaysPerWeek(configuredDays);
    }
    plannerPreferencesInitialized.current = true;
  }, [profile.data, profile.isLoading, profile.isError]);

  const generate = trpc.plans.generate.useMutation({
    onSuccess: result => {
      setPlan({
        ...result,
        habits: Array.isArray(result.habits) ? result.habits : [],
        steps: Array.isArray(result.steps) ? result.steps : [],
        reviewQuestion: "",
      });
      setApproved(false);
      setLoadedSavedDraft(false);
      void utils.plans.list.invalidate();
      toast.success("خطة المذاكرة جاهزة. راجع توزيع الأيام قبل إضافتها لمهامك.");
    },
    onError: error => toast.error("تعذّر بناء الخطة: " + error.message),
  });

  const generationProgress = trpc.plans.generationProgress.useQuery(undefined, {
    enabled: generate.isPending,
    refetchInterval: generate.isPending ? 750 : false,
    refetchOnWindowFocus: false,
  });

  const approvePlan = trpc.plans.approve.useMutation({
    onSuccess: async result => {
      setApproved(true);
      setPlan(current => {
        if (!current) return current;
        const authoritative = result.plan
          ? { ...(result.plan as unknown as PlanView), reviewQuestion: "" }
          : current;
        return {
          ...authoritative,
          taskSync: {
            parentGoalId: result.parentGoalId,
            stageCount: result.taskCount,
            taskCount: result.taskCount,
            routineId: result.routineId ?? null,
          },
        };
      });
      await Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      toast.success(`تم اعتماد خطة المذاكرة وربط ${result.taskCount} خطوة بالمهام.`);
    },
    onError: error => toast.error("تعذّر اعتماد الخطة: " + error.message),
  });

  const deleteSavedPlan = trpc.plans.delete.useMutation({
    onSuccess: async () => {
      await utils.plans.list.invalidate();
      toast.success("تم حذف الخطة من السجل.");
    },
    onError: error => toast.error("تعذّر حذف الخطة: " + error.message),
  });

  const deleteAllPlans = trpc.plans.deleteAll.useMutation({
    onSuccess: async result => {
      setPlan(null);
      setApproved(false);
      setLoadedSavedDraft(false);
      historyInitialized.current = true;
      await Promise.all([
        utils.plans.list.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
      ]);
      toast.success(`تم حذف ${result.deletedPlans} خطة و${result.deletedTasks} مهمة مولّدة من الخطط.`);
    },
    onError: error => toast.error("تعذّر مسح الخطط: " + error.message),
  });

  const runGeneration = (mode: PlanningMode, horizon: 7 | 14, minutes: number, studyDays: 5 | 6 | 7) => {
    generate.mutate({
      prompt: initialPrompt,
      includeStudentProfile: true,
      planningMode: mode,
      horizonDays: horizon,
      dailyMinutes: minutes,
      daysPerWeek: studyDays,
      startDate: todayCairo,
      pace: "balanced",
      paceLevel: 2,
      deadline: null,
    });
  };

  useEffect(() => {
    const waitingForActivePlan = Boolean(profile.data?.subjectIds?.length) && activeDailyPlan.isLoading;
    if (history.isLoading || history.isError || waitingForActivePlan || historyInitialized.current) return;
    historyInitialized.current = true;

    // The current active plan is not a deletable history draft. Load it from the
    // read-only daily snapshot; otherwise fall back to the latest saved draft.
    const active = activeDailyPlan.data?.plan
      ? parseSavedPlan({ planJson: JSON.stringify(activeDailyPlan.data.plan) })
      : null;
    if (active) {
      setPlan(active);
      setApproved(true);
      setLoadedSavedDraft(false);
      return;
    }

    if (savedPlans.length > 0) {
      setPlan(savedPlans[0].plan);
      setApproved(false);
      setLoadedSavedDraft(true);
    }
  }, [
    history.isLoading,
    history.isError,
    savedPlans,
    profile.data?.subjectIds,
    activeDailyPlan.isLoading,
    activeDailyPlan.data?.plan,
  ]);

  useEffect(() => {
    // Reflect successful background replans only while the page still displays
    // an untouched active plan. Manual edits and opened drafts are never replaced.
    if (!historyInitialized.current || !approved || loadedSavedDraft || !activeDailyPlan.data?.plan) return;
    const refreshed = parseSavedPlan({ planJson: JSON.stringify(activeDailyPlan.data.plan) });
    if (refreshed) setPlan(refreshed);
  }, [activeDailyPlan.data?.plan, approved, loadedSavedDraft]);

  const updatePlan = (next: PlanView) => {
    setPlan(next);
    setApproved(false);
  };

  const updateStep = (index: number, patch: Partial<PlanStep>) => {
    if (!plan) return;
    updatePlan({ ...plan, steps: plan.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    if (!plan) return;
    const destination = index + direction;
    if (destination < 0 || destination >= plan.steps.length) return;
    const steps = [...plan.steps];
    [steps[index], steps[destination]] = [steps[destination], steps[index]];
    updatePlan({ ...plan, steps });
  };

  const removeStep = (index: number) => {
    if (!plan || plan.steps.length <= 1) return;
    updatePlan({ ...plan, steps: plan.steps.filter((_, stepIndex) => stepIndex !== index) });
  };

  const addStep = () => {
    if (!plan) return;
    updatePlan({
      ...plan,
      steps: [...plan.steps, {
        day: `اليوم ${plan.steps.length + 1}`,
        title: "مهمة جديدة",
        detail: "اكتب ما الذي تريد إنجازه في هذه الجلسة.",
        minutes: 30,
        category: "دراسة",
        priority: "medium",
        difficulty: "unknown",
        lessonSize: "unknown",
        difficultyBasis: "unknown",
        difficultyConfidence: "low",
        curriculumNodeIds: [],
      }],
    });
  };

  const approveCurrentPlan = () => {
    if (!plan) return;
    approvePlan.mutate({
      plan: {
        title: plan.title,
        summary: plan.summary,
        steps: plan.steps.map((step, index) => ({
          ...step,
          day: step.day || `اليوم ${index + 1}`,
        })),
      },
      schedule: { startDate: todayCairo, dailyMinutes, daysPerWeek, horizonDays },
    });
  };

  const handleDeleteAll = () => {
    const confirmed = window.confirm(
      "سيتم حذف كل خطط الذكاء الاصطناعي المحفوظة، مع المهام ومراحل الأهداف التي أنشأتها هذه الخطط فقط. لن تُحذف المهام اليدوية أو تقدمك في المنهج أو ملفك الدراسي. هل تؤكد؟",
    );
    if (confirmed) deleteAllPlans.mutate();
  };

  return (
    <DashboardLayout
      title="خطة المذاكرة"
      description="خطة واقعية تتغير مع تقدمك والتزاماتك."
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
        {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
        {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي. أعد المحاولة قبل إنشاء الخطة." />}

        <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-primary/[0.08] blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold tracking-[.22em] text-primary">STUDYFLOW / PLANNER</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">مذاكرتك، بترتيب واقعي.</h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                المحرك يوازن تلقائيًا بين المتراكم، والدرس القادم مع المدرس، والمهام المسجلة، والوقت المتاح. لا تحتاج إلى اختيار طريقة التخطيط أو كتابة طلب طويل.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-[10px] text-muted-foreground">المواد</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{(profile.data?.subjectIds?.length ?? 0).toLocaleString("ar-EG")}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-[10px] text-muted-foreground">مهام مفتوحة</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{(tasksQuery.data ?? []).filter((task: any) => task.status !== "done").length.toLocaleString("ar-EG")}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <p className="text-[10px] text-muted-foreground">فروع المنهج</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{progressPreview.length.toLocaleString("ar-EG")}</p>
              </div>
            </div>
          </div>
          {profile.data && (
            <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-muted/25 px-3 py-1.5">{profile.data.track}</span>
              <span className="rounded-full border border-border bg-muted/25 px-3 py-1.5">{profile.data.subjectIds.length} مواد مختارة</span>
              <span className="rounded-full border border-border bg-muted/25 px-3 py-1.5">{dailyMinutes} دقيقة يوميًا · {daysPerWeek} أيام أسبوعيًا</span>
            </div>
          )}
        </section>

        {!profile.isLoading && profile.data && (!profile.data.subjectIds || profile.data.subjectIds.length === 0) && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">أكمل ملفك الدراسي أولًا</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد نظامك وصفك وموادك حتى يختار المحرك الدروس الصحيحة بدل إنشاء خطة عامة.</p>
            <a href="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">فتح الملف الدراسي <ArrowUpRight className="size-4" /></a>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[.18em] text-primary">YOUR AVAILABLE CAPACITY</p>
              <h3 className="mt-1 text-lg font-bold">حدد وقتك المتاح فقط</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">باقي القرارات يتولاها المحرك من بياناتك الفعلية. لن يضغط أكثر من السقف الذي تحدده.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:min-w-[440px]">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">وقت الدراسة يوميًا</span>
                <select value={dailyMinutes} onChange={event => setDailyMinutes(Number(event.target.value))} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60">
                  {Array.from(new Set([dailyMinutes,20,30,45,60,75,90,105,120,135,150,180,210,240,270,300,330,360,390,420,450,480,510,540,570,600])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{formatStudyDuration(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">أيام الدراسة</span>
                <select value={daysPerWeek} onChange={event => setDaysPerWeek(Number(event.target.value) as 5 | 6 | 7)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60">
                  <option value={5}>5 أيام</option><option value={6}>6 أيام</option><option value={7}>7 أيام</option>
                </select>
              </label>
              <label className="block col-span-2 sm:col-span-1">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">الفترة</span>
                <select value={horizonDays} onChange={event => setHorizonDays(Number(event.target.value) as 7 | 14)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60">
                  <option value={7}>7 أيام</option><option value={14}>14 يومًا</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-6 text-muted-foreground">
              تُقرأ مواضع المنهج ومواعيد المدرسين والمهام تلقائيًا. أي عمل لا يتسع داخل الفترة سيظهر بوضوح كمؤجل، لا كعبء مخفي على يومك.
            </p>
            <Button className="h-11 w-full rounded-xl px-6 sm:w-auto" onClick={() => runGeneration("smart", horizonDays, dailyMinutes, daysPerWeek)} disabled={!isPreflightReady || generate.isPending || !profile.data?.subjectIds?.length}>
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generate.isPending ? "جارٍ ترتيب خطتك" : loadedSavedDraft ? "تحديث خطتي" : "أنشئ خطتي"}
            </Button>
          </div>
          <details className="mt-4 border-t border-border/60 pt-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-muted-foreground hover:text-foreground">
              عرض تفاصيل البيانات التي سيستخدمها المحرك
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                <h4 className="text-xs font-semibold">التقدم في المنهج</h4>
                {profile.isLoading || learning.isLoading ? <p className="mt-2 text-xs text-muted-foreground">جارٍ قراءة التقدم...</p> : (
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {progressPreview.slice(0, 16).map(item => (
                      <div key={item.key} className="rounded-lg border border-border/60 bg-card p-3">
                        <p className="text-xs font-semibold">{item.subject} · {item.branch}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">آخر مكتمل: {item.lastCompleted}</p>
                        <p className="mt-1 text-xs font-semibold text-primary">التالي: {item.next}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">مرجع المدرس: {item.reference}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                <h4 className="text-xs font-semibold">التزامات مرتبطة بالمنهج</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{curriculumLinkedTasks.length} مهمة مفتوحة طابقت موضوعات المنهج. سيتم ربط الموجود بدل تكراره.</p>
                {curriculumLinkedTasks.slice(0, 8).map(({task,match}) => (
                  <p key={task.id} className="mt-2 rounded-lg bg-card px-3 py-2 text-xs">
                    <b>{task.title}</b>
                    {match && <span className="mt-1 block text-muted-foreground">{getSIESubject(match.subjectId)?.nameAr} · {match.branchTitle}</span>}
                  </p>
                ))}
                {taskProgressConflicts.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
                    <p className="text-xs font-semibold">تعارضات تحتاج مراجعة</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">بعض المهام مرتبطة بموضوعات مسجلة كمكتملة. المحرك لن يغير تقدم المنهج تلقائيًا.</p>
                    {taskProgressConflicts.slice(0, 4).map(({task,match}) => <p key={task.id} className="mt-2 text-xs">{task.title} — {match?.title}</p>)}
                    <a href="/study" className="mt-2 inline-flex text-xs font-semibold text-primary">مراجعة تقدم المنهج</a>
                  </div>
                )}
              </div>
              {(profile.isError || learning.isError || tasksQuery.isError) && <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">تعذر قراءة كل البيانات. أعد المحاولة قبل توليد الخطة حتى لا تعتمد على بيانات ناقصة.</div>}
            </div>
          </details>
        </section>

        {generate.isPending && !plan && <PlanLoading progress={generationProgress.data ?? null} />}
        {!generate.isPending && !plan && !history.isLoading && !profile.isLoading && profile.data?.subjectIds?.length && (
          <section className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarClock className="size-5" /></span>
            <h3 className="mt-4 text-base font-semibold">لم يتم ترتيب خطة لهذه الفترة بعد</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">اضغط «أنشئ خطتي». سيجمع المحرك تقدمك والتزاماتك ثم يعرض أولويات واضحة وجدولًا لا يتجاوز وقتك اليومي.</p>
          </section>
        )}

        {loadedSavedDraft && !approved && plan && (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">أنت تراجع خطة محفوظة من فترة سابقة</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">قد لا تعكس آخر تقدم أو تغييرات مواعيدك. يمكنك تحديثها من إعدادات الوقت أعلاه.</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">مسودة محفوظة</span>
          </section>
        )}

        {plan && (
          <PlanCard
            plan={plan}
            title={approved ? "الخطة المعتمدة" : loadedSavedDraft ? "مسودة محفوظة" : "مقترحك الدراسي"}
            studentName={profile.data?.studentName}
            editable={!approved}
            onChange={updatePlan}
            onApprove={approveCurrentPlan}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            onMoveStep={moveStep}
            approving={approvePlan.isPending}
            approved={approved}
          />
        )}

        {savedPlans.length > 0 && (
          <details className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[.16em] text-muted-foreground">SAVED HISTORY</p>
                <h3 className="mt-1 font-semibold">خطط سابقة <span className="text-xs font-normal text-muted-foreground">({savedPlans.length})</span></h3>
              </div>
              <span className="text-xs text-primary">عرض السجل</span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {savedPlans.map(item => (
                <article key={item.id} className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <button type="button" onClick={() => { setPlan(item.plan); setApproved(false); setLoadedSavedDraft(true); }} className="w-full text-right">
                    <span className="block text-sm font-semibold">{item.plan.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.plan.summary}</span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</span>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive" disabled={deleteSavedPlan.isPending} onClick={() => { if (window.confirm("حذف هذه المسودة من السجل؟")) deleteSavedPlan.mutate({ id: item.id }); }}>
                      <Trash2 className="size-3.5" /> حذف
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 flex justify-end border-t border-border pt-3">
              <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>
                {deleteAllPlans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-3.5" />}
                مسح كل الخطط
              </Button>
            </div>
          </details>
        )}
      </div>
    </DashboardLayout>
  );
}


function PlanLoading({ progress }: { progress: GenerationProgress | null }) {
  const stages: Array<{ id: GenerationProgress["currentStage"]; title: string }> = [
    { id: "profile", title: "قراءة ملف الطالب والتقدم المسجل" },
    { id: "curriculum", title: "تحميل خريطة الكتب والفروع والمتطلبات" },
    { id: "model", title: "تحليل الأولويات وتكوين المسودة" },
    { id: "validation", title: "مراجعة المسودة والقواعد المعتمدة" },
    { id: "saving", title: "حفظ المسودة للمراجعة" },
  ];
  return (
    <section className="app-card rounded-2xl p-5 sm:p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><Sparkles className="size-5 animate-pulse" /></span>
        <div>
          <h3 className="font-bold">ببني مسودة خطتك</h3>
          <p className="mt-1 text-sm text-muted-foreground">{progress?.detail || "جارٍ بدء المعالجة وقراءة بياناتك."}</p>
        </div>
        <Loader2 className="mr-auto size-5 animate-spin text-primary" />
      </div>
      <ol className="mt-5 space-y-2">
        {stages.map((stage, index) => {
          const done = progress?.completedStages.includes(stage.id) ?? false;
          const current = progress?.status === "running" && progress.currentStage === stage.id;
          return (
            <li key={stage.id} className={"flex items-center gap-3 rounded-xl border px-3 py-3 " + (current
              ? "border-primary/40 bg-primary/5"
              : done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-muted/10")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 text-xs">
                {done ? <CheckCircle2 className="size-4 text-emerald-600" /> : current ? <Loader2 className="size-4 animate-spin text-primary" /> : index + 1}
              </span>
              <span className={"text-sm " + (current || done ? "font-semibold" : "text-muted-foreground")}>{stage.title}</span>
              {current && <span className="mr-auto text-[11px] font-medium text-primary">جارٍ الآن</span>}
              {done && <span className="mr-auto text-[11px] text-emerald-700">اكتملت</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PlanCard({
  plan,
  title,
  studentName,
  editable,
  onChange,
  onApprove,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  approving,
  approved,
}: {
  plan: PlanView;
  title: string;
  studentName?: string;
  editable: boolean;
  onChange: (next: PlanView) => void;
  onApprove: () => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  approving: boolean;
  approved: boolean;
}) {
  const [editing, setEditing] = useState<{ index: number; title: string; detail: string; minutes: number } | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, Array<{ step: PlanStep; index: number }>>();
    plan.steps.forEach((step, index) => {
      const key = step.scheduleState === "deferred" ? "deferred" : (step.day || "غير مجدول");
      const current = map.get(key) ?? [];
      current.push({ step, index });
      map.set(key, current);
    });
    return [...map.entries()].map(([key, steps]) => ({
      key,
      title: key === "deferred" ? "بعد الفترة المحددة" : key,
      steps,
      deferred: key === "deferred",
      totalMinutes: steps.reduce((sum, item) => sum + item.step.minutes, 0),
    }));
  }, [plan.steps]);

  const totalMinutes = plan.steps.reduce((sum, step) => sum + step.minutes, 0);
  const scheduledMinutes = plan.quality?.stats.scheduledMinutes
    ?? plan.steps.filter(step => step.scheduleState !== "deferred").reduce((sum, step) => sum + step.minutes, 0);
  const deferredMinutes = plan.quality?.stats.deferredMinutes
    ?? plan.steps.filter(step => step.scheduleState === "deferred").reduce((sum, step) => sum + step.minutes, 0);
  const scheduledSteps = plan.steps.filter(step => step.scheduleState !== "deferred");
  const statusLabel = plan.quality?.status === "blocked" ? "يحتاج مراجعة"
    : plan.quality?.status === "partial" ? "جدول جزئي" : "جاهزة للمراجعة";
  const statusStyle = plan.quality?.status === "blocked"
    ? "border-destructive/25 bg-destructive/[0.04] text-destructive"
    : plan.quality?.status === "partial"
      ? "border-amber-500/25 bg-amber-500/[0.04] text-amber-700 dark:text-amber-300"
      : "border-primary/20 bg-primary/[0.05] text-primary";

  const saveEdit = () => {
    if (!editing) return;
    onChange({
      ...plan,
      steps: plan.steps.map((step, index) => index === editing.index
        ? { ...step, title: editing.title.trim() || step.title, detail: editing.detail.trim() || step.detail, minutes: Math.max(5, Math.min(480, Math.round(editing.minutes || 5))) }
        : step),
    });
    setEditing(null);
  };

  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-sm">
      <header className="border-b border-border/70 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[.16em] text-primary">STUDYFLOW / YOUR PLAN</span>
              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">{title}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">خطة الفترة القادمة</h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{plan.summary.split("\n\n")[0]}</p>
            {studentName && <p className="mt-2 text-xs text-muted-foreground">مبنية على ملف {studentName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (approved ? "border-primary/20 bg-primary/[0.05] text-primary" : statusStyle)}>
              {approved ? "خطة معتمدة" : statusLabel}
            </span>
            <PlanExportActions plan={plan} studentName={studentName} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
            <p className="text-[10px] text-muted-foreground">وقت داخل الجدول</p>
            <p className="mt-1 text-base font-bold tabular-nums">{formatStudyDuration(scheduledMinutes)}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
            <p className="text-[10px] text-muted-foreground">وقت مؤجل</p>
            <p className="mt-1 text-base font-bold tabular-nums">{deferredMinutes ? formatStudyDuration(deferredMinutes) : "لا يوجد"}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
            <p className="text-[10px] text-muted-foreground">أيام دراسة</p>
            <p className="mt-1 text-base font-bold tabular-nums">{(plan.quality?.stats.studyDaysUsed ?? new Set(scheduledSteps.map(step => step.day)).size).toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
            <p className="text-[10px] text-muted-foreground">إجمالي العمل</p>
            <p className="mt-1 text-base font-bold tabular-nums">{formatStudyDuration(totalMinutes)}</p>
          </div>
        </div>

        {plan.quality && (
          <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold">فحص قابلية التنفيذ</p>
                <p className="mt-1 text-[11px] text-muted-foreground">تم فحص سقف اليوم وتقسيم الجلسات قبل عرض الخطة.</p>
              </div>
              <span className="text-sm font-bold tabular-nums">{plan.quality.score}/100</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: plan.quality.score + "%" }} />
            </div>
            {plan.quality.warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
                {plan.quality.warnings.slice(0, 3).map((warning, index) => <li key={index}>• {warning}</li>)}
              </ul>
            )}
            {plan.quality.blockers.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs leading-5 text-destructive">
                {plan.quality.blockers.map((blocker, index) => <li key={index}>• {blocker}</li>)}
              </ul>
            )}
          </div>
        )}
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-bold">توزيعك اليومي</h3>
            <p className="mt-1 text-xs text-muted-foreground">ابدأ بأول خطوة في اليوم الحالي. كل جلسة لها وقت محدد وواضح.</p>
          </div>
          {editable && (
            <Button type="button" size="sm" variant="outline" className="h-9 rounded-lg" onClick={onAddStep}>
              <Plus className="size-3.5" /> إضافة مهمة
            </Button>
          )}
        </div>

        {groups.map((group, groupIndex) => (
          <section key={group.key} className={"overflow-hidden rounded-2xl border " + (group.deferred ? "border-amber-500/25 bg-amber-500/[0.025]" : "border-border/80 bg-background")}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={"flex size-9 items-center justify-center rounded-xl text-xs font-bold " + (group.deferred ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary")}>
                  {group.deferred ? <CalendarClock className="size-4" /> : String(groupIndex + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4 className="text-sm font-bold">{group.title}</h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{group.steps.length} جلسات</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold tabular-nums">{formatStudyDuration(group.totalMinutes)}</p>
                <p className="text-[10px] text-muted-foreground">{group.deferred ? "غير محسوب على أيام هذه الفترة" : "حمل اليوم"}</p>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {group.steps.map(({ step, index }) => (
                <article key={`${step.sourceStepIndex ?? index}:${step.segmentIndex ?? 1}:${index}`} className="p-4">
                  {editing?.index === index ? (
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">عنوان المهمة</span>
                        <input value={editing.title} onChange={event => setEditing(current => current ? { ...current, title: event.target.value } : current)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">تفاصيل التنفيذ</span>
                        <textarea rows={3} value={editing.detail} onChange={event => setEditing(current => current ? { ...current, detail: event.target.value } : current)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" />
                      </label>
                      <label className="block max-w-[180px]">
                        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">الوقت بالدقائق</span>
                        <input type="number" min={5} max={480} step={5} value={editing.minutes} onChange={event => setEditing(current => current ? { ...current, minutes: Number(event.target.value) } : current)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                      </label>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>إلغاء</Button>
                        <Button type="button" size="sm" onClick={saveEdit}>حفظ التعديل</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{step.category}</span>
                          {step.priority === "critical" && <span className="text-[10px] font-semibold text-destructive">عاجل</span>}
                          {(step.priority === "high") && <span className="text-[10px] font-semibold text-amber-600">أولوية عالية</span>}
                          {step.plannerTaskStatus === "done" && <span className="text-[10px] text-primary">أُنجزت جلسة الخطة</span>}
                          {step.existingTask?.status === "done" && <span className="text-[10px] text-primary">المهمة المرتبطة مكتملة</span>}
                        </div>
                        <h5 className="mt-2 text-sm font-bold leading-6">{step.title}</h5>
                        <p className="mt-1 whitespace-pre-line text-xs leading-6 text-muted-foreground">{step.detail}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-[11px] font-semibold">
                            <Clock3 className="size-3.5" /> {formatStudyDuration(step.minutes)}
                          </span>
                          {step.priorityReason && (
                            <details className="text-[11px] text-muted-foreground">
                              <summary className="cursor-pointer">لماذا هذه المهمة؟</summary>
                              <p className="mt-2 max-w-xl leading-6">{step.priorityReason}</p>
                            </details>
                          )}
                          {step.resourceRecommendation && (
                            <a href={step.resourceRecommendation.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-primary">مصدر شرح مقترح</a>
                          )}
                        </div>
                        {group.deferred && step.scheduleNote && <p className="mt-2 rounded-lg bg-amber-500/[0.05] px-3 py-2 text-[11px] leading-5 text-muted-foreground">{step.scheduleNote}</p>}
                        {editable && (
                          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/50 pt-2">
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setEditing({ index, title: step.title, detail: step.detail, minutes: step.minutes })}>تعديل</Button>
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={index === 0} onClick={() => onMoveStep(index, -1)}><ArrowUp className="size-3.5" /> لأعلى</Button>
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={index === plan.steps.length - 1} onClick={() => onMoveStep(index, 1)}><ArrowDown className="size-3.5" /> لأسفل</Button>
                            <Button type="button" variant="ghost" size="sm" className="mr-auto h-8 px-2 text-xs text-destructive" disabled={plan.steps.length <= 1} onClick={() => onRemoveStep(index)}><X className="size-3.5" /> حذف</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        {editable && (
          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground">اعتماد الخطة سينشئ مهامًا فقط. لن يغيّر مواضع المنهج المكتملة تلقائيًا.</p>
            <Button type="button" className="h-11 rounded-xl px-6" onClick={onApprove} disabled={approving || plan.steps.length === 0 || !plan.title.trim() || plan.quality?.status === "blocked"}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              اعتماد الخطة وإنشاء المهام
            </Button>
          </div>
        )}

        <details className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <summary className="cursor-pointer text-xs font-semibold">تفاصيل إضافية عن الخطة</summary>
          <div className="mt-3 whitespace-pre-line text-xs leading-6 text-muted-foreground">{plan.summary}</div>
          {plan.habits.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {plan.habits.map((habit, index) => <div key={`${habit.title}:${index}`} className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-foreground">{habit.title}</p><p className="mt-1 text-xs leading-5">{habit.cue}</p></div>)}
            </div>
          )}
        </details>

        <details className="rounded-xl border border-border/70">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground">اسأل مساعد الخطة</summary>
          <div className="p-3"><PlanAssistantChat plan={plan} /></div>
        </details>
      </div>
    </section>
  );
}

function PlanAssistantChat({ plan }: { plan: PlanView }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [draft, setDraft] = useState("");
  const context = useMemo(() => [
    "السياق: المستخدم يتحدث من صفحة خطة المذاكرة في StudyFlow.",
    "اسم الخطة: " + plan.title,
    "ملخص الخطة: " + plan.summary,
    "مدة التنفيذ: " + plan.durationLabel,
    "خطوات الخطة الحالية:",
    ...plan.steps.map((step, index) =>
      `${index + 1}. ${step.day} | ${step.title} | ${step.minutes} دقيقة | ${step.category} | ${step.detail}${step.priorityReason ? " | سبب الأولوية: " + step.priorityReason : ""}`
    ),
  ].join("\n").slice(0, 7_500), [plan]);

  const chat = trpc.ai.chat.useMutation({
    onSuccess: result => setMessages(current => [...current, { role: "assistant" as const, content: result.content }].slice(-20)),
    onError: error => toast.error(error.message || "تعذّر الوصول إلى مساعد الخطة."),
  });

  const sendMessage = () => {
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content }].slice(-20);
    setMessages(nextMessages);
    setDraft("");
    chat.mutate({ messages: nextMessages, memory: "", context });
  };

  return (
    <section className="sf-plan-chat lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/20 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-5" /></span>
          <div className="min-w-0">
            <h3 className="font-bold">اتكلم مع مساعد خطتك</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">اسأله عن ترتيب الأيام أو وقت أي خطوة أو اطلب اقتراحًا لتعديل الخطة.</p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-[10px] text-muted-foreground">مرتبط بالخطة الحالية</span>
      </header>
      <div className="grid gap-3 p-3 sm:p-4">
        <div className="max-h-[360px] min-h-24 space-y-3 overflow-y-auto rounded-xl bg-muted/15 p-3" aria-live="polite">
          {!messages.length && (
            <div className="flex min-h-20 items-center gap-3 text-sm text-muted-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><BrainCircuit className="size-4" /></span>
              <p>أنا شايف تفاصيل الخطة الحالية. اسألني مثلاً: ليه حطيت الدرس ده في اليوم ده؟ أو اقترح توزيعًا أخف.</p>
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={message.role === "user" ? "flex justify-start" : "flex justify-end"}>
              <div className={"max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-7 " + (message.role === "user"
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md border border-border bg-card text-foreground")}>
                {message.content}
              </div>
            </div>
          ))}
          {chat.isPending && <div className="flex justify-end"><span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">المساعد بيحلل الخطة...</span></div>}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            rows={2}
            maxLength={4_000}
            placeholder="اكتب سؤالك عن الخطة..."
            aria-label="اكتب رسالة لمساعد الخطة"
            className="min-h-12 max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <Button type="button" onClick={sendMessage} disabled={!draft.trim() || chat.isPending} className="h-12 shrink-0 rounded-xl px-4">
            <Send className="size-4" /><span className="hidden sm:inline">إرسال</span>
          </Button>
        </div>
        <p className="px-1 text-[10px] text-muted-foreground">المساعد يقترح ويشرح؛ تعديل المهام أو ترتيبها يتم من أدوات الخطة نفسها قبل الاعتماد.</p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/70 bg-card/75 p-3">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <b className="mt-1 block text-sm font-bold">{value}</b>
  </div>;
}
