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
import { CalendarDays, CheckCircle2, CircleDashed, Flag, ListTree, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const goalColor = { violet: "bg-slate-600", teal: "bg-teal-600", emerald: "bg-emerald-600", amber: "bg-amber-600", sky: "bg-sky-600" };
type EditableGoal = { id: number; title: string; description: string | null; kind: "short" | "long"; category: string; color: string; targetDate: Date | null; status: "active" | "completed" | "paused"; updatedAt: Date };
type GoalRecord = EditableGoal & { parentGoalId: number | null; sortOrder: number; taskCount: number; completedTaskCount: number; progress: number };

export default function Goals() {
  const utils = trpc.useUtils(); const [formOpen, setFormOpen] = useState(false); const [editingGoal, setEditingGoal] = useState<EditableGoal | null>(null); const [progressFilter, setProgressFilter] = useState<ProgressFilter>("all"); const [progressSort, setProgressSort] = useState<ProgressSort>("progress"); const [categoryFilter, setCategoryFilter] = useState("all"); const goalsQuery = trpc.goals.list.useQuery(); const tasksQuery = trpc.tasks.list.useQuery();
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
    return categoryMatch && filterMatch;
  }).sort((first, second) => compareGoals(first, second, stagesFor, allTasks, progressSort)), [active, allTasks, categoryFilter, progressFilter, progressSort]);
  return <DashboardLayout title="الأهداف" description="احتفظ بوجهتك في مكان واضح، وحوّل كل هدف إلى مهام صغيرة يمكن قياسها وإتمامها." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-2xl bg-primary"><Plus className="size-4" />هدف جديد</Button>}>
    {goalsQuery.isError && <QueryErrorNotice onRetry={() => void goalsQuery.refetch()} label="تعذّر تحميل أهدافك." />}
    {tasksQuery.isError && <QueryErrorNotice onRetry={() => void tasksQuery.refetch()} label="تعذّر تحميل المهام اللازمة لحساب تقدم الأهداف." />}
    {formOpen && <GoalForm onClose={() => setFormOpen(false)} loading={createGoal.isPending} onSubmit={data => createGoal.mutate(data)} />}
    {editingGoal && <GoalEditForm goal={editingGoal} onClose={() => setEditingGoal(null)} loading={updateGoal.isPending} onSubmit={data => updateGoal.mutate({ id: editingGoal.id, ...data, status: editingGoal.status })} />}
    <section className="mb-6 grid gap-4 sm:grid-cols-3"><Overview icon={<Target className="size-5" />} value={active.length} label="أهداف نشطة" /><Overview icon={<CheckCircle2 className="size-5" />} value={completed.length} label="أهداف مكتملة" /><Overview icon={<CircleDashed className="size-5" />} value={`${active.length ? Math.round(active.reduce((sum, goal) => sum + goalProgress(goal, stagesFor(goal.id), allTasks).progress, 0) / active.length) : 0}%`} label="متوسط التقدم" /></section>
    <ProgressToolbar filter={progressFilter} sort={progressSort} category={categoryFilter} categories={categories} onFilterChange={setProgressFilter} onSortChange={setProgressSort} onCategoryChange={setCategoryFilter} resultCount={visibleActive.length} />
    <section className="space-y-5"><div className="flex items-center gap-3"><span className="h-px flex-1 bg-border" /><h2 className="text-sm font-bold text-muted-foreground">الأهداف النشطة</h2><span className="h-px flex-1 bg-border" /></div>{goalsQuery.isLoading ? <GoalSkeletons /> : visibleActive.length ? visibleActive.map(goal => <GoalCard key={goal.id} goal={goal} stages={stagesFor(goal.id)} tasks={allTasks} completing={setStatus.isPending} onComplete={id => setStatus.mutate({ id, status: "completed" })} onEdit={setEditingGoal} onDelete={id => { if (window.confirm("حذف هذا الهدف؟ ستبقى المهام دون ربط به.")) deleteGoal.mutate({ id }); }} />) : active.length ? <div className="app-card flex min-h-48 flex-col items-center justify-center p-6 text-center"><ListTree className="mb-3 size-8 text-primary/45" /><p className="font-semibold">لا توجد أهداف تطابق هذه التصفية</p><p className="mt-1 text-sm text-muted-foreground">غيّر الحالة أو التصنيف حتى ترى بقية خطتك.</p></div> : <EmptyGoals onClick={() => setFormOpen(true)} />}
      {completed.length > 0 && <><div className="mt-10 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><h2 className="text-sm font-bold text-muted-foreground">منجزاتك</h2><span className="h-px flex-1 bg-border" /></div><div className="grid gap-3 md:grid-cols-2">{completed.map(goal => <article key={goal.id} className="app-card flex items-center gap-4 p-5 opacity-75"><span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"><CheckCircle2 className="size-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{goal.title}</p><p className="mt-1 text-xs text-muted-foreground">{goal.category}</p></div><span className="num text-sm font-semibold text-emerald-700 dark:text-emerald-300">{goalProgress(goal, stagesFor(goal.id), allTasks).progress}%</span></article>)}</div></>}
    </section>
  </DashboardLayout>;
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
    <article className="goal-card app-card overflow-hidden">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className={cn("goal-emblem flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm", goalColor[goal.color as keyof typeof goalColor] || goalColor.teal)}><Flag className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{goal.title}</h3>
            <Badge variant="secondary" className="rounded-lg text-[11px]">{goal.kind === "long" ? "طويل المدى" : "قصير المدى"}</Badge>
            {summary.overdueCount > 0 && <Badge className="rounded-lg bg-amber-100 text-[11px] text-amber-900 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950/60">{summary.overdueCount} متأخرة</Badge>}
          </div>
          {goal.description && <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">{goal.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{goal.category}</span><span>{summary.completedTaskCount} من {summary.taskCount} مهام</span>
            {goal.targetDate && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />ينتهي {new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" }).format(new Date(goal.targetDate))}</span>}
          </div>
        </div>
        <div className="sm:w-44"><div className="mb-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">التقدم</span><span className="num text-sm font-semibold text-primary">{summary.progress}%</span></div><Progress value={summary.progress} className="h-2 bg-muted" /></div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" title={!canComplete ? "أكمل مهام المراحل أولًا" : undefined} onClick={() => onComplete(goal.id)} disabled={completing || !canComplete} className="pressable rounded-xl">إتمام</Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(goal)} className="rounded-xl" aria-label={`تعديل ${goal.title}`}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(goal.id)} className="rounded-xl text-destructive hover:text-destructive" aria-label={`حذف ${goal.title}`}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      {stages.length > 0 && <div className="border-t border-border/70 bg-muted/15 px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center gap-2"><ListTree className="size-4 text-primary" /><p className="text-sm font-bold">مراحل هذه الخطة</p><span className="text-xs text-muted-foreground">{stages.length} مراحل</span></div>
        <div className="space-y-2">{stages.map((stage, index) => (
          <div key={stage.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-center">
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">{index + 1}</span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{stage.title}</p>{stage.status === "completed" && <Badge className="rounded-md bg-emerald-600 text-[11px] text-white hover:bg-emerald-600">مكتملة</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{stage.completedTaskCount} من {stage.taskCount} مهام</p></div>
            <div className="flex items-center gap-3 sm:w-44"><Progress value={stage.progress} className="h-1.5 flex-1 bg-muted" /><span className="num text-xs font-semibold text-primary">{stage.progress}%</span>{stage.status === "active" && <Button variant="ghost" size="sm" onClick={() => onComplete(stage.id)} disabled={completing || stage.progress < 100} className="pressable h-8 rounded-lg text-xs">إتمام</Button>}</div>
          </div>
        ))}</div>
      </div>}
      <div className="border-t border-border/70 bg-muted/10 px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><div className="flex items-center gap-2"><ListTree className="size-4 text-primary" /><p className="text-sm font-bold">خطوات التنفيذ</p><span className="text-xs text-muted-foreground">{relatedTasks.length}</span></div><p className="mt-1 text-xs text-muted-foreground">التقدم يتحسب من المهام المكتملة فعلًا، وليس من نسبة يدوية.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTaskEntry(value => !value)} className="shrink-0 rounded-xl"><Plus className="size-3.5" />إضافة خطوة</Button>
        </div>
        {showTaskEntry && <form onSubmit={submitTask} className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row">
          <Input autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="ما الخطوة التالية لتحقيق الهدف؟" className="h-10 rounded-xl" />
          <div className="flex gap-2"><Button type="submit" disabled={addTask.isPending || !taskTitle.trim()} className="rounded-xl">{addTask.isPending ? "إضافة..." : "إضافة"}</Button><Button type="button" variant="ghost" onClick={() => setShowTaskEntry(false)} className="rounded-xl">إلغاء</Button></div>
        </form>}
        {relatedTasks.length ? <div className="space-y-1.5">
          {relatedTasks.slice(0, 5).map(task => <div key={task.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
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
function Overview({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <div className="app-card flex items-center gap-4 p-5"><span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">{icon}</span><div><p className="num text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div></div>; }
function EmptyGoals({ onClick }: { onClick: () => void }) { return <div className="app-card flex min-h-72 flex-col items-center justify-center p-6 text-center"><Target className="mb-4 size-10 text-primary/40" /><h3 className="font-bold">امنح يومك وجهة</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">أنشئ هدفًا، ثم اربطه بمهام صغيرة. سيحسب التطبيق نسبة تقدمك تلقائيًا.</p><Button onClick={onClick} className="pressable mt-5 rounded-xl"><Plus className="size-4" />أنشئ أول هدف</Button></div>; }
function GoalEditForm({ goal, onClose, onSubmit, loading }: { goal: EditableGoal; onClose: () => void; loading: boolean; onSubmit: (data: { title: string; description: string | null; kind: "short" | "long"; category: string; color: string; targetDate: Date | null }) => void }) { const [title, setTitle] = useState(goal.title); const [description, setDescription] = useState(goal.description || ""); const [kind, setKind] = useState<"short" | "long">(goal.kind); const [category, setCategory] = useState(goal.category); const [color, setColor] = useState(goal.color); const [date, setDate] = useState(goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : ""); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الهدف أولًا."); onSubmit({ title: title.trim(), description: description.trim() || null, kind, category: category.trim() || "شخصي", color, targetDate: date ? new Date(`${date}T12:00:00`) : null }); }; return <section className="enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل الهدف</p><h2 className="mt-1 font-bold">حدّث وجهتك وخطتك</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">عنوان الهدف</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">الوصف</label><Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">مدى الهدف</label><Select value={kind} onValueChange={(value: "short" | "long") => setKind(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">قصير المدى</SelectItem><SelectItem value="long">طويل المدى</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">اللون</label><Select value={color} onValueChange={setColor}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="violet">رمادي</SelectItem><SelectItem value="teal">تركوازي</SelectItem><SelectItem value="emerald">زمردي</SelectItem><SelectItem value="amber">ذهبي</SelectItem><SelectItem value="sky">سماوي</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التاريخ المستهدف</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">حفظ التعديلات</Button></div></form></section>; }
function GoalForm({ onClose, onSubmit, loading }: { onClose: () => void; loading: boolean; onSubmit: (data: { title: string; description: string | null; kind: "short" | "long"; category: string; color: string; targetDate: Date | null }) => void }) { const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [kind, setKind] = useState<"short" | "long">("short"); const [category, setCategory] = useState("شخصي"); const [color, setColor] = useState("teal"); const [date, setDate] = useState(""); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الهدف أولًا."); onSubmit({ title: title.trim(), description: description.trim() || null, kind, category, color, targetDate: date ? new Date(`${date}T12:00:00`) : null }); }; return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">وجهة جديدة</p><h2 className="mt-1 font-bold">أنشئ هدفًا قابلًا للمتابعة</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">عنوان الهدف</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: إنهاء مقرر الإحصاء" className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">لماذا يهمك؟ <span className="font-normal text-muted-foreground">اختياري</span></label><Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="وصف موجز يذكّرك بالنتيجة التي تسعى إليها" className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">مدى الهدف</label><Select value={kind} onValueChange={(value: "short" | "long") => setKind(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">قصير المدى</SelectItem><SelectItem value="long">طويل المدى</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">اللون</label><Select value={color} onValueChange={setColor}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="violet">بنفسجي</SelectItem><SelectItem value="emerald">زمردي</SelectItem><SelectItem value="amber">ذهبي</SelectItem><SelectItem value="sky">سماوي</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">تاريخ مستهدف</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "يُنشأ الهدف..." : "حفظ الهدف"}</Button></div></form></section>; }
function GoalSkeletons() { return <>{[0, 1].map(i => <div key={i} className="app-card h-36 animate-pulse bg-muted/60" />)}</>; }
