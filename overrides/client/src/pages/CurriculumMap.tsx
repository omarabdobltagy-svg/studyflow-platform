import DashboardLayout from "@/components/DashboardLayout";
import CurriculumProgressScene, { type SceneBranch } from "@/components/CurriculumProgressScene";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointBranches, getSIECheckpointChoiceDisplayLabel, getSIESubject, getSIETeacher, type SIECheckpointChoice } from "@shared/sie-catalog";
import { ArrowLeft, BookOpenCheck, BookOpenText, CircleHelp, Gauge, Network, RefreshCw, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type LearningGap = {
  referenceSource: "teacher" | "school" | "unavailable";
  referenceFrontierTitle: string | null;
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

  const branches = useMemo(() => getSIECheckpointBranches(subjectId), [subjectId]);
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
    title: branch.branchTitle,
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
      return { nodeId: choice.nodeId, title: choice.title, state };
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
      action={<span className="sf-page-action-label"><Network className="size-4" />SIE / CURRICULUM MAP</span>}
    >
      {profile.isError && <div className="app-card p-4 text-sm text-destructive">تعذّر تحميل ملفك الدراسي. أعد المحاولة بعد التحقق من الاتصال.</div>}
      {learning.isError && <div className="app-card p-4 text-sm text-destructive">تعذّر تحميل بيانات التقدم. لم يتم استبدال البيانات المفقودة بأرقام صفرية.</div>}

      <section className="sf-map-hero mb-5">
        <div className="sf-map-hero-copy">
          <p className="sf-map-eyebrow">CURRICULUM INTELLIGENCE</p>
          <h2>اعرف مكانك في المنهج،<br />وما الذي يستحق تركيزك الآن.</h2>
          <p>الخريطة تجمع تقدمك مع مرجع المدرس أو الفصل، وتحسب الفجوة داخل كل وحدة على حدة. الفروع غير الموثقة تظل ظاهرة كبيانات غير مكتملة.</p>
        </div>
        <div className="sf-map-hero-meta">
          <span><b>{branches.length}</b><small>وحدات هذه المادة</small></span>
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
            <div><p className="sf-map-eyebrow">INTERACTIVE LEARNING GRAPH</p><h3>خريطة الوحدات والدروس</h3><p>استعرض الوحدات والدروس، ثم افتح الدرس لتحديث تقدمك وموضع المدرس.</p></div>
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
            <p className="sf-map-eyebrow">PRIORITY BRANCH</p>
            <h3>أعلى فجوة نسبية معروفة</h3>
            <p>{priorityBranch.branchTitle} · {gapLabel(priorityBranch.gap, priorityBranch.pointLabel)}</p>
            {priorityBranch.nextLesson && <small>الخطوة التالية حسب تقدمك المسجل: {getSIECheckpointChoiceDisplayLabel(priorityBranch.nextLesson)}</small>}
          </div>
          <Button type="button" onClick={() => goToStudy(priorityBranch.branchId, priorityBranch.nextLesson?.nodeId)} className="sf-map-priority-button">
            افتح نقطة البداية <ArrowLeft className="size-4" />
          </Button>
        </section>
      )}

      <section className="sf-map-branches">
        <div className="sf-map-section-heading"><div><p className="sf-map-eyebrow">BRANCH STATUS</p><h3>تفاصيل فروع المنهج</h3></div><span>{branches.length} فروع مستقلة</span></div>
        {profile.isLoading || learning.isLoading ? (
          <div className="app-card p-5 text-sm text-muted-foreground">جارٍ تجميع مواضعك من الملف الدراسي...</div>
        ) : branches.length === 0 ? (
          <div className="app-card p-5 text-sm text-muted-foreground">لا توجد فروع موثقة لهذه المادة في الفهرس الحالي.</div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {branchViews.map(branch => {
              const gap = branch.gap;
              const progress = gap?.studentPosition !== null && gap?.studentPosition !== undefined
                ? Math.round(Math.max(0, Math.min(100, (gap.studentPosition / Math.max(1, branch.choices.length)) * 100)))
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
                    <span className="sf-map-branch-titles"><b>{branch.branchTitle}</b><small>{branch.choices.length} {branch.pointLabel === "درس" ? "دروس" : "موضوعات"}</small></span>
                    <span className="sf-map-gap-status">{gapLabel(gap, branch.pointLabel)}</span>
                  </button>
                  <div className="sf-map-branch-progress">
                    <div className="sf-map-progress-rail"><i style={{ width: progress === null ? "0%" : progress + "%" }} /></div>
                    <span>{progress === null ? "موضع غير محدد" : progress + "% من نقاط الفرع"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {branch.choices.map(choice => <span key={choice.nodeId} className="rounded-lg border border-border/70 bg-background px-2 py-1 text-[10px] leading-5 text-muted-foreground">{getSIECheckpointChoiceDisplayLabel(choice)}</span>)}
                  </div>
                  <div className="sf-map-branch-details">
                    <p>آخر نقطة لك: <b>{gap?.studentFrontierTitle || (gap?.studentPosition === 0 ? "لم تبدأ بعد" : "غير محدد")}</b></p>
                    <p>مرجع التدريس: <b>{gap?.referenceFrontierTitle || (gap?.referencePosition === 0 ? "لم يبدأ بعد" : "غير متاح")}</b><small>{gap?.referenceSource === "teacher" ? "المدرس" : gap?.referenceSource === "school" ? "الفصل" : "لا يوجد مرجع موثق"}</small></p>
                    <p>مدة النقطة المتوقعة: <b>{branch.minutesPerLesson === null ? "غير محددة" : branch.minutesPerLesson + " دقيقة"}</b></p>
                  </div>
                  <div className="sf-map-branch-actions">
                    <Button type="button" variant="outline" onClick={() => goToStudy(branch.branchId)} className="sf-map-update-button">تحديث تقدم الوحدة</Button>
                    {branch.nextLesson && <Button type="button" onClick={() => goToStudy(branch.branchId, branch.nextLesson?.nodeId)} className="sf-map-next-button">ابدأ: {branch.nextLesson.lessonType === "topic" ? `Lesson ${branch.nextLesson.lessonNumber}` : `الدرس ${branch.nextLesson.lessonNumber ?? ""}`}</Button>}
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
