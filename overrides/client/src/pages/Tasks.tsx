import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Circle, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const priorityMeta = {
  high: { label: "عالية", dot: "bg-rose-500", pill: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200" },
  medium: { label: "متوسطة", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  low: { label: "مرنة", dot: "bg-sky-500", pill: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200" },
};

function displayDate(date: Date | null) {
  if (!date) return "بلا موعد";
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date));
}

function dateInputValue(date: Date | null) {
  if (!date) return "";
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function Tasks() {
  const utils = trpc.useUtils();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("todo");
  const [reportingTaskId, setReportingTaskId] = useState<number | null>(null);
  const [blockerReason, setBlockerReason] = useState<"low_time" | "not_understood" | "too_much" | "other_commitment" | "forgot" | "other">("low_time");
  const [blockerNote, setBlockerNote] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const tasksQuery = trpc.tasks.list.useQuery();
  const taskSubtasksQuery = trpc.tasks.subtasks.useQuery({ taskId: selectedTaskId ?? 0 }, { enabled: selectedTaskId !== null });
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
  const addSubtask = trpc.tasks.addSubtask.useMutation({
    onSuccess: async () => {
      setNewSubtaskTitle("");
      if (selectedTaskId !== null) await utils.tasks.subtasks.invalidate({ taskId: selectedTaskId });
      toast.success("أضيفت خطوة التنفيذ.");
    },
    onError: error => toast.error(error.message),
  });
  const toggleSubtask = trpc.tasks.toggleSubtask.useMutation({
    onSuccess: async () => {
      if (selectedTaskId !== null) await utils.tasks.subtasks.invalidate({ taskId: selectedTaskId });
    },
    onError: error => toast.error(error.message),
  });
  const undoTask = trpc.tasks.undo.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); toast.success("تم التراجع عن التغيير."); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("تم حفظ تعديلات المهمة."); }, onError: error => toast.error(error.message) });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("حُذفت المهمة."); }, onError: error => toast.error(error.message) });
  const selectedTask = tasksQuery.data?.find(task => task.id === selectedTaskId) ?? null;
  const shownTasks = useMemo(() => (tasksQuery.data || []).filter(task => filter === "all" || task.status === filter), [tasksQuery.data, filter]);
  const todoCount = (tasksQuery.data || []).filter(task => task.status === "todo").length;
  const doneCount = (tasksQuery.data || []).filter(task => task.status === "done").length;

  return (
    <DashboardLayout title="المهام" description="قائمة مرنة من المهام. لا يوجد وقت أو موعد إلزامي إلا إذا اخترته بنفسك." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-2xl bg-primary"><Plus className="size-4" />مهمة جديدة</Button>}>
      {tasksQuery.isError && <QueryErrorNotice onRetry={() => void tasksQuery.refetch()} label="تعذّر تحميل مهامك." />}
      {selectedTask && <TaskDetailsPanel
        task={selectedTask}
        subtasks={taskSubtasksQuery.data ?? []}
        loading={taskSubtasksQuery.isLoading}
        newTitle={newSubtaskTitle}
        onNewTitleChange={setNewSubtaskTitle}
        onAddSubtask={() => selectedTaskId !== null && addSubtask.mutate({ taskId: selectedTaskId, title: newSubtaskTitle.trim() })}
        adding={addSubtask.isPending}
        onToggleSubtask={(subtaskId, completed) => selectedTaskId !== null && toggleSubtask.mutate({ taskId: selectedTaskId, subtaskId, completed })}
        onClose={() => { setSelectedTaskId(null); setNewSubtaskTitle(""); }}
      />}
      {goalsQuery.isError && <QueryErrorNotice onRetry={() => void goalsQuery.refetch()} label="تعذّر تحميل الأهداف المتاحة لربط المهمة." />}
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
        <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><p className="eyebrow">قائمة التنفيذ</p><h2 className="mt-1 text-lg font-bold">مهامك بحسب الأولوية</h2></div>
          <div className="flex rounded-2xl bg-muted/70 p-1 text-xs font-semibold">
            {([ ["todo", `قيد التنفيذ ${todoCount}`], ["done", `مكتملة ${doneCount}`], ["all", "الكل"] ] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={cn("pressable rounded-xl px-3 py-2", filter === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {tasksQuery.isLoading ? <TaskSkeletons /> : shownTasks.length ? shownTasks.map(task => {
            const meta = priorityMeta[task.priority];
            return <div key={task.id} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:px-6">
              <button onClick={() => toggleTask.mutate({ id: task.id, done: task.status !== "done" })} disabled={toggleTask.isPending} className={cn("pressable flex size-6 shrink-0 items-center justify-center rounded-full border-2", task.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground")} aria-label={task.status === "done" ? `إعادة فتح ${task.title}` : `إكمال ${task.title}`}>{task.status === "done" && <Check className="size-3.5" />}</button>
              <div className="min-w-0 flex-1"><p className={cn("font-semibold", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Tag className="size-3" />{task.category}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{displayDate(task.dueAt)}</span></div><Button type="button" size="sm" variant="outline" onClick={() => setSelectedTaskId(task.id)} className="mt-2 h-8 rounded-lg px-2 text-[11px]">تفاصيل المهمة</Button></div>
              <Badge className={cn("shrink-0 rounded-lg border-0 px-2 py-1 text-[11px]", meta.pill)}><span className={cn("ml-1 inline-block size-1.5 rounded-full", meta.dot)} />{meta.label}</Badge>{task.status!=="done"&&<Button type="button" size="sm" variant="ghost" onClick={()=>{setReportingTaskId(task.id);setBlockerReason("low_time");setBlockerNote("");}} className="h-8 shrink-0 rounded-lg px-2 text-[11px] text-muted-foreground">ليه ما كملتش؟</Button>}<div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingTaskId(task.id)} className="size-8 rounded-lg" aria-label={`تعديل ${task.title}`}><Pencil className="size-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => { if (window.confirm("حذف هذه المهمة؟")) deleteTask.mutate({ id: task.id }); }} className="size-8 rounded-lg text-destructive hover:text-destructive" aria-label={`حذف ${task.title}`}><Trash2 className="size-3.5" /></Button></div>
            </div>;
          }) : <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><Circle className="mb-3 size-8 text-muted-foreground/35" /><p className="font-semibold">لا توجد مهام في هذه القائمة</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">أضف مهمة محددة وصغيرة بما يكفي لتبدأ بها اليوم.</p><Button variant="link" onClick={() => setFormOpen(true)} className="mt-2 gap-1 text-primary"><Plus className="size-4" />أضف مهمة</Button></div>}
        </div>
      </section>
    </DashboardLayout>
  );
}

function parseTaskNotes(notes: string | null | undefined) {
  if (!notes?.trim()) return [];
  const labels = ["المطلوب", "سبب اختيار المهمة", "قواعد المهمة", "المتطلبات السابقة", "معيار الإكمال", "مصدر الشرح"];
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = "ملاحظات إضافية";
  let currentLines: string[] = [];
  const flush = () => {
    const value = currentLines.join("\n").trim();
    if (value) sections.push({ title: currentTitle, content: value });
  };
  for (const line of notes.split("\n")) {
    const heading = labels.find(label => line.trim() === label + ":");
    if (heading) { flush(); currentTitle = heading; currentLines = []; }
    else currentLines.push(line);
  }
  flush();
  return sections;
}

function TaskDetailsPanel({
  task, subtasks, loading, newTitle, onNewTitleChange, onAddSubtask, onToggleSubtask, adding, onClose,
}: {
  task: any;
  subtasks: Array<{ id: number; title: string; isCompleted: boolean; sortOrder: number }>;
  loading: boolean;
  newTitle: string;
  onNewTitleChange: (value: string) => void;
  onAddSubtask: () => void;
  onToggleSubtask: (id: number, completed: boolean) => void;
  adding: boolean;
  onClose: () => void;
}) {
  const sections = parseTaskNotes(task.notes);
  const completedSteps = subtasks.filter(item => item.isCompleted).length;
  const progress = subtasks.length ? Math.round(completedSteps / subtasks.length * 100) : 0;
  return <section className="app-card mb-5 overflow-hidden border-primary/20">
    <header className="flex flex-col gap-3 border-b border-border/70 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">TASK WORKSPACE / DETAILS</p>
        <h2 className="mt-1 text-lg font-bold">{task.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{task.category}</Badge>
          <span>{task.priority === "high" ? "أولوية عالية" : task.priority === "medium" ? "أولوية متوسطة" : "أولوية مرنة"}</span>
          {task.dueAt && <span>استحقاق: {displayDate(task.dueAt)}</span>}
        </div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق التفاصيل"><X className="size-4"/></Button>
    </header>
    <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.85fr)]">
      <div className="space-y-3">
        <div><h3 className="text-sm font-bold">شرح المهمة</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">المطلوب، وقواعد التنفيذ، والمتطلبات السابقة، ومعيار الإكمال في مكان واحد.</p></div>
        {sections.length ? sections.map((section,index)=><section key={index} className="rounded-xl border border-border/70 bg-muted/10 p-3">
          <h4 className="text-xs font-bold">{section.title}</h4>
          <p className="mt-1 whitespace-pre-line text-xs leading-6 text-muted-foreground">{section.content}</p>
        </section>) : <section className="rounded-xl border border-dashed border-border p-4 text-xs leading-6 text-muted-foreground">لا توجد تفاصيل مكتوبة لهذه المهمة بعد. أضف ملاحظات أو خطوات واضحة حتى يصبح المطلوب محددًا.</section>}
      </div>
      <div className="rounded-2xl border border-border/70 bg-background p-4">
        <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold">خطوات التنفيذ</h3><p className="mt-1 text-[11px] text-muted-foreground">{subtasks.length ? `${completedSteps} من ${subtasks.length} خطوات مكتملة` : "حوّل المهمة إلى خطوات صغيرة قابلة للتنفيذ."}</p></div><span className="text-xs font-semibold tabular-nums text-primary">{subtasks.length ? `${progress}%` : "—"}</span></div>
        {subtasks.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: progress + "%" }}/></div>}
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-xs text-muted-foreground">جارٍ تحميل الخطوات…</p> : subtasks.map(item=><label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-3 text-xs leading-5">
            <input type="checkbox" checked={item.isCompleted} onChange={event=>onToggleSubtask(item.id,event.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]"/>
            <span className={item.isCompleted ? "text-muted-foreground line-through" : "text-foreground"}>{item.title}</span>
          </label>)}
        </div>
        <div className="mt-4 border-t border-border/70 pt-4">
          <label className="mb-2 block text-xs font-semibold" htmlFor="new-task-substep">أضف خطوة تحتاجها</label>
          <div className="flex gap-2"><Input id="new-task-substep" value={newTitle} onChange={event=>onNewTitleChange(event.target.value)} placeholder="اكتب خطوة تنفيذ محددة" className="h-10 min-w-0 text-xs"/><Button type="button" size="icon" disabled={adding || newTitle.trim().length<2} onClick={onAddSubtask} aria-label="إضافة خطوة"><Plus className="size-4"/></Button></div>
        </div>
      </div>
    </div>
  </section>;
}


type EditableTask = { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null };

function TaskEditForm({ task, goals, onClose, onSubmit, onDelete, loading }: { task: EditableTask; goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null }) => void; onDelete: () => void; loading: boolean }) {
  const [title, setTitle] = useState(task.title); const [notes, setNotes] = useState(task.notes || ""); const [category, setCategory] = useState(task.category); const [priority, setPriority] = useState<"low" | "medium" | "high">(task.priority); const [date, setDate] = useState(dateInputValue(task.dueAt)); const [goalId, setGoalId] = useState(task.goalId ? String(task.goalId) : "none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), notes: notes.trim() || null, category: category.trim() || "عام", priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId), bookId: task.bookId }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل سريع</p><h2 className="mt-1 font-bold">تفاصيل المهمة</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">المهمة</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ملاحظات</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">موعد استحقاق <span className="font-normal text-muted-foreground">(اختياري)</span></label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف</label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onDelete} className="rounded-xl text-destructive hover:text-destructive"><Trash2 className="size-4" />حذف المهمة</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">حفظ التعديلات</Button></div></div></form></section>;
}

function TaskForm({ goals, onClose, onSubmit, loading }: { goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null }) => void; loading: boolean }) {
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("شخصي"); const [priority, setPriority] = useState<"low" | "medium" | "high">("medium"); const [date, setDate] = useState(""); const [goalId, setGoalId] = useState("none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), category, priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId) }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">خطوة جديدة</p><h2 className="mt-1 font-bold">أضف مهمة إلى قائمتك</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ما المهمة؟</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: مراجعة الملخص قبل المحاضرة" className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الموعد</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف <span className="font-normal text-muted-foreground">اختياري</span></label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "تتم الإضافة..." : "إضافة المهمة"}</Button></div></form></section>;
}

function TaskSkeletons() { return <>{[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 px-5 py-5"><span className="size-6 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-1/5 animate-pulse rounded bg-muted" /></div></div>)}</>; }
