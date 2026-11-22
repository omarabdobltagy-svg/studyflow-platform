import DashboardLayout from "@/components/DashboardLayout";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCheck, Clock3, Loader2, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string | null) {
  if (!value) return "لم تُحدَّد بعد";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function Reminders() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.reminders.settings.useQuery();
  const notificationsQuery = trpc.reminders.notifications.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [dailyTime, setDailyTime] = useState("08:00");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setDailyTime(settingsQuery.data.dailyTime);
    setTimezone(settingsQuery.data.timezone);
  }, [settingsQuery.data]);

  const configure = trpc.reminders.configure.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.reminders.settings.invalidate(), utils.reminders.notifications.invalidate()]);
      toast.success(enabled ? "تم تفعيل تذكيرك اليومي." : "تم إيقاف التذكير اليومي.");
    },
    onError: error => toast.error(error.message || "تعذّر تحديث التذكير."),
  });
  const markRead = trpc.reminders.markRead.useMutation({ onSuccess: () => utils.reminders.notifications.invalidate() });

  const save = () => configure.mutate({ enabled, dailyTime, timezone });
  const isLoading = settingsQuery.isLoading || notificationsQuery.isLoading;
  const unreadCount = notificationsQuery.data?.filter(notification => !notification.readAt).length ?? 0;

  return (
    <DashboardLayout title="التذكيرات" description="اضبط نبضًا يوميًا يراجع مهامك ومواعيدك وروتينك، ثم اقرأ تنبيهاتك من هنا دون أن تفوت الأولويات.">
      {(settingsQuery.isError || notificationsQuery.isError) && <QueryErrorNotice label="تعذّر تحميل إعدادات التذكيرات" onRetry={() => { settingsQuery.refetch(); notificationsQuery.refetch(); }} />}
      
      <section className="sf-reminder-hero">
        <div><p className="sf-reminder-overline">ATTENTION / DAILY RHYTHM</p><h2>تذكير هادئ، في الوقت المناسب.</h2><p>اختر موعدًا محليًا واحدًا لتصل إليك خلاصة ما يحتاج انتباهك، من غير إغراقك بإشعارات متكررة.</p></div>
        <div className="sf-reminder-hero-counts">
          <div><strong>{settingsQuery.isLoading || settingsQuery.isError ? "—" : enabled ? "مفعّل" : "متوقف"}</strong><span>حالة التذكير اليومي</span></div>
          <div><strong>{notificationsQuery.isLoading || notificationsQuery.isError ? "—" : unreadCount}</strong><span>تنبيهات غير مقروءة</span></div>
        </div>
        <span className="sf-reminder-orbit" aria-hidden="true" />
      </section>
      <div className="sf-reminder-layout grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="sf-reminder-settings app-card overflow-hidden p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"><BellRing className="size-5" /></span><div><p className="eyebrow">النبض اليومي</p><h2 className="mt-1 text-xl font-bold">تذكير واحد، يوم أوضح</h2><p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">يُنشأ التذكير في الخلفية حسب وقتك المحلي، ويجمع المستحق اليوم وروتينك النشط في إشعار داخل التطبيق.</p></div></div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="تفعيل التذكيرات اليومية" />
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">وقت التذكير<Input type="time" value={dailyTime} onChange={event => setDailyTime(event.target.value)} className="mt-2 h-12 rounded-xl" disabled={!enabled || isLoading} /></label>
            <label className="block text-sm font-semibold">المنطقة الزمنية<Input value={timezone} onChange={event => setTimezone(event.target.value)} className="mt-2 h-12 rounded-xl" placeholder="Asia/Riyadh" disabled={!enabled || isLoading} /></label>
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-muted/65 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4 text-violet-600" />التشغيل التالي: {formatDate(settingsQuery.data?.nextExecutionAt ?? null)}</span><span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-4 text-emerald-600" />لن تتكرر الرسالة أكثر من مرة في اليوم.</span></div>
          <Button onClick={save} disabled={configure.isPending || isLoading} className="pressable mt-6 h-11 rounded-xl px-5"><Send className="size-4" />{configure.isPending ? "يُحفظ الإعداد…" : "حفظ التذكير"}</Button>
        </section>

        <section className="sf-reminder-history app-card p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">سجل التنبيهات</p><h2 className="mt-1 text-xl font-bold">ما الذي يحتاج انتباهك؟</h2></div><span className="rounded-xl bg-muted px-3 py-1.5 text-xs text-muted-foreground">{notificationsQuery.data?.length ?? 0} تنبيه</span></div>
          <div className="mt-5 space-y-3">
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : notificationsQuery.isError ? null : notificationsQuery.data?.length ? notificationsQuery.data.map(notification => <article key={notification.id} className="sf-notification-row rounded-2xl border border-border/70 bg-card p-4"><div className="flex gap-3"><span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200"><BellRing className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{notification.title}</h3><span className="text-xs text-muted-foreground">{formatDate(notification.deliveredAt)}</span></div><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{notification.content}</p>{!notification.readAt && <Button variant="ghost" size="sm" onClick={() => markRead.mutate({ id: notification.id })} className="pressable mt-2 h-8 rounded-lg px-2 text-xs text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"><CheckCheck className="size-3.5" />تمت القراءة</Button>}</div></div></article>) : <div className="rounded-2xl border border-dashed border-border bg-muted/35 px-5 py-10 text-center"><BellRing className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-semibold">لا توجد تنبيهات بعد</p><p className="mt-1 text-sm text-muted-foreground">فعّل التذكير وسيظهر هنا ملخص يومك عند موعده.</p></div>}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
