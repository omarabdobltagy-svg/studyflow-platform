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
  MessageCircle,
  Send,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  studyMethod?: { stages: Array<{ title: string; instruction: string; reason: string; optional?: boolean }>; completionCriteria: string; teacherPolicyNote?: string };
  minutes: number;
  category: string;
  phaseId?: "backlog" | "teacher_sync" | "steady";
  priority?: "critical" | "high" | "medium" | "low";
  priorityScore?: number;
  priorityReason?: string;
  priorityEvidenceConfidence?: "low" | "medium" | "high";
  curriculumNodeIds?: string[];
  existingTask?: { id: number; title: string; status: "todo" | "done"; confidence: "exact" | "strong"; dueAt?: string | null };
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
type ExecutionStrategyPhase = { id: "backlog" | "teacher_sync" | "steady"; title: string; purpose: string; actions: string[]; completionCriteria: string };
type PlanView = {
  title: string;
  summary: string;
  executionStrategy?: { objective: string; rationale: string; phases?: ExecutionStrategyPhase[] };
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
const PlannerFlowScene = lazy(() => import("@/components/PlannerFlowScene"));

function DeferredPlannerFlowScene() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 450);
    return () => window.clearTimeout(timer);
  }, []);
  const fallback = <div className="sf-planner-flow-placeholder" aria-hidden="true"><span /><span /><span /></div>;
  return ready ? <Suspense fallback={fallback}><PlannerFlowScene /></Suspense> : fallback;
}

function parseSavedPlan(record: { planJson: string }): PlanView | null {
  try {
    const saved = JSON.parse(record.planJson) as Partial<PlanView>;
    if (!saved || typeof saved.title !== "string" || !Array.isArray(saved.steps) || saved.steps.length === 0) return null;
    return {
      title: saved.title,
      summary: typeof saved.summary === "string" ? saved.summary : "خطة دراسية مبنية على ملفك وتقدمك.",
      executionStrategy: saved.executionStrategy as PlanView["executionStrategy"],
      durationLabel: "مهام مرنة",
      steps: saved.steps.map((raw: any, index) => ({
        day: "",
        title: typeof raw.title === "string" ? raw.title : "مهمة دراسية",
        detail: typeof raw.detail === "string" ? raw.detail : "نفّذ المهمة ثم سجّل تقدمك.",
        minutes: 0,
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
  const [dailyMinutes, setDailyMinutes] = useState(120);
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
    if (Number.isFinite(configuredMinutes) && configuredMinutes > 0) setDailyMinutes(configuredMinutes <= 60 ? 60 : configuredMinutes <= 150 ? 120 : 180);
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
      toast.success("قائمة المهام الذكية جاهزة. راجعها قبل إضافتها إلى مهامك.");
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
        const authoritative = "plan" in result && result.plan
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

  const runGeneration = (minutes: number) => {
    generate.mutate({
      prompt: initialPrompt,
      includeStudentProfile: true,
      planningMode: "smart",
      horizonDays: 7,
      dailyMinutes: minutes,
      daysPerWeek: 6,
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
    // Any manual edit invalidates the previous quality report. The server will
    // recalculate the schedule and quality before creating tasks.
    setPlan({ ...next, quality: undefined });
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
        minutes: 0,
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
      schedule: { startDate: todayCairo, dailyMinutes, daysPerWeek: 6, horizonDays: 7, mode: "flexible" },
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

        <section className="sf-planner-intro relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-7">
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
              <span className="rounded-full border border-border bg-muted/25 px-3 py-1.5">مستوى الانشغال: {dailyMinutes === 60 ? "مرتفع جدًا" : dailyMinutes === 120 ? "متوسط" : "أقل نسبيًا"}</span>
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

        <section className="sf-planner-capacity-card rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[.18em] text-primary">YOUR STUDY CAPACITY</p>
            <h3 className="mt-1 text-lg font-bold">قد إيه وقتك متاح في حياتك غالبًا؟</h3>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">ده مؤشر لانشغالك وحجم المهام المناسب ليك، مش مدة للمحاضرات أو جدول بمواعيد. تقدر تغيّره في أي وقت، ومش هنحدد وقتًا لأي مهمة إلا لو أنت اخترت ده بنفسك.</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([[60,"ساعة تقريبًا","مشغول جدًا — مهام أقل وبأولوية أعلى"],[120,"ساعتان تقريبًا","انشغال متوسط — حمل متوازن"],[180,"3 ساعات أو أكثر","مساحة أكبر — مهام أكثر عند الحاجة"]] as const).map(([value,label,description]) => (
              <button key={value} type="button" aria-pressed={dailyMinutes===value} onClick={() => setDailyMinutes(value)}
                className={"sf-capacity-choice rounded-xl border p-4 text-right transition " + (dailyMinutes===value ? "border-primary bg-primary/[.06] ring-1 ring-primary/25" : "border-border bg-background hover:border-primary/35")}>
                <span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-6 text-muted-foreground">المخطط هيقرأ موادك وتقدمك والمهام وشروط المدرسين، ثم يقترح قائمة مهام مرنة. لا يوجد يوم أو ساعة إلزامية لكل مهمة.</p>
            <Button className="h-11 w-full rounded-xl px-6 sm:w-auto" onClick={() => runGeneration(dailyMinutes)} disabled={!isPreflightReady || generate.isPending || !profile.data?.subjectIds?.length}>
              {generate.isPending ? <><Loader2 className="size-4 animate-spin" /> بنبني قائمتك…</> : <><Sparkles className="size-4" /> أنشئ قائمة مهامي</>}
            </Button>
          </div>
        </section>

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

function PlanCard({ plan, title, studentName, editable, onChange, onApprove, onAddStep, onRemoveStep, onMoveStep, approving, approved }: {
  plan: PlanView; title: string; studentName?: string; editable: boolean;
  onChange: (next: PlanView) => void; onApprove: () => void; onAddStep: () => void;
  onRemoveStep: (index: number) => void; onMoveStep: (index: number, direction: -1 | 1) => void;
  approving: boolean; approved: boolean;
}) {
  const [editing, setEditing] = useState<{ index: number; title: string; detail: string } | null>(null);
  const completedCount = plan.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length;
  const fallbackPhases: ExecutionStrategyPhase[] = [
    { id: "backlog", title: "1. نقفل المتراكم المؤكد", purpose: "نبدأ بالالتزامات المفتوحة المسجلة فعلًا، ولا نعتبر وجود مهمة دليلًا على اكتمال درس.", actions: ["نرتب الالتزامات حسب الاستحقاق والأولوية", "نحافظ على تفاصيل التكليف الأصلي كما سجلها الطالب أو المدرس"], completionCriteria: "تحديث حالة الالتزام بعد تنفيذه، مع إبقاء تقدم المنهج مستقلًا." },
    { id: "teacher_sync", title: "2. نواكب المدرس", purpose: "نربط الدروس القادمة بجدول الحصة المسجل، ونستعد للموضوع التالي من غير افتراض محتوى لم يذكره المدرس.", actions: ["نجهز للدرس التالي قبل الحصة إذا سمح الوقت", "بعد الحصة نسجل الفروع التي شرحها المدرس من تقرير الطالب"], completionCriteria: "تحديث موضع شرح المدرس فقط من تقرير واضح، من دون اعتبار الطالب متقنًا للدرس تلقائيًا." },
    { id: "steady", title: "3. نثبت التقدم ونستكمل الفجوات", purpose: "نستكمل الخطوات المنهجية التالية بعد معالجة الأولويات الأقرب.", actions: ["نحافظ على ترتيب الدروس داخل كل فرع", "نعيد الحساب عند تسجيل تقدم أو التزام جديد"], completionCriteria: "تسجيل ما أنجزه الطالب فعلًا ثم إعادة ترتيب الخطوة التالية." },
  ];
  const phases = plan.executionStrategy?.phases?.length ? plan.executionStrategy.phases : fallbackPhases;
  const stepPhaseId = (step: PlanStep, index: number) => step.phaseId ?? (step.existingTask ? "backlog" : index === 0 ? "teacher_sync" : "steady");
  const saveEdit = () => {
    if (!editing) return;
    onChange({
      ...plan,
      steps: plan.steps.map((step, index) => index === editing.index
        ? { ...step, title: editing.title.trim() || step.title, detail: editing.detail.trim() || step.detail }
        : step),
    });
    setEditing(null);
  };
  const formatTaskDueDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(date);
  };

  return (
    <section className="sf-execution-plan overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-sm">
      <header className="border-b border-border/70 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[.16em] text-primary">STUDYFLOW / EXECUTION PLAN</span>
              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">{title}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">خطة التنفيذ — هنعمل إيه وبأي ترتيب؟</h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{plan.summary.split("\n\n")[0]}</p>
            {studentName && <p className="mt-2 text-xs text-muted-foreground">مبنية على ملف {studentName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={"rounded-full border px-3 py-1.5 text-xs font-semibold " + (approved ? "border-primary/20 bg-primary/[0.05] text-primary" : "border-border bg-muted/30 text-muted-foreground")}>{approved ? "خطة معتمدة" : "مقترح للمراجعة"}</span>
            <PlanExportActions plan={plan} studentName={studentName} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3"><p className="text-[10px] text-muted-foreground">المهام الفعلية في الخطة</p><p className="mt-1 text-base font-bold tabular-nums">{plan.steps.length.toLocaleString("ar-EG")}</p></div>
          <div className="rounded-xl border border-border/70 bg-muted/15 p-3"><p className="text-[10px] text-muted-foreground">المهام المكتملة</p><p className="mt-1 text-base font-bold tabular-nums">{completedCount.toLocaleString("ar-EG")}</p></div>
          <div className="col-span-2 rounded-xl border border-border/70 bg-muted/15 p-3 sm:col-span-1"><p className="text-[10px] text-muted-foreground">ترتيب العمل</p><p className="mt-1 text-sm font-bold">متراكم ← المدرس ← التثبيت</p></div>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        <section className="sf-execution-overview grid gap-4 overflow-hidden rounded-2xl border border-primary/15 bg-background/75 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.78fr)]">
          <div className="relative z-10">
            <p className="eyebrow">المنطق وراء الخطة</p>
            <h3 className="mt-2 text-lg font-bold leading-8">{plan.executionStrategy?.objective ?? "نقفل الالتزامات المؤكدة أولًا، ثم نواكب شرح المدرس ونكمل الفجوات."}</h3>
            <p className="mt-2 whitespace-pre-line text-xs leading-7 text-muted-foreground">{plan.executionStrategy?.rationale ?? "الترتيب يعتمد على المهام المفتوحة وموضع تقدمك في كل فرع وجدول الحصص المسجل. لن نخترع واجبًا أو نفترض موعدًا غير موجود."}</p>
            <p className="mt-3 rounded-xl border border-border/70 bg-card/70 p-3 text-[11px] leading-6 text-muted-foreground">
              مهم: واجب المدرس لا يظهر كتكليف جديد إلا إذا كان مسجلًا فعلًا في بياناتك أو أكدت أنت أنه مطلوب. متابعة شرح المدرس لا تعني أن الدرس اكتمل عندك.
            </p>
          </div>
          <div className="sf-planner-flow-visual relative flex min-h-[190px] flex-col justify-end overflow-hidden rounded-xl border border-border/70 bg-card/65 p-3">
            <DeferredPlannerFlowScene />
            <div className="relative z-10 grid grid-cols-3 gap-1 text-center text-[10px] font-semibold">
              <span className="rounded-lg border border-border/70 bg-background/85 px-2 py-2 text-foreground">المتراكم</span>
              <span className="rounded-lg border border-border/70 bg-background/85 px-2 py-2 text-foreground">المدرس</span>
              <span className="rounded-lg border border-border/70 bg-background/85 px-2 py-2 text-foreground">التثبيت</span>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {phases.map((phase, phaseIndex) => {
            const phaseSteps = plan.steps
              .map((step, index) => ({ step, index }))
              .filter(item => stepPhaseId(item.step, item.index) === phase.id);
            return (
              <section key={phase.id} className={"sf-execution-phase sf-execution-phase-" + phase.id + " overflow-hidden rounded-2xl border border-border/80 bg-background"}>
                <header className="border-b border-border/70 bg-muted/15 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/[.07] text-xs font-bold text-primary">{phaseIndex + 1}</span>
                    <h3 className="text-sm font-bold">{phase.title}</h3>
                    <span className="mr-auto rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground">{phaseSteps.length.toLocaleString("ar-EG")} مهمة</span>
                  </div>
                  <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">{phase.purpose}</p>
                  {phase.actions.length > 0 && (
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {phase.actions.slice(0, 4).map((action, index) => <li key={index} className="flex items-start gap-2 text-[11px] leading-5 text-foreground/80"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" />{action}</li>)}
                    </ul>
                  )}
                </header>

                <div className="divide-y divide-border/60">
                  {phaseSteps.length ? phaseSteps.map(({ step, index }) => {
                    const dueLabel = step.existingTask ? formatTaskDueDate(step.existingTask.dueAt) : null;
                    const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
                    return (
                      <article key={step.plannerTaskId ?? step.existingTask?.id ?? step.sourceStepIndex ?? index} className="sf-execution-task p-4 sm:p-5">
                        {editing?.index === index ? (
                          <div className="space-y-3">
                            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">عنوان المهمة</span><input value={editing.title} onChange={event => setEditing(current => current ? { ...current, title: event.target.value } : current)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
                            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">تفاصيل المهمة</span><textarea rows={3} value={editing.detail} onChange={event => setEditing(current => current ? { ...current, detail: event.target.value } : current)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" /></label>
                            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>إلغاء</Button><Button type="button" size="sm" onClick={saveEdit}>حفظ التعديل</Button></div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <span className={"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border text-[11px] font-semibold " + (isDone ? "border-primary/25 bg-primary/[.08] text-primary" : "border-border bg-muted/35 text-muted-foreground")}>{isDone ? <CheckCircle2 className="size-4" /> : (index + 1).toLocaleString("ar-EG")}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{step.category}</span>
                                {step.existingTask && <span className="text-[10px] text-muted-foreground">التزام مسجل مسبقًا</span>}
                                {step.priority === "critical" && <span className="text-[10px] font-semibold text-destructive">عاجل</span>}
                                {step.priority === "high" && <span className="text-[10px] font-semibold text-amber-600">أولوية عالية</span>}
                                {isDone && <span className="text-[10px] font-semibold text-primary">مكتملة</span>}
                                {dueLabel && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarClock className="size-3" />{dueLabel}</span>}
                              </div>
                              <h4 className="mt-2 text-sm font-bold leading-6">{step.title}</h4>
                              <p className="mt-1 whitespace-pre-line text-xs leading-6 text-muted-foreground">{step.detail}</p>
                              {step.studyMethod && (
                                <details className="mt-3 rounded-xl border border-border/70 bg-muted/15 p-3">
                                  <summary className="cursor-pointer text-xs font-bold">طريقة المذاكرة والسبب وراء كل مرحلة</summary>
                                  <ol className="mt-3 space-y-3">
                                    {step.studyMethod.stages.map((stage, stageIndex) => (
                                      <li key={stageIndex} className="border-r-2 border-primary/35 pr-3">
                                        <p className="text-xs font-bold">{stageIndex + 1}. {stage.title}{stage.optional && <span className="mr-2 text-[10px] font-normal text-muted-foreground">(حسب المطلوب من المدرس)</span>}</p>
                                        <p className="mt-1 text-xs leading-6 text-foreground/90">{stage.instruction}</p>
                                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">ليه؟ {stage.reason}</p>
                                      </li>
                                    ))}
                                  </ol>
                                  {step.studyMethod.teacherPolicyNote && <p className="mt-3 rounded-lg bg-amber-500/5 p-2 text-[11px] leading-5 text-muted-foreground">{step.studyMethod.teacherPolicyNote}</p>}
                                  <p className="mt-3 border-t border-border/60 pt-3 text-xs font-semibold leading-6">متى تعتبر المهمة مكتملة؟ {step.studyMethod.completionCriteria}</p>
                                </details>
                              )}
                              {step.priorityReason && <details className="mt-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer">ليه المهمة دي في المرحلة دي؟</summary><p className="mt-2 max-w-xl leading-6">{step.priorityReason}</p></details>}
                              {step.resourceRecommendation && <a href={step.resourceRecommendation.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] font-semibold text-primary">افتح شرح المدرس المقترح</a>}
                              {editable && (
                                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/50 pt-2">
                                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setEditing({ index, title: step.title, detail: step.detail })}>تعديل</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={index === 0} onClick={() => onMoveStep(index, -1)}><ArrowUp className="size-3.5" /> لأعلى</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" disabled={index === plan.steps.length - 1} onClick={() => onMoveStep(index, 1)}><ArrowDown className="size-3.5" /> لأسفل</Button>
                                  <Button type="button" variant="ghost" size="sm" className="mr-auto h-8 px-2 text-xs text-destructive" disabled={plan.steps.length <= 1} onClick={() => onRemoveStep(index)}><X className="size-3.5" /> حذف</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }) : (
                    <p className="p-4 text-xs leading-6 text-muted-foreground">لا توجد مهمة موثقة لهذه المرحلة في دورة التخطيط الحالية. لن نضيف عملًا افتراضيًا لمجرد ملء القائمة.</p>
                  )}
                </div>
                <footer className="border-t border-border/60 bg-muted/10 px-4 py-3 text-[11px] leading-6 text-muted-foreground">
                  متى نعتبر المرحلة تقدمت؟ {phase.completionCriteria}
                </footer>
              </section>
            );
          })}
        </div>

        {editable && (
          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" onClick={onAddStep}><Plus className="size-3.5" /> إضافة مهمة</Button>
              <p className="self-center text-xs leading-5 text-muted-foreground">الاعتماد يضيف المهام إلى قائمتك. المواعيد لا تُنشأ إلا من موعد حقيقي أو من جدول المدرس.</p>
            </div>
            <Button type="button" className="h-11 rounded-xl px-6" onClick={onApprove} disabled={approving || plan.steps.length === 0 || !plan.title.trim()}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} اعتماد المهام وإضافتها
            </Button>
          </div>
        )}
        <details className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <summary className="cursor-pointer text-xs font-semibold">تفاصيل إضافية</summary>
          <div className="mt-3 whitespace-pre-line text-xs leading-6 text-muted-foreground">{plan.summary}</div>
          {plan.habits.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{plan.habits.map((habit, index) => <div key={habit.title + ":" + index} className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-foreground">{habit.title}</p><p className="mt-1 text-xs leading-5">{habit.cue}</p></div>)}</div>}
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
