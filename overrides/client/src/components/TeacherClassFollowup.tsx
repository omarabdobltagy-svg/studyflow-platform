import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { CalendarClock, CheckCircle2, Clock3, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function formatCairoDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function TeacherClassFollowup() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const dueQuery = trpc.teacherClassFollowups.due.useQuery(undefined, {
    enabled: Boolean(user) && !loading,
    refetchInterval: query => query.state.data?.length ? 45_000 : 180_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
  const dueItems = dueQuery.data ?? [];
  const autoSubmitted = useRef(new Set<string>());
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchFrontiers, setBranchFrontiers] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const complete = trpc.teacherClassFollowups.complete.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.teacherClassFollowups.due.invalidate(),
        utils.learning.get.invalidate(),
        utils.plans.currentDaily.invalidate(),
        utils.calendar.list.invalidate(),
        utils.studentProfile.get.invalidate(),
      ]);
      setSelectedBranches([]);
      setBranchFrontiers({});
      setBusyKey(null);
      toast.success("اتسجل شرح المدرس، واتضاف الموعد القادم للتقويم.");
    },
    onError: error => {
      setBusyKey(null);
      toast.error(error.message || "تعذّر تسجيل متابعة المحاضرة.");
    },
  });
  const snooze = trpc.teacherClassFollowups.snooze.useMutation({
    onSuccess: async () => {
      await utils.teacherClassFollowups.due.invalidate();
      setSelectedBranches([]);
      setBranchFrontiers({});
      setBusyKey(null);
      toast("هنفكّرك بمتابعة المحاضرة بعد شوية.");
    },
    onError: error => {
      setBusyKey(null);
      toast.error(error.message || "تعذّر تأجيل المتابعة.");
    },
  });

  useEffect(() => {
    if (!user || loading || !dueItems.length) return;
    for (const item of dueItems) {
      if (item.requiresTopicSelection || autoSubmitted.current.has(item.key)) continue;
      autoSubmitted.current.add(item.key);
      setBusyKey(item.key);
      complete.mutate({
        key: item.key,
        outcome: "covered",
        coveredBranches: [],
        branchFrontiers: {},
      });
    }
  }, [dueItems, user, loading]);

  const active = useMemo(
    () => dueItems.find(item => item.requiresTopicSelection) ?? null,
    [dueItems],
  );

  useEffect(() => {
    setSelectedBranches([]);
    setBranchFrontiers({});
  }, [active?.key]);

  const toggleBranch = (branchId: string, checked: boolean) => {
    setSelectedBranches(current => checked
      ? [...new Set([...current, branchId])]
      : current.filter(id => id !== branchId));
    if (!checked) {
      setBranchFrontiers(current => {
        const next = { ...current };
        delete next[branchId];
        return next;
      });
    }
  };

  const submit = (outcome: "covered" | "no_new_topics" | "cancelled") => {
    if (!active || busyKey) return;
    if (outcome === "covered" && selectedBranches.length === 0) {
      toast.error("حدد فرعًا واحدًا على الأقل، أو اختر «ما شرحش موضوعًا جديدًا».");
      return;
    }
    setBusyKey(active.key);
    complete.mutate({
      key: active.key,
      outcome,
      coveredBranches: outcome === "covered" ? selectedBranches : [],
      branchFrontiers: outcome === "covered" ? branchFrontiers : {},
    });
  };

  const defer = () => {
    if (!active || busyKey) return;
    setBusyKey(active.key);
    snooze.mutate({ key: active.key, hours: 4 });
  };

  return (
    <Sheet open={Boolean(active)} onOpenChange={open => { if (!open && active && !busyKey) defer(); }}>
      <SheetContent side="right" className="sf-class-followup-sheet flex w-full max-w-xl flex-col gap-0 overflow-y-auto border-border bg-card p-0" dir="rtl">
        {active && (
          <>
            <div className="border-b border-border/70 bg-gradient-to-bl from-primary/[.11] via-card to-card p-5 sm:p-7">
              <SheetHeader className="text-right">
                <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[.09] text-primary">
                  <Sparkles className="size-5" />
                </div>
                <p className="text-[10px] font-semibold tracking-[.16em] text-primary">متابعة بعد المحاضرة</p>
                <SheetTitle className="text-xl font-bold">المستر شرح لك إيه النهارده؟</SheetTitle>
                <SheetDescription className="text-sm leading-7 text-muted-foreground">
                  مرّ ساعتان على موعد حصتك مع {active.teacherName} في مادة {active.subjectName}. سجّل الفروع التي تناولها الشرح حتى تتحدث خطة المذاكرة.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid gap-2 rounded-2xl border border-border/70 bg-background/70 p-3 text-xs">
                <p className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4 text-primary" /> الحصة المسجلة: {formatCairoDateTime(active.classStartAt)}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4 text-primary" /> موعد الحصة القادمة من جدولك: {formatCairoDateTime(active.nextSessionAt)}</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 p-5 sm:p-7">
              <div>
                <h3 className="text-sm font-bold">اختار الفروع اللي اتشرحت</h3>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">علّم على كل فرع اتشرح فعلًا. بعد كده اختار آخر درس وصل له المدرس داخل الفرع لو تعرفه. لو مش متأكد من الدرس، سيب الاختيار فاضي.</p>
              </div>

              <div className="space-y-3">
                {active.branches.map(branch => {
                  const checked = selectedBranches.includes(branch.branchId);
                  return (
                    <section key={branch.branchId} className={"rounded-2xl border p-4 transition-colors " + (checked ? "border-primary/35 bg-primary/[.035]" : "border-border bg-background")}>
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => toggleBranch(branch.branchId, event.target.checked)}
                          className="size-4 accent-[var(--primary)]"
                        />
                        <span className="text-sm font-semibold">{branch.branchTitle}</span>
                        <span className="mr-auto text-[10px] text-muted-foreground">{branch.choices.length} موضوع</span>
                      </label>
                      {checked && (
                        <label className="mt-3 block text-xs font-semibold">
                          آخر درس وصل له المدرس في الفرع (اختياري)
                          <select
                            value={branchFrontiers[branch.branchId] ?? ""}
                            onChange={event => setBranchFrontiers(current => ({ ...current, [branch.branchId]: event.target.value }))}
                            className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-normal"
                          >
                            <option value="">مش متأكد — سجّل الفرع فقط</option>
                            {branch.choices.map(choice => (
                              <option key={choice.nodeId} value={choice.nodeId}>{choice.title}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </section>
                  );
                })}
              </div>

              <p className="rounded-xl border border-border/70 bg-muted/25 p-3 text-xs leading-6 text-muted-foreground">
                التحديث ده بيسجل موضع شرح المدرس فقط. مش هنعتبر إنك أنهيت الدرس أو أتقنته تلقائيًا، ومش هنضيف واجب أو امتحان إلا لو كان مسجلًا فعلًا من المدرس.
              </p>
            </div>

            <div className="sticky bottom-0 space-y-2 border-t border-border/70 bg-card p-5 sm:p-6">
              <Button type="button" className="h-11 w-full rounded-xl" disabled={Boolean(busyKey) || selectedBranches.length === 0} onClick={() => submit("covered")}>
                {busyKey ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                سجّل الفروع والموضوعات
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-xl" disabled={Boolean(busyKey)} onClick={() => submit("no_new_topics")}>ما شرحش موضوعًا جديدًا</Button>
                <Button type="button" variant="ghost" className="h-10 rounded-xl text-muted-foreground" disabled={Boolean(busyKey)} onClick={defer}>فكّرني بعد 4 ساعات</Button>
              </div>
              <Button type="button" variant="ghost" className="h-9 w-full rounded-xl text-xs text-muted-foreground" disabled={Boolean(busyKey)} onClick={() => submit("cancelled")}>الحصة اتلغت أو ما حصلتش</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
