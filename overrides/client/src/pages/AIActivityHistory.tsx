import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

type ActivityFilter = "all" | "running" | "complete" | "failed";
const eventLabels: Record<string, string> = {
  "ai.background.started": "بدأت عملية ذكاء اصطناعي",
  "ai.background.progress": "تقدم التنفيذ",
  "ai.background.completed": "اكتملت العملية",
  "ai.background.failed": "تعذّر إكمال العملية",
  "ai.activity.started": "بدأت عملية ذكاء اصطناعي",
  "ai.activity.progress": "تقدم التنفيذ",
  "ai.activity.completed": "اكتملت العملية",
  "ai.activity.failed": "تعذّر إكمال العملية",
  "teacher.public_update_detected": "محتوى جديد من قنوات المدرسين",
  "teacher.video_analysis_completed": "اكتمل تحليل فيديو تعليمي",
  "teacher.video_analysis_failed": "تعذّر تحليل فيديو تعليمي",
  "teacher.alternative_review_accepted": "تم قبول مراجعة تعليمية للتحليل",
};
const kindLabels: Record<string, string> = {
  daily_plan: "خطة المذاكرة",
  planner: "المخطط الذكي",
  teacher_monitor: "متابعة المدرسين",
};
function getStatus(eventType: string, metadata: Record<string, unknown>): ActivityFilter | "update" {
  if (eventType.endsWith(".failed") || eventType.endsWith("_failed") || metadata.status === "failed") return "failed";
  if (eventType.endsWith(".started") || metadata.status === "running") return "running";
  if (eventType.endsWith(".completed") || eventType.endsWith("_completed") || metadata.status === "complete" || metadata.status === "completed") return "complete";
  return "update";
}
function statusLabel(status: ReturnType<typeof getStatus>) {
  if (status === "running") return "قيد التنفيذ";
  if (status === "complete") return "اكتملت";
  if (status === "failed") return "تعذّر الإكمال";
  return "تحديث جديد";
}
function statusClasses(status: ReturnType<typeof getStatus>) {
  if (status === "failed") return "border-destructive/20 bg-destructive/5 text-destructive";
  if (status === "complete") return "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-300";
  if (status === "running") return "border-primary/20 bg-primary/5 text-primary";
  return "border-border bg-muted/40 text-muted-foreground";
}

export default function AIActivityHistory() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const history = trpc.ai.history.useQuery({ limit: 80 }, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: query => query.state.data?.some(event => event.metadata?.status === "running") ? 3_000 : false,
  });
  const events = history.data ?? [];
  const timeline = useMemo(() => {
    type Event = (typeof events)[number] & { historyKey: string; historyDate: Date | string };
    const standalone: Event[] = [];
    const operations = new Map<string, { latest: Event; startedAt: Date | string }>();

    for (const event of events) {
      const isBackgroundLifecycle = (event.entityType === "ai_background" || event.entityType === "ai_activity") && event.entityId !== null;
      if (!isBackgroundLifecycle) {
        standalone.push({ ...event, historyKey: String(event.id), historyDate: event.createdAt });
        continue;
      }
      const key = String(event.entityId);
      const existing = operations.get(key);
      if (!existing) {
        operations.set(key, {
          latest: { ...event, historyKey: key, historyDate: event.createdAt },
          startedAt: event.createdAt,
        });
        continue;
      }
      const eventTime = new Date(event.createdAt as unknown as string).getTime();
      const latestTime = new Date(existing.latest.createdAt as unknown as string).getTime();
      if (event.eventType === "ai.background.started" || event.eventType === "ai.activity.started") existing.startedAt = event.createdAt;
      if (Number.isFinite(eventTime) && (!Number.isFinite(latestTime) || eventTime > latestTime)) {
        existing.latest = { ...event, historyKey: key, historyDate: existing.startedAt };
      } else {
        existing.latest.historyDate = existing.startedAt;
      }
    }

    const grouped = [...operations.values()].map(operation => ({
      ...operation.latest,
      historyDate: operation.startedAt,
    }));
    return [...standalone, ...grouped].sort((left, right) =>
      new Date(right.historyDate as unknown as string).getTime() - new Date(left.historyDate as unknown as string).getTime()
    );
  }, [events]);
  const visible = useMemo(() => timeline.filter(event => {
    const status = getStatus(event.eventType, event.metadata ?? {});
    return filter === "all" || status === filter;
  }), [timeline, filter]);

  return (
    <DashboardLayout title="أنشطة الذكاء الاصطناعي" description="سجل العمليات الخلفية التي ينفذها StudyFlow لخدمة خطتك ومتابعة مصادر المدرسين.">
      <div className="sf-ai-history-page space-y-5" dir="rtl">
        <section className="app-card rounded-2xl border border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
              <div>
                <h2 className="text-base font-extrabold">سجل العمل الخلفي</h2>
                <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">يعرض إنشاء الخطة ومزامنتها، وفحص قنوات المدرسين، وتحليل الفيديوهات. محادثاتك العادية مع المساعد الدراسي لا تظهر هنا.</p>
              </div>
            </div>
            <button type="button" onClick={() => void history.refetch()} disabled={history.isFetching} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted disabled:opacity-60">
              <RefreshCw className={"size-3.5 " + (history.isFetching ? "animate-spin" : "")} /> تحديث السجل
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="تصفية الأنشطة">
            {([
              ["all", "كل الأنشطة"],
              ["running", "قيد التنفيذ"],
              ["complete", "المكتملة"],
              ["failed", "المتعثرة"],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={"min-h-9 rounded-lg border px-3 text-xs font-semibold transition-colors " + (filter === key ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>{label}</button>
            ))}
          </div>
        </section>
        {history.isLoading ? (
          <section className="app-card flex items-center gap-3 rounded-2xl border border-border p-6 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-5 animate-spin text-primary" /> جارٍ تحميل سجل الأنشطة المحفوظة…
          </section>
        ) : history.isError ? (
          <section className="app-card rounded-2xl border border-destructive/20 p-6">
            <div className="flex items-center gap-2 font-bold text-destructive"><AlertCircle className="size-5" /> تعذّر تحميل السجل</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">لم نتمكن من قراءة الأنشطة الآن. لم يؤثر ذلك على خطة المذاكرة أو تقدمك المحفوظ.</p>
            <button type="button" onClick={() => void history.refetch()} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold">إعادة المحاولة</button>
          </section>
        ) : visible.length === 0 ? (
          <section className="app-card rounded-2xl border border-dashed border-border p-8 text-center">
            <Clock3 className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-bold">{events.length ? "لا توجد أنشطة بهذا التصنيف" : "لا توجد أنشطة محفوظة حتى الآن"}</h3>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-muted-foreground">عندما ينفذ StudyFlow عملية خلفية مثل تحديث الخطة أو فحص مصادر المدرسين، ستظهر تفاصيل بدايتها ونتيجتها هنا.</p>
          </section>
        ) : (
          <section className="space-y-3" aria-label="سجل الأنشطة">
            {visible.map(event => {
              const status = getStatus(event.eventType, event.metadata ?? {});
              const kind = String(event.metadata?.kind ?? "");
              const date = event.historyDate instanceof Date ? event.historyDate : new Date(event.historyDate as unknown as string);
              const title = kindLabels[kind] ?? eventLabels[event.eventType] ?? "نشاط في StudyFlow";
              return (
                <article key={event.historyKey} className="app-card rounded-2xl border border-border p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold">{title}</h3>
                        {kind && <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">{kindLabels[kind] ?? "عملية خلفية"}</span>}
                      </div>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">{event.summary}</p>
                    </div>
                    <span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusClasses(status)}>
                      {status === "running" ? <Loader2 className="size-3 animate-spin" /> : status === "complete" ? <CheckCircle2 className="size-3" /> : status === "failed" ? <AlertCircle className="size-3" /> : <Sparkles className="size-3" />}
                      {statusLabel(status)}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
                    {Number.isNaN(date.getTime()) ? "وقت غير متاح" : new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }).format(date)}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
