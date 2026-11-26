import DashboardLayout from "@/components/DashboardLayout";
import CurriculumProgressScene, { type SceneBranch } from "@/components/CurriculumProgressScene";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  getSIEStudentVisibleBranches,
  getSIECheckpointProgressOptions,
  getSIESubject,
  getSIETeacher,
  type SIECheckpointChoice,
} from "@shared/sie-catalog";
import { ArrowLeft, BookOpenCheck, BookOpenText, CircleHelp, Gauge, Network, RefreshCw, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type LearningGap = {
  referenceSource: "teacher" | "school" | "unavailable";
  referenceFrontierId: string | null;
  referenceFrontierTitle: string | null;
  studentFrontierId: string | null;
  studentFrontierTitle: string | null;
  referencePosition: number | null;
  studentPosition: number | null;
  gapCount: number | null;
  aheadCount: number | null;
  status: "calculated" | "student_position_missing" | "reference_missing";
};

type BranchView = {
  branchId: string;
  branchTitle: string;
  branchType: string;
  pointLabel: string;
  choices: SIECheckpointChoice[];
  gap: LearningGap | null;
  nextLesson: SIECheckpointChoice | null;
  minutesPerLesson: number | null;
};

function gapLabel(gap: LearningGap | null, pointLabel: string) {
  if (!gap || gap.status !== "calculated" || gap.gapCount === null) return "غير محسوبة بعد";
  if (gap.gapCount > 0) return `فجوة مرجعية: ${gap.gapCount} ${pointLabel}`;
  if ((gap.aheadCount ?? 0) > 0) return `متقدم بـ ${gap.aheadCount} ${pointLabel}`;
  return "متوافق مع المرجع";
}

const ENGLISH_CURRICULUM_LABELS: Record<string, string> = {
  "Living Well in a Complex World": "الحياة الجيدة في عالم معقّد",
  "Leisure Time": "وقت الفراغ",
  "Echoes of the Past": "أصداء الماضي",
  "The Power of Choice": "قوة الاختيار",
  "The Greenhouse Effect": "ظاهرة الاحتباس الحراري",
  "The Space We Share": "المساحة التي نتشاركها",
  "Discovering Your Passion": "اكتشاف شغفك",
  "Pathways to Progress": "مسارات التقدم",
  "Circles of Belonging": "دوائر الانتماء",
  "Behind the Buy": "ما وراء الشراء",
  "The Lost World": "العالم المفقود",
  "Vocabulary": "المفردات",
  "Participial Phrases and Relative Clauses": "عبارات التصريف والجمل الموصولة",
  "Conditional Structures": "التراكيب الشرطية",
  "Gerunds and Infinitives": "المصدر بصيغتيه Gerund وInfinitive",
  "Narrative Tenses": "أزمنة السرد",
  "Prepositional Phrases of Place and Time": "عبارات حروف الجر للمكان والزمان",
  "Concession Clauses": "جمل التنازل",
  "Passive Voice for Formal Reporting": "المبني للمجهول في التقارير الرسمية",
  "Present Perfect": "المضارع التام",
  "Linking Words and Logical Connectors": "أدوات الربط المنطقي",
  "Fronting for Emphasis": "التقديم للتوكيد",
  "Modal Verbs": "الأفعال الناقصة",
  "Cause-and-Effect Structures": "تراكيب السبب والنتيجة",
  "Adverbials of Degree and Frequency": "ظروف الدرجة والتكرار",
  "Reported Speech": "الكلام المنقول",
  "Used to / Would (Past Habits)": "التعبير عن العادات الماضية",
  "Present Continuous": "المضارع المستمر",
  "Have / Get Something Done (Causative)": "صيغة السببية",
  "So...that / Such...that": "تراكيب النتيجة",
  "Stative Verbs vs. Action Verbs": "أفعال الحالة مقابل أفعال الحركة",
  "Quantifiers": "المحددات الكمية",
  "Social Media and Self-Image": "وسائل التواصل الاجتماعي وصورة الذات",
  "Exploring Modern Lifestyles": "استكشاف أنماط الحياة الحديثة",
  "Whose Responsibility Is It?": "على من تقع المسؤولية؟",
  "Understanding Mental Health": "فهم الصحة النفسية",
  "Screen Time and Young People": "وقت الشاشة والشباب",
  "Creative Arts as Leisure Activities": "الفنون الإبداعية كأنشطة لوقت الفراغ",
  "Sport and Physical Activity as Leisure": "الرياضة والنشاط البدني في وقت الفراغ",
  "Not Exactly a Relaxing Day": "يوم ليس مريحًا تمامًا",
  "Sites of Memory": "مواقع الذاكرة",
  "The Museum as a Storyteller": "المتحف بوصفه راويًا",
  "The Viral Past": "الماضي سريع الانتشار",
  "Social Media and Historical Events": "وسائل التواصل والأحداث التاريخية",
  "Food Waste": "هدر الطعام",
  "Beyond the Brand": "ما وراء العلامة التجارية",
  "Digital Consumption": "الاستهلاك الرقمي",
  "Black Friday and Sales Culture": "الجمعة السوداء وثقافة التخفيضات",
  "The Climate Crisis": "أزمة المناخ",
  "Renewable Energy – Powering a Sustainable Future": "الطاقة المتجددة: طاقة لمستقبل مستدام",
  "Greening Projects in Egypt": "مشروعات الاستدامة في مصر",
  "Individual and Collective Actions": "جهود فردية وجماعية",
  "A World We Borrow": "عالم نستعيره",
  "When Needs Compete": "عندما تتنافس الاحتياجات",
  "Voices for the Voiceless": "أصوات من لا صوت لهم",
  "Global Citizens, Local Actions": "مواطنون عالميون وأفعال محلية",
  "From Hobby to Opportunity": "من الهواية إلى الفرصة",
  "Building a Community Around Your Passion": "بناء مجتمع حول شغفك",
  "Leaving Your Mark": "اترك بصمتك",
  "Time Well Spent: Balancing Passion and Priorities": "وقت مثمر: الموازنة بين الشغف والأولويات",
  "Vocational Education in Egypt": "التعليم الفني في مصر",
  "International Vocational Voices Online": "أصوات التعليم الفني عالميًا عبر الإنترنت",
  "The Egyptian-Japanese Schools (EJS)": "المدارس المصرية اليابانية",
  "The Skills Employers Really Want": "المهارات التي يبحث عنها أصحاب العمل",
  "Finding My Place": "أجد مكاني",
  "Relationships That Help Us Grow": "علاقات تساعدنا على النمو",
  "No One Left Behind": "لا أحد يُترك خلف الركب",
  "Community That Cares": "مجتمع يهتم بأفراده",
  "Hidden Cost of a Click": "التكلفة الخفية لضغطة واحدة",
  "Chasing Validation": "السعي وراء القبول",
  "True Price of Fast Fashion": "التكلفة الحقيقية للأزياء السريعة",
  "Rethinking What We Buy: A Community Response": "إعادة التفكير فيما نشتريه: استجابة مجتمعية",
  "A Dream of Adventure": "حلم بالمغامرة",
  "Professor Challenger’s Secret": "سر البروفيسور تشالنجر",
  "The Expedition Is Chosen": "اختيار أفراد الرحلة الاستكشافية",
  "Into the Unknown": "إلى المجهول",
  "Trapped in the Lost World": "عالقون في العالم المفقود",
  "Malone’s Night Adventure": "مغامرة مالون الليلية",
  "Prisoners of the Ape-Men": "أسرى رجال القردة",
  "The Battle for the Plateau": "المعركة من أجل الهضبة",
  "The Hidden Way Home": "الطريق الخفي إلى الوطن",
  "Proof Before the World": "إثبات الحقيقة أمام العالم",
};

function displayCurriculumTitle(value: string | null | undefined): string {
  const title = (value ?? "").trim();
  if (!title) return "عنوان غير متاح";
  return ENGLISH_CURRICULUM_LABELS[title]
    ?? title.replace(/^Unit\\s+(\\d+)\\s*:/i, "الوحدة $1:")
      .replace(/^Lesson\\s+(\\d+)\\s*$/i, "الدرس $1");
}

function displayBranchTitle(value: string): string {
  const labels: Record<string, string> = {
    "الوحدات (Units)": "وحدات الكتاب",
    "القصة - The Lost World": "القصة: العالم المفقود",
    "GRE — مسار تكميلي": "مسار إثرائي لاختبار اللغة",
    "دروس المفردات داخل الوحدات": "المفردات",
    "دروس القواعد داخل الوحدات": "قواعد اللغة",
    "المقرر بالكامل": "المقرر بالكامل",
  };
  return labels[value] ?? displayCurriculumTitle(value);
}

export default function CurriculumMap() {
  const [, setLocation] = useLocation();
  const profile = trpc.studentProfile.get.useQuery();
  const learning = trpc.learning.get.useQuery();
  const [subjectId, setSubjectId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [viewMode, setViewMode] = useState<"3d" | "list">("3d");

  const subjects = profile.data?.subjectIds ?? [];
  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0]);
  }, [subjectId, subjects]);

  const branches = useMemo(() => getSIEStudentVisibleBranches(subjectId), [subjectId]);
  useEffect(() => {
    if (!branches.length) {
      setSelectedBranchId("");
      return;
    }
    if (!branches.some(branch => branch.branchId === selectedBranchId)) {
      setSelectedBranchId(branches[0].branchId);
    }
  }, [branches, selectedBranchId]);

  const selection = (profile.data?.selection ?? {}) as Record<string, any>;
  const subjectProgress = (learning.data?.courseProgress?.[subjectId] ?? {}) as Record<string, any>;
  const branchProgress = (subjectProgress.branches ?? {}) as Record<string, Record<string, any>>;
  const subjectGaps = ((learning.data as any)?.gapByBranch?.[subjectId] ?? {}) as Record<string, LearningGap>;

  const branchViews: BranchView[] = useMemo(() => branches.map(branch => {
    const gap = subjectGaps[branch.branchId] ?? null;
    const saved = branchProgress[branch.branchId] ?? {};
    const nextIndex = gap?.studentPosition;
    const nextLesson = typeof nextIndex === "number" && nextIndex >= 0 && nextIndex < branch.choices.length
      ? branch.choices[nextIndex]
      : null;
    return {
      branchId: branch.branchId,
      branchTitle: branch.branchTitle,
      branchType: branch.branchType,
      pointLabel: branch.branchType === "official_section" ? "موضوع" : "درس",
      choices: branch.choices,
      gap,
      nextLesson,
      minutesPerLesson: Number.isFinite(Number(saved.estimatedMinutesPerLesson))
        ? Number(saved.estimatedMinutesPerLesson)
        : Number.isFinite(Number(subjectProgress.estimatedMinutesPerLesson))
          ? Number(subjectProgress.estimatedMinutesPerLesson)
          : null,
    };
  }), [branches, subjectGaps, branchProgress, subjectProgress]);

  const sceneBranches: SceneBranch[] = useMemo(() => branchViews.map(branch => ({
    branchId: branch.branchId,
    title: displayBranchTitle(branch.branchTitle),
    nodes: branch.choices.map((choice, index) => {
      const gap = branch.gap;
      const studentPosition = gap?.studentPosition ?? null;
      const referencePosition = gap?.referencePosition ?? null;
      let state: "completed" | "gap" | "next" | "future" | "unmapped" = "unmapped";
      if (studentPosition !== null) {
        if (index < studentPosition) state = "completed";
        else if (referencePosition !== null && index < referencePosition) state = "gap";
        else if (index === studentPosition) state = "next";
        else state = "future";
      } else if (referencePosition !== null && index < referencePosition) {
        state = "unmapped";
      } else {
        state = "future";
      }
      return { nodeId: choice.nodeId, title: displayCurriculumTitle(choice.title), state };
    }),
  })), [branchViews]);

  const knownGaps = branchViews.filter(branch => branch.gap?.status === "calculated" && branch.gap.gapCount !== null);
  const branchesWithGap = knownGaps.filter(branch => (branch.gap?.gapCount ?? 0) > 0).length;
  const knownReferences = branchViews.filter(branch => Boolean(branch.gap && branch.gap.referenceSource !== "unavailable")).length;
  const trackedPositions = branchViews.filter(branch => branch.gap?.studentPosition !== null && branch.gap?.studentPosition !== undefined).length;
  const priorityBranch = knownGaps
    .filter(branch => (branch.gap?.gapCount ?? 0) > 0)
    .sort((a, b) => {
      const ratioA = (a.gap?.referencePosition ?? 0) > 0 ? (a.gap?.gapCount ?? 0) / (a.gap?.referencePosition ?? 1) : 0;
      const ratioB = (b.gap?.referencePosition ?? 0) > 0 ? (b.gap?.gapCount ?? 0) / (b.gap?.referencePosition ?? 1) : 0;
      return ratioB - ratioA;
    })[0] ?? null;

  const teacherId = (selection.teacherChoices as Record<string, string> | undefined)?.[subjectId]
    ?? profile.data?.teacherSelections?.[subjectId];
  const teacher = teacherId ? getSIETeacher(teacherId) : undefined;
  const subject = getSIESubject(subjectId);

  const selectBranch = useCallback((branchId: string) => {
    setSelectedBranchId(branchId);
  }, []);

  const goToStudy = (branchId = selectedBranchId, lessonId?: string) => {
    const query = new URLSearchParams();
    if (subjectId) query.set("subject", subjectId);
    if (branchId) query.set("branch", branchId);
    if (lessonId) query.set("lesson", lessonId);
    setLocation("/study?" + query.toString());
  };

  const scrollToBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    requestAnimationFrame(() => document.getElementById("curriculum-branch-" + branchViews.find(item => item.branchId === branchId)?.branchId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <DashboardLayout
      title="خريطة المنهج"
      description="تابع تقدمك وآخر موضع للمدرس داخل كل فرع من فروع المنهج."
      action={<span className="sf-page-action-label"><Network className="size-4" />بيانات المنهج</span>}
    >
      {profile.isError && <div className="app-card p-4 text-sm text-destructive">تعذّر تحميل ملفك الدراسي. أعد المحاولة بعد التحقق من الاتصال.</div>}
      {learning.isError && <div className="app-card p-4 text-sm text-destructive">تعذّر تحميل بيانات التقدم. لم يتم استبدال البيانات المفقودة بأرقام صفرية.</div>}

      <section className="sf-map-hero mb-5">
        <div className="sf-map-hero-copy">
          <p className="sf-map-eyebrow">متابعة المنهج والتقدم</p>
          <h2>اعرف مكانك في المنهج،<br />وما الذي يستحق تركيزك الآن.</h2>
          <p>الخريطة تجمع تقدمك مع مرجع المدرس أو الفصل، وتحسب الفجوة داخل كل وحدة على حدة. الفروع غير الموثقة تظل ظاهرة كبيانات غير مكتملة.</p>
        </div>
        <div className="sf-map-hero-meta">
          <span><b>{branches.length}</b><small>مسارات المادة</small></span>
          <span><b>{trackedPositions}</b><small>مواضع طالب مسجلة</small></span>
        </div>
      </section>

      <section className="sf-map-filter-bar app-card mb-5">
        <div className="sf-map-filter-title">
          <BookOpenText className="size-5" />
          <div><b>اختر المادة</b><small>{teacher?.nameAr || "المدرس لم يُحدد في هذه المادة"}</small></div>
        </div>
        <select
          aria-label="المادة الدراسية"
          value={subjectId}
          onChange={event => setSubjectId(event.target.value)}
          disabled={profile.isLoading || subjects.length === 0}
          className="sf-map-subject-select"
        >
          {subjects.map(id => <option value={id} key={id}>{getSIESubject(id)?.nameAr || id}</option>)}
        </select>
        <div className="sf-map-view-toggle" role="group" aria-label="طريقة عرض الخريطة">
          <button type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}>الخريطة التفاعلية</button>
          <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>الدروس والوحدات</button>
        </div>
      </section>

      {!profile.isLoading && subject && !subject.curriculumAvailable && branches.length === 0 && (
        <section className="app-card mb-5 p-5">
          <div className="flex items-start gap-3"><CircleHelp className="mt-1 size-5 shrink-0 text-muted-foreground" /><div><h3 className="font-bold">فهرس هذه المادة غير محمّل بعد</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">{subject.note || "لا تتوفر نقاط منهج موثقة لهذه المادة في نسخة الفهرس الحالية."}</p></div></div>
        </section>
      )}

      {viewMode === "3d" && branches.length > 0 && (
        <section className="sf-map-scene-card mb-5">
          <div className="sf-map-scene-heading">
            <div><p className="sf-map-eyebrow">الخريطة التفاعلية</p><h3>خريطة الوحدات والدروس</h3><p>استعرض الوحدات والدروس، ثم افتح الدرس لتحديث تقدمك وموضع المدرس.</p></div>
            <span className="sf-map-scene-count">{branches.length} وحدات</span>
          </div>
          <CurriculumProgressScene branches={sceneBranches} onSelectBranch={selectBranch} />
          <div className="sf-map-legend">
            <span><i className="is-complete" />أتممته</span>
            <span><i className="is-gap" />داخل الفجوة المرجعية</span>
            <span><i className="is-next" />الخطوة التالية</span>
            <span><i className="is-future" />لم يحن بعد</span>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3 mb-5">
        <article className="sf-map-metric"><span><Target className="size-4" />الفجوات المحسوبة</span><b>{learning.isLoading ? "—" : knownGaps.length}</b><small>من أصل {branches.length} وحدات</small></article>
        <article className="sf-map-metric"><span><Gauge className="size-4" />نقاط التراكم المرجعية</span><b>{learning.isLoading ? "—" : branchesWithGap}</b><small>وحدات بها دروس متأخرة</small></article>
        <article className="sf-map-metric"><span><BookOpenCheck className="size-4" />مراجع معروفة</span><b>{learning.isLoading ? "—" : knownReferences}</b><small>مدرس أو تقدم فصل مسجل</small></article>
      </section>

      {priorityBranch && (
        <section className="sf-map-priority mb-5">
          <div className="sf-map-priority-copy">
            <p className="sf-map-eyebrow">أولوية المذاكرة</p>
            <h3>أعلى فجوة نسبية معروفة</h3>
            <p>{displayBranchTitle(priorityBranch.branchTitle)} · {gapLabel(priorityBranch.gap, priorityBranch.pointLabel)}</p>
            {priorityBranch.nextLesson && <small>الخطوة التالية: {displayCurriculumTitle(priorityBranch.nextLesson.title)}</small>}
          </div>
          <Button type="button" onClick={() => goToStudy(priorityBranch.branchId, priorityBranch.nextLesson?.nodeId)} className="sf-map-priority-button">
            افتح نقطة البداية <ArrowLeft className="size-4" />
          </Button>
        </section>
      )}

      <section className="sf-map-branches">
        <div className="sf-map-section-heading"><div><p className="sf-map-eyebrow">حالة فروع المنهج</p><h3>تفاصيل فروع المنهج</h3></div><span>{branches.length} فروع مستقلة</span></div>
        {profile.isLoading || learning.isLoading ? (
          <div className="app-card p-5 text-sm text-muted-foreground">جارٍ تجميع مواضعك من الملف الدراسي...</div>
        ) : branches.length === 0 ? (
          <div className="app-card p-5 text-sm text-muted-foreground">لا توجد فروع موثقة لهذه المادة في الفهرس الحالي.</div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {branchViews.map(branch => {
              const gap = branch.gap;
              const completedCount = gap?.studentPosition !== null && gap?.studentPosition !== undefined
                ? Math.max(0, Math.min(branch.choices.length, gap.studentPosition))
                : null;
              const progress = completedCount !== null
                ? Math.round((completedCount / Math.max(1, branch.choices.length)) * 100)
                : null;
              const referenceProgress = gap?.referencePosition !== null && gap?.referencePosition !== undefined
                ? Math.round((Math.max(0, Math.min(branch.choices.length, gap.referencePosition)) / Math.max(1, branch.choices.length)) * 100)
                : null;
              const isSelected = branch.branchId === selectedBranchId;
              return (
                <article
                  id={"curriculum-branch-" + branch.branchId}
                  key={branch.branchId}
                  className={"sf-map-branch-card " + (isSelected ? "is-selected" : "")}
                >
                  <button type="button" className="sf-map-branch-select" onClick={() => scrollToBranch(branch.branchId)}>
                    <span className="sf-map-branch-mark"><Network className="size-4" /></span>
                    <span className="sf-map-branch-titles"><b>{displayBranchTitle(branch.branchTitle)}</b><small>{branch.choices.length} {branch.pointLabel === "درس" ? "دروس" : "موضوعات"}</small></span>
                    <span className="sf-map-gap-status">{gapLabel(gap, branch.pointLabel)}</span>
                  </button>
                  <div className="sf-map-branch-progress">
                    <div className="sf-map-progress-rail" aria-label="تقدمك مقارنة بموضع المدرس">
                      {referenceProgress !== null && <b style={{ width: referenceProgress + "%" }} />}
                      <i style={{ width: progress === null ? "0%" : progress + "%" }} />
                    </div>
                    <span>{progress === null ? "لم يُسجل التقدم بعد" : completedCount + " من " + branch.choices.length + " نقاط مكتملة · " + progress + "%"}</span>
                  </div>
                  <div className="sf-map-branch-steps" role="list" aria-label="التسلسل التفصيلي للدروس">
                    {branch.choices.map((choice, index) => {
                      const isCompleted = completedCount !== null && index < completedCount;
                      const isNext = completedCount !== null && index === completedCount;
                      const isBehindTeacher = completedCount !== null && gap?.referencePosition !== null && gap?.referencePosition !== undefined
                        && index >= completedCount && index < gap.referencePosition;
                      const state = isCompleted ? "completed" : isBehindTeacher ? "gap" : isNext ? "next" : completedCount === null ? "untracked" : "future";
                      const stepLabel = branch.pointLabel === "موضوع" ? "الموضوع" : "الدرس";
                      const localizedTitle = displayCurriculumTitle(choice.title);
                      const localizedUnit = displayCurriculumTitle(choice.unitTitle);
                      return (
                        <button
                          key={choice.nodeId}
                          type="button"
                          role="listitem"
                          onClick={() => goToStudy(branch.branchId, choice.nodeId)}
                          className={"sf-map-step sf-map-step-" + state}
                          aria-label={stepLabel + " " + (choice.lessonNumber ?? index + 1) + ": " + localizedTitle}
                        >
                          <span className="sf-map-step-number">{stepLabel} {choice.lessonNumber ?? index + 1}</span>
                          <b>{localizedTitle}</b>
                          {localizedTitle !== choice.title && <small className="sf-map-step-original" dir="ltr">{choice.title}</small>}
                          {choice.unitTitle && <small className="sf-map-step-unit">{choice.unitNumber ? "الوحدة " + choice.unitNumber + " · " : ""}{localizedUnit}</small>}
                          <em>{isCompleted ? "مكتمل" : isBehindTeacher ? (isNext ? "ابدأ الآن · متأخر" : "ضمن فجوة المدرس") : isNext ? "التالي" : completedCount === null ? "لم يُسجل التقدم" : "لاحقًا"}</em>
                        </button>
                      );
                    })}
                  </div>
                  <div className="sf-map-branch-details">
                    <p>آخر نقطة لك: <b>{gap?.studentFrontierTitle || (gap?.studentPosition === 0 ? "لم تبدأ بعد" : "غير محدد")}</b></p>
                    <p>مرجع التدريس: <b>{gap?.referenceFrontierTitle || (gap?.referencePosition === 0 ? "لم يبدأ بعد" : "غير متاح")}</b><small>{gap?.referenceSource === "teacher" ? "المدرس" : gap?.referenceSource === "school" ? "الفصل" : "لا يوجد مرجع موثق"}</small></p>
                    <p>وقت دراسة الموضوع المتوقع: <b>{branch.minutesPerLesson === null ? "غير محدد" : branch.minutesPerLesson + " دقيقة"}</b></p>
                  </div>
                  <div className="sf-map-branch-actions">
                    <Button type="button" variant="outline" onClick={() => goToStudy(branch.branchId)} className="sf-map-update-button">تحديث تقدم الوحدة</Button>
                    {branch.nextLesson && <Button type="button" onClick={() => goToStudy(branch.branchId, branch.nextLesson?.nodeId)} className="sf-map-next-button">ابدأ: {`الدرس ${branch.nextLesson.lessonNumber ?? ""}`}</Button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
