import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Circle, Pencil, Plus, Tag, Trash2, X, Search, Target, ListChecks, Clock3 } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const tasksQuery = trpc.tasks.list.useQuery();
  const goalsQuery = trpc.goals.list.useQuery();
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => { void utils.tasks.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setFormOpen(false); toast.success("أُضيفت المهمة إلى يومك."); },
    onError: error => toast.error(error.message),
  });
  const toggleTask = trpc.tasks.toggle.useMutation({
    onSuccess: change => { void utils.tasks.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); if (change?.changeId) toast("تم تحديث حالة المهمة.", { action: { label: "تراجع", onClick: () => undoTask.mutate({ changeId: change.changeId }) } }); },
    onError: error => toast.error(error.message),
  });
  const undoTask = trpc.tasks.undo.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); toast.success("تم التراجع عن التغيير."); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("تم حفظ تعديلات المهمة."); }, onError: error => toast.error(error.message) });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => { void utils.tasks.list.invalidate(); void utils.dashboard.summary.invalidate(); void utils.goals.list.invalidate(); setEditingTaskId(null); toast.success("حُذفت المهمة."); }, onError: error => toast.error(error.message) });
  const shownTasks = useMemo(() => (tasksQuery.data || []).filter(task => (filter === "all" || task.status === filter) && (!searchQuery.trim() || [task.title, task.category, task.notes || ""].join(" ").toLowerCase().includes(searchQuery.trim().toLowerCase()))), [tasksQuery.data, filter, searchQuery]);
  const todoCount = (tasksQuery.data || []).filter(task => task.status === "todo").length;
  const doneCount = (tasksQuery.data || []).filter(task => task.status === "done").length;

  return (
    <DashboardLayout title="المهام" description="حوّل ما تفكر به إلى خطوة قابلة للإنجاز، وحدد أولويتها وموعدها ثم أفسح لها مساحة في يومك." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-2xl bg-primary"><Plus className="size-4" />مهمة جديدة</Button>}>
      {tasksQuery.isError && <QueryErrorNotice onRetry={() => void tasksQuery.refetch()} label="تعذّر تحميل مهامك." />}
      {goalsQuery.isError && <QueryErrorNotice onRetry={() => void goalsQuery.refetch()} label="تعذّر تحميل الأهداف المتاحة لربط المهمة." />}
      {isFormOpen && <TaskForm goals={goalsQuery.data || []} onClose={() => setFormOpen(false)} onSubmit={data => createTask.mutate(data)} loading={createTask.isPending} />}
      {editingTaskId !== null && tasksQuery.data?.find(task => task.id === editingTaskId) ? <TaskEditForm task={tasksQuery.data.find(task => task.id === editingTaskId)!} goals={goalsQuery.data || []} onClose={() => setEditingTaskId(null)} onSubmit={data => updateTask.mutate({ id: editingTaskId, ...data })} onDelete={() => { if (window.confirm("هل تريد حذف هذه المهمة؟")) deleteTask.mutate({ id: editingTaskId }); }} loading={updateTask.isPending} /> : null}
      <section className="sf-task-hero">
        <div className="sf-task-hero-copy">
          <p className="sf-task-overline">EXECUTION / YOUR TASKS</p>
          <h2>حوّل القائمة إلى خطوات واضحة.</h2>
          <p>رتّب ما عليك، اعرف ما اكتمل، واحتفظ بصورة واحدة لكل ما يحتاج انتباهك.</p>
          <div className="sf-task-hero-actions">
            <Button onClick={() => setFormOpen(true)} className="rounded-xl bg-white text-[#3b214c] hover:bg-[#f1e8f7]">
              <Plus className="size-4" /> أضف مهمة
            </Button>
            <span><Check className="size-3.5" /> يتم حفظ التغييرات على حسابك</span>
          </div>
        </div>
        <div className="sf-task-hero-score">
          <div className="sf-task-score-top"><span>معدل الإنجاز</span><ListChecks /></div>
          <div className="sf-task-score-ring" style={{ background: "conic-gradient(#d7b9ec " + (tasksQuery.data?.length ? Math.round(doneCount / tasksQuery.data.length * 100) : 0) + "%,rgb(255 255 255 / 15%) 0)" }}>
            <div><strong>{tasksQuery.isLoading ? "—" : tasksQuery.data?.length ? Math.round(doneCount / tasksQuery.data.length * 100) + "%" : "0%"}</strong><small>من إجمالي المهام</small></div>
          </div>
          <div className="sf-task-score-breakdown">
            <div><b>{tasksQuery.isLoading ? "—" : todoCount}</b><span>قيد التنفيذ</span></div>
            <div><b>{tasksQuery.isLoading ? "—" : doneCount}</b><span>مكتملة</span></div>
            <div><b>{tasksQuery.isLoading ? "—" : tasksQuery.data?.length ?? 0}</b><span>الإجمالي</span></div>
          </div>
        </div>
        <span className="sf-task-hero-orbit" aria-hidden="true" />
      </section>

      <section className="sf-task-insights">
        <article className="sf-task-insight tone-lilac">
          <span>ما زال مفتوحًا</span><strong>{tasksQuery.isLoading ? "—" : todoCount}</strong><small>خطوة تحتاج قرارًا أو تنفيذًا</small>
        </article>
        <article className="sf-task-insight tone-mint">
          <span>أنجزته بالفعل</span><strong>{tasksQuery.isLoading ? "—" : doneCount}</strong><small>إنجازات مسجلة في قائمتك</small>
        </article>
        <article className="sf-task-insight tone-sun">
          <span>أولوية عالية</span><strong>{tasksQuery.isLoading ? "—" : (tasksQuery.data || []).filter(task => task.status === "todo" && task.priority === "high").length}</strong><small>من المهام غير المكتملة</small>
        </article>
      </section>

      <section className="sf-task-workspace">
        <div className="sf-task-main">
          <section className="sf-work-panel sf-task-list-panel">
            <div className="sf-task-list-heading">
              <div>
                <p className="sf-task-section-kicker">TASK MANAGER</p>
                <h2>قائمة التنفيذ</h2>
                <p>افتح المهمة لتعديل تفاصيلها أو حدّث حالتها مباشرة.</p>
              </div>
              <span className="sf-task-total">{tasksQuery.isLoading ? "—" : (tasksQuery.data || []).length} <small>مهمة</small></span>
            </div>

            <div className="sf-task-toolbar">
              <div className="sf-task-filters" role="group" aria-label="تصفية المهام">
                {([
                  ["todo", "قيد التنفيذ", todoCount],
                  ["done", "مكتملة", doneCount],
                  ["all", "الكل", (tasksQuery.data || []).length],
                ] as const).map(([value, label, count]) => (
                  <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={"sf-task-filter " + (filter === value ? "is-active" : "")}>
                    <span>{label}</span><b>{count}</b>
                  </button>
                ))}
              </div>
              <div className="sf-task-search">
                <Search aria-hidden="true" />
                <Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="ابحث باسم المهمة أو التصنيف..." aria-label="البحث في المهام" />
                {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="مسح البحث"><X /></button>}
              </div>
            </div>

            <div className="sf-task-results">
              {tasksQuery.isLoading ? <TaskSkeletons /> : shownTasks.length ? shownTasks.map(task => {
                const meta = priorityMeta[task.priority];
                return (
                  <article key={task.id} className={"sf-task-row " + (task.status === "done" ? "is-complete" : "")}>
                    <button type="button" onClick={() => toggleTask.mutate({ id: task.id, done: task.status !== "done" })} disabled={toggleTask.isPending} className={"sf-task-check " + (task.status === "done" ? "is-done" : "")} aria-label={task.status === "done" ? "إعادة فتح " + task.title : "إكمال " + task.title}>
                      {task.status === "done" && <Check />}
                    </button>
                    <div className="sf-task-row-content">
                      <div className="sf-task-row-title">
                        <h3>{task.title}</h3>
                        <Badge className={"sf-task-priority " + (task.priority === "high" ? "is-high" : task.priority === "medium" ? "is-medium" : "is-low")}>{meta.label}</Badge>
                      </div>
                      <div className="sf-task-row-meta">
                        <span><Tag />{task.category}</span>
                        <span><CalendarDays />{displayDate(task.dueAt)}</span>
                        {task.goalId && <span><Target />مرتبطة بهدف</span>}
                      </div>
                      {task.notes && <p className="sf-task-notes">{task.notes}</p>}
                    </div>
                    <div className="sf-task-row-actions">
                      <Button type="button" size="icon" variant="ghost" onClick={() => setEditingTaskId(task.id)} aria-label={"تعديل " + task.title}><Pencil /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => { if (window.confirm("حذف هذه المهمة؟")) deleteTask.mutate({ id: task.id }); }} aria-label={"حذف " + task.title} className="is-delete"><Trash2 /></Button>
                    </div>
                  </article>
                );
              }) : (
                <div className="sf-task-empty">
                  <span><Circle /></span>
                  <h3>{searchQuery ? "لا توجد نتائج مطابقة." : filter === "done" ? "لم تسجل إنجازات بعد." : filter === "todo" ? "لا توجد مهام قيد التنفيذ." : "ابدأ ببناء قائمتك."}</h3>
                  <p>{searchQuery ? "جرّب كلمة مختلفة أو امسح البحث للعودة إلى القائمة." : "أضف مهمة واضحة، ثم حدّد موعدها وأولويتها عند الحاجة."}</p>
                  {searchQuery ? <Button variant="outline" onClick={() => setSearchQuery("")}>مسح البحث</Button> : <Button variant="outline" onClick={() => setFormOpen(true)}><Plus /> أضف مهمة</Button>}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="sf-task-side">
          <section className="sf-work-panel sf-task-guidance">
            <div className="sf-task-side-icon"><Clock3 /></div>
            <p className="sf-task-section-kicker">A SMALL SYSTEM</p>
            <h3>خلي المهمة قابلة للبدء.</h3>
            <p>اكتب فعلًا محددًا بدل عنوان عام. الموعد والأولوية أدوات مساعدة، وليست مقياسًا لقيمتك أو قدرتك.</p>
            <div className="sf-task-guidance-divider" />
            <div><b>1</b><span>اكتب الخطوة التي ستنفذها فعلًا.</span></div>
            <div><b>2</b><span>أضف موعدًا فقط عندما يكون له معنى.</span></div>
            <div><b>3</b><span>حدّث الإنجاز عندما تنتهي منها.</span></div>
          </section>
          <section className="sf-task-priority-panel">
            <p className="sf-task-section-kicker">PRIORITY DISTRIBUTION</p>
            <h3>توزيع الأولويات</h3>
            {([
              { key: "high", label: "عالية", tone: "high" },
              { key: "medium", label: "متوسطة", tone: "medium" },
              { key: "low", label: "مرنة", tone: "low" },
            ] as const).map(item => {
              const count = (tasksQuery.data || []).filter(task => task.status === "todo" && task.priority === item.key).length;
              const total = Math.max(1, todoCount);
              return <div className="sf-task-priority-row" key={item.key}>
                <span>{item.label}</span><div><i className={item.tone} style={{ width: (count / total) * 100 + "%" }} /></div><b>{tasksQuery.isLoading ? "—" : count}</b>
              </div>;
            })}
            <small>الحساب من المهام قيد التنفيذ فقط.</small>
          </section>
        </aside>
      </section>
    </DashboardLayout>
  );
}

type EditableTask = { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null };

function TaskEditForm({ task, goals, onClose, onSubmit, onDelete, loading }: { task: EditableTask; goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; notes: string | null; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null; bookId: number | null }) => void; onDelete: () => void; loading: boolean }) {
  const [title, setTitle] = useState(task.title); const [notes, setNotes] = useState(task.notes || ""); const [category, setCategory] = useState(task.category); const [priority, setPriority] = useState<"low" | "medium" | "high">(task.priority); const [date, setDate] = useState(dateInputValue(task.dueAt)); const [goalId, setGoalId] = useState(task.goalId ? String(task.goalId) : "none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), notes: notes.trim() || null, category: category.trim() || "عام", priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId), bookId: task.bookId }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/20"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل سريع</p><h2 className="mt-1 font-bold">تفاصيل المهمة</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">المهمة</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ملاحظات</label><Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-20 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الموعد</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف</label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onDelete} className="rounded-xl text-destructive hover:text-destructive"><Trash2 className="size-4" />حذف المهمة</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">حفظ التعديلات</Button></div></div></form></section>;
}

function TaskForm({ goals, onClose, onSubmit, loading }: { goals: { id: number; title: string }[]; onClose: () => void; onSubmit: (data: { title: string; category: string; priority: "low" | "medium" | "high"; dueAt: Date | null; goalId: number | null }) => void; loading: boolean }) {
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("شخصي"); const [priority, setPriority] = useState<"low" | "medium" | "high">("medium"); const [date, setDate] = useState(""); const [goalId, setGoalId] = useState("none");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان المهمة أولًا."); onSubmit({ title: title.trim(), category, priority, dueAt: date ? new Date(`${date}T12:00:00`) : null, goalId: goalId === "none" ? null : Number(goalId) }); };
  return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">خطوة جديدة</p><h2 className="mt-1 font-bold">أضف مهمة إلى قائمتك</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-semibold">ما المهمة؟</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: مراجعة الملخص قبل المحاضرة" className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">التصنيف</label><Input value={category} onChange={event => setCategory(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الموعد</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">الأولوية</label><Select value={priority} onValueChange={(value: "low" | "medium" | "high") => setPriority(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">عالية</SelectItem><SelectItem value="medium">متوسطة</SelectItem><SelectItem value="low">مرنة</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">ربط بهدف <span className="font-normal text-muted-foreground">اختياري</span></label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">من دون هدف</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "تتم الإضافة..." : "إضافة المهمة"}</Button></div></form></section>;
}

function TaskSkeletons() { return <>{[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-3 px-5 py-5"><span className="size-6 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-1/5 animate-pulse rounded bg-muted" /></div></div>)}</>; }
