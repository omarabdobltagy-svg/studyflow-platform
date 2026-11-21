import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Check, Clock3, ListChecks, MoonStar, Pencil, Plus, Sparkles, SunMedium, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const periodInfo = { morning: { label: "روتين صباحي", icon: SunMedium, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200", line: "bg-amber-500" }, evening: { label: "روتين مسائي", icon: MoonStar, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200", line: "bg-violet-500" }, custom: { label: "روتين طوال اليوم", icon: SunMedium, tone: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-200", line: "bg-teal-500" } };

export default function Routines() {
  const utils = trpc.useUtils(); const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; const [formOpen, setFormOpen] = useState(false); const [editingRoutine, setEditingRoutine] = useState<{ id: number; name: string; period: "morning" | "evening" | "custom"; accent: string; isActive: boolean; items: { title: string; durationMinutes: number }[] } | null>(null); const routinesQuery = trpc.routines.list.useQuery({ timeZone });
  const createRoutine = trpc.routines.create.useMutation({ onSuccess: () => { void utils.routines.list.invalidate(); void utils.dashboard.summary.invalidate(); setFormOpen(false); toast.success("تم إنشاء روتينك."); }, onError: error => toast.error(error.message) });
  const toggleItem = trpc.routines.toggleItem.useMutation({ onSuccess: () => { void utils.routines.list.invalidate(); void utils.dashboard.summary.invalidate(); }, onError: error => toast.error(error.message) });
  const updateRoutine = trpc.routines.update.useMutation({ onSuccess: () => { void utils.routines.list.invalidate(); void utils.dashboard.summary.invalidate(); setEditingRoutine(null); toast.success("تم تحديث الروتين."); }, onError: error => toast.error(error.message) });
  const deleteRoutine = trpc.routines.delete.useMutation({ onSuccess: () => { void utils.routines.list.invalidate(); void utils.dashboard.summary.invalidate(); toast.success("تم حذف الروتين."); }, onError: error => toast.error(error.message) });
  const allItems = (routinesQuery.data || []).filter(routine => routine.isActive).flatMap(routine => routine.items.filter(item => item.isActive)); const completed = allItems.filter(item => item.completedToday).length; const rate = allItems.length ? Math.round((completed / allItems.length) * 100) : 0;
  return <DashboardLayout title="روتيني" description="صمّم طقوسًا صغيرة قابلة للتكرار. لا تبحث عن الكمال؛ ابحث عن إيقاع تستطيع العودة إليه كل يوم." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-2xl bg-primary"><Plus className="size-4" />روتين جديد</Button>}>
    {routinesQuery.isError && <QueryErrorNotice onRetry={() => void routinesQuery.refetch()} label="تعذّر تحميل روتينك اليومي." />}
    {formOpen && <RoutineForm onClose={() => setFormOpen(false)} loading={createRoutine.isPending} onSubmit={data => createRoutine.mutate(data)} />}
    {editingRoutine && <RoutineEditForm routine={editingRoutine} onClose={() => setEditingRoutine(null)} loading={updateRoutine.isPending} onSubmit={data => updateRoutine.mutate(data)} />}
    <section className="relative mb-6 overflow-hidden rounded-[1.5rem] bg-gradient-to-l from-[#174b55] via-[#216875] to-[#425a70] p-6 text-primary-foreground shadow-[0_20px_50px_-28px_rgba(45,37,92,.8)] sm:p-7"><div className="absolute -bottom-8 left-10 size-40 rounded-full bg-violet-300/15 blur-2xl" /><div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-sm text-primary-foreground/65">التزام اليوم</p><h2 className="mt-1 text-3xl font-bold"><span className="num">{rate}%</span> <span className="text-lg font-medium text-primary-foreground/75">بهدوء وثبات</span></h2><p className="mt-3 text-sm text-primary-foreground/70">أكملت {completed} من {allItems.length} من عاداتك النشطة.</p></div><div className="w-full max-w-xs"><div className="mb-2 flex justify-between text-xs text-primary-foreground/65"><span>تقدم اليوم</span><span className="num">{completed}/{allItems.length}</span></div><Progress value={rate} className="h-2.5 bg-white/15 [&>div]:bg-amber-200" /></div></div></section>
    <section className="grid gap-5 xl:grid-cols-2">{routinesQuery.isLoading ? [0, 1].map(item => <div key={item} className="app-card h-72 animate-pulse bg-muted/70" />) : routinesQuery.data?.length ? routinesQuery.data.map(routine => { const info = periodInfo[routine.period]; const Icon = info.icon; const activeItems = routine.items.filter(item => item.isActive); const total = activeItems.length; const done = activeItems.filter(item => item.completedToday).length; return <article key={routine.id} className={cn("app-card overflow-hidden", !routine.isActive && "opacity-75")}><div className="flex items-start justify-between border-b border-border/65 p-5"><div className="flex items-center gap-3"><span className={cn("flex size-11 items-center justify-center rounded-2xl", info.tone)}><Icon className="size-5" /></span><div><h2 className="font-bold">{routine.name}</h2><p className="mt-1 text-xs text-muted-foreground">{info.label} · {total} خطوات نشطة{!routine.isActive ? " · متوقف" : ""}</p></div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setEditingRoutine({ id: routine.id, name: routine.name, period: routine.period, accent: routine.accent, isActive: routine.isActive, items: activeItems.map(item => ({ title: item.title, durationMinutes: item.durationMinutes })) })} className="pressable size-8 rounded-lg" aria-label={`تعديل ${routine.name}`}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`حذف روتين «${routine.name}»؟`)) deleteRoutine.mutate({ id: routine.id }); }} className="pressable size-8 rounded-lg text-destructive hover:text-destructive" aria-label={`حذف ${routine.name}`}><Trash2 className="size-3.5" /></Button><span className="num mr-1 rounded-xl bg-muted px-2.5 py-1 text-xs text-muted-foreground">{done}/{total}</span></div></div><div className="p-5"><div className="mb-4 h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", info.line)} style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div><div className="space-y-2">{activeItems.map(item => <button key={item.id} onClick={() => toggleItem.mutate({ id: item.id, done: !item.completedToday, timeZone })} disabled={toggleItem.isPending || !routine.isActive} aria-pressed={item.completedToday} className="pressable flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right hover:bg-muted/55"><span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", item.completedToday ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background")} >{item.completedToday && <Check className="size-3" />}</span><span className={cn("flex-1 text-sm font-medium", item.completedToday && "text-muted-foreground line-through")}>{item.title}</span><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{item.durationMinutes}د</span></button>)}</div></div></article>; }) : <div className="app-card col-span-full flex min-h-80 flex-col items-center justify-center p-6 text-center"><Sparkles className="mb-4 size-10 text-primary/40" /><h2 className="font-bold">امنح يومك بداية ونهاية لطيفتين</h2><p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">أنشئ روتينًا صباحيًا أو مسائيًا من خطوات صغيرة تساعدك على الاستمرار.</p><Button onClick={() => setFormOpen(true)} className="pressable mt-5 rounded-xl"><Plus className="size-4" />أنشئ روتينك الأول</Button></div>}</section>
  </DashboardLayout>;
}


type RoutineStepDraft = { key: string; title: string; durationMinutes: number };
type RoutinePeriod = "morning" | "evening" | "custom";

function makeRoutineStep(title = "", durationMinutes = 10): RoutineStepDraft {
  return { key: `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, durationMinutes };
}

const routineTemplates = [
  { label: "بداية اليوم", name: "بداية اليوم", period: "morning" as const, items: [
    { title: "ترتيب مساحة العمل", durationMinutes: 5 },
    { title: "مراجعة أولويات اليوم", durationMinutes: 10 },
    { title: "بدء أول مهمة", durationMinutes: 25 },
  ] },
  { label: "جلسة تركيز", name: "جلسة تركيز", period: "custom" as const, items: [
    { title: "تحديد هدف الجلسة", durationMinutes: 5 },
    { title: "عمل مركز دون مقاطعة", durationMinutes: 25 },
    { title: "استراحة قصيرة", durationMinutes: 5 },
    { title: "مراجعة ما تم إنجازه", durationMinutes: 5 },
  ] },
  { label: "نهاية اليوم", name: "نهاية اليوم", period: "evening" as const, items: [
    { title: "مراجعة إنجازات اليوم", durationMinutes: 10 },
    { title: "تجهيز مهام الغد", durationMinutes: 10 },
    { title: "إغلاق مساحة العمل", durationMinutes: 5 },
  ] },
];

function PeriodPicker({ value, onChange }: { value: RoutinePeriod; onChange: (value: RoutinePeriod) => void }) {
  const options: Array<{ value: RoutinePeriod; label: string }> = [
    { value: "morning", label: "صباحي" },
    { value: "evening", label: "مسائي" },
    { value: "custom", label: "اليوم كامل" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/55 p-1.5" role="group" aria-label="فترة الروتين">
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
          className={cn("rounded-xl px-3 py-2.5 text-sm font-semibold transition", value === option.value
            ? "bg-card text-primary shadow-sm ring-1 ring-border/70"
            : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RoutineStepBuilder({ items, onChange }: { items: RoutineStepDraft[]; onChange: (items: RoutineStepDraft[]) => void }) {
  const patchStep = (key: string, patch: Partial<RoutineStepDraft>) => onChange(items.map(item => item.key === key ? { ...item, ...patch } : item));
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
        <ListChecks className="mx-auto mb-2 size-6 text-muted-foreground/65" />
        <p className="text-sm font-semibold">ابدأ بإضافة أول خطوة</p>
        <p className="mt-1 text-xs text-muted-foreground">كل خطوة لها اسم ومدة تقديرية، ويمكنك ترتيبها لاحقًا.</p>
      </div>}
      {items.map((item, index) => (
        <div key={item.key} className="routine-step-card grid grid-cols-[30px_minmax(0,1fr)_76px_64px] items-center gap-2 rounded-2xl border border-border/75 bg-card p-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-primary">{index + 1}</span>
          <Input value={item.title} onChange={event => patchStep(item.key, { title: event.target.value })}
            placeholder={index === 0 ? "مثال: مراجعة أولويات اليوم" : "اسم الخطوة"} aria-label={`اسم الخطوة ${index + 1}`}
            className="h-10 min-w-0 rounded-xl bg-background text-sm" />
          <label className="relative">
            <Input type="number" min={1} max={300} value={item.durationMinutes}
              onChange={event => { const value = Number(event.target.value); patchStep(item.key, { durationMinutes: Number.isFinite(value) ? Math.min(300, Math.max(1, value)) : 10 }); }}
              aria-label={`مدة الخطوة ${index + 1} بالدقائق`} className="h-10 rounded-xl bg-background pl-1 text-center text-sm" />
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">د</span>
          </label>
          <div className="flex items-center justify-end gap-0.5">
            <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveStep(index, -1)} className="size-7 rounded-lg" aria-label="تحريك الخطوة لأعلى"><ArrowUp className="size-3.5" /></Button>
            <Button type="button" size="icon" variant="ghost" disabled={index === items.length - 1} onClick={() => moveStep(index, 1)} className="size-7 rounded-lg" aria-label="تحريك الخطوة لأسفل"><ArrowDown className="size-3.5" /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter(step => step.key !== item.key))} className="size-7 rounded-lg text-destructive hover:text-destructive" aria-label="حذف الخطوة"><Trash2 className="size-3.5" /></Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" disabled={items.length >= 20} onClick={() => onChange([...items, makeRoutineStep()])} className="w-full rounded-xl border-dashed">
        <Plus className="size-4" /> {items.length >= 20 ? "وصلت للحد الأقصى من الخطوات" : "إضافة خطوة"}
      </Button>
    </div>
  );
}

function RoutineForm({ onClose, onSubmit, loading }: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (data: { name: string; period: RoutinePeriod; accent: string; items: { title: string; durationMinutes: number }[] }) => void;
}) {
  const [name, setName] = useState("");
  const [period, setPeriod] = useState<RoutinePeriod>("morning");
  const [items, setItems] = useState<RoutineStepDraft[]>([]);
  const applyTemplate = (template: typeof routineTemplates[number]) => {
    setName(current => current || template.name);
    setPeriod(template.period);
    setItems(template.items.map(item => makeRoutineStep(item.title, item.durationMinutes)));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("اكتب اسم الروتين.");
    const normalized = items.map(item => ({ title: item.title.trim(), durationMinutes: item.durationMinutes })).filter(item => item.title.length > 0);
    if (!normalized.length) return toast.error("أضف خطوة واحدة على الأقل.");
    onSubmit({ name: name.trim(), period, accent: period === "morning" ? "amber" : period === "evening" ? "sky" : "teal", items: normalized });
  };
  return (
    <section className="enter app-card mb-6 overflow-hidden border-primary/15">
      <div className="flex items-center justify-between border-b border-border/65 px-5 py-4">
        <div><p className="eyebrow">إيقاع جديد</p><h2 className="mt-1 font-bold">صمّم روتينك</h2><p className="mt-1 text-xs text-muted-foreground">اختَر قالبًا جاهزًا أو أنشئ خطواتك بترتيبك.</p></div>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button>
      </div>
      <form onSubmit={submit} className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="mb-2 block text-sm font-semibold">اسم الروتين</label><Input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثال: بداية يوم الدراسة" className="h-11 rounded-xl bg-background" /></div>
          <div><label className="mb-2 block text-sm font-semibold">موعد الروتين</label><PeriodPicker value={period} onChange={setPeriod} /></div>
        </div>
        <div className="flex flex-wrap gap-2">{routineTemplates.map(template => (
          <button key={template.label} type="button" onClick={() => applyTemplate(template)} className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:bg-secondary/60">{template.label}</button>
        ))}</div>
        <section className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold">خطوات الروتين</h3><p className="mt-1 text-xs text-muted-foreground">رتّب الخطوات وحدد زمنًا تقريبيًا لكل واحدة.</p></div><span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-primary">{items.length} خطوة</span></div>
          <RoutineStepBuilder items={items} onChange={setItems} />
        </section>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "يُحفظ الروتين..." : "حفظ الروتين"}</Button></div>
      </form>
    </section>
  );
}

function RoutineEditForm({ routine, onClose, onSubmit, loading }: {
  routine: { id: number; name: string; period: RoutinePeriod; accent: string; isActive: boolean; items: { title: string; durationMinutes: number }[] };
  onClose: () => void;
  loading: boolean;
  onSubmit: (data: { id: number; name: string; period: RoutinePeriod; accent: string; isActive: boolean; items: { title: string; durationMinutes: number }[] }) => void;
}) {
  const [name, setName] = useState(routine.name);
  const [period, setPeriod] = useState(routine.period);
  const [isActive, setIsActive] = useState(routine.isActive);
  const [items, setItems] = useState<RoutineStepDraft[]>(routine.items.map(item => makeRoutineStep(item.title, item.durationMinutes)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("اكتب اسم الروتين.");
    const normalized = items.map(item => ({ title: item.title.trim(), durationMinutes: item.durationMinutes })).filter(item => item.title.length > 0);
    if (!normalized.length) return toast.error("أضف خطوة واحدة على الأقل.");
    onSubmit({ id: routine.id, name: name.trim(), period, accent: period === "morning" ? "amber" : period === "evening" ? "sky" : "teal", isActive, items: normalized });
  };
  return (
    <section className="enter app-card mb-6 overflow-hidden border-primary/15">
      <div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل الروتين</p><h2 className="mt-1 font-bold">حدّث روتينك</h2></div><Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="size-4" /></Button></div>
      <form onSubmit={submit} className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="mb-2 block text-sm font-semibold">اسم الروتين</label><Input value={name} onChange={event => setName(event.target.value)} className="h-11 rounded-xl bg-background" /></div>
          <div><label className="mb-2 block text-sm font-semibold">موعد الروتين</label><PeriodPicker value={period} onChange={setPeriod} /></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">خطوات الروتين</h3><p className="mt-1 text-xs text-muted-foreground">يمكنك تغيير ترتيبها أو مدتها أو حذفها.</p></div><span className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-primary">{items.length} خطوة</span></div><RoutineStepBuilder items={items} onChange={setItems} /></div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div><p className="text-sm font-semibold">تفعيل الروتين</p><p className="mt-1 text-xs text-muted-foreground">عند الإيقاف لن يدخل في حساب التقدم اليومي.</p></div><Switch checked={isActive} onCheckedChange={setIsActive} aria-label="تفعيل الروتين" /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "يُحفظ التعديل..." : "حفظ التعديل"}</Button></div>
      </form>
    </section>
  );
}
