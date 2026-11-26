import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ActivityEvent = {
  stage: string;
  detail: string;
  status: "active" | "complete" | "failed";
  updatedAt: number;
};

type Activity = {
  id: string;
  kind: "assistant" | "planner" | "daily_plan";
  title: string;
  status: "running" | "complete" | "failed";
  stage: string;
  detail: string;
  events: ActivityEvent[];
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  error?: string;
};

const kindLabel: Record<Activity["kind"], string> = {
  assistant: "المساعد الدراسي",
  planner: "مخطط المذاكرة",
  daily_plan: "خطة اليوم",
};

function eventIcon(status: ActivityEvent["status"]) {
  if (status === "complete") return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === "failed") return <AlertCircle className="size-3.5 text-destructive" />;
  return <Loader2 className="size-3.5 animate-spin text-primary" />;
}

export default function AIActivityCenter() {
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(Date.now());
  const activityQuery = trpc.ai.activity.useQuery(undefined, {
    enabled: Boolean(user) && !loading,
    staleTime: 1_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.active?.length ? 1_500 : 10_000,
  });

  const active = activityQuery.data?.active ?? [];
  const recent = activityQuery.data?.recent ?? [];
  const current = active[0] ?? recent[0] ?? null;
  const showRecent = current?.status !== "running"
    && current?.completedAt !== null
    && current?.completedAt !== undefined
    && now - current.completedAt < 8_000;
  const visible = Boolean(current && (current.status === "running" || showRecent));

  useEffect(() => {
    if (!active.length && !showRecent) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active.length, showRecent]);

  useEffect(() => {
    if (current?.status === "running") setExpanded(true);
  }, [current?.id, current?.status]);

  const orderedEvents = useMemo(
    () => current?.events.slice(-6) ?? [],
    [current?.events],
  );

  if (!user || !visible || !current) return null;

  const isRunning = current.status === "running";
  const isFailed = current.status === "failed";

  return (
    <AnimatePresence>
      <motion.aside
        key={current.id}
        dir="rtl"
        role="status"
        aria-live="polite"
        aria-label="حالة عمل الذكاء الاصطناعي"
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-3 z-[120] w-[min(360px,calc(100vw-24px))] md:bottom-5 md:left-5"
      >
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_18px_55px_-24px_rgba(0,0,0,.48)] backdrop-blur-xl">
          <header className="flex items-start gap-3 p-3.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              {isRunning ? <Sparkles className="size-4" /> : isFailed ? <AlertCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">نشاط الذكاء الاصطناعي</span>
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {kindLabel[current.kind]}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-foreground">{current.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{current.detail}</p>
            </div>
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setExpanded(value => !value)}
              aria-label={expanded ? "طي تفاصيل نشاط الذكاء الاصطناعي" : "عرض تفاصيل نشاط الذكاء الاصطناعي"}
              aria-expanded={expanded}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
            </button>
          </header>

          {isRunning && (
            <div className="h-1 w-full overflow-hidden bg-muted" role="progressbar" aria-label="جاري تنفيذ الطلب" aria-valuetext="مؤشر انتظار غير محدد؛ لا توجد نسبة إنجاز دقيقة">
              <motion.div
                className="h-full w-1/3 rounded-full bg-primary"
                initial={{ x: "120%" }}
                animate={{ x: ["120%", "-120%"] }}
                transition={{ duration: 1.35, repeat: Infinity, ease: "linear" }}
              />
            </div>
          )}

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/70 bg-muted/20 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">خطوات التنفيذ</span>
                    {active.length > 1 && (
                      <span className="text-[10px] text-muted-foreground">عمليات نشطة أخرى: {active.length - 1}</span>
                    )}
                  </div>
                  <ol className="space-y-2">
                    {orderedEvents.map((event, index) => (
                      <li key={event.stage + "-" + event.updatedAt} className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0">{eventIcon(event.status)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={"text-xs font-semibold " + (event.status === "active" ? "text-foreground" : "text-muted-foreground")}>{event.stage}</span>
                            {event.status === "active" && <span className="text-[10px] font-medium text-primary">جارٍ الآن</span>}
                            {event.status === "failed" && <span className="text-[10px] font-medium text-destructive">توقفت</span>}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{event.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {isFailed && current.error && (
                    <p className="mt-3 rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-[11px] leading-5 text-destructive">{current.error}</p>
                  )}
                  {!isRunning && !isFailed && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> اكتملت العملية
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </motion.aside>
    </AnimatePresence>
  );
}
