import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { displayBranchTitle, displayCurriculumTitle } from "@/lib/curriculum-display";
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
  const [plannerTab, setPlannerTab] = useState<"overview" | "schedule" | "curriculum" | "tasks" | "history">("overview");

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
          subjectId,
          branchId: branch.branchId,
          subject: getSIESubject(subjectId)?.nameAr ?? subjectId,
          branch: displayBranchTitle(branch.branchTitle),
          lastCompleted: gap?.studentFrontierTitle ? displayCurriculumTitle(gap.studentFrontierTitle) : (nextIndex === 0 ? "لم يبدأ بعد" : "غير محدد"),
          next: next?.title ? displayCurriculumTitle(next.title) : (gap?.studentPosition === branch.choices.length ? "اكتمل الفرع" : "غير محدد"),
          completedCount: typeof nextIndex === "number" ? Math.max(0, Math.min(nextIndex, branch.choices.length)) : null,
          totalCount: branch.choices.length,
          gapCount: gap?.gapCount ?? null,
          reference: gap?.referenceFrontierTitle ? displayCurriculumTitle(gap.referenceFrontierTitle) : "غير مسجل",
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



  const planStepCount = plan?.steps.length ?? 0;
  const completedPlanCount = plan?.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length ?? 0;
  const planProgress = planStepCount ? Math.round((completedPlanCount / planStepCount) * 100) : 0;
  const nextPlanStep = plan?.steps.find(step => step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done") ?? null;
  const plannedMinutes = plan?.steps.reduce((sum, step) => sum + (Number.isFinite(step.minutes) ? Math.max(0, step.minutes) : 0), 0) ?? 0;
  const taskRows = tasksQuery.data ?? [];
  const openTaskRows = taskRows.filter(task => task.status !== "done");
  const overdueTaskRows = openTaskRows.filter(task => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const todayTaskRows = openTaskRows.filter(task => task.dueAt && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(task.dueAt)) === todayCairo);
  const curriculumGapCount = progressPreview.reduce((sum, item) => sum + (typeof item.gapCount === "number" ? item.gapCount : 0), 0);
  const planNeedsRefresh = Boolean(activeDailyPlan.data?.needsRefresh);

  return (
    <DashboardLayout title="خطة المذاكرة" description="مساحة واحدة لفهم أولوياتك، وتنظيم جلساتك، ومتابعة ما أنجزته.">
      <div className="sf-study-plan-v2">
        {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
        {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي. أعد المحاولة قبل إنشاء الخطة." />}

        <header className="sf-sp-hero" data-scroll-reveal>
          <div className="sf-sp-hero-copy">
            <div className="sf-sp-hero-meta">
              <span className="sf-sp-kicker">مساحة التخطيط الدراسي</span>
              <span className={"sf-sp-status " + (approved ? "is-active" : plan ? "is-draft" : "is-empty")}>
                {approved ? "خطة معتمدة" : plan ? "مسودة للمراجعة" : "لم تُنشأ خطة بعد"}
              </span>
              {planNeedsRefresh && approved && <span className="sf-sp-update-note">توجد بيانات جديدة تحتاج إلى إعادة ترتيب</span>}
            </div>
            <h1>خطة واضحة. جلسة وراء جلسة.</h1>
            <p>StudyFlow يربط المنهج وتقدمك الفعلي والمهام المسجلة وجدول المدرس، ثم يرتب لك الخطوة التالية. لا نعتبر الدرس مكتملًا لمجرد ظهوره في الخطة.</p>
            <div className="sf-sp-context">
              {profile.data?.track && <span>{profile.data.track}</span>}
              <span>{(profile.data?.subjectIds?.length ?? 0).toLocaleString("ar-EG")} مواد دراسية</span>
              <span>{dailyMinutes === 60 ? "حمل يومي خفيف" : dailyMinutes === 120 ? "حمل يومي متوازن" : "مساحة يومية أكبر"}</span>
            </div>
          </div>
          <div className="sf-sp-hero-progress">
            <div className="sf-sp-ring" style={{ background: "conic-gradient(var(--primary) " + planProgress + "%, color-mix(in srgb, var(--border) 88%, transparent) 0)" }}>
              <div className="sf-sp-ring-center">
                <strong>{plan ? planProgress.toLocaleString("ar-EG") + "%" : "—"}</strong>
                <span>إنجاز الخطة</span>
              </div>
            </div>
            <p>{plan ? completedPlanCount.toLocaleString("ar-EG") + " من " + planStepCount.toLocaleString("ar-EG") + " مهمة مكتملة" : "ستظهر نسبة التنفيذ بعد إنشاء الخطة واعتمادها."}</p>
          </div>
        </header>

        <section className="sf-sp-metrics" data-scroll-reveal aria-label="ملخص بيانات المذاكرة">
          <article className="sf-sp-metric"><span>المهام المفتوحة</span><strong>{tasksQuery.isLoading ? "…" : openTaskRows.length.toLocaleString("ar-EG")}</strong><small>من قائمة مهامك الفعلية</small></article>
          <article className="sf-sp-metric"><span>مهام مستحقة اليوم</span><strong>{tasksQuery.isLoading ? "…" : todayTaskRows.length.toLocaleString("ar-EG")}</strong><small>وفق المواعيد المسجلة</small></article>
          <article className="sf-sp-metric"><span>مهام تجاوزت موعدها</span><strong>{tasksQuery.isLoading ? "…" : overdueTaskRows.length.toLocaleString("ar-EG")}</strong><small>تحتاج إلى إعادة ترتيب</small></article>
          <article className="sf-sp-metric"><span>وقت الخطة المقترح</span><strong>{plan ? Math.round(plannedMinutes / 60 * 10) / 10 + " س" : "—"}</strong><small>{plan ? planStepCount.toLocaleString("ar-EG") + " مهمة في المقترح" : "يظهر بعد بناء الخطة"}</small></article>
        </section>

        <nav className="sf-sp-tabs" role="tablist" aria-label="أقسام خطة المذاكرة">
          {([
            ["overview", "الملخص", Sparkles],
            ["schedule", "الجدول", CalendarClock],
            ["curriculum", "المنهج", BrainCircuit],
            ["tasks", "المهام", CheckCircle2],
            ["history", "السجل", RefreshCw],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={plannerTab === key} className="sf-sp-tab" onClick={() => setPlannerTab(key)}>
              <Icon className="size-4" /><span>{label}</span>
            </button>
          ))}
        </nav>

        {plannerTab === "overview" && (
          <div className="sf-sp-panel sf-sp-overview-panel">
            <section className="sf-sp-overview-grid" data-scroll-reveal>
              <article className="sf-sp-focus-card">
                <div className="sf-sp-section-heading">
                  <div><span className="sf-sp-eyebrow">الخطوة التالية</span><h2>{nextPlanStep ? "ابدأ من هنا" : plan ? "أنهيت كل خطوات الخطة" : "ابدأ ببناء خطتك"}</h2></div>
                  <span className="sf-sp-focus-mark">{plan ? (approved ? "خطة فعّالة" : "تحتاج مراجعتك") : "خطوة البداية"}</span>
                </div>
                {nextPlanStep ? (
                  <>
                    <div className="sf-sp-focus-title">{displayCurriculumTitle(nextPlanStep.title)}</div>
                    <p className="sf-sp-focus-detail">{nextPlanStep.detail}</p>
                    <div className="sf-sp-step-meta">
                      {nextPlanStep.minutes > 0 && <span><CalendarClock className="size-3.5" />{nextPlanStep.minutes.toLocaleString("ar-EG")} دقيقة</span>}
                      {nextPlanStep.category && <span>{nextPlanStep.category}</span>}
                      {nextPlanStep.priority && <span>{({critical:"عاجلة",high:"أولوية عالية",medium:"متوسطة",low:"مرنة"} as Record<string,string>)[nextPlanStep.priority] || "أولوية عادية"}</span>}
                    </div>
                    <div className="sf-sp-focus-actions">
                      <Button type="button" onClick={() => setPlannerTab("schedule")}><ArrowUpRight className="size-4" />افتح تفاصيل الجلسة</Button>
                      <span>المدة تقديرية، وليست موعدًا ثابتًا.</span>
                    </div>
                  </>
                ) : plan ? (
                  <p className="sf-sp-focus-detail">تم تسجيل اكتمال جميع مهام الخطة الحالية. راجع تقدمك في المنهج أو أنشئ خطة محدثة عند تغيّر بياناتك.</p>
                ) : (
                  <p className="sf-sp-focus-detail">سيبدأ المحرك من ملفك الدراسي والمواد المختارة وآخر موضع مؤكد في كل فرع، ثم يوازن بين المتراكم وشرح المدرس والمراجعة.</p>
                )}
              </article>

              <aside className="sf-sp-builder-card">
                <div className="sf-sp-section-heading">
                  <div><span className="sf-sp-eyebrow">توزيع الحمل</span><h2>الوقت المتاح لك يوميًا</h2></div>
                </div>
                <p>اختر متوسط الوقت الذي تستطيع تخصيصه للمذاكرة. سيستخدمه المحرك لضبط حجم العمل، لا لفرض مواعيد ثابتة.</p>
                <div className="sf-sp-capacity-options">
                  {([[60,"ساعة","حمل أقل"],[120,"ساعتان","حمل متوازن"],[180,"3 ساعات","حمل أكبر"]] as const).map(([value,label,description]) => (
                    <button key={value} type="button" aria-pressed={dailyMinutes === value} className="sf-sp-capacity" onClick={() => setDailyMinutes(value)}>
                      <strong>{label}</strong><span>{description}</span>
                    </button>
                  ))}
                </div>
                <Button type="button" className="sf-sp-build-button" disabled={!isPreflightReady || generate.isPending || !profile.data?.subjectIds?.length} onClick={() => runGeneration(dailyMinutes)}>
                  {generate.isPending ? <><Loader2 className="size-4 animate-spin" /> جارٍ بناء الخطة</> : <>{plan ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}{plan ? "إعادة بناء الخطة" : "أنشئ خطة المذاكرة"}</>}
                </Button>
                <small>ستظهر المسودة أولًا للمراجعة. لن تُضاف المهام إلى قائمتك قبل اعتمادك.</small>
              </aside>
            </section>

            {generate.isPending && <PlanLoading progress={generationProgress.data ?? null} />}

            {!profile.isLoading && profile.data && profile.data.subjectIds.length === 0 && (
              <section className="sf-sp-empty" data-scroll-reveal>
                <h2>ملفك الدراسي يحتاج إلى استكمال</h2>
                <p>اختر الصف والمواد والمدرسين من ملفك الدراسي حتى نستطيع إنشاء خطة مرتبطة بمنهجك بدل اقتراح مهام عامة.</p>
                <a href="/profile"><ArrowUpRight className="size-4" />افتح الملف الدراسي</a>
              </section>
            )}

            <section className="sf-sp-snapshot" data-scroll-reveal>
              <div className="sf-sp-section-heading">
                <div><span className="sf-sp-eyebrow">صورة المنهج</span><h2>أين وصلت في المواد؟</h2></div>
                <button type="button" className="sf-sp-text-action" onClick={() => setPlannerTab("curriculum")}>عرض كل الفروع <ArrowUpRight className="size-4" /></button>
              </div>
              {profile.isLoading || learning.isLoading ? (
                <div className="sf-sp-skeletons"><span /><span /><span /></div>
              ) : progressPreview.length ? (
                <div className="sf-sp-snapshot-grid">
                  {progressPreview.slice(0,4).map(item => (
                    <article key={item.key} className="sf-sp-branch-card">
                      <div className="sf-sp-branch-heading"><span>{item.subject}</span><small>{item.branch}</small></div>
                      <strong>{item.next}</strong>
                      <p>آخر موضع مكتمل: {item.lastCompleted}</p>
                      <div className="sf-sp-branch-foot"><span>{item.gapCount === null ? "الفجوة غير محسوبة" : item.gapCount.toLocaleString("ar-EG") + " درس متأخر عن المرجع"}</span><span>{item.completedCount === null ? "التقدم غير محدد" : Math.round(item.completedCount / Math.max(1,item.totalCount) * 100).toLocaleString("ar-EG") + "%"}</span></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="sf-sp-empty-inline">لا توجد فروع منهج متاحة للمواد المحددة في ملفك بعد.</div>
              )}
            </section>

            {plan?.executionStrategy && (
              <section className="sf-sp-strategy" data-scroll-reveal>
                <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">منطق ترتيب الأولويات</span><h2>{plan.executionStrategy.objective}</h2></div></div>
                <p>{plan.executionStrategy.rationale}</p>
                {plan.executionStrategy.phases?.length ? (
                  <div className="sf-sp-phase-summary">
                    {plan.executionStrategy.phases.map((phase,index) => (
                      <article key={phase.id}><span>{(index+1).toLocaleString("ar-EG")}</span><div><strong>{phase.title}</strong><small>{phase.purpose}</small></div></article>
                    ))}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        )}

        {plannerTab === "schedule" && (
          <div className="sf-sp-panel" data-scroll-reveal>
            {plan ? (
              <PlanCard plan={plan} title={approved ? "الخطة المعتمدة" : loadedSavedDraft ? "مسودة محفوظة" : "مقترح للمراجعة"} studentName={profile.data?.studentName} editable={!approved} onChange={updatePlan} onApprove={approveCurrentPlan} onAddStep={addStep} onRemoveStep={removeStep} onMoveStep={moveStep} approving={approvePlan.isPending} approved={approved} />
            ) : (
              <section className="sf-sp-empty"><h2>لا يوجد جدول مذاكرة حالي</h2><p>أنشئ مقترحًا أولًا، ثم راجع توزيع المهام حسب اليوم والمرحلة واعتمده لإضافته إلى قائمتك.</p><Button type="button" onClick={() => setPlannerTab("overview")}>العودة إلى الملخص</Button></section>
            )}
          </div>
        )}

        {plannerTab === "curriculum" && (
          <div className="sf-sp-panel sf-sp-curriculum-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">تقدم موثّق</span><h2>خريطة ما أُنجز وما تبقى</h2></div><a href="/curriculum" className="sf-sp-text-action">فتح خريطة المنهج <ArrowUpRight className="size-4" /></a></div>
              <p className="sf-sp-muted-intro">نقطة الطالب ومرجع المدرس مستقلان. أي فرع لا توجد له بيانات كافية سيظهر كغير محدد بدل اعتباره صفرًا.</p>
              {progressPreview.length ? (
                <div className="sf-sp-curriculum-list">
                  {progressPreview.map(item => {
                    const percent = item.completedCount === null ? null : Math.round(item.completedCount / Math.max(1,item.totalCount) * 100);
                    return (
                      <article key={item.key} className="sf-sp-curriculum-row">
                        <div className="sf-sp-curriculum-main">
                          <div className="sf-sp-branch-heading"><span>{item.subject}</span><small>{item.branch}</small></div>
                          <strong>الخطوة التالية: {item.next}</strong>
                          <p>آخر درس مكتمل: {item.lastCompleted}</p>
                          <small>مرجع المدرس: {item.reference}</small>
                        </div>
                        <div className="sf-sp-curriculum-side">
                          <strong>{item.gapCount === null ? "غير محسوبة" : item.gapCount.toLocaleString("ar-EG") + " درس"}</strong>
                          <span>فجوة التقدم عن المرجع</span>
                          <div className="sf-sp-progress-track"><i style={{width:(percent ?? 0) + "%"}} /></div>
                          <small>{percent === null ? "لا توجد نقطة طالب مؤكدة" : percent.toLocaleString("ar-EG") + "% من الفرع"}</small>
                          <a href={"/study?subject=" + encodeURIComponent(item.subjectId) + "&branch=" + encodeURIComponent(item.branchId)}>افتح هذا الفرع <ArrowUpRight className="size-3.5" /></a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد بيانات منهج مرتبطة بالمواد المحددة.</div>}
              <div className="sf-sp-curriculum-total">إجمالي الفجوات المحسوبة: <strong>{curriculumGapCount.toLocaleString("ar-EG")}</strong> موضعًا عبر الفروع المعروفة فقط.</div>
            </section>
          </div>
        )}

        {plannerTab === "tasks" && (
          <div className="sf-sp-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">قائمة العمل الفعلية</span><h2>مهام مفتوحة تؤثر على ترتيب المذاكرة</h2></div><a href="/tasks" className="sf-sp-text-action">إدارة كل المهام <ArrowUpRight className="size-4" /></a></div>
              {taskProgressConflicts.length > 0 && <div className="sf-sp-conflict"><strong>تحتاج مراجعة حالة المنهج</strong><p>هناك {taskProgressConflicts.length.toLocaleString("ar-EG")} مهمة مرتبطة بموضع يظهر مكتملًا بالفعل في تقدم المنهج. إكمال المهمة لا يغيّر تقدم المنهج تلقائيًا.</p><a href="/curriculum">راجع خريطة المنهج</a></div>}
              {tasksQuery.isLoading ? <div className="sf-sp-skeletons"><span /><span /><span /></div> : mappedOpenTasks.length ? (
                <div className="sf-sp-task-list">
                  {mappedOpenTasks.map(({task,match}) => (
                    <article key={task.id} className="sf-sp-task-row">
                      <span className="sf-sp-task-check" aria-hidden="true" />
                      <div><strong>{task.title}</strong><p>{task.notes || "لا توجد تفاصيل إضافية مسجلة."}</p><small>{match ? (getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية") + " · " + displayCurriculumTitle(match.title) : task.category || "مهمة عامة"}</small></div>
                      <div className="sf-sp-task-meta"><span>{task.priority === "high" ? "أولوية عالية" : task.priority === "low" ? "مرنة" : "متوسطة"}</span><small>{task.dueAt ? new Intl.DateTimeFormat("ar-EG",{timeZone:"Africa/Cairo",day:"numeric",month:"short"}).format(new Date(task.dueAt)) : "بلا موعد"}</small></div>
                    </article>
                  ))}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد مهام مفتوحة مرتبطة بموادك حاليًا.</div>}
            </section>
          </div>
        )}

        {plannerTab === "history" && (
          <div className="sf-sp-panel">
            <section className="sf-sp-section-card" data-scroll-reveal>
              <div className="sf-sp-section-heading"><div><span className="sf-sp-eyebrow">النسخ المحفوظة</span><h2>سجل خططك السابقة</h2></div><span className="sf-sp-count">{savedPlans.length.toLocaleString("ar-EG")} خطة</span></div>
              {savedPlans.length ? (
                <div className="sf-sp-history-list">
                  {savedPlans.map(item => (
                    <article key={item.id} className="sf-sp-history-row">
                      <button type="button" onClick={() => {setPlan(item.plan);setApproved(false);setLoadedSavedDraft(true);setPlannerTab("schedule");}}>
                        <strong>{item.plan.title}</strong><span>{item.plan.summary}</span><small>{new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"long",year:"numeric"}).format(new Date(item.createdAt))}</small>
                      </button>
                      <Button type="button" variant="ghost" size="sm" disabled={deleteSavedPlan.isPending} onClick={() => {if(window.confirm("حذف هذه الخطة من السجل؟")) deleteSavedPlan.mutate({id:item.id});}}><Trash2 className="size-3.5" />حذف</Button>
                    </article>
                  ))}
                </div>
              ) : <div className="sf-sp-empty-inline">لا توجد مسودات محفوظة حتى الآن.</div>}
              {savedPlans.length > 0 && <div className="sf-sp-history-footer"><Button type="button" variant="ghost" className="text-destructive" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>{deleteAllPlans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} مسح كل الخطط المولّدة</Button></div>}
            </section>
          </div>
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
          <h3 className="font-bold">بنجهّز مسودة خطتك</h3>
          <p className="mt-1 text-sm text-muted-foreground">{progress?.detail || "نراجع ملفك الدراسي والمهام وتقدم المنهج قبل ترتيب الأولويات."}</p>
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
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const completedCount = plan.steps.filter(step => step.plannerTaskStatus === "done" || step.existingTask?.status === "done").length;
  const totalMinutes = plan.steps.reduce((sum, step) => sum + Math.max(0, Number(step.minutes) || 0), 0);
  const dayGroups = Array.from(plan.steps.reduce((groups, step, index) => {
    const key = step.scheduleState === "deferred" ? "خارج فترة الخطة" : step.day?.trim() || (typeof step.dayIndex === "number" ? "اليوم " + (step.dayIndex + 1) : "غير محدد اليوم");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ step, index });
    return groups;
  }, new Map<string, Array<{step: PlanStep; index: number}>>()).entries());
  const visibleGroups = dayGroups.map(([day, items]) => ({
    day,
    items: items.filter(({step}) => filter === "all" || (filter === "done"
      ? step.plannerTaskStatus === "done" || step.existingTask?.status === "done"
      : step.plannerTaskStatus !== "done" && step.existingTask?.status !== "done")),
  })).filter(group => group.items.length > 0);
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
  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", day: "numeric", month: "short" }).format(date);
  };
  const priorityLabel: Record<string,string> = {critical:"عاجلة",high:"أولوية عالية",medium:"متوسطة",low:"مرنة"};
  const difficultyLabel: Record<string,string> = {easy:"خفيف",medium:"متوسط",hard:"يحتاج تركيزًا",unknown:"غير محدد"};
  const phaseLabel: Record<string,string> = {backlog:"المتراكم",teacher_sync:"مواكبة المدرس",steady:"التثبيت"};
  return (
    <section className="sf-sp-plan-board">
      <header className="sf-sp-board-header">
        <div className="sf-sp-board-title">
          <span className="sf-sp-eyebrow">تفاصيل التنفيذ</span>
          <div className="sf-sp-section-heading">
            <div><h2>{plan.title || "خطة المذاكرة"}</h2><p>{plan.summary.split("\n\n")[0]}</p></div>
            <span className={"sf-sp-status " + (approved ? "is-active" : "is-draft")}>{approved ? "معتمدة" : "بانتظار الاعتماد"}</span>
          </div>
          {studentName && <small>مبنية على البيانات المسجلة في ملف {studentName}</small>}
        </div>
        <PlanExportActions plan={plan} studentName={studentName} />
      </header>

      <div className="sf-sp-board-metrics">
        <article><span>إجمالي المهام</span><strong>{plan.steps.length.toLocaleString("ar-EG")}</strong></article>
        <article><span>المكتمل</span><strong>{completedCount.toLocaleString("ar-EG")}</strong></article>
        <article><span>الوقت التقديري</span><strong>{totalMinutes.toLocaleString("ar-EG")} دقيقة</strong></article>
        <article><span>المؤجل خارج الفترة</span><strong>{plan.steps.filter(step => step.scheduleState === "deferred").length.toLocaleString("ar-EG")}</strong></article>
      </div>

      {plan.executionStrategy && (
        <section className="sf-sp-plan-rationale">
          <span className="sf-sp-eyebrow">لماذا هذا الترتيب؟</span>
          <h3>{plan.executionStrategy.objective}</h3>
          <p>{plan.executionStrategy.rationale}</p>
          {plan.executionStrategy.phases?.length ? (
            <div className="sf-sp-phase-summary">
              {plan.executionStrategy.phases.map((phase,index) => (
                <article key={phase.id}><span>{(index+1).toLocaleString("ar-EG")}</span><div><strong>{phase.title}</strong><small>{phase.purpose}</small></div></article>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {plan.quality && (
        <section className={"sf-sp-quality sf-sp-quality-" + plan.quality.status}>
          <div><strong>{plan.quality.status === "ready" ? "الخطة جاهزة للاعتماد" : plan.quality.status === "partial" ? "الخطة تحتاج مراجعة" : "هناك عائق يمنع الاعتماد"}</strong><p>تقييم التوزيع: {plan.quality.score.toLocaleString("ar-EG")} من 100. الحمل اليومي الأقصى {plan.quality.stats.maxDailyLoadMinutes.toLocaleString("ar-EG")} دقيقة.</p></div>
          <div>{plan.quality.blockers.map((item,index)=><small key={"b"+index}>{item}</small>)}{plan.quality.warnings.map((item,index)=><small key={"w"+index}>{item}</small>)}</div>
        </section>
      )}

      <div className="sf-sp-board-toolbar">
        <div><h3>توزيع الجلسات</h3><p>افتح تفاصيل أي مهمة لمعرفة المطلوب وطريقة تنفيذها.</p></div>
        <div className="sf-sp-filter-group" role="group" aria-label="تصفية مهام الخطة">
          {([["all","الكل"],["open","المتبقي"],["done","المكتمل"]] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
        </div>
      </div>

      <div className="sf-sp-day-groups">
        {visibleGroups.length ? visibleGroups.map(group => (
          <section className="sf-sp-day-group" key={group.day}>
            <header><div><span className="sf-sp-day-dot" /><h4>{group.day}</h4></div><small>{group.items.length.toLocaleString("ar-EG")} مهمة</small></header>
            <div className="sf-sp-day-items">
              {group.items.map(({step,index}) => {
                const isDone = step.plannerTaskStatus === "done" || step.existingTask?.status === "done";
                return (
                  <article key={step.plannerTaskId ?? step.existingTask?.id ?? step.sourceStepIndex ?? index} className={"sf-sp-plan-step " + (isDone ? "is-done" : "")}>
                    {editing?.index === index ? (
                      <div className="sf-sp-step-editor">
                        <label><span>عنوان المهمة</span><input value={editing.title} onChange={event => setEditing(current => current ? {...current,title:event.target.value} : current)} /></label>
                        <label><span>تفاصيل التنفيذ</span><textarea rows={3} value={editing.detail} onChange={event => setEditing(current => current ? {...current,detail:event.target.value} : current)} /></label>
                        <div><Button type="button" variant="ghost" size="sm" onClick={()=>setEditing(null)}>إلغاء</Button><Button type="button" size="sm" onClick={saveEdit}>حفظ التعديل</Button></div>
                      </div>
                    ) : (
                      <>
                        <div className="sf-sp-step-index">{isDone ? <CheckCircle2 className="size-4" /> : (index+1).toLocaleString("ar-EG")}</div>
                        <div className="sf-sp-step-content">
                          <div className="sf-sp-step-tags">
                            {step.category && <span>{step.category}</span>}
                            {step.phaseId && <span>{phaseLabel[step.phaseId] || "مرحلة الخطة"}</span>}
                            {step.priority && <span>{priorityLabel[step.priority] || "أولوية عادية"}</span>}
                            {step.difficulty && <span>{difficultyLabel[step.difficulty] || "غير محدد"}</span>}
                            {step.minutes > 0 && <span><CalendarClock className="size-3" />{step.minutes.toLocaleString("ar-EG")} دقيقة</span>}
                            {step.existingTask && <span>مهمة مسجلة مسبقًا</span>}
                            {step.scheduleState === "deferred" && <span>مؤجلة خارج الفترة</span>}
                            {isDone && <span>مكتملة</span>}
                            {formatDate(step.existingTask?.dueAt) && <span>موعدها {formatDate(step.existingTask?.dueAt)}</span>}
                          </div>
                          <h4>{displayCurriculumTitle(step.title)}</h4>
                          {step.sourceTitle && <small className="sf-sp-source-title">مرجع الدرس: {displayCurriculumTitle(step.sourceTitle)}</small>}
                          <p>{step.detail}</p>
                          {step.scheduleNote && <small className="sf-sp-source-title">{step.scheduleNote}</small>}
                          {step.studyMethod && (
                            <details className="sf-sp-study-method">
                              <summary>طريقة تنفيذ الجلسة — {step.studyMethod.stages.length} مراحل</summary>
                              <ol>
                                {step.studyMethod.stages.map((stage,stageIndex) => (
                                  <li key={stageIndex}>
                                    <strong>{(stageIndex+1).toLocaleString("ar-EG")}. {stage.title}</strong>
                                    {stage.optional && <span>اختياري حسب تكليف المدرس</span>}
                                    <p>{stage.instruction}</p>
                                    <small>الهدف من المرحلة: {stage.reason}</small>
                                  </li>
                                ))}
                              </ol>
                              <p className="sf-sp-completion-rule">معيار الإكمال: {step.studyMethod.completionCriteria}</p>
                              {step.studyMethod.teacherPolicyNote && <small>{step.studyMethod.teacherPolicyNote}</small>}
                            </details>
                          )}
                          {step.priorityReason && <details className="sf-sp-step-extra"><summary>لماذا ظهرت هذه المهمة هنا؟</summary><p>{step.priorityReason}</p></details>}
                          {step.resourceRecommendation && <a className="sf-sp-resource-link" href={step.resourceRecommendation.url} target="_blank" rel="noreferrer">افتح شرح المدرس المقترح <ArrowUpRight className="size-3.5" /></a>}
                          {editable && (
                            <div className="sf-sp-step-actions">
                              <Button type="button" size="sm" variant="ghost" onClick={()=>setEditing({index,title:step.title,detail:step.detail})}>تعديل</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={index===0} onClick={()=>onMoveStep(index,-1)}><ArrowUp className="size-3.5" />لأعلى</Button>
                              <Button type="button" size="sm" variant="ghost" disabled={index===plan.steps.length-1} onClick={()=>onMoveStep(index,1)}><ArrowDown className="size-3.5" />لأسفل</Button>
                              <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={plan.steps.length<=1} onClick={()=>onRemoveStep(index)}><X className="size-3.5" />حذف</Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )) : <div className="sf-sp-empty-inline">{filter === "done" ? "لا توجد مهام مكتملة في هذا العرض." : filter === "open" ? "لا توجد مهام متبقية." : "لا توجد مهام ضمن الفلتر الحالي."}</div>}
      </div>

      {editable ? (
        <footer className="sf-sp-board-footer">
          <Button type="button" variant="outline" onClick={onAddStep}><Plus className="size-4" />أضف مهمة</Button>
          <div><small>سيعاد فحص توزيع الخطة عند اعتمادها. لن تُنشأ مواعيد أو واجبات غير مسجلة.</small><Button type="button" onClick={onApprove} disabled={approving || !plan.steps.length || !plan.title.trim()}>{approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}اعتماد الخطة وإضافة المهام</Button></div>
        </footer>
      ) : (
        <footer className="sf-sp-approved-footer"><CheckCircle2 className="size-4" /><span>هذه الخطة معتمدة، والمهام مرتبطة بقائمة عملك. تعديل المصدر يتم من المهام أو من تقدم المنهج.</span>{plan.taskSync && <strong>{plan.taskSync.taskCount.toLocaleString("ar-EG")} مهمة مرتبطة</strong>}</footer>
      )}

      <details className="sf-sp-plan-extra"><summary>ملخص إضافي ومساعد الخطة</summary><p>{plan.summary}</p>{plan.habits.length > 0 && <div className="sf-sp-habits">{plan.habits.map((habit,index)=><article key={habit.title+index}><strong>{habit.title}</strong><small>{habit.cue}</small></article>)}</div>}<PlanAssistantChat plan={plan} /></details>
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
