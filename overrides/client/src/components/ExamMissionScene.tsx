import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CalendarDays, ShieldCheck } from "lucide-react";

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
  const sceneRef = useRef<HTMLElement | null>(null);
  const dateLabel = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Cairo",
  }).format(new Date(exam.date + "T12:00:00"));
  const urgencyLabel = daysUntil === 0
    ? "امتحان اليوم"
    : daysUntil === 1
      ? "امتحان غدًا"
      : "بعد " + daysUntil.toLocaleString("ar-EG") + " يوم";

  useEffect(() => {
    const root = sceneRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.fromTo("[data-exam-reveal]",
        { opacity: 0, y: 24, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: .75, stagger: .08, ease: "power3.out" },
      );
      gsap.to("[data-exam-orbit]", { rotate: 360, duration: 44, repeat: -1, ease: "none" });
      gsap.to("[data-exam-orbit-inner]", { rotate: -360, duration: 31, repeat: -1, ease: "none" });
      gsap.to("[data-exam-core]", { y: -5, duration: 2.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, root);
    return () => context.revert();
  }, [exam.date]);

  return (
    <section
      ref={sceneRef}
      className={"sf-exam-mission-scene" + (daysUntil === 0 ? " is-today" : daysUntil === 1 ? " is-tomorrow" : "")}
      data-testid="planner-exam-spotlight"
      data-exam-date={exam.date}
    >
      <div className="sf-exam-mission-backdrop" aria-hidden="true" />
      <div className="sf-exam-mission-visual" aria-hidden="true">
        <div className="sf-exam-mission-orbit" data-exam-orbit><i /><i /><i /><i /></div>
        <div className="sf-exam-mission-orbit is-inner" data-exam-orbit-inner><i /><i /><i /></div>
        <div className="sf-exam-mission-core" data-exam-core>
          <span>{daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "NEXT" : "UPCOMING"}</span>
          <strong>{daysUntil.toLocaleString("en-US")}</strong>
          <small>{daysUntil === 0 ? "يوم الامتحان" : "يوم متبقٍ"}</small>
        </div>
      </div>
      <div className="sf-exam-mission-copy">
        <div className="sf-exam-mission-meta" data-exam-reveal>
          <span className="sf-exam-mission-kicker"><CalendarDays className="size-3.5" /> مركز متابعة الامتحانات</span>
          <span className="sf-exam-mission-state">{urgencyLabel}</span>
        </div>
        <h2 data-exam-reveal>{exam.subjectName}</h2>
        <strong className="sf-exam-mission-date" data-exam-reveal>{dateLabel}</strong>
        <p data-exam-reveal>
          {exam.schoolConfirmed
            ? "تم تأكيد هذا الموعد من المدرسة."
            : "الموعد الحالي من جدول مديرية القاهرة المقترح، وليس تأكيدًا من مدرستك. راجع إشعار المدرسة قبل الاعتماد النهائي."}
        </p>
        <div className="sf-exam-mission-timeline" data-exam-reveal>
          {upcomingExams.slice(0, 4).map(item => (
            <div key={item.subjectId + item.date} className={item.subjectId === exam.subjectId && item.date === exam.date ? "is-active" : ""}>
              <i />
              <span>{item.subjectName}</span>
              <small>{new Intl.DateTimeFormat("ar-EG", {
                day: "numeric", month: "short", timeZone: "Africa/Cairo",
              }).format(new Date(item.date + "T12:00:00"))}</small>
            </div>
          ))}
        </div>
        {!exam.schoolConfirmed && (
          <small className="sf-exam-mission-provenance">
            <ShieldCheck className="size-3.5" /> الجدول مقترح من مديرية القاهرة؛ لم يُؤكد من المدرسة.
          </small>
        )}
      </div>
      <div className="sf-exam-mission-scope" data-exam-reveal>
        <p>لم يتوفر حتى الآن نطاق موثّق لهذا الامتحان. سنعرض الموضوعات فقط عند وجود تصريح واضح يمكن الرجوع إلى مصدره.</p>
      </div>
    </section>
  );
}
