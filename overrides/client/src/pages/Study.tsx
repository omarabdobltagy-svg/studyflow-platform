import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThreeAmbientScene from "@/components/ThreeAmbientScene";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getSIECheckpointChoices, getSIESubject, getSIETeacher } from "@shared/sie-catalog";
import { calculateLearningGap } from "@shared/sie-learning-progress";
import { Activity, BookOpenText, Check, CircleHelp, Eye, Gauge, Mic2, RefreshCcw, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const steps = [
  { id: "survey", title: "مسح", hint: "استكشف عنوان الدرس وأفكاره الرئيسية قبل البدء.", icon: Eye },
  { id: "question", title: "تساؤل", hint: "حوّل العناوين إلى أسئلة تريد أن تعرف إجابتها.", icon: CircleHelp },
  { id: "read", title: "قراءة وفهم", hint: "ادرس الدرس بتركيز وأجب عن أسئلتك بالأدلة والأمثلة.", icon: BookOpenText },
  { id: "recite", title: "تسميع", hint: "استرجع الفكرة دون النظر إلى المصدر، شفهيًا أو كتابة.", icon: Mic2 },
  { id: "review", title: "مراجعة", hint: "راجع إجاباتك وحدد نقطة تحتاج إلى تثبيت لاحقًا.", icon: RefreshCcw },
] as const;
type StepId = typeof steps[number]["id"];
type LessonProgress = { completedSteps?: StepId[]; difficulty?: "unknown" | "easy" | "medium" | "hard"; notes?: string; updatedAt?: string };

export default function Study() {
  const utils = trpc.useUtils();
  const profile = trpc.studentProfile.get.useQuery();
  const [subjectId, setSubjectId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [difficulty, setDifficulty] = useState<"unknown" | "easy" | "medium" | "hard">("unknown");
  const [notes, setNotes] = useState("");
  const subjects = profile.data?.subjects || [];
  const lessons = useMemo(() => getSIECheckpointChoices(subjectId), [subjectId]);
  const selection = (profile.data?.selection || {}) as Record<string, unknown>;
  const progressMap = (selection.subjectLessonProgress || {}) as Record<string, Record<string, LessonProgress>>;
  const currentProgress = progressMap[subjectId] && progressMap[subjectId][lessonId];

  type CourseStatus = "not_started" | "in_progress" | "caught_up" | "needs_review";
  const courseProgressMap = (selection.learningCourseProgress || {}) as Record<string, any>;
  const currentCourseProgress = courseProgressMap[subjectId] || {};
  const assessmentHistory = Array.isArray(selection.learningAssessments) ? selection.learningAssessments as Array<any> : [];
  const subjectAssessments = assessmentHistory.filter(item => item.subjectId === subjectId).slice(-5).reverse();
  const selectedTeacherId = ((selection.teacherChoices || {}) as Record<string, string>)[subjectId]
    || (profile.data?.teacherSelections || {})[subjectId];
  const selectedTeacher = selectedTeacherId ? getSIETeacher(selectedTeacherId) : undefined;
  const [lastCompletedLessonId, setLastCompletedLessonId] = useState("");
  const [teacherTeachingFrontierId, setTeacherTeachingFrontierId] = useState("__UNKNOWN__");
  const [schoolClassFrontierId, setSchoolClassFrontierId] = useState("__UNKNOWN__");
  const [teacherCourseFrontier, setTeacherCourseFrontier] = useState("");
  const [courseStatus, setCourseStatus] = useState<CourseStatus>("not_started");
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [courseDifficulty, setCourseDifficulty] = useState<"unknown" | "easy" | "medium" | "hard">("unknown");
  const [courseNotes, setCourseNotes] = useState("");
  const [learningObstacle, setLearningObstacle] = useState("");
  const [assessmentType, setAssessmentType] = useState<"self_check" | "quiz" | "homework" | "exam">("quiz");
  const [assessmentScore, setAssessmentScore] = useState("");
  const [assessmentCorrect, setAssessmentCorrect] = useState("");
  const [assessmentTotal, setAssessmentTotal] = useState("");
  const [weakConcepts, setWeakConcepts] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState("");

  const currentGap = calculateLearningGap(lessons, {
    studentFrontierId: lastCompletedLessonId || null,
    teacherTeachingFrontierId,
    schoolClassFrontierId,
  });


  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0]);
  }, [subjects, subjectId]);

  useEffect(() => {
    if (!lessons.length) {
      setLessonId("");
      return;
    }
    if (!lessons.some(lesson => lesson.nodeId === lessonId)) setLessonId(lessons[0].nodeId);
  }, [subjectId, lessons, lessonId]);

  useEffect(() => {
    setCompletedSteps(currentProgress?.completedSteps || []);
    setDifficulty(currentProgress?.difficulty || "unknown");
    setNotes(currentProgress?.notes || "");
  }, [subjectId, lessonId, currentProgress?.updatedAt]);

  useEffect(() => {
    const legacyTeacherState = ((selection.teacherProgressState || {}) as Record<string, Record<string, any>>)[subjectId] || {};
    const subjectLessonRecords = progressMap[subjectId] || {};
    const latestSq3rCompleted = [...lessons].reverse().find(lesson => {
      const record = subjectLessonRecords[lesson.nodeId];
      return Array.isArray(record?.completedSteps) && record.completedSteps.length === 5;
    })?.nodeId;
    setLastCompletedLessonId(
      currentCourseProgress.lastCompletedLessonId
      || legacyTeacherState.studentAttendedFrontier
      || latestSq3rCompleted
      || ""
    );
    setTeacherTeachingFrontierId(currentCourseProgress.teacherTeachingFrontierId || "__UNKNOWN__");
    setSchoolClassFrontierId(currentCourseProgress.schoolClassFrontierId || "__UNKNOWN__");
    setTeacherCourseFrontier(currentCourseProgress.teacherCourseFrontier || "");
    setCourseStatus(currentCourseProgress.status || "not_started");
    setEstimatedMinutes(Number(currentCourseProgress.estimatedMinutesPerLesson ?? 45));
    setCourseDifficulty(currentCourseProgress.difficulty || "unknown");
    setCourseNotes(currentCourseProgress.notes || "");
    setLearningObstacle(profile.data?.obstacle || "");
  }, [subjectId, currentCourseProgress.updatedAt, profile.data?.obstacle, lessons, progressMap]);


  const saveProgress = trpc.study.saveSubjectLessonProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم حفظ تقدمك في الدرس.");
    },
    onError: error => toast.error(error.message),
  });

  const saveCourseProgress = trpc.learning.updateCourseProgress.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      toast.success("تم تحديث التراكم والتقدم الدراسي.");
    },
    onError: error => toast.error(error.message),
  });
  const saveAssessment = trpc.learning.addAssessment.useMutation({
    onSuccess: async () => {
      await utils.studentProfile.get.invalidate();
      setAssessmentCorrect("");
      setAssessmentTotal("");
      setWeakConcepts("");
      setAssessmentNotes("");
      toast.success("تم حفظ نتيجة التقييم ونقاط التحسين.");
    },
    onError: error => toast.error(error.message),
  });

  const submitCourseProgress = () => {
    if (!subjectId) return;
    saveCourseProgress.mutate({
      subjectId,
      teacherId: selectedTeacherId || null,
      lastCompletedLessonId: lastCompletedLessonId || "__UNKNOWN__",
      teacherTeachingFrontierId,
      schoolClassFrontierId,
      teacherCourseFrontier: teacherCourseFrontier.trim(),
      status: courseStatus,
      estimatedMinutesPerLesson: Math.max(5, Math.min(480, estimatedMinutes)),
      difficulty: courseDifficulty,
      notes: courseNotes,
      obstacle: learningObstacle,
    });
  };

  const submitAssessment = () => {
    if (!subjectId || !assessmentScore.trim() || !Number.isFinite(Number(assessmentScore))) {
      toast.error("أدخل نتيجة تقييم صحيحة.");
      return;
    }
    const correct = assessmentCorrect.trim() ? Number(assessmentCorrect) : null;
    const total = assessmentTotal.trim() ? Number(assessmentTotal) : null;
    if ((correct === null) !== (total === null) || (correct !== null && total !== null && (correct > total || correct < 0 || total < 1))) {
      toast.error("راجع عدد الإجابات الصحيحة وإجمالي الأسئلة.");
      return;
    }
    saveAssessment.mutate({
      subjectId,
      lessonId: lessonId || null,
      assessmentType,
      scorePercent: Math.max(0, Math.min(100, Number(assessmentScore))),
      correctAnswers: correct,
      totalQuestions: total,
      weakConcepts: weakConcepts.split(/[،,\n]/).map(item => item.trim()).filter(Boolean).slice(0, 10),
      notes: assessmentNotes,
    });
  };

  const updateProgress = (nextSteps: StepId[], nextDifficulty = difficulty, nextNotes = notes) => {
    if (!subjectId || !lessonId) return;
    setCompletedSteps(nextSteps);
    saveProgress.mutate({
      subjectId,
      lessonId,
      completedSteps: nextSteps,
      difficulty: nextDifficulty,
      notes: nextNotes,
    });
  };

  const toggleStep = (stepId: StepId) => {
    const next = completedSteps.includes(stepId)
      ? completedSteps.filter(item => item !== stepId)
      : [...completedSteps, stepId];
    updateProgress(next);
  };

  const subjectName = (getSIESubject(subjectId)?.nameAr || subjectId);
  const doneCount = completedSteps.length;
  const completion = Math.round((doneCount / steps.length) * 100);
  const selectedLesson = lessons.find(item => item.nodeId === lessonId);

  return (
    <DashboardLayout title="المذاكرة وذكاء التقدم" description="تابع تقدمك وتراكمك ونتائجك، ثم استخدم SQ3R لتحويل كل درس إلى خطوات تعلم قابلة للقياس.">
      {profile.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">تعذّر تحميل ملفك الدراسي. <button className="font-bold underline" onClick={() => void profile.refetch()}>إعادة المحاولة</button></div>}
      <section className="app-card mb-5 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><BookOpenText className="size-5" /></span><div><h2 className="font-bold">حدد موضع مذاكرتك</h2><p className="text-xs text-muted-foreground">المواد المضافة إلى ملفك فقط</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-2 block text-sm font-semibold">المادة</label><Select value={subjectId} onValueChange={setSubjectId} disabled={profile.isLoading || subjects.length === 0}><SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="اختر المادة" /></SelectTrigger><SelectContent>{subjects.map(id => <SelectItem key={id} value={id}>{getSIESubject(id)?.nameAr || id}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-2 block text-sm font-semibold">الدرس</label><Select value={lessonId} onValueChange={setLessonId} disabled={!lessons.length}><SelectTrigger className="h-12 rounded-xl bg-background"><SelectValue placeholder="اختر درسًا" /></SelectTrigger><SelectContent>{lessons.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{lesson.unitTitle} · {lesson.title}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {subjectId && !lessons.length && <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-muted-foreground">فهرس هذه المادة غير محمّل في النسخة الحالية؛ لذلك لن أعرض دروسًا مخمّنة. ستظهر هنا تلقائيًا عندما يُضاف فهرس المنهج المعتمد.</p>}
        {!subjects.length && !profile.isLoading && <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">لم تُضف مواد إلى ملفك الدراسي بعد. أضف المواد من الملف الشخصي أولًا.</p>}
      </section>
      <motion.section
        className="learning-progress-panel app-card mb-6 overflow-hidden"
        initial={{ opacity: 0, y: 22, rotateX: -1.5 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-[#171613] px-5 py-6 text-white sm:px-7">
          <div className="pointer-events-none absolute -left-4 -top-5 h-48 w-64 opacity-80 sm:h-56 sm:w-72"><ThreeAmbientScene /></div>
          <div className="relative z-10 max-w-[70%] sm:max-w-[74%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e5bd55]">LEARNING INTELLIGENCE</p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">حالة تعلّمك الفعلية</h2>
            <p className="mt-2 max-w-xl text-xs leading-6 text-white/65 sm:text-sm">سجّل موضعك والتراكم من هنا. لا نحتاج اتصالًا بمنصة المدرس كي يبدأ النظام في فهم تقدمك.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] text-white/80">{subjectName}</span>
              <span className="rounded-full border border-[#e5bd55]/25 bg-[#e5bd55]/10 px-3 py-1.5 text-[11px] text-[#f1d58c]">{selectedTeacher?.nameAr || "لم تحدد مدرسًا"}</span>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-[#e5bd55]/70 to-transparent" />
        </div>

        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-semibold">
                آخر درس أتمه الطالب في المنهج
                <Select value={lastCompletedLessonId || "__UNKNOWN__"} onValueChange={setLastCompletedLessonId} disabled={!lessons.length}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue placeholder="غير محدد" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNKNOWN__">غير محدد</SelectItem>
                    <SelectItem value="__NOT_STARTED__">لم أبدأ المنهج بعد</SelectItem>
                    {lessons.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{lesson.unitTitle} · {lesson.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">ده موضع الطالب، وليس موضع المدرس أو المدرسة.</span>
              </label>
              <label className="text-sm font-semibold">
                آخر درس شرحه المدرس فعليًا
                <Select value={teacherTeachingFrontierId} onValueChange={setTeacherTeachingFrontierId} disabled={!selectedTeacher || !lessons.length}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNKNOWN__">لا أعرف / غير متاح</SelectItem>
                    <SelectItem value="__NOT_STARTED__">لم يبدأ التدريس بعد</SelectItem>
                    {lessons.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{lesson.unitTitle} · {lesson.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">يُستخدم كمرجع أول فقط عندما يكون معروفًا.</span>
              </label>
              <label className="text-sm font-semibold">
                آخر درس وصل إليه فصلك في المدرسة
                <Select value={schoolClassFrontierId} onValueChange={setSchoolClassFrontierId} disabled={!lessons.length}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNKNOWN__">غير معروف حتى الآن</SelectItem>
                    <SelectItem value="__NOT_STARTED__">لم يبدأ الفصل المادة بعد</SelectItem>
                    {lessons.map(lesson => <SelectItem key={lesson.nodeId} value={lesson.nodeId}>{lesson.unitTitle} · {lesson.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">يُحدَّث حسب آخر درس وصل إليه فصل الطالب في المدرسة، ويُستخدم بديلًا عند عدم معرفة موضع المدرس.</span>
              </label>
              <label className="text-sm font-semibold">
                آخر محاضرة شاهدتها على منصة المدرس (اختياري)
                <Input value={teacherCourseFrontier} onChange={event => setTeacherCourseFrontier(event.target.value)} placeholder="مثال: المحاضرة 12" maxLength={120} className="mt-2 h-11 rounded-xl bg-background" />
                <span className="mt-1 block text-[11px] font-normal text-muted-foreground">للتوثيق فقط؛ لا تدخل في حساب فجوة المنهج.</span>
              </label>
              <label className="text-sm font-semibold">
                وضعك الحالي مع المادة
                <Select value={courseStatus} onValueChange={value => setCourseStatus(value as CourseStatus)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">لم أبدأ بعد</SelectItem>
                    <SelectItem value="in_progress">أتابع المحتوى حاليًا</SelectItem>
                    <SelectItem value="caught_up">مواكب لآخر محتوى</SelectItem>
                    <SelectItem value="needs_review">أنهيت المحتوى ويحتاج مراجعة</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm font-semibold">
                الوقت المعتاد للدرس بالدقائق
                <Input type="number" min={5} max={480} value={estimatedMinutes} onChange={event => setEstimatedMinutes(Math.max(5, Math.min(480, Number(event.target.value) || 5)))} className="mt-2 h-11 rounded-xl bg-background" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[.7fr_1.3fr]">
              <label className="text-sm font-semibold">
                صعوبة المادة
                <Select value={courseDifficulty} onValueChange={value => setCourseDifficulty(value as typeof courseDifficulty)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">غير محددة</SelectItem>
                    <SelectItem value="easy">سهلة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="hard">صعبة وتحتاج وقتًا</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-sm font-semibold">
                ملاحظات اختيارية
                <Input value={courseNotes} onChange={event => setCourseNotes(event.target.value)} placeholder="مثال: المحاضرتان الأخيرتان لم أراجعهما" maxLength={600} className="mt-2 h-11 rounded-xl bg-background" />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              العائق الرئيسي الذي يؤثر على مذاكرتك (اختياري)
              <Textarea value={learningObstacle} onChange={event => setLearningObstacle(event.target.value)} placeholder="مثال: صعوبة البدء، تشتت، وقت قليل، أو تراكم كبير" maxLength={600} className="mt-2 min-h-20 rounded-xl bg-background leading-7" />
            </label>
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-muted-foreground">افصل بين موضع الطالب وموضع المدرس وموضع المدرسة. النظام يفضّل موضع المدرس إذا كان معروفًا، وإلا يستخدم موضع الفصل في المدرسة. الرقم يُحسب تلقائيًا من ترتيب دروس المنهج؛ إذا لم يتوفر أي مرجع فلن يخترع النظام تراكمًا.</p>
              <Button type="button" onClick={submitCourseProgress} disabled={saveCourseProgress.isPending || !subjectId} className="pressable shrink-0 rounded-xl bg-primary">
                {saveCourseProgress.isPending ? "جارٍ حفظ التقدم..." : "حفظ حالة المادة"}
              </Button>
            </div>
          </div>

          <aside className="learning-glass-card rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
            <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h3 className="font-bold">مؤشرات المادة</h3></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-background/75 p-3">
                <p className="text-[11px] text-muted-foreground">فجوة المنهج المحسوبة</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{currentGap.gapCount === null ? "—" : currentGap.gapCount}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{currentGap.referenceSource === "teacher" ? "المرجع: موضع المدرس" : currentGap.referenceSource === "school" ? "المرجع: موضع المدرسة" : "حدد موضع المدرس أو المدرسة"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/75 p-3">
                <p className="text-[11px] text-muted-foreground">التقييمات المسجلة</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{subjectAssessments.length}</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] text-muted-foreground">حالة المقارنة</p>
              <p className="mt-1 text-sm font-semibold">{currentGap.status === "calculated" ? (currentGap.gapCount! > 0 ? "الطالب متأخر عن المرجع" : currentGap.aheadCount! > 0 ? "الطالب متقدم على المرجع" : "الطالب مواكب للمرجع") : currentGap.status === "student_position_missing" ? "موضع الطالب غير محدد" : "لا يوجد موضع مرجعي معروف"}</p>
              {currentGap.aheadCount !== null && currentGap.aheadCount > 0 && <p className="mt-1 text-[11px] text-muted-foreground">تقدم بمقدار {currentGap.aheadCount} درسًا عن المرجع.</p>}
            </div>
            <div className="mt-3 rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] text-muted-foreground">متوسط آخر التقييمات المحفوظة</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{subjectAssessments.length ? Math.round(subjectAssessments.reduce((sum, item) => sum + Number(item.scorePercent || 0), 0) / subjectAssessments.length) + "%" : "—"}</p>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <Gauge className="mt-1 size-4 shrink-0 text-primary" />
              <p>المخطط سيوازن التراكم مع صعوبة الدروس ونتائجك بدل اعتبار عدد المحاضرات مقياسًا وحيدًا.</p>
            </div>
          </aside>
        </div>

        <div className="border-t border-border/70 bg-muted/15 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">PERFORMANCE SIGNALS</p><h3 className="mt-1 font-bold">سجّل نتيجة اختبار أو واجب</h3></div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><TrendingUp className="size-5" /></span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-muted-foreground">نوع التقييم
              <Select value={assessmentType} onValueChange={value => setAssessmentType(value as typeof assessmentType)}>
                <SelectTrigger className="mt-2 h-10 rounded-xl bg-background text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_check">اختبار ذاتي</SelectItem>
                  <SelectItem value="quiz">كويز</SelectItem>
                  <SelectItem value="homework">واجب</SelectItem>
                  <SelectItem value="exam">امتحان</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs font-semibold text-muted-foreground">الدرجة من 100
              <Input type="number" min={0} max={100} step="0.5" value={assessmentScore} onChange={event => setAssessmentScore(event.target.value)} placeholder="مثال: 78" className="mt-2 h-10 rounded-xl bg-background text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">إجابات صحيحة (اختياري)
              <Input type="number" min={0} max={500} value={assessmentCorrect} onChange={event => setAssessmentCorrect(event.target.value)} placeholder="مثال: 8" className="mt-2 h-10 rounded-xl bg-background text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">إجمالي الأسئلة (اختياري)
              <Input type="number" min={1} max={500} value={assessmentTotal} onChange={event => setAssessmentTotal(event.target.value)} placeholder="مثال: 10" className="mt-2 h-10 rounded-xl bg-background text-foreground" />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">مفاهيم أو نقاط أخطأت فيها
              <Textarea value={weakConcepts} onChange={event => setWeakConcepts(event.target.value)} placeholder="افصل بين النقاط بفاصلة أو سطر جديد" className="mt-2 min-h-20 rounded-xl bg-background text-foreground" maxLength={900} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">ملاحظة عن سبب النتيجة
              <Textarea value={assessmentNotes} onChange={event => setAssessmentNotes(event.target.value)} placeholder="مثال: فهمت القاعدة لكن أخطأت في التطبيق" className="mt-2 min-h-20 rounded-xl bg-background text-foreground" maxLength={600} />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-5 text-muted-foreground">اختر الدرس من أعلى الصفحة لربط النتيجة به. استخدم الدرجة الفعلية ولا تقدّر نتيجة غير معروفة.</p>
            <Button type="button" onClick={submitAssessment} disabled={saveAssessment.isPending || !subjectId} className="pressable rounded-xl bg-primary">
              {saveAssessment.isPending ? "جارٍ حفظ النتيجة..." : "حفظ نتيجة التقييم"}
            </Button>
          </div>
          {subjectAssessments.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {subjectAssessments.slice(0, 3).map(item => (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{({ self_check: "اختبار ذاتي", quiz: "كويز", homework: "واجب", exam: "امتحان" } as Record<string, string>)[item.assessmentType] || "تقييم"}</span><span className="text-lg font-bold tabular-nums text-primary">{item.scorePercent}%</span></div>
                {Array.isArray(item.weakConcepts) && item.weakConcepts.length > 0 && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">يحتاج تقوية: {item.weakConcepts.join("، ")}</p>}
              </div>
            ))}
          </div>}
        </div>
      </motion.section>

      {lessonId && selectedLesson ? (
        <>
          <section className="app-card mb-5 overflow-hidden">
            <div className="flex flex-col gap-4 bg-gradient-to-l from-secondary/70 to-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold text-primary">{subjectName} · {selectedLesson.unitTitle}</p><h2 className="mt-1 text-xl font-bold">{selectedLesson.title}</h2><p className="mt-2 text-sm text-muted-foreground">تقدم خطوات SQ3R لهذا الدرس</p></div>
              <div className="min-w-32 rounded-2xl border border-border/70 bg-background/80 p-3 text-center"><p className="text-2xl font-bold tabular-nums text-primary">{completion}%</p><p className="text-[11px] text-muted-foreground">{doneCount} من 5 خطوات</p></div>
            </div>
            <div className="h-1.5 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: completion + "%" }} /></div>
          </section>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const done = completedSteps.includes(step.id);
                return <button type="button" key={step.id} onClick={() => toggleStep(step.id)} disabled={saveProgress.isPending} className={"app-card flex w-full items-center gap-4 p-4 text-right transition-colors sm:p-5 " + (done ? "border-emerald-500/30 bg-emerald-500/5" : "hover:border-primary/25")}>
                  <span className={"flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold " + (done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}>{done ? <Check className="size-4" /> : index + 1}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{step.title}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{step.hint}</span></span>
                  <span className={"shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold " + (done ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>{done ? "تمت" : "تسجيل"}</span>
                </button>;
              })}
            </div>
            <aside className="app-card h-fit p-5">
              <h3 className="font-bold">صعوبة الدرس</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">تساعد هذه المعلومة المخطط على تقدير الوقت المناسب.</p>
              <Select value={difficulty} onValueChange={value => { const next = value as typeof difficulty; setDifficulty(next); updateProgress(completedSteps, next); }}>
                <SelectTrigger className="mt-3 h-10 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="unknown">لم أحدد بعد</SelectItem><SelectItem value="easy">سهل</SelectItem><SelectItem value="medium">متوسط</SelectItem><SelectItem value="hard">صعب ويحتاج وقتًا</SelectItem></SelectContent>
              </Select>
              <h3 className="mt-6 font-bold">ملاحظاتك</h3>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="اكتب سؤالًا أو فكرة تريد الرجوع إليها..." className="mt-2 min-h-28 rounded-xl bg-background leading-7" maxLength={2_000} />
              <Button type="button" onClick={() => updateProgress(completedSteps, difficulty, notes)} disabled={saveProgress.isPending} className="mt-3 w-full rounded-xl bg-primary">{saveProgress.isPending ? "جارٍ الحفظ..." : "حفظ الملاحظة والتقدم"}</Button>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{currentProgress?.updatedAt ? "آخر حفظ: " + new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentProgress.updatedAt)) : "لم يُسجّل تقدم لهذا الدرس بعد."}</p>
            </aside>
          </section>
        </>
      ) : (
        <section className="app-card soft-grid flex min-h-64 flex-col items-center justify-center p-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-6" /></span>
          <h2 className="mt-4 text-lg font-bold">اختر المادة والدرس للبدء</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">لن تحتاج إلى اختيار كتاب. بعد تحديد الدرس ستظهر خطوات المسح والتساؤل والقراءة والتسميع والمراجعة.</p>
        </section>
      )}
    </DashboardLayout>
  );
}
