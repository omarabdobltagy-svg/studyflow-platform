import { CalendarDays, ShieldCheck, AlertCircle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export type PlannerExam = {
  subjectId: string;
  date: string;
  dayName: string;
  subjectName: string;
  category: string;
  schoolConfirmed: boolean;
};

export default function ExamMissionScene({
  exam,
  daysUntil,
  upcomingExams,
}: {
  exam: PlannerExam;
  daysUntil: number;
  upcomingExams: PlannerExam[];
}) {
  const [, setLocation] = useLocation();
  const dateLabel = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Cairo",
  }).format(new Date(exam.date + "T12:00:00"));

  const countdownLabel = daysUntil === 0
    ? "الامتحان اليوم"
    : daysUntil === 1
      ? "متبقي يوم واحد"
      : "متبقي " + daysUntil.toLocaleString("ar-EG") + " يوم";

  return (
    <section
      className={"sf-exam-mission-scene" + (daysUntil === 0 ? " is-today" : daysUntil === 1 ? " is-tomorrow" : "")}
      data-testid="planner-exam-spotlight"
      data-exam-date={exam.date}
      aria-labelledby="sf-exam-mission-title"
    >
      <div className="sf-exam-mission-main">
        <header className="sf-exam-mission-header">
          <span className="sf-exam-mission-kicker"><CalendarDays className="size-4" /> الامتحان الأقرب</span>
          <span className={"sf-exam-mission-state" + (exam.schoolConfirmed ? " is-confirmed" : " is-proposed")}>
            {exam.schoolConfirmed ? <><ShieldCheck className="size-3.5" /> مؤكد من المدرسة</> : <><AlertCircle className="size-3.5" /> موعد مقترح</>}
          </span>
        </header>

        <div className="sf-exam-mission-overview">
          <div className="sf-exam-mission-copy">
            <span className="sf-exam-mission-subject-label">{exam.category === "specialization" ? "مادة تخصصية" : "مادة أساسية"}</span>
            <h2 id="sf-exam-mission-title">{exam.subjectName}</h2>
            <strong className="sf-exam-mission-date">{dateLabel}</strong>
          </div>
          <div className="sf-exam-mission-countdown" aria-label={countdownLabel}>
            <strong>{daysUntil.toLocaleString("ar-EG")}</strong>
            <span>{daysUntil === 0 ? "اليوم" : daysUntil === 1 ? "يوم" : "يوم متبقٍ"}</span>
          </div>
        </div>

        <div className="sf-exam-mission-guidance">
          <span>الخطوة التالية</span>
          <p>
            {exam.schoolConfirmed
              ? "راجع إعلان المدرسة لمعرفة نطاق الدروس، ثم اربط المراجعة بالموضوعات المحددة."
              : "تأكد من الموعد مع المدرسة أولاً. هذا التاريخ من جدول مديرية القاهرة المقترح وليس تأكيداً مدرسياً."}
          </p>
          <button type="button" className="sf-exam-mission-action" onClick={() => setLocation("/planner")}>
            افتح خريطة المذاكرة <ArrowLeft className="size-4" />
          </button>
        </div>
      </div>

      {upcomingExams.length > 1 && (
        <div className="sf-exam-mission-timeline" aria-label="الاختبارات التالية">
          <span className="sf-exam-mission-timeline-title">بعده</span>
          {upcomingExams.slice(1, 4).map(item => (
            <div key={item.subjectId + item.date}>
              <i aria-hidden="true" />
              <span>{item.subjectName}</span>
              <small>{new Intl.DateTimeFormat("ar-EG", {
                day: "numeric", month: "short", timeZone: "Africa/Cairo",
              }).format(new Date(item.date + "T12:00:00"))}</small>
            </div>
          ))}
        </div>
      )}

      <footer className="sf-exam-mission-scope">
        <ShieldCheck className="size-4" />
        <p>نطاق الدروس لا يُعرض إلا عند توفر إعلان موثّق؛ لا توجد حالياً موضوعات مؤكدة لهذا الامتحان.</p>
      </footer>
    </section>
  );
}
