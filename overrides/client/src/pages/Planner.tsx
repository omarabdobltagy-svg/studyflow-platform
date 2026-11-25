import DashboardLayout from "@/components/DashboardLayout";
import PlanExportActions from "@/components/PlanExportActions";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  getSIECheckpointProgressBranches,
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
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Pace = "intensive" | "balanced" | "relaxed";
type PaceLevel = 1 | 2 | 3;
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
};
type PlanView = {
  title: string;
  summary: string;
  durationLabel: string;
  steps: PlanStep[];
  habits: { title: string; cue: string }[];
  // Export component compatibility only; deliberately blank so no AI self-test is created.
  reviewQuestion: string;
  taskSync?: { parentGoalId: number; stageCount: number; taskCount: number; routineId?: number | null };
};
const PLANNING_READY_BY = "2027-06-11";
const DAILY_SNAPSHOT_PREFIX = "SIE_DAILY_PLAN_V4:";
const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const initialPrompt = "أنشئ الخطة السنوية الكاملة للعام الدراسي 2026–2027 حتى الجاهزية قبل 11 يونيو 2027. غطِّ المنهج كله في المواد المختارة، وانطلق من آخر موضوع مكتمل في كل فرع. ادمج المهام الحالية دون تكرارها، ولا تعتبر المهمة دليلًا على اكتمال الدرس. لا تنشئ اختبارات أو أسئلة أو واجبات من عندك.";
const paceOptions: Array<{ value: Pace; title: string; subtitle: string }> = [
  { value: "intensive", title: "مكثفة", subtitle: "إنجاز أسرع مع حمل أعلى محسوب" },
  { value: "balanced", title: "متوازنة", subtitle: "تقدم ثابت ومساحة للتعويض" },
  { value: "relaxed", title: "مرنة ومريحة", subtitle: "جلسات أخف وحرية أكبر في التنفيذ" },
];
const paceLevelOptions: Record<Pace, Array<{ value: PaceLevel; title: string; description: string }>> = {
  intensive: [
    { value: 1, title: "مكثفة محسوبة", description: "تقدم أسرع مع الحفاظ على جلسات الفهم والراحة." },
    { value: 2, title: "مكثفة عالية", description: "حمل مرتفع وهامش تعويض أصغر دون تجاوز وقتك." },
    { value: 3, title: "مكثفة قصوى", description: "أعلى كثافة قابلة للتنفيذ فقط؛ لا تحميل فوق طاقتك." },
  ],
  balanced: [
    { value: 1, title: "متوازنة خفيفة", description: "حمل أخف وتقدم ثابت مع مساحة واسعة للتعويض." },
    { value: 2, title: "متوازنة نشطة", description: "توازن بين الإنجاز والفهم والمراجعة والتعويض." },
    { value: 3, title: "متوازنة سريعة", description: "تقدم أسرع دون تحويل كل الأيام إلى ضغط مكثف." },
  ],
  relaxed: [
    { value: 1, title: "مرنة جدًا", description: "جلسات أقل في البداية ومرونة واسعة حسب ظروفك." },
    { value: 2, title: "راحة نشطة", description: "حمل مريح ومنتظم مع هدف واضح دون ضغط زائد." },
    { value: 3, title: "مرنة قوية", description: "مرونة في التنفيذ مع إنجاز أعلى قليلًا ووقت للاستيعاب." },
  ],
};

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
      reviewQuestion: "",
    };
  } catch {
    return null;
  }
}

export default function Planner() {
  const utils = trpc.useUtils();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [pace, setPace] = useState<Pace>("balanced");
  const [paceLevel, setPaceLevel] = useState<PaceLevel>(2);
  const [dailyMinutes, setDailyMinutes] = useState(120);
  const [daysPerWeek, setDaysPerWeek] = useState<5 | 6 | 7>(6);
  const [usePersonalDeadline, setUsePersonalDeadline] = useState(false);
  const [personalDeadline, setPersonalDeadline] = useState("");
  const [approved, setApproved] = useState(false);
  const [loadedSavedDraft, setLoadedSavedDraft] = useState(false);
  const historyInitialized = useRef(false);

  const history = trpc.plans.list.useQuery();
  const profile = trpc.studentProfile.get.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const learning = trpc.learning.get.useQuery(undefined, { staleTime: 15_000 });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { staleTime: 15_000 });

  const progressPreview = useMemo(() => {
    const subjects = profile.data?.subjectIds ?? [];
    const gaps = (learning.data as any)?.gapByBranch ?? {};
    return subjects.flatMap(subjectId =>
      getSIECheckpointProgressBranches(subjectId).map(branch => {
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
    .filter(record => !String(record.prompt || "").startsWith(DAILY_SNAPSHOT_PREFIX))
    .flatMap(record => {
      const saved = parseSavedPlan(record);
      return saved ? [{ id: record.id, createdAt: record.createdAt, plan: saved }] : [];
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [history.data]);

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
      toast.success("المسودة جاهزة. راجعها واضبطها قبل اعتماد المهام.");
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
      setPlan(current => current ? {
        ...current,
        taskSync: {
          parentGoalId: result.parentGoalId,
          stageCount: result.taskCount,
          taskCount: result.taskCount,
          routineId: result.routineId ?? null,
        },
      } : current);
      await Promise.all([
        utils.plans.currentDaily.invalidate(),
        utils.tasks.list.invalidate(),
        utils.goals.list.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.plans.list.invalidate(),
      ]);
      toast.success(`تم اعتماد الخطة السنوية وربط ${result.taskCount} خطوة بالمهام.`);
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

  const runGeneration = (selectedPace: Pace, selectedLevel: PaceLevel, selectedMinutes: number, selectedDays: 5 | 6 | 7, deadline: string | null) => {
    if (deadline && deadline < todayCairo) {
      toast.error("الموعد الشخصي يجب أن يكون اليوم أو في المستقبل.");
      return;
    }
    generate.mutate({
      prompt: initialPrompt,
      includeStudentProfile: true,
      dailyMinutes: selectedMinutes,
      daysPerWeek: selectedDays,
      startDate: todayCairo,
      pace: selectedPace,
      paceLevel: selectedLevel,
      deadline,
    });
  };

  useEffect(() => {
    if (history.isLoading || history.isError || historyInitialized.current) return;
    historyInitialized.current = true;
    // Open the most recent saved annual draft instead of silently generating
    // and storing another copy every time the student visits this page.
    if (savedPlans.length > 0) {
      setPlan(savedPlans[0].plan);
      setLoadedSavedDraft(true);
    }
  }, [history.isLoading, history.isError, savedPlans]);

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
      schedule: { startDate: todayCairo, dailyMinutes, daysPerWeek },
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
      title="المخطط الذكي"
      description="ابنِ خارطة العام الدراسي كاملة من بيانات المنصة، ثم اعتمد توزيعها على مراحل وأسابيع."
    >
      <div className="space-y-5">
        {history.isError && <QueryErrorNotice onRetry={() => void history.refetch()} label="تعذّر تحميل خططك المحفوظة." />}
        {profile.isError && <QueryErrorNotice onRetry={() => void profile.refetch()} label="تعذّر تحميل ملفك الدراسي. أعد المحاولة قبل توليد الخطة." />}

        <section className="relative overflow-hidden rounded-[1.6rem] border border-stone-700/60 bg-gradient-to-l from-[#24211d] via-[#1b1a18] to-[#342c24] p-5 text-white shadow-xl sm:p-7">
          <div className="pointer-events-none absolute -left-12 -top-16 size-56 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold tracking-[0.2em] text-amber-100/75">STUDYFLOW · AI STUDY PLAN</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">خطة واحدة. قرار واضح. وتنفيذ تحت سيطرتك.</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                الذكاء الاصطناعي يبني المسودة من موادك وتقدمك وتراكمك. أنت تراجع المهام وتغيّرها قبل أن تتحول إلى جدول تنفيذ.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-100"><CalendarClock className="size-4" />موعد امتحان نهاية السنة</div>
              <div className="mt-2 text-xl font-bold">12–22 يونيو 2027</div>
              <p className="mt-1 text-[11px] text-slate-300">فترة امتحانات تقريبية — الجاهزية المستهدفة قبل 11 يونيو</p>
            </div>
          </div>
          {profile.data && (
            <div className="relative mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.studentName}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.track}</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">{profile.data.subjectIds.length} مواد محددة</span>
            </div>
          )}
        </section>

        {!profile.isLoading && profile.data && (!profile.data.subjectIds || profile.data.subjectIds.length === 0) && (
          <section className="app-card rounded-2xl p-5">
            <h3 className="font-bold">أكمل ملفك الدراسي أولًا</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">حدد نظامك وصفك وموادك حتى يستطيع المخطط اختيار الدروس الصحيحة بدل إنشاء خطة عامة.</p>
            <a href="/profile" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">فتح الملف الدراسي <ArrowUpRight className="size-4" /></a>
          </section>
        )}

        <section className="app-card overflow-hidden rounded-[1.6rem] border border-border/80">
          <header className="border-b border-border/70 bg-gradient-to-l from-secondary/65 to-card p-5 sm:p-6">
            <p className="eyebrow">ANNUAL PLAN · 2026 / 2027</p>
            <h2 className="mt-1 text-xl font-bold">قبل ما نبني خطتك السنوية</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">راجع البيانات التي ستدخل في التخطيط، ثم حدّد وقتك وإيقاعك. لن يُنشئ النظام خطة متراكمات منفصلة، ولن يعتبر وجود مهمة دليلًا على أنك أنهيت الدرس.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="المواد المختارة" value={(profile.data?.subjectIds?.length ?? 0).toLocaleString("ar-EG")} />
              <Metric label="المهام المفتوحة" value={(tasksQuery.data ?? []).filter((task: any) => task.status !== "done").length.toLocaleString("ar-EG")} />
              <Metric label="مهام مرتبطة بالمنهج" value={curriculumLinkedTasks.length.toLocaleString("ar-EG")} />
              <Metric label="فروع تقدم مقروءة" value={progressPreview.length.toLocaleString("ar-EG")} />
            </div>
          </header>

          <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold">إعدادات الدراسة السنوية</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">دي تفضيلات الخطة من البداية، ومش هنطلب منك تعيد إدخال تقدم أو مهام موجودة بالفعل.</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">إيقاع الخطة</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {paceOptions.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setPace(option.value)}
                      aria-pressed={pace === option.value}
                      className={"rounded-xl border p-3 text-right transition " + (pace === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/20 hover:border-primary/40")}
                    >
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">درجة الكثافة</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {paceLevelOptions[pace].map(option => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setPaceLevel(option.value)}
                      aria-pressed={paceLevel === option.value}
                      className={"rounded-xl border p-3 text-right transition " + (paceLevel === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/20 hover:border-primary/40")}
                    >
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">وقت المذاكرة في اليوم</span>
                  <select
                    value={dailyMinutes}
                    onChange={event => setDailyMinutes(Number(event.target.value))}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    {[60, 90, 120, 150, 180, 210, 240, 300, 360, 420].map(value => (
                      <option key={value} value={value}>{formatStudyDuration(value)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">أيام الدراسة في الأسبوع</span>
                  <select
                    value={daysPerWeek}
                    onChange={event => setDaysPerWeek(Number(event.target.value) as 5 | 6 | 7)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value={5}>5 أيام + يومان راحة</option>
                    <option value={6}>6 أيام + يوم راحة</option>
                    <option value={7}>7 أيام</option>
                  </select>
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">هل عندك موعد شخصي قبل الامتحانات؟</p>
                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 text-sm">
                  <input type="checkbox" checked={usePersonalDeadline} onChange={event => setUsePersonalDeadline(event.target.checked)} className="size-4 accent-primary" />
                  نعم، عندي موعد إضافي
                </label>
                {usePersonalDeadline && (
                  <input
                    type="date"
                    min={todayCairo}
                    max={PLANNING_READY_BY}
                    value={personalDeadline}
                    onChange={event => setPersonalDeadline(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                  />
                )}
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-xs leading-6 text-muted-foreground">
                الهدف الافتراضي: إنهاء الاستعداد الأساسي قبل 11 يونيو 2027، مع نافذة امتحانات تقريبية من 12 إلى 22 يونيو 2027. اليوميات والمهام الحالية ستبقى منفصلة عن الخطة السنوية.
              </div>
              <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">الخطة ستغطي كل الموضوعات غير المكتملة وتُظهر المهام الموجودة بدل نسخها.</p>
                <Button
                  className="rounded-xl px-5"
                  onClick={() => runGeneration(pace, paceLevel, dailyMinutes, daysPerWeek, usePersonalDeadline ? personalDeadline : null)}
                  disabled={!isPreflightReady || generate.isPending || (usePersonalDeadline && !personalDeadline)}
                >
                  {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {loadedSavedDraft ? "إعادة بناء الخطة السنوية" : "إنشاء الخطة السنوية"}
                </Button>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <h3 className="font-bold">ما تقرأه المنصة الآن</h3>
                {profile.isLoading || learning.isLoading || tasksQuery.isLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">جارٍ قراءة الملف والتقدم والمهام...</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">الموضوع التالي محسوب بعد آخر موضوع مكتمل، ومرجع المدرس ظاهر للمقارنة فقط.</p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                      {progressPreview.slice(0, 12).map(item => (
                        <div key={item.key} className="rounded-lg border border-border/70 bg-card p-3">
                          <p className="text-xs font-bold">{item.subject} · {item.branch}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">آخر موضوع مكتمل: {item.lastCompleted}</p>
                          <p className="mt-1 text-xs font-semibold text-primary">التالي: {item.next}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">مرجع المدرس: {item.reference}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
                <h3 className="font-bold">المهام التي ستُدمج</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{curriculumLinkedTasks.length} مهمة مفتوحة تطابقت مع موضوعات المنهج؛ سيتم إظهارها بدل إنشاء نسخ أخرى.</p>
                {curriculumLinkedTasks.slice(0, 5).map(({ task, match }) => (
                  <p key={task.id} className="mt-2 rounded-lg bg-card px-3 py-2 text-xs">
                    <b>{task.title}</b>
                    {match && <span className="block mt-1 text-muted-foreground">{getSIESubject(match.subjectId)?.nameAr} · {match.branchTitle} · {match.title}</span>}
                  </p>
                ))}
              </div>
              {taskProgressConflicts.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
                  <h3 className="text-sm font-bold">تعارض يحتاج مراجعة</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">فيه مهمة مفتوحة مرتبطة بموضوع مسجل كمكتمل. المنصة لن تغيّر التقدم تلقائيًا.</p>
                  {taskProgressConflicts.slice(0,3).map(({ task, match }) => <p key={task.id} className="mt-2 text-xs">{task.title} — {match?.title}</p>)}
                  <a href="/study" className="mt-2 inline-flex text-xs font-semibold text-primary">مراجعة تقدم المنهج</a>
                </div>
              )}
              {(profile.isError || learning.isError || tasksQuery.isError) && (
                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">تعذر قراءة كل البيانات الحالية؛ أعد المحاولة قبل إنشاء الخطة حتى لا تُبنى على بيانات ناقصة.</div>
              )}
            </aside>
          </div>
        </section>

        {generate.isPending && !plan && <PlanLoading progress={generationProgress.data ?? null} />}
        {!generate.isPending && !plan && !history.isLoading && !profile.isLoading && profile.data?.subjectIds?.length && (
          <section className="app-card rounded-2xl p-4 text-sm text-muted-foreground">
            لم تُنشأ مسودة سنوية بعد. أكمل إعدادات الخطة أعلاه ثم ابدأ التوليد.
          </section>
        )}

        {plan && (
          <>
            {loadedSavedDraft && !approved && (
              <section className="app-card flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">أنت تعرض مسودة محفوظة من زيارة سابقة</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">قد لا تعكس آخر تقدم سجلته في الفروع. حدّثها الآن ليُعاد حساب الدروس المتبقية وترتيب الأولويات من ملفك الحالي.</p>
                </div>
                <Button
                  type="button"
                  className="shrink-0 rounded-xl"
                  onClick={() => runGeneration(pace, paceLevel, dailyMinutes, daysPerWeek, usePersonalDeadline ? personalDeadline : null)}
                  disabled={generate.isPending}
                >
                  {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  تحديث حسب تقدمي الحالي
                </Button>
              </section>
            )}
            <PlanCard
              plan={plan}
              title={approved ? "الخطة السنوية المعتمدة" : loadedSavedDraft ? "آخر مسودة سنوية محفوظة" : "مسودة الخطة السنوية"}
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

          </>
        )}

        {savedPlans.length > 0 && (
          <section className="app-card rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">PLAN HISTORY</p>
                <h3 className="mt-1 text-lg font-bold">المسودات السابقة</h3>
                <p className="mt-1 text-xs text-muted-foreground">اختر مسودة قديمة لفتحها ومراجعتها من جديد.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{savedPlans.length} محفوظة</span>
                <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>
                  {deleteAllPlans.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  مسح كل الخطط
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {savedPlans.map(item => (
                <article key={item.id} className="rounded-xl border border-border/70 bg-muted/15 p-3">
                  <button
                    type="button"
                    onClick={() => { setPlan(item.plan); setApproved(false); setLoadedSavedDraft(true); }}
                    className="w-full text-right"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="size-4 text-primary" />{item.plan.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.plan.summary}</span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</span>
                  </button>
                  <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                      disabled={deleteSavedPlan.isPending}
                      onClick={() => {
                        if (window.confirm("حذف هذه المسودة من السجل؟")) deleteSavedPlan.mutate({ id: item.id });
                      }}
                    >
                      <Trash2 className="size-3.5" />حذف
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {(savedPlans.length === 0 && !history.isLoading) && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" className="text-xs text-muted-foreground" onClick={handleDeleteAll} disabled={deleteAllPlans.isPending}>
              مسح بيانات الخطط والمهام المولّدة القديمة
            </Button>
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
  const totalMinutes = plan.steps.reduce((sum, step) => sum + step.minutes, 0);
  const coveredTopics = new Set(plan.steps.flatMap(step => step.curriculumNodeIds ?? [])).size;
  const dayCount = new Set(plan.steps.map(step => step.day || "غير مجدول")).size;
  const highPriorityCount = plan.steps.filter(step => step.priority === "critical" || step.priority === "high").length;
  const firstStep = plan.steps[0];
  const dayGroups: Array<{ day: string; steps: Array<{ step: PlanStep; index: number }> }> = [];
  plan.steps.forEach((step, index) => {
    const day = step.day || "غير مجدول";
    let group = dayGroups.find(item => item.day === day);
    if (!group) {
      group = { day, steps: [] };
      dayGroups.push(group);
    }
    group.steps.push({ step, index });
  });
  const priorityLabel = (value?: string) => value === "critical" ? "عاجل" : value === "high" ? "أولوية عالية" : value === "low" ? "منخفضة" : "متوسطة";
  const difficultyLabel = (value?: string) => value === "hard" ? "صعب" : value === "easy" ? "سهل" : value === "medium" ? "متوسط" : "غير محدد";
  return (
    <section className="app-card overflow-hidden rounded-2xl border border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-l from-secondary/60 to-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{title}</p>
            <input
              aria-label="عنوان الخطة"
              disabled={!editable}
              value={plan.title}
              onChange={event => onChange({ ...plan, title: event.target.value })}
              className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-xl font-bold outline-none focus:border-primary/40 focus:bg-background/60 disabled:opacity-100"
            />
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>
            {studentName && <p className="mt-2 text-xs text-primary">خطة مخصصة لـ {studentName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm"><Clock3 className="size-3.5" />{plan.durationLabel || formatStudyDuration(totalMinutes)}</span>
            <PlanExportActions plan={plan} studentName={studentName} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="نقاط المنهج المغطاة" value={coveredTopics.toLocaleString("ar-EG")} />
          <Metric label="أيام التنفيذ" value={dayCount.toLocaleString("ar-EG")} />
          <Metric label="إجمالي وقت الدراسة" value={formatStudyDuration(totalMinutes)} />
          <Metric label="أولوية عالية أو عاجلة" value={highPriorityCount.toLocaleString("ar-EG")} />
        </div>

        {plan.taskSync && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-emerald-600" />تم اعتماد الخطة وإنشاء المهام</div>
            <a href="/tasks" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">فتح قائمة المهام <ArrowUpRight className="size-3.5" /></a>
          </div>
        )}
        {firstStep && !approved && (
          <div className="mx-4 mt-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:mx-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-wide text-primary">ابدأ من هنا · أعلى خطوة في الأولوية</p>
              <span className="rounded-lg border border-primary/20 bg-background px-2.5 py-1 text-[11px] font-semibold">{firstStep.minutes} دقيقة</span>
            </div>
            <h3 className="mt-2 text-base font-bold leading-7">{firstStep.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{firstStep.detail}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">{firstStep.category} · {priorityLabel(firstStep.priority)}</p>
          </div>
        )}
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(230px,.65fr)]">
        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">تفاصيل التنفيذ</h3>
              <p className="mt-1 text-xs text-muted-foreground">{editable ? "اضغط داخل المهمة لتغيير محتواها ومدتها أو ترتيبها." : "تم تثبيت المهام في قائمة التنفيذ."}</p>
            </div>
            {editable && <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onAddStep}><Plus className="size-4" />إضافة مهمة</Button>}
          </div>

           <div className="space-y-3">
            {dayGroups.map((group, groupIndex) => (
              <details key={group.day} open={groupIndex === 0} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-primary">{groupIndex + 1}</span>
                    <div className="min-w-0">
                      <h4 className="font-bold">{group.day}</h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{group.steps.length} مهام · {formatStudyDuration(group.steps.reduce((sum, item) => sum + item.step.minutes, 0))}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary">عرض مهام اليوم</span>
                </summary>
                <div className="space-y-3 border-t border-border/60 bg-muted/10 p-3 sm:p-4">
                  {group.steps.map(({ step, index }) => (
                    <article key={`step-${index}-${step.curriculumNodeIds?.join("-") || "manual"}`} className="rounded-xl border border-border/70 bg-background p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-lg bg-secondary px-2 py-1 font-semibold text-primary">{step.category}</span>
                        {step.priority && <span className="mr-auto rounded-lg border border-border bg-card px-2 py-1">{priorityLabel(step.priority)}</span>}
                      </div>
                      {editable ? (
                        <>
                          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">عنوان المهمة</label>
                          <input
                            value={step.title}
                            onChange={event => onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })}
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary/50"
                          />
                          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">تفاصيل التنفيذ</label>
                          <Textarea
                            value={step.detail}
                            onChange={event => onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, detail: event.target.value } : item) })}
                            className="mt-1 min-h-20 rounded-lg bg-card text-sm leading-6"
                          />
                          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-muted-foreground">المدة بالدقائق</label>
                              <input
                                type="number"
                                min={5}
                                max={480}
                                step={5}
                                value={step.minutes}
                                onChange={event => {
                                  const minutes = Number(event.target.value);
                                  onChange({ ...plan, steps: plan.steps.map((item, itemIndex) => itemIndex === index ? { ...item, minutes: Number.isFinite(minutes) ? Math.max(5, Math.min(480, minutes)) : 5 } : item) });
                                }}
                                className="mt-1 h-10 w-28 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => onMoveStep(index, -1)} aria-label="نقل المهمة لأعلى"><ArrowUp className="size-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === plan.steps.length - 1} onClick={() => onMoveStep(index, 1)} aria-label="نقل المهمة لأسفل"><ArrowDown className="size-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" disabled={plan.steps.length <= 1} onClick={() => onRemoveStep(index)} aria-label="حذف المهمة"><X className="size-4" /></Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <h4 className="mt-3 font-semibold">{step.title}</h4>
                          <p className="mt-1 text-sm leading-7 text-muted-foreground">{step.detail}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{step.minutes} دقيقة</p>
                        </>
                      )}
                      {step.priorityReason && <p className="mt-2 border-t border-border/60 pt-2 text-xs leading-6 text-muted-foreground">سبب الأولوية: {step.priorityReason}</p>}
                      {step.resourceRecommendation && (
                        <a href={step.resourceRecommendation.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">
                          <ArrowUpRight className="size-3.5" />
                          مشاهدة مقترحة من {step.resourceRecommendation.teacherName || "المدرس"}: {step.resourceRecommendation.title}
                          <span className="font-normal text-muted-foreground">— {step.resourceRecommendation.reason}</span>
                        </a>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                        {step.priorityScore !== undefined && <span className="rounded-md border border-border bg-card px-2 py-1">أولوية {step.priorityScore}/100</span>}
                        {step.difficulty && <span className="rounded-md border border-border bg-card px-2 py-1">الصعوبة: {difficultyLabel(step.difficulty)}</span>}
                        {step.printedPageRange && <span className="rounded-md border border-border bg-card px-2 py-1">صفحات {step.printedPageRange[0]}–{step.printedPageRange[1]}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
          {editable && (
            <Button type="button" variant="outline" className="mt-4 w-full rounded-xl" onClick={onApprove} disabled={approving || plan.steps.length === 0 || !plan.title.trim()}>
              {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              اعتماد الخطة وإنشاء المهام
            </Button>
          )}
        </main>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <h3 className="flex items-center gap-2 font-bold"><BrainCircuit className="size-4 text-primary" />ملخص الخطة</h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{plan.summary}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <h3 className="font-bold">عادات داعمة</h3>
            {plan.habits.length ? (
              <div className="mt-3 space-y-2">
                {plan.habits.map((habit, index) => <div key={`${habit.title}-${index}`} className="rounded-lg bg-background p-3"><p className="text-sm font-semibold">{habit.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{habit.cue}</p></div>)}
              </div>
            ) : <p className="mt-2 text-xs leading-6 text-muted-foreground">لا توجد عادات إضافية لازمة لهذه الخطة.</p>}
          </div>
          {editable && (
            <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-6 text-muted-foreground">
              التعديلات هنا لا تؤثر على ملف المنهج أو تقدمك. لن تُنشأ مهام أو مواعيد فعلية إلا بعد الضغط على «اعتماد الخطة».
            </p>
          )}
        </aside>
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
