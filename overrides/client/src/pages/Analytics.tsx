import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import QueryErrorNotice from "@/components/QueryErrorNotice";
import { BarChart3, CheckCircle2, Clock3, Target, TrendingUp, CalendarDays } from "lucide-react";

const periodLabels = { daily: "اليوم", weekly: "هذا الأسبوع", monthly: "هذا الشهر" } as const;

export default function Analytics() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const analytics = trpc.dashboard.analytics.useQuery({ timeZone });
  const data = analytics.data;
  const totalCompleted = data ? data.periods.daily.completed + data.periods.weekly.completed + data.periods.monthly.completed : null;
  const strongestSubject = data?.subjects.length
    ? [...data.subjects].sort((a, b) => b.rate - a.rate)[0]
    : null;
  const subjectCount = data?.subjects.length ?? 0;

  return (
    <DashboardLayout title="تحليل الأداء" description="قراءة واقعية لنشاطك المسجل عبر اليوم والأسبوع والشهر، مع توضيح ما تقيسه المؤشرات وما لا تقيسه.">
      {analytics.isError && <QueryErrorNotice onRetry={() => void analytics.refetch()} label="تعذّر تحميل مؤشرات التقدم." />}

      <section className="sf-analytics-hero">
        <div className="sf-analytics-hero-copy">
          <p className="sf-analytics-overline">INSIGHT / MEASURE WHAT HAPPENED</p>
          <h2>الأرقام تصف ما فعلته، لا ما تتوقعه من نفسك.</h2>
          <p>هذه اللوحة تقرأ إنجاز المهام المسجل حسب الفترة وتصنيف المادة. لا تدّعي قياس الفهم أو الإتقان من مجرد عدد المهام.</p>
        </div>
        <div className="sf-analytics-hero-snapshot">
          <div className="sf-analytics-snapshot-head"><span>أقوى معدل إنجاز حسب المادة</span><TrendingUp /></div>
          {analytics.isLoading || analytics.isError ? <strong>—</strong> : strongestSubject ? <><strong>{strongestSubject.rate}%</strong><b>{strongestSubject.name}</b></> : <><strong>—</strong><b>لا توجد بيانات مصنفة بعد</b></>}
          <small>{analytics.isLoading || analytics.isError ? "بانتظار البيانات" : subjectCount ? "من " + subjectCount + " مواد مصنفة" : "أضف تصنيفًا للمهام لبدء المقارنة"}</small>
        </div>
        <span className="sf-analytics-orbit" aria-hidden="true" />
      </section>

      {analytics.isLoading ? (
        <div className="sf-analytics-period-grid">{[1,2,3].map(item => <div key={item} className="sf-analytics-skeleton" />)}</div>
      ) : data ? <>
        <section className="sf-analytics-period-grid">
          {(Object.entries(data.periods) as Array<[keyof typeof periodLabels, typeof data.periods.daily]>).map(([key, period]) => (
            <article key={key} className={"sf-analytics-period tone-" + key}>
              <div className="sf-analytics-period-top">
                <span>{key === "daily" ? <Clock3 /> : key === "weekly" ? <BarChart3 /> : <CalendarDays />}</span>
                <Badge>{periodLabels[key]}</Badge>
              </div>
              <strong>{period.completed}</strong>
              <h3>مهام أُنجزت</h3>
              <p>{key === "daily" ? "خلال اليوم الحالي" : key === "weekly" ? "من بداية الأسبوع الحالي" : "من بداية الشهر الحالي"}</p>
              <div className="sf-analytics-period-mark" aria-hidden="true" />
            </article>
          ))}
        </section>

        <section className="sf-analytics-subjects app-card">
          <div className="sf-analytics-subjects-header">
            <div><p className="sf-analytics-section-kicker">SUBJECT BREAKDOWN</p><h2>التقدم حسب المادة</h2><p>المادة مأخوذة من تصنيف المهمة. عدّل التصنيف من صفحة المهام لقراءة أدق.</p></div>
            <span><Target /> {data.subjects.length} مواد</span>
          </div>
          {data.subjects.length ? <div className="sf-analytics-subject-list">
            {data.subjects.map((subject, index) => (
              <article key={subject.name} className={"sf-analytics-subject tone-" + (index % 4 + 1)}>
                <div className="sf-analytics-subject-heading"><span className="sf-analytics-subject-index">{String(index + 1).padStart(2,"0")}</span><div><h3>{subject.name}</h3><p>{subject.completed} مكتملة · {subject.overdue} متأخرة · {subject.total} إجمالي</p></div><strong>{subject.rate}%</strong></div>
                <Progress value={subject.rate} className="sf-analytics-subject-progress" />
              </article>
            ))}
          </div> : <div className="sf-analytics-empty"><BarChart3 /><h3>لا توجد بيانات مصنفة بعد.</h3><p>أضف مهامًا وصنّفها حسب المادة لتظهر هنا قراءة التقدم.</p></div>}
        </section>
        <aside className="sf-analytics-disclaimer"><CheckCircle2 /><p>{data.disclaimer}</p></aside>
      </> : !analytics.isError ? <div className="sf-analytics-empty"><BarChart3 /><h3>لا توجد بيانات كافية لعرض التقدم الآن.</h3><p>ستظهر القراءة عندما توجد مهام مسجلة في النظام.</p></div> : null}
    </DashboardLayout>
  );
}
