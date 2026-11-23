import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { buildCalendarDays, groupCalendarItems, localDateKey } from "@/lib/calendar-utils";
import { CalendarDays, ChevronLeft, ChevronRight, Circle, Clock3, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";

const typeMeta = { event: { label: "موعد", color: "bg-violet-500" }, study: { label: "مذاكرة", color: "bg-sky-500" }, goal: { label: "هدف", color: "bg-emerald-500" }, task: { label: "مهمة", color: "bg-rose-500" } };
const weekdays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function Calendar() {
  const utils = trpc.useUtils();
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ id: number; title: string; type: "event" | "study" | "goal"; startAt: Date | string; color: string } | null>(null);
  const eventsQuery = trpc.calendar.list.useQuery();
  useEffect(() => setMode(isMobile ? "agenda" : "month"), [isMobile]);

  const createEvent = trpc.calendar.create.useMutation({ onSuccess: () => { void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); setFormOpen(false); toast.success("تمت إضافة الموعد إلى التقويم."); }, onError: error => toast.error(error.message) });
  const updateEvent = trpc.calendar.update.useMutation({ onSuccess: () => { void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); setEditingEvent(null); toast.success("تم تحديث الموعد."); }, onError: error => toast.error(error.message) });
  const deleteEvent = trpc.calendar.delete.useMutation({ onSuccess: () => { void utils.calendar.list.invalidate(); void utils.dashboard.summary.invalidate(); toast.success("تم حذف الموعد."); }, onError: error => toast.error(error.message) });

  const days = useMemo(() => {
    if (mode === "month") return buildCalendarDays(cursor, 42);
    if (mode === "week") return buildCalendarDays(cursor, 7);
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      day.setDate(day.getDate() + index);
      return day;
    });
  }, [cursor, mode]);
  const eventsByDate = useMemo(() => groupCalendarItems(eventsQuery.data || []), [eventsQuery.data]);
  const upcomingEvents = useMemo(
    () => (eventsQuery.data || []).filter(event => new Date(event.startAt).getTime() >= Date.now()).slice(0, 6),
    [eventsQuery.data],
  );
  const upcomingCount = useMemo(
    () => (eventsQuery.data || []).filter(event => new Date(event.startAt).getTime() >= Date.now()).length,
    [eventsQuery.data],
  );
  const monthTitle = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(cursor);
  const rangeTitle = mode === "agenda"
    ? `${new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(days[0])} – ${new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(days[days.length - 1])}`
    : monthTitle;
  const moveCursor = (direction: -1 | 1) => setCursor(previous => {
    const next = new Date(previous);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (mode === "week" ? 7 : 14));
    return next;
  });
  const changeMode = (nextMode: "month" | "week" | "agenda") => {
    setMode(nextMode);
    if (nextMode === "month") setCursor(current => new Date(current.getFullYear(), current.getMonth(), 1));
  };
  type CalendarEventItem = NonNullable<typeof eventsQuery.data>[number];
  const getItemMeta = (item: CalendarEventItem) => {
    if (item.source === "routine") return { label: "روتين", color: "bg-amber-500" };
    if (item.source === "task") return {
      label: item.completed ? "مهمة مكتملة" : "مهمة",
      color: item.completed ? "bg-emerald-500" : "bg-rose-500",
    };
    return typeMeta[item.type];
  };
  const getItemTitle = (item: CalendarEventItem) => item.source === "routine"
    ? `${item.title} · ${item.completedCount ?? 0}/${item.itemCount ?? 0}`
    : item.title;
  const renderEventActions = (event: CalendarEventItem) => event.source === "event" ? (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`تعديل ${event.title}`} onClick={() => setEditingEvent({ id: Number(event.id.replace("event-", "")), title: event.title, type: event.type as "event" | "study" | "goal", startAt: event.startAt, color: event.color })}><Pencil className="size-3.5" /></Button>
      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-destructive hover:text-destructive" aria-label={`حذف ${event.title}`} onClick={() => { if (window.confirm(`حذف موعد «${event.title}»؟`)) deleteEvent.mutate({ id: Number(event.id.replace("event-", "")) }); }}><Trash2 className="size-3.5" /></Button>
    </div>
  ) : null;

  return <DashboardLayout title="التقويم" description="شاهد خطتك بالطريقة الأنسب لشاشتك: شبكة شهرية، أسبوع مختصر، أو قائمة يومية واضحة على الهاتف." action={<Button onClick={() => setFormOpen(true)} className="pressable rounded-xl bg-primary"><Plus className="size-4" />موعد جديد</Button>}>
    {eventsQuery.isError && <QueryErrorNotice onRetry={() => void eventsQuery.refetch()} label="تعذّر تحميل عناصر التقويم." />}
    {formOpen && <EventForm onClose={() => setFormOpen(false)} onSubmit={data => createEvent.mutate(data)} loading={createEvent.isPending} />}
    {editingEvent && <EventEditForm event={editingEvent} onClose={() => setEditingEvent(null)} loading={updateEvent.isPending} onSubmit={data => updateEvent.mutate(data)} />}
    <section className="app-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border/65 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => moveCursor(1)} aria-label="الفترة التالية"><ChevronRight className="size-4" /></Button>
            <Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => moveCursor(-1)} aria-label="الفترة السابقة"><ChevronLeft className="size-4" /></Button>
            <h2 className="mr-1 truncate text-base font-bold sm:text-lg">{rangeTitle}</h2>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 rounded-lg text-primary" onClick={() => setCursor(new Date())}>اليوم</Button>
        </div>
        <div className="grid grid-cols-3 rounded-xl bg-muted p-1 text-xs font-semibold">
          <button onClick={() => changeMode("agenda")} className={cn("rounded-lg px-2 py-2", mode === "agenda" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>قائمة</button>
          <button onClick={() => changeMode("week")} className={cn("rounded-lg px-2 py-2", mode === "week" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>أسبوعي</button>
          <button onClick={() => changeMode("month")} className={cn("rounded-lg px-2 py-2", mode === "month" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>شهري</button>
        </div>
      </div>
      {mode === "agenda" ? (
        <div className="divide-y divide-border/65">
          {days.map(day => {
            const key = localDateKey(day);
            const dayEvents = eventsByDate[key] || [];
            const today = key === localDateKey(new Date());
            return <section key={key} className="px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className={cn("text-sm font-bold", today && "text-primary")}>{new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(day)}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long" }).format(day)}</p></div>
                {today && <Badge variant="secondary" className="rounded-full">اليوم</Badge>}
              </div>
              {dayEvents.length ? <div className="space-y-2">{dayEvents.map(event => <article key={event.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-white", getItemMeta(event).color)}><CalendarDays className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{getItemTitle(event)}</p><p className="mt-1 text-xs text-muted-foreground">{getItemMeta(event).label}</p></div>
                {renderEventActions(event)}
              </article>)}</div> : <p className="rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">لا توجد عناصر مجدولة لهذا اليوم.</p>}
            </section>;
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 border-b border-border/65">{weekdays.map(day => <div key={day} className="px-3 py-3 text-center text-[11px] font-bold text-muted-foreground">{day}</div>)}</div>
            <div className="grid grid-cols-7">{days.map((day, index) => {
              const key = localDateKey(day); const cellEvents = eventsByDate[key] || [];
              const isCurrentMonth = day.getMonth() === cursor.getMonth(); const isToday = key === localDateKey(new Date());
              return <div key={`${key}-${index}`} className={cn("min-h-28 border-b border-l border-border/50 p-2", !isCurrentMonth && mode === "month" && "bg-muted/25 text-muted-foreground/55")}>
                <span className={cn("flex size-7 items-center justify-center rounded-full text-xs", isToday && "bg-primary font-bold text-primary-foreground")}>{new Intl.NumberFormat("ar-EG").format(day.getDate())}</span>
                <div className="mt-2 space-y-1">{cellEvents.slice(0, 2).map(event => <div key={event.id} className="flex items-center gap-1.5 rounded-md bg-muted/60 px-1.5 py-1 text-[11px] font-medium"><span className={cn("size-1.5 shrink-0 rounded-full", getItemMeta(event).color)} /><span className="truncate">{event.title}</span></div>)}{cellEvents.length > 2 && <p className="px-1 text-[11px] text-muted-foreground">+{cellEvents.length - 2} أخرى</p>}</div>
              </div>;
            })}</div>
          </div>
        </div>
      )}
    </section>
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">القادم</p><h2 className="mt-1 font-bold">المواعيد المقبلة</h2></div><Badge variant="secondary" className="rounded-lg">{upcomingCount} عنصر قادم</Badge></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {eventsQuery.isLoading ? [0, 1, 2].map(i => <div key={i} className="app-card h-24 animate-pulse bg-muted" />)
          : upcomingEvents.length ? upcomingEvents.map(event => <article key={event.id} className="app-card flex min-w-0 items-center gap-3 p-4">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-white", getItemMeta(event).color)}><CalendarDays className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{getItemTitle(event)}</p><p className="mt-1 text-xs text-muted-foreground">{getItemMeta(event).label} · {new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(event.startAt))}</p></div>
            {renderEventActions(event)}
          </article>)
          : <div className="app-card col-span-full flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><Circle className="size-4" />لا توجد مواعيد قادمة بعد.</div>}
      </div>
    </section>
  </DashboardLayout>;
}

function EventForm({ onClose, onSubmit, loading }: { onClose: () => void; loading: boolean; onSubmit: (data: { title: string; type: "event" | "study" | "goal"; startAt: Date; color: string }) => void }) { const [title, setTitle] = useState(""); const [type, setType] = useState<"event" | "study" | "goal">("event"); const [date, setDate] = useState(localDateKey(new Date())); const submit = (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الموعد."); onSubmit({ title: title.trim(), type, startAt: new Date(`${date}T12:00:00`), color: type === "study" ? "sky" : type === "goal" ? "emerald" : "violet" }); }; return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">موعد جديد</p><h2 className="mt-1 font-bold">أضفه إلى تقويمك</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-3"><div className="sm:col-span-3"><label className="mb-2 block text-sm font-semibold">عنوان الموعد</label><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="مثال: جلسة مراجعة الفصل الثالث" className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">النوع</label><Select value={type} onValueChange={(value: "event" | "study" | "goal") => setType(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="event">موعد</SelectItem><SelectItem value="study">مذاكرة</SelectItem><SelectItem value="goal">هدف</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التاريخ</label><Input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="flex items-end justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">إضافة</Button></div></form></section>; }

function EventEditForm({ event, onClose, onSubmit, loading }: { event: { id: number; title: string; type: "event" | "study" | "goal"; startAt: Date | string; color: string }; onClose: () => void; loading: boolean; onSubmit: (data: { id: number; title: string; type: "event" | "study" | "goal"; startAt: Date; allDay: boolean; color: string }) => void }) { const [title, setTitle] = useState(event.title); const [type, setType] = useState(event.type); const [date, setDate] = useState(localDateKey(new Date(event.startAt))); const submit = (form: FormEvent) => { form.preventDefault(); if (!title.trim()) return toast.error("اكتب عنوان الموعد."); onSubmit({ id: event.id, title: title.trim(), type, startAt: new Date(`${date}T12:00:00`), allDay: false, color: type === "study" ? "sky" : type === "goal" ? "emerald" : "violet" }); }; return <section className="enter app-card mb-6 overflow-hidden border-primary/15"><div className="flex items-center justify-between border-b border-border/65 px-5 py-4"><div><p className="eyebrow">تعديل الموعد</p><h2 className="mt-1 font-bold">حدّث تفاصيل الموعد</h2></div><Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}><X className="size-4" /></Button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-3"><div className="sm:col-span-3"><label className="mb-2 block text-sm font-semibold">عنوان الموعد</label><Input autoFocus value={title} onChange={input => setTitle(input.target.value)} className="h-11 rounded-xl bg-background" /></div><div><label className="mb-2 block text-sm font-semibold">النوع</label><Select value={type} onValueChange={(value: "event" | "study" | "goal") => setType(value)}><SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="event">موعد</SelectItem><SelectItem value="study">مذاكرة</SelectItem><SelectItem value="goal">هدف</SelectItem></SelectContent></Select></div><div><label className="mb-2 block text-sm font-semibold">التاريخ</label><Input type="date" value={date} onChange={input => setDate(input.target.value)} className="h-11 rounded-xl bg-background" /></div><div className="flex items-end justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button disabled={loading} className="pressable rounded-xl bg-primary">{loading ? "يُحفظ التعديل..." : "حفظ التعديل"}</Button></div></form></section>; }
