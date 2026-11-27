import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getSIESubject, matchSIECheckpointTask } from "@shared/sie-catalog";
import { displayBranchTitle, displayCurriculumTitle } from "@/lib/curriculum-display";
import { CalendarDays, Check, Circle, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const priorityMeta = {
  high: { label: "عالية", dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" },
  medium: { label: "متوسطة", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  low: { label: "مرنة", dot: "bg-sky-500", pill: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200" },
};

function displayDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
}

function dateInputValue(date: Date | null) {
  if (!date) return "";
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}


function isEnglishOnlyTaskText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return /[A-Za-z]{3,}/.test(text) && !/[\\u0600-\\u06FF]/.test(text);
}

function taskArabicPresentation(task: { title: string; category: string; notes: string | null }, subjectIds: string[]) {
  const match = matchSIECheckpointTask(subjectIds, [task.title, task.notes ?? ""].join(" "));
  if (match) {
    const subject = getSIESubject(match.subjectId)?.nameAr ?? "مادة دراسية";
    return {
      title: subject + " · " + displayBranchTitle(match.branchTitle) + " · " + displayCurriculumTitle(match.title),
      category: subject + " · " + displayBranchTitle(match.branchTitle),
      notes: isEnglishOnlyTaskText(task.notes) ? "تفاصيل التكليف محفوظة في المصدر الأصلي. راجع شرح المدرس أو المنصة المرتبطة." : task.notes,
    };
  }
  return {
    title: isEnglishOnlyTaskText(task.title) ? "مهمة دراسية مسجلة" : task.title,
    category: isEnglishOnlyTaskText(task.category) ? "مهمة عامة" : task.category,
    notes: isEnglishOnlyTaskText(task.notes) ? "تفاصيل المهمة محفوظة باللغة الأصلية في السجل." : task.notes,
  };
}

export default function Tasks() {
  const utils = trpc.useUtils();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportingTaskId, setReportingTaskId] = useState<number | null>(null);
  const [blockerReason, setBlockerReason] = useState<"low_time" | "not_understood" | "too_much" | "other_commitment" | "forgot" | "other">("low_time");
  const [blockerNote, setBlockerNote] = useState("");
  const tasksQuery = trpc.tasks.list.useQuery();
  const profileQuery = trpc.studentProfile.get.useQuery();
  const subjectIds = profileQuery.data?.subjectIds ?? [];
  const goalsQuery = trpc.goals.list.useQuery();
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setFormOpen(false); toast.success("أُضيفت المهمة إلى يومك."); },
    onError: error => toast.error(error.message),
  });
  const toggleTask = trpc.tasks.toggle.useMutation({
    onSuccess: change => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); if (change?.changeId) toast("تم تحديث حالة المهمة.", { action: { label: "تراجع", onClick: () => undoTask.mutate({ changeId: change.changeId }) } }); },
    onError: error => toast.error(error.message),
  });
  const reportNotCompleted=trpc.tasks.reportNotCompleted.useMutation({
    onSuccess:async()=>{await Promise.all([utils.tasks.list.invalidate(),utils.plans.currentDaily.invalidate()]);setReportingTaskId(null);setBlockerNote("");toast.success("اتسجل سبب عدم إكمال المهمة، وهيظهر للمخطط الذكي في المراجعة القادمة.");},
    onError:error=>toast.error(error.message||"تعذّر حفظ السبب."),
  });
  const undoTask = trpc.tasks.undo.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); toast.success("تم التراجع عن التغيير."); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("تم حفظ تعديلات المهمة."); }, onError: error => toast.error(error.message) });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("حُذفت المهمة."); }, onError: error => toast.error(error.message) });
  const shownTasks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ar");
    return (tasksQuery.data || [])
      .filter(task => filter === "all" || task.status === filter)
      .filter(task => !query || [task.title, task.category, task.notes || ""]
        .join(" ").toLocaleLowerCase("ar").includes(query))
      .sort((left, right) => {
        if (filter === "all" && left.status !== right.status) return left.status === "todo" ? -1 : 1;
        if (left.status === "todo" && right.status === "todo") {
          const priorityRank = (value: string) => value === "high" ? 3 : value === "medium" ? 2 : 1;
          const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
          if (priorityDiff) return priorityDiff;
        }
        const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
        return leftDue - rightDue;
      });
  }, [tasksQuery.data, filter, searchQuery]);
  const allTasks = tasksQuery.data || [];
  const todoCount = allTasks.filter(task => task.status === "todo").length;
  const doneCount = allTasks.filter(task => task.status === "done").length;
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const taskDateKey = (date: Date | null) => date
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(date))
    : null;
  const overdueCount = allTasks.filter(task => task.status === "todo" && task.dueAt && (taskDateKey(task.dueAt) ?? "") < todayKey).length;
  const dueTodayCount = allTasks.filter(task => task.status === "todo" && task.dueAt && taskDateKey(task.dueAt) === todayKey).length;
  const highPriorityCount = allTasks.filter(task => task.status === "todo" && task.priority === "high").length;
  const completionRate = allTasks.length ? Math.round((doneCount / allTasks.length) * 100) : 0;

  return (
    <DashboardLayout title="المهام" description="قائمة مرنة من المهام. لا يوجد وقت أو موعد إلزامي إلا إذا اخترته بنفسك." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-2xl bg-primary"><Plus className="size-4" />مهمة جديدة</Button>}>
      {tasksQuery.isError && <QueryErrorNotice onRetry={() => void tasksQuery.refetch()} label="تعذّر تحميل مهامك." />}
      {goalsQuery.isError && <QueryErrorNotice onRetry={() => void goalsQuery.refetch()} label="تعذّر تحميل الأهداف المتاحة لربط المهمة." />}
      {!tasksQuery.isError && (
        <section className="sf-task-overview mb-5">
          <div className="sf-task-overview-heading">
            <p>مساحة التنفيذ</p>
            <h2>حوّل التزاماتك إلى تقدم واضح</h2>
            <span>الأولوية والموعد وحالة الإنجاز في لوحة واحدة، مع تفاصيل كل مهمة أسفلها.</span>
          </div>
          <div className="sf-task-overview-progress">
            <div className="sf-task-progress-copy">
              <span>نسبة الإنجاز المسجلة</span>
              <strong>{completionRate.toLocaleString("ar-EG")}%</strong>
              <div className="sf-task-progress-rail"><i style={{ width: completionRate + "%" }} /></div>
              <small>أُنجز {doneCount.toLocaleString("ar-EG")} من {allTasks.length.toLocaleString("ar-EG")} مهمة</small>
            </div>
            <div className="sf-task-overview-stats">
              <article><span>قيد التنفيذ</span><b>{todoCount.toLocaleString("ar-EG")}</b></article>
              <article><span>مستحقة اليوم</span><b>{dueTodayCount.toLocaleString("ar-EG")}</b></article>
              <article><span>متأخرة</span><b>{overdueCount.toLocaleString("ar-EG")}</b></article>
              <article><span>أولوية عالية</span><b>{highPriorityCount.toLocaleString("ar-EG")}</b></article>
            </div>
          </div>
        </section>
      )}
      {isFormOpen && <TaskForm goals={goalsQuery.data || []} onClose={() => setFormOpen(false)} onSubmit={data => createTask.mutate(data)} loading={createTask.isPending} />}
      {editingTaskId !== null && tasksQuery.data?.find(task => task.id === editingTaskId) ? <TaskEditForm task={tasksQuery.data.find(task => task.id === editingTaskId)!} goals={goalsQuery.data || []} onClose={() => setEditingTaskId(null)} onSubmit={data => updateTask.mutate({ id: editingTaskId, ...data })} onDelete={() => { if (window.confirm("هل تريد حذف هذه المهمة؟")) deleteTask.mutate({ id: editingTaskId }); }} loading={updateTask.isPending} /> : null}
      {reportingTaskId!==null&&<section className="app-card mb-5 border-primary/20 p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">تغذية راجعة للمخطط الذكي</p><h2 className="mt-1 font-bold">ليه ما كملتش المهمة؟</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">إجابتك هتساعد النظام يقلل الحمل أو يغيّر ترتيب المهام بدل ما يكرر نفس الخطة.</p></div><Button type="button" variant="ghost" size="icon" onClick={()=>setReportingTaskId(null)} aria-label="إغلاق"><X className="size-4"/></Button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">السبب الأساسي<select value={blockerReason} onChange={e=>setBlockerReason(e.target.value as typeof blockerReason)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal">
            <option value="low_time">وقتي كان قليل</option><option value="not_understood">المحتوى مش واضح وفهمه صعب</option><option value="too_much">المهمة كبيرة أو صعبة</option><option value="other_commitment">انشغلت بحاجة تانية</option><option value="forgot">نسيت المهمة</option><option value="other">سبب آخر</option>
          </select></label>
          <label className="block text-xs font-semibold">تفاصيل إضافية (اختياري)<Input value={blockerNote} onChange={e=>setBlockerNote(e.target.value)} maxLength={500} placeholder="اكتب أي توضيح يساعدنا..." className="mt-2 h-11 bg-background text-sm font-normal"/></label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setReportingTaskId(null)}>إلغاء</Button><Button type="button" disabled={reportNotCompleted.isPending} onClick={()=>reportNotCompleted.mutate({id:reportingTaskId,reason:blockerReason,note:blockerNote.trim()||undefined})}>{reportNotCompleted.isPending?"بيتحفظ السبب…":"إرسال السبب"}</Button></div>
      </section>}
            <section className="app-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">قائمة التنفيذ</p>
              <h2 className="mt-1 text-lg font-bold">مهامك بحسب الأولوية</h2>
              <p className="mt-1 text-xs text-muted-foreground">المهام المفتوحة أولًا، ثم الأقرب موعدًا. ابحث بالعنوان أو المادة أو الملاحظات.</p>
            </div>
            <div className="flex rounded-2xl bg-muted/70 p-1 text-xs font-semibold">
              {([ ["todo", `قيد التنفيذ ${todoCount}`], ["done", `مكتملة ${doneCount}`], ["all", "الكل"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={cn("pressable rounded-xl px-3 py-2", filter === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث في مهامك..." aria-label="البحث في المهام" className="h-11 rounded-xl pr-10" />
            {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="مسح البحث"><X className="size-4" /></button>}
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {tasksQuery.isLoading ? <TaskSkeletons /> : shownTasks.length ? shownTasks.map(task => {
            const meta = priorityMeta[task.priority];
            return <div key={task.id} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:px-6">
              <button onClick={() => { const done = task.status !== "done"; if (done && task.notes?.includes("طريقة المذاكرة:") && !window.confirm("هل أنهيت طريقة المذاكرة المطلوبة، وخلصت واجب أو امتحان المدرس لو كان مطلوبًا؟")) return; toggleTask.mutate({ id: task.id, done }); }} disabled={toggleTask.isPending} className={cn("pressable flex size-6 shrink-0 items-center justify-center rounded-full border-2", task.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground")} aria-label={task.status === "done" ? `إعادة فتح ${presentation.title}` : `إكمال ${presentation.title}`}>{task.status === "done" && <Check className="size-3.5" />}</button>
              <div className="min-w-0 flex-1"><p className={cn("font-semibold", task.status === "done" && "text-muted-foreground line-through")}>{presentation.title}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Tag className="size-3" />{presentation.category}</span>{task.dueAt && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{displayDate(task.dueAt)}</span>}</div>{presentation.notes&&<details className="mt-2 max-w-2xl rounded-lg border border-border/60 bg-muted/20 px-3 py-2"><summary className="cursor-pointer text-[11px] font-semibold text-primary">{presentation.notes.includes("طريقة المذاكرة:")?"عرض طريقة المذاكرة وسبب كل مرحلة":"عرض تفاصيل المهمة"}</summary><p className="mt-2 whitespace-pre-line text-xs leading-6 text-muted-foreground">{presentation.notes}</p></details>}</div>
              <Badge className={cn("shrink-0 rounded-lg border-0 px-2 py-1 text-[11px]", meta.pill)}><span className={cn("ml-1 inline-block size-1.5 rounded-full", meta.dot)} />{meta.label}</Badge>{task.status!=="done"&&<Button type="button" size="sm" variant="ghost" onClick={()=>{setReportingTaskId(task.id);setBlockerReason("low_time");setBlockerNote("");}} className="h-8 shrink-0 rounded-lg px-2 text-[11px] text-muted-foreground">ليه ما كملتش؟</Button>}<div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingTaskId(task.id)} className="size-8 rounded-lg" aria-label={`تعديل ${presentation.title}`}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => { if (window.confirm("حذف هذه المهمة؟")) deleteTask.mutate({ id: task.id }); }} className="size-8 rounded-lg text-destructive hover:text-destructive" aria-label={`حذف ${task.title}`}><Trash2 className="size-3.5" /></Button></div>
            </div>;
          }) : <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><Circle className="mb-3 size-8 text-muted-foreground/35" /><p className="font-semibold">{searchQuery ? "مفيش نتائج مطابقة للبحث" : "لا توجد مهام في هذه القائمة"}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{searchQuery ? "جرّب كلمة مختلفة أو امسح البحث لعرض المهام." : "أضف مهمة محددة وصغيرة بما يكفي لتبدأ بها اليوم."}</p>{searchQuery ? <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-primary">مسح البحث</Button> : <Button variant="link" onClick={() => setFormOpen(true)} className="mt-2 gap-1 text-primary"><Plus className="size-4" />أضف مهمة</Button>}</div>}
        </div>
      </section>
    </DashboardLayout>
  );
}

type EditableTask = { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null };

function TaskEditForm({ task, goals, onClose, onSubmit, onDelete, loading }: { task: EditableTask; goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null }) => void; onDelete: () => void; loading: boolean }) {
  const [title, setTitle] = useState(task.title); const [notes, setNotes] = useState(task.notes || ""); const [category, setCategory] = useState(task.category); const [priority, setPriority] = useState<"low" | "medium" | "high">(task.priority); const [date, setDate] = useState(dateInputValue(task.dueAt)); const [goalId, setGoalId] = useState(task.goalId ? String(task.goalId) : "none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), notes: notes.trim() || null, category: category.trim() || "عام", priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId), bookId: task.bookId }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل سريع</p><h2 className="mt-1 font-bold">تفاصيل المهمة</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">المهمة</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ملاحظات</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">موعد استحقاق <span className="font-normal text-muted-foreground">(اختياري)</span></label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف</label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onDelete} className="rounded-xl text-destructive hover:text-destructive"><Trash2 className="size-4" />حذف المهمة</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">حفظ التعديلات</Button></div></div></form></section>;
}

function TaskForm({ goals, onClose, onSubmit, loading }: { goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null }) => void; loading: boolean }) {
  const [title, setTitle] = useState(""); const [notes, setNotes] = useState(""); const [category, setCategory] = useState("شخصي"); const [priority, setPriority] = useState<"low" | "medium" | "high">("medium"); const [date, setDate] = useState(""); const [goalId, setGoalId] = useState("none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), notes: notes.trim() || null, category, priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId) }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">خطوة جديدة</p><h2 className="mt-1 font-bold">أضف مهمة إلى قائمتك</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ما المهمة؟</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: مراجعة الملخص قبل المحاضرة" className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">تفاصيل التنفيذ أو المطلوب تسليمه</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="المطلوب، المصادر، أو خطوات التنفيذ التي تريد الرجوع إليها..." className="min-h-24 rounded-xl bg-background" maxLength={8000} /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الموعد</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف <span className="font-normal text-muted-foreground">اختياري</span></label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "تتم الإضافة..." : "إضافة المهمة"}</Button></div></form></section>;
}

function TaskSkeletons() { return <>{[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 px-5 py-5"><span className="size-6 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-1/5 animate-pulse rounded bg-muted" /></div></div>)}</>; }
