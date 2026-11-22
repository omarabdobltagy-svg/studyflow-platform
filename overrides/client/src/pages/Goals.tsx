import DashboardLayout from "@/components/DashboardLayout";
import ProgressToolbar, { type ProgressFilter, type ProgressSort } from "@/components/ProgressToolbar";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, CircleDashed, Flag, ListTree, Pencil, Plus, Target, Trash2, X, Search, TrendingUp } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const goalColor = { red: "bg-rose-600", gold: "bg-amber-500", charcoal: "bg-stone-800", violet: "bg-stone-700", teal: "bg-rose-700", emerald: "bg-emerald-600", amber: "bg-amber-600", sky: "bg-stone-700" };
type EditableGoal = { id: number; title: string; description: string | null; kind: "short" | "long"; category: string; color: string; targetDate: Date | null; status: "active" | "completed" | "paused"; updatedAt: Date };
type GoalRecord = EditableGoal & { parentGoalId: number | null; sortOrder: number; taskCount: number; completedTaskCount: number; progress: number };

export default function Goals() {
  const utils = trpc.useUtils(); const [formOpen, setFormOpen] = useState(false); const [editingGoal, setEditingGoal] = useState<EditableGoal | null>(null); const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all"); const [progressSort, setProgressSort] = useState<ProgressSort>("progress"); const [categoryFilter, setCategoryFilter] = useState("all"); const [goalSearch, setGoalSearch] = useState(""); const goalsQuery = trpc.goals.list.useQuery(); const tasksQuery = trpc.tasks.list.useQuery();
  const createGoal = trpc.goals.create.useMutation({ onSuccess: () => { void utils.goals.list.invalidate(); void utils.dashboard.summary.invalidate(); setFormOpen(false); toast.success("تم إنشاء الهدف."); }, onError: error => toast.error(error.message) });
  const setStatus = trpc.goals.setStatus.useMutation({ onSuccess: () => { void utils.goals.list.invalidate(); void utils.dashboard.summary.invalidate(); toast.success("تم تحديث حالة الهدف."); }, onError: error => toast.error(error.message) });
  const updateGoal = trpc.goals.update.useMutation({ onSuccess: () => { void utils.goals.list.invalidate(); void utils.dashboard.summary.invalidate(); setEditingGoal(null); toast.success("تم حفظ تعديلات الهدف."); }, onError: error => toast.error(error.message) });
  const deleteGoal = trpc.goals.delete.useMutation({ onSuccess: () => { void utils.goals.list.invalidate(); void utils.dashboard.summary.invalidate(); setEditingGoal(null); toast.success("حُذف الهدف."); }, onError: error => toast.error(error.message) });
  const allGoals = (goalsQuery.data || []) as GoalRecord[];
  const allTasks = (tasksQuery.data || []) as TaskRecord[];
  const stagesFor = (parentGoalId: number) => allGoals.filter(goal => goal.parentGoalId === parentGoalId).sort((first, second) => first.sortOrder - second.sortOrder);
  const active = allGoals.filter(goal => goal.status === "active" && !goal.parentGoalId);
  const completed = allGoals.filter(goal => goal.status === "completed" && !goal.parentGoalId);
  const categories = useMemo(() => Array.from(new Set(active.map(goal => goal.category))).sort((a, b) => a.localeCompare(b, "ar")), [active]);
  const visibleActive = useMemo(() => active.filter(goal => {
    const summary = goalProgress(goal, stagesFor(goal.id), allTasks);
    const categoryMatch = categoryFilter === "all" || goal.category === categoryFilter;
    const filterMatch = progressFilter === "all" || (progressFilter === "overdue" && summary.overdueCount > 0) || (progressFilter === "incomplete" && summary.progress < 100) || (progressFilter === "completed" && summary.progress === 100);
    const searchMatch = !goalSearch.trim() || [goal.title, goal.description || "", goal.category].join(" ").toLowerCase().includes(goalSearch.trim().toLowerCase());
    return categoryMatch && filterMatch && searchMatch;
  }).sort((first, second) => compareGoals(first, second, stagesFor, allTasks, progressSort)), [active, allTasks, categoryFilter, progressFilter, progressSort, goalSearch]);
  const averageProgress = goalsQuery.isSuccess && tasksQuery.isSuccess && active.length
    ? Math.round(active.reduce((sum, goal) => sum + goalProgress(goal, stagesFor(goal.id), allTasks).progress, 0) / active.length)
    : goalsQuery.isSuccess && tasksQuery.isSuccess ? 0 : null;
  const totalTaskCount = goalsQuery.isSuccess && tasksQuery.isSuccess ? allTasks.filter(task => task.goalId !== null && allGoals.some(goal => goal.id === task.goalId)).length : null;
  const highProgressGoals = goalsQuery.isSuccess && tasksQuery.isSuccess
    ? active.filter(goal => goalProgress(goal, stagesFor(goal.id), allTasks).progress >= 75).length : null;
  return (
    <DashboardLayout
      title="الأهداف"
      description="وجهاتك الكبيرة، مقسمة إلى مراحل وخطوات يمكن تتبعها من إنجاز المهام الفعلي."
    >
      {goalsQuery.isError && <QueryErrorNotice onRetry={() => void goalsQuery.refetch()} label="تعذّر تحميل أهدافك." />}
      {tasksQuery.isError && <QueryErrorNotice onRetry={() => void tasksQuery.refetch()} label="تعذّر تحميل المهام اللازمة لحساب تقدم الأهداف." />}

      <section className="sf-goals-hero">
        <div className="sf-goals-hero-copy">
          <p className="sf-goals-overline">DIRECTION / LONG-TERM PROGRESS</p>
          <h2>النتيجة الكبيرة تبدأ بخطوات يمكن رؤيتها.</h2>
          <p>اربط كل هدف بمراحل ومهام فعلية. التقدم هنا يتغير مع إنجازك المسجل، وليس بنسبة تقديرية تكتبها بنفسك.</p>
          <div className="sf-goals-hero-actions">
            <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-white text-[#3b214c] hover:bg-[#f2eaf7]"><Plus /> إنشاء هدف</Button>
            <span><ListTree /> {goalsQuery.isLoading || goalsQuery.isError ? "—" : active.length} أهداف تعمل عليها</span>
          </div>
        </div>
        <div className="sf-goals-hero-panel">
          <div className="sf-goals-hero-stat">
            <span>متوسط تقدم الأهداف النشطة</span>
            <TrendingUp />
          </div>
          <strong>{averageProgress === null ? "—" : averageProgress + "%"}</strong>
          <div className="sf-goals-hero-rail"><i style={{ width: (averageProgress ?? 0) + "%" }} /></div>
          <div className="sf-goals-hero-breakdown">
            <div><b>{goalsQuery.isLoading || goalsQuery.isError ? "—" : active.length}</b><span>نشطة</span></div>
            <div><b>{goalsQuery.isLoading || goalsQuery.isError ? "—" : completed.length}</b><span>مكتملة</span></div>
            <div><b>{totalTaskCount === null ? "—" : totalTaskCount}</b><span>مهام مرتبطة</span></div>
          </div>
        </div>
        <span className="sf-goals-hero-orbit" aria-hidden="true" />
      </section>

      {formOpen && <GoalForm onClose={() => setFormOpen(false)} loading={createGoal.isPending} onSubmit={data => createGoal.mutate(data)} />}
      {editingGoal && <GoalEditForm goal={editingGoal} onClose={() => setEditingGoal(null)} loading={updateGoal.isPending} onSubmit={data => updateGoal.mutate({ id: editingGoal.id, ...data, status: editingGoal.status })} />}

      <section className="sf-goal-quick-stats">
        <Overview icon={<Target />} value={goalsQuery.isLoading || goalsQuery.isError ? "—" : active.length} label="أهداف نشطة" />
        <Overview icon={<CheckCircle2 />} value={goalsQuery.isLoading || goalsQuery.isError ? "—" : completed.length} label="أهداف مكتملة" />
        <Overview icon={<CircleDashed />} value={highProgressGoals === null ? "—" : highProgressGoals} label="أهداف تجاوزت 75%" />
      </section>

      <div className="sf-goal-control-panel">
        <div className="sf-goal-control-heading">
          <div><p className="sf-goals-section-kicker">GOAL CONTROL</p><h2>تابع وجهاتك</h2><p>صفِّ الأهداف حسب الحالة، ورتبها حسب أقرب موعد أو التقدم أو التأخير.</p></div>
          <span>{goalsQuery.isError ? "تعذّر التحميل" : goalsQuery.isLoading ? "جارٍ التحميل" : visibleActive.length + " نتيجة"}</span>
        </div>
        <div className="sf-goal-search">
          <Search />
          <Input value={goalSearch} onChange={event => setGoalSearch(event.target.value)} placeholder="ابحث باسم الهدف أو وصفه أو تصنيفه..." aria-label="البحث في الأهداف" />
          {goalSearch && <button type="button" onClick={() => setGoalSearch("")} aria-label="مسح البحث"><X /></button>}
        </div>
        <ProgressToolbar filter={progressFilter} sort={progressSort} category={categoryFilter} categories={categories} onFilterChange={setProgressFilter} onSortChange={setProgressSort} onCategoryChange={setCategoryFilter} resultCount={visibleActive.length} />
      </div>

      <section className="sf-goal-results">
        <div className="sf-goals-section-heading"><span>01</span><div><h2>الأهداف النشطة</h2><p>كل هدف يحتفظ بمراحله ومهامه وحالة تقدمه.</p></div></div>
        {goalsQuery.isLoading ? <GoalSkeletons /> : goalsQuery.isError ? null : visibleActive.length ? (
          <div className="sf-goal-list">
            {visibleActive.map(goal => <GoalCard key={goal.id} goal={goal} stages={stagesFor(goal.id)} tasks={allTasks} completing={setStatus.isPending} onComplete={id => setStatus.mutate({ id, status: "completed" })} onEdit={setEditingGoal} onDelete={id => { if (window.confirm("حذف هذا الهدف؟ ستبقى المهام دون ربط به.")) deleteGoal.mutate({ id }); }} />)}
          </div>
        ) : active.length ? (
          <div className="sf-goal-empty"><ListTree /><h3>لا توجد نتائج مطابقة.</h3><p>جرّب تعديل البحث أو حالة التقدم أو التصنيف.</p><Button variant="outline" onClick={() => { setGoalSearch(""); setCategoryFilter("all"); setProgressFilter("all"); }}>إعادة ضبط التصفية</Button></div>
        ) : <EmptyGoals onClick={() => setFormOpen(true)} />}

        {completed.length > 0 && (
          <section className="sf-completed-goals">
            <div className="sf-goals-section-heading"><span>02</span><div><h2>منجزاتك</h2><p>الأهداف التي وصلت إلى حالتها المكتملة.</p></div></div>
            <div className="sf-completed-goal-grid">
              {completed.map(goal => <article key={goal.id} className="sf-completed-goal">
                <span><CheckCircle2 /></span>
                <div><h3>{goal.title}</h3><p>{goal.category}</p></div>
                <strong>{goalProgress(goal, stagesFor(goal.id), allTasks).progress}%</strong>
              </article>)}
            </div>
          </section>
        )}
      </section>
    </DashboardLayout>
  );
}

type TaskRecord = { id: number; title: string; goalId: number | null; status: "todo" | "done"; dueAt: Date | null; updatedAt: Date; };
function goalProgress(goal: GoalRecord, stages: GoalRecord[], tasks: TaskRecord[] = []) { const goalIds = new Set([goal.id, ...stages.map(stage => stage.id)]); const relatedTasks = tasks.length ? tasks.filter(task => task.goalId !== null && goalIds.has(task.goalId)) : []; const taskCount = relatedTasks.length || (stages.length ? stages.reduce((sum, stage) => sum + stage.taskCount, 0) : goal.taskCount); const completedTaskCount = relatedTasks.length ? relatedTasks.filter(task => task.status === "done").length : (stages.length ? stages.reduce((sum, stage) => sum + stage.completedTaskCount, 0) : goal.completedTaskCount); const overdueCount = relatedTasks.filter(task => task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() < Date.now()).length; return { taskCount, completedTaskCount, overdueCount, progress: taskCount ? Math.round((completedTaskCount / taskCount) * 100) : 0 }; }
function compareGoals(first: GoalRecord, second: GoalRecord, stagesFor: (id: number) => GoalRecord[], tasks: TaskRecord[], sort: ProgressSort) { const a = goalProgress(first, stagesFor(first.id), tasks); const b = goalProgress(second, stagesFor(second.id), tasks); if (sort === "overdue") return b.overdueCount - a.overdueCount || a.progress - b.progress; if (sort === "due") return (first.targetDate ? new Date(first.targetDate).getTime() : Number.MAX_SAFE_INTEGER) - (second.targetDate ? new Date(second.targetDate).getTime() : Number.MAX_SAFE_INTEGER); if (sort === "updated") return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(); return a.progress - b.progress; }

function GoalCard({ goal, stages, tasks, completing, onComplete, onEdit, onDelete }: {
  goal: GoalRecord;
  stages: GoalRecord[];
  tasks: TaskRecord[];
  completing: boolean;
  onComplete: (id: number) => void;
  onEdit: (goal: EditableGoal) => void;
  onDelete: (id: number) => void;
}) {
  const summary = goalProgress(goal, stages, tasks);
  const canComplete = !stages.length || summary.progress === 100;
  const utils = trpc.useUtils();
  const [showTaskEntry, setShowTaskEntry] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const addTask = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tasks.list.invalidate(), utils.goals.list.invalidate(), utils.dashboard.summary.invalidate()]);
      setTaskTitle("");
      setShowTaskEntry(false);
      toast.success("أُضيفت خطوة إلى الهدف.");
    },
    onError: error => toast.error(error.message),
  });
  const toggleTask = trpc.tasks.toggle.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.tasks.list.invalidate(), utils.goals.list.invalidate(), utils.dashboard.summary.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const goalIds = new Set([goal.id, ...stages.map(stage => stage.id)]);
  const relatedTasks = tasks.filter(task => task.goalId !== null && goalIds.has(task.goalId));
  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    addTask.mutate({ title: taskTitle.trim(), category: goal.category || "عام", priority: "medium", goalId: goal.id, dueAt: null });
  };
  return (
    <article className="sf-goal-card app-card">
      <div className="sf-goal-card-header">
        <span className={cn("goal-emblem flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm", goalColor[goal.color as keyof typeof goalColor] || goalColor.teal)}><Flag className="size-5" /></span>
        <div className="sf-goal-identity-copy">
          <p className="sf-goal-overline">GOAL / {goal.kind === "long" ? "LONG-TERM" : "SHORT-TERM"}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="sf-goal-title">{goal.title}</h3>
            <Badge variant="secondary" className="rounded-lg text-[11px]">{goal.kind === "long" ? "طويل المدى" : "قصير المدى"}</Badge>
            {summary.overdueCount > 0 && <Badge className="rounded-lg bg-amber-100 text-[11px] text-amber-900 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950/60">{summary.overdueCount} متأخرة</Badge>}
          </div>
          {goal.description && <p className="sf-goal-description">{goal.description}</p>}
          <div className="sf-goal-meta">
            <span>{goal.category}</span><span>{summary.completedTaskCount} من {summary.taskCount} مهام</span>
            {goal.targetDate && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />ينتهي {new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" }).format(new Date(goal.targetDate))}</span>}
          </div>
        </div>
        <div className="sf-goal-progress-block"><div className="mb-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">التقدم</span><span className="num text-sm font-semibold text-primary">{summary.progress}%</span></div><Progress value={summary.progress} className="h-2 bg-muted" /></div>
        <div className="sf-goal-actions">
          <Button variant="outline" title={!canComplete ? "أكمل مهام المراحل أولًا" : undefined} onClick={() => onComplete(goal.id)} disabled={completing || !canComplete} className="pressable rounded-xl">إتمام</Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(goal)} className="rounded-xl" aria-label={`تعديل ${goal.title}`}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(goal.id)} className="rounded-xl text-destructive hover:text-destructive" aria-label={`حذف ${goal.title}`}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      {stages.length > 0 && <div className="sf-goal-stages">
        <div className="sf-goal-subheading"><ListTree className="size-4 text-primary" /><p className="text-sm font-bold">مراحل هذه الخطة</p><span className="text-xs text-muted-foreground">{stages.length} مراحل</span></div>
        <div className="sf-goal-stage-list">{stages.map((stage, index) => (
          <div key={stage.id} className="sf-goal-stage-row">
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">{index + 1}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{stage.title}</p>{stage.status === "completed" && <Badge className="rounded-md bg-emerald-600 text-[11px] text-white hover:bg-emerald-600">مكتملة</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{stage.completedTaskCount} من {stage.taskCount} مهام</p></div>
            <div className="flex items-center gap-3 sm:w-44"><Progress value={stage.progress} className="h-1.5 flex-1 bg-muted" /><span className="num text-xs font-semibold text-primary">{stage.progress}%</span>{stage.status === "active" && <Button variant="ghost" size="sm" onClick={() => onComplete(stage.id)} disabled={completing || stage.progress < 100} className="pressable h-8 rounded-lg text-xs">إتمام</Button>}</div>
          </div>
        ))}</div>
      </div>}
      <div className="sf-goal-tasks">
        <div className="sf-goal-task-heading">
          <div><div className="flex items-center gap-2"><ListTree className="size-4 text-primary" /><p className="text-sm font-bold">خطوات التنفيذ</p><span className="text-xs text-muted-foreground">{relatedTasks.length}</span></div><p className="mt-1 text-xs text-muted-foreground">التقدم يتحسب من المهام المكتملة فعلًا، وليس من نسبة يدوية.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTaskEntry(value => !value)} className="shrink-0 rounded-xl"><Plus className="size-3.5" />إضافة خطوة</Button>
        </div>
        {showTaskEntry && <form onSubmit={submitTask} className="sf-goal-task-entry">
          <Input autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="ما الخطوة التالية لتحقيق الهدف؟" className="h-10 rounded-xl" />
          <div className="flex gap-2"><Button type="submit" disabled={addTask.isPending || !taskTitle.trim()} className="rounded-xl">{addTask.isPending ? "إضافة..." : "إضافة"}</Button><Button type="button" variant="ghost" onClick={() => setShowTaskEntry(false)} className="rounded-xl">إلغاء</Button></div>
        </form>}
        {relatedTasks.length ? <div className="sf-goal-task-list">
          {relatedTasks.slice(0, 5).map(task => <div key={task.id} className="sf-goal-task-row">
            <button type="button" onClick={() => toggleTask.mutate({ id: task.id, done: task.status !== "done" })} disabled={toggleTask.isPending} aria-label={task.status === "done" ? "إعادة فتح المهمة" : "إكمال المهمة"} className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", task.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background")}>
              {task.status === "done" && <CheckCircle2 className="size-3.5" />}
            </button>
            <span className={cn("min-w-0 flex-1 text-sm", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
            <span className="text-[11px] text-muted-foreground">{task.status === "done" ? "مكتملة" : "قيد التنفيذ"}</span>
          </div>)}
          {relatedTasks.length > 5 && <p className="px-2 text-[11px] text-muted-foreground">و{relatedTasks.length - 5} خطوات أخرى ضمن قائمة المهام.</p>}
        </div> : <p className="rounded-xl border border-dashed border-border bg-card/60 px-3 py-4 text-center text-xs text-muted-foreground">أضف أول خطوة ليبدأ قياس تقدم الهدف تلقائيًا.</p>}
      </div>
    </article>
  );
}
function Overview({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <div className="sf-goal-overview"><span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</span><div><p className="num text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div></div>; }
function EmptyGoals({ onClick }: { onClick: () => void }) { return <div className="sf-goal-empty"><Target className="mb-4 size-10 text-primary/40" /><h3 className="font-bold">امنح يومك وجهة</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">أنشئ هدفًا، ثم اربطه بمهام صغيرة. سيحسب التطبيق نسبة تقدمك تلقائيًا.</p><Button onClick={onClick} className="pressable mt-5 rounded-xl"><Plus className="size-4" />أنشئ أول هدف</Button></div>; }
function GoalEditForm({ goal, onClose, onSubmit, loading }: { goal: EditableGoal; onClose: () => void; loading: boolean; onSubmit: (data: { title: string; description: string | null; kind: "short" | "long"; category: string; color: string; targetDate: Date | null }) => void }) { const [title, setTitle] = useState(goal.title); const [description, setDescription] = useState(goal.description || ""); const [kind, setKind] = useState<"short" | "long">(goal.kind); const [category, setCategory] = useState(goal.category); const [color, setColor] = useState(goal.color === "violet" ? "charcoal" : goal.color === "teal" ? "red" : goal.color === "sky" || goal.color === "emerald" || goal.color === "amber" ? "gold" : goal.color); const [date, setDate] = useState(goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : ""); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الهدف أولًا."); onSubmit({ title: title.trim(), description: description.trim() || null, kind, category: category.trim() || "شخصي", color, targetDate: date ? new Date(`${date}T12:00:00`) : null }); }; return <section className="sf-goal-form enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل الهدف</p><h2 className="mt-1 font-bold">حدّث وجهتك وخطتك</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">عنوان الهدف</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">الوصف</label><Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">مدى الهدف</label><Select value={kind} onValueChange={(value: "short" | "long") => setKind(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">قصير المدى</SelectItem><SelectItem value="long">طويل المدى</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">اللون</label><Select value={color} onValueChange={setColor}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="red">أحمر</SelectItem><SelectItem value="gold">ذهبي</SelectItem><SelectItem value="charcoal">فحمي</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التاريخ المستهدف</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">حفظ التعديلات</Button></div></form></section>; }

type GoalStepDraft = { id: string; title: string; estimatedMinutes: number };

function GoalForm({ onClose, onSubmit, loading }: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (data: {
    title: string;
    description: string | null;
    kind: "short" | "long";
    category: string;
    color: string;
    targetDate: Date | null;
    initialSteps: { title: string; estimatedMinutes: number }[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"short" | "long">("short");
  const [category, setCategory] = useState("شخصي");
  const [color, setColor] = useState("red");
  const [date, setDate] = useState("");
  const [initialSteps, setInitialSteps] = useState<GoalStepDraft[]>([]);

  const addStep = () => setInitialSteps(items => [
    ...items,
    { id: `goal-step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: "", estimatedMinutes: 25 },
  ]);
  const patchStep = (id: string, patch: Partial<GoalStepDraft>) =>
    setInitialSteps(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= initialSteps.length) return;
    setInitialSteps(items => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return toast.error("اكتب عنوان الهدف أولًا.");
    const steps = initialSteps
      .map(step => ({ title: step.title.trim(), estimatedMinutes: step.estimatedMinutes }))
      .filter(step => step.title.length > 0);
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      kind,
      category,
      color,
      targetDate: date ? new Date(`${date}T12:00:00`) : null,
      initialSteps: steps,
    });
  };

  return (
    <section className="sf-goal-form enter app-card mb-6 overflow-hidden border-primary/15">
      <div className="flex items-center justify-between border-b border-border/65 px-5 py-4">
        <div>
          <p className="eyebrow">وجهة جديدة</p>
          <h2 className="mt-1 font-bold">أنشئ هدفًا قابلًا للمتابعة</h2>
          <p className="mt-1 text-xs text-muted-foreground">أضف الهدف وخطواته من شاشة واحدة، أو ابدأ بالهدف فقط.</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button>
      </div>
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold">عنوان الهدف</label>
          <Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: إنهاء مقرر الإحصاء" className="h-11 rounded-xl bg-background" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-semibold">لماذا يهمك؟ <span className="font-normal text-muted-foreground">اختياري</span></label>
          <Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="وصف موجز يذكّرك بالنتيجة التي تسعى إليها" className="min-h-20 rounded-xl bg-background" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">مدى الهدف</label>
          <Select value={kind} onValueChange={(value: "short" | "long") => setKind(value)}>
            <SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="short">قصير المدى</SelectItem><SelectItem value="long">طويل المدى</SelectItem></SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">التصنيف</label>
          <Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">اللون</label>
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="red">أحمر</SelectItem>
              <SelectItem value="gold">ذهبي</SelectItem>
              <SelectItem value="charcoal">فحمي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">تاريخ مستهدف</label>
          <Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" />
        </div>
        <div className="sm:col-span-2 rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">خطوات التنفيذ الأولية</h3>
              <p className="mt-1 text-xs text-muted-foreground">كل خطوة تتحول إلى مهمة مرتبطة بالهدف ويُحسب التقدم من إنجازها الفعلي.</p>
            </div>
            <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-primary">{initialSteps.length} خطوة</span>
          </div>
          {initialSteps.length > 0 && (
            <div className="mb-3 space-y-2">
              {initialSteps.map((step, index) => (
                <div key={step.id} className="grid grid-cols-[30px_minmax(0,1fr)_76px_64px] items-center gap-2 rounded-xl border border-border/75 bg-card p-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">{index + 1}</span>
                  <Input value={step.title} onChange={event => patchStep(step.id, { title: event.target.value })} placeholder="ما الخطوة التالية؟" aria-label={`خطوة الهدف ${index + 1}`} className="h-10 min-w-0 rounded-xl bg-background text-sm" />
                  <label className="relative">
                    <Input type="number" min={1} max={300} value={step.estimatedMinutes} onChange={event => patchStep(step.id, { estimatedMinutes: Math.min(300, Math.max(1, Number(event.target.value) || 25)) })} aria-label={`مدة الخطوة ${index + 1}`} className="h-10 rounded-xl bg-background pl-1 text-center text-sm" />
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">د</span>
                  </label>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveStep(index, -1)} className="size-7 rounded-lg" aria-label="تحريك خطوة لأعلى"><ArrowUp className="size-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" disabled={index === initialSteps.length - 1} onClick={() => moveStep(index, 1)} className="size-7 rounded-lg" aria-label="تحريك خطوة لأسفل"><ArrowDown className="size-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setInitialSteps(items => items.filter(item => item.id !== step.id))} className="size-7 rounded-lg text-destructive hover:text-destructive" aria-label="حذف الخطوة"><Trash2 className="size-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" disabled={initialSteps.length >= 20} onClick={addStep} className="w-full rounded-xl border-dashed">
            <Plus className="size-4" /> إضافة خطوة إلى الهدف
          </Button>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button>
          <Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "يُنشأ الهدف..." : "حفظ الهدف"}</Button>
        </div>
      </form>
    </section>
  );
}
function GoalSkeletons() { return <>{[0, 1].map(i => <div key={i} className="app-card h-36 animate-pulse bg-muted/60" />)}</>; }
