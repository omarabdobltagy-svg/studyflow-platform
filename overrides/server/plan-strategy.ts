export type StrategyStepSnapshot = {
  key: string; title: string; dayIndex: number | null; priority: string; phaseId: string; deferred: boolean;
};
export type PlanStrategyTrigger = { code: string; label: string; detail: string };
export type PlanDecisionSignals = {
  exams?: Array<{ subjectName: string; date: string; daysUntil: number; source: string }>;
  energyLevel?: string; moraleLevel?: string; dailyMinutes?: number; openTasksCount?: number; recentSetbacks?: number; obstacle?: string;
  officialEducationUpdates?: Array<{
    title: string;
    sourceLabel: string;
    publishedAt: string;
    impactType: "exam_schedule" | "exam_scope" | "curriculum_update" | "official_policy";
    url: string;
  }>;
};
export type PlanStrategyRevision = {
  number: number; createdAt: string; status: "baseline" | "adapted" | "stable"; headline: string; rationale: string;
  hasPreviousVersion: boolean; triggers: PlanStrategyTrigger[];
  diff: { added: StrategyStepSnapshot[]; removed: StrategyStepSnapshot[]; rescheduled: StrategyStepSnapshot[];
    reprioritized: StrategyStepSnapshot[]; deferred: StrategyStepSnapshot[]; preservedCount: number };
};
export type PlanStrategySnapshot = {
  version: 1;
  baseline: { createdAt: string; title: string; summary: string; steps: StrategyStepSnapshot[] };
  revision: PlanStrategyRevision; history: PlanStrategyRevision[];
};
type PlanLike = { title?: unknown; summary?: unknown; steps?: unknown; strategy?: PlanStrategySnapshot };

function cleanText(value: unknown, limit = 180): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}
function stepKey(step: Record<string, any>, index: number): string {
  // Curriculum identity is stable before/after task synchronization; task IDs may be attached later.
  const nodes = Array.isArray(step.curriculumNodeIds)
    ? step.curriculumNodeIds.filter((item: unknown): item is string => typeof item === "string").sort()
    : [];
  if (nodes.length) return "curriculum:" + nodes.join(",");
  const taskId = Number(step.plannerTaskId ?? step.existingTask?.id);
  if (Number.isInteger(taskId) && taskId > 0) return "task:" + taskId;
  const resourceUrl = cleanText(step.resourceRecommendation?.url, 500);
  if (resourceUrl) return "resource:" + resourceUrl.split("#")[0];
  return "step:" + cleanText(step.title, 160).toLocaleLowerCase("ar") + ":" + index;
}
function snapshotSteps(plan: PlanLike | null | undefined): StrategyStepSnapshot[] {
  const raw = Array.isArray(plan?.steps) ? plan.steps as Array<Record<string, any>> : [];
  const occurrences = new Map<string, number>();
  return raw.slice(0, 240).map((step, index) => {
    const base = stepKey(step, index), occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    return { key: base + (occurrence ? ":" + occurrence : ""), title: cleanText(step.title, 180) || "خطوة دراسية",
      dayIndex: Number.isInteger(step.dayIndex) ? Number(step.dayIndex) : null,
      priority: cleanText(step.priority, 30) || "medium", phaseId: cleanText(step.phaseId, 40) || "steady",
      deferred: step.scheduleState === "deferred" || step.phaseId === "deferred" };
  });
}
function buildTriggers(signals: PlanDecisionSignals): PlanStrategyTrigger[] {
  const triggers: PlanStrategyTrigger[] = [];
  const nearest = (signals.exams ?? [])
    .filter(exam => Number.isFinite(exam.daysUntil) && exam.daysUntil >= 0 && exam.daysUntil <= 30)
    .slice().sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (nearest && nearest.daysUntil <= 1) {
    triggers.push({ code: "exam_imminent", label: nearest.daysUntil === 0 ? "امتحان اليوم" : "امتحان غدًا",
      detail: nearest.subjectName + " — " + nearest.date + ". أعاد المحرك ترتيب الأولويات للاستعداد للموعد القريب." });
  } else if (nearest && nearest.daysUntil <= 7) {
    triggers.push({ code: "exam_approaching", label: "امتحان خلال أسبوع",
      detail: nearest.subjectName + " — " + nearest.date + ". خُصصت أولوية للاستعداد دون إلغاء خطة المواد الأخرى." });
  } else if (nearest) {
    triggers.push({ code: "exam_on_horizon", label: "امتحان قادم",
      detail: nearest.subjectName + " — " + nearest.date + ". يراعي المحرك الموعد في التوزيع القادم." });
  }
  if (signals.energyLevel === "low") triggers.push({ code: "low_energy", label: "طاقة منخفضة", detail: "تمت مراعاة مستوى الطاقة المسجل وتقليل التكديس غير القابل للتنفيذ." });
  if (signals.moraleLevel === "low") triggers.push({ code: "low_morale", label: "ضغط معنوي", detail: "تمت مراعاة الحالة المعنوية المسجلة مع إبقاء خطوة بداية واضحة." });
  if (typeof signals.dailyMinutes === "number" && signals.dailyMinutes <= 60)
    triggers.push({ code: "limited_capacity", label: "وقت يومي محدود", detail: "القدرة اليومية المسجلة " + signals.dailyMinutes + " دقيقة؛ تُحفظ المهام الزائدة بدل ضغطها داخل اليوم." });
  if (typeof signals.recentSetbacks === "number" && signals.recentSetbacks >= 2)
    triggers.push({ code: "repeated_setbacks", label: "تعثر متكرر", detail: "رُصدت " + signals.recentSetbacks + " تقارير حديثة عن عدم إكمال مهام؛ راعى المحرك ذلك في واقعية التوزيع." });
  if (typeof signals.openTasksCount === "number" && signals.openTasksCount >= 10)
    triggers.push({ code: "heavy_backlog", label: "تراكم مهام مرتفع", detail: "هناك " + signals.openTasksCount + " مهمة مفتوحة؛ يحافظ المحرك على الالتزامات ويحدد ما يتسع له الأفق." });
  for (const update of (signals.officialEducationUpdates ?? []).slice(0, 3)) {
    const impactLabels = {
      exam_schedule: "جدول امتحانات",
      exam_scope: "نطاق امتحان",
      curriculum_update: "تحديث منهج",
      official_policy: "تعليمات رسمية",
    } as const;
    const impactLabel = impactLabels[update.impactType];
    const title = cleanText(update.title, 180);
    const source = cleanText(update.sourceLabel, 100);
    const published = cleanText(update.publishedAt, 40);
    const url = cleanText(update.url, 600);
    if (!title || !source || !published || !url.startsWith("https://")) continue;
    triggers.push({
      code: "official_education_update",
      label: "تحديث رسمي من التعليم",
      detail: impactLabel + ": " + title + " — المصدر: " + source + " — تاريخ النشر: " + published + ". راجع المصدر قبل تحويله إلى موعد أو نطاق امتحان.",
    });
  }
  const obstacle = cleanText(signals.obstacle, 220);
  if (obstacle) triggers.push({ code: "student_obstacle", label: "عائق مسجل", detail: obstacle });
  return triggers;
}
function compareSteps(previous: StrategyStepSnapshot[], current: StrategyStepSnapshot[]) {
  const previousByKey = new Map(previous.map(step => [step.key, step]));
  const currentByKey = new Map(current.map(step => [step.key, step]));
  const added = current.filter(step => !previousByKey.has(step.key));
  const removed = previous.filter(step => !currentByKey.has(step.key));
  const rescheduled = current.filter(step => { const old = previousByKey.get(step.key); return old && old.dayIndex !== step.dayIndex; });
  const reprioritized = current.filter(step => { const old = previousByKey.get(step.key); return old && old.priority !== step.priority; });
  const deferred = current.filter(step => { const old = previousByKey.get(step.key); return step.deferred && (!old || !old.deferred); });
  const changedKeys = new Set([...added, ...removed].map(step => step.key));
  const preservedCount = current.filter(step => {
    const old = previousByKey.get(step.key);
    return old && !changedKeys.has(step.key) && old.dayIndex === step.dayIndex && old.priority === step.priority && old.deferred === step.deferred;
  }).length;
  return { added, removed, rescheduled, reprioritized, deferred, preservedCount };
}
function snapshotBaseline(plan: PlanLike, createdAt: string) {
  return { createdAt, title: cleanText(plan.title, 120) || "خطة المذاكرة",
    summary: cleanText(plan.summary, 500), steps: snapshotSteps(plan) };
}
export function buildPlanStrategySnapshot(
  previousPlan: PlanLike | null, nextPlan: PlanLike, signals: PlanDecisionSignals = {},
  now = new Date(), previousGeneratedAt?: string | null,
): PlanStrategySnapshot {
  const nowIso = now.toISOString(), previousStrategy = previousPlan?.strategy, currentSteps = snapshotSteps(nextPlan);
  const baseline = previousStrategy?.baseline
    ?? (previousPlan ? snapshotBaseline(previousPlan, previousGeneratedAt || nowIso) : snapshotBaseline(nextPlan, nowIso));
  const hasPreviousVersion = Boolean(previousPlan && Array.isArray(previousPlan.steps));
  const previousSteps = hasPreviousVersion ? snapshotSteps(previousPlan) : [];
  const diff = hasPreviousVersion
    ? compareSteps(previousSteps, currentSteps)
    : { added: [], removed: [], rescheduled: [], reprioritized: [], deferred: [], preservedCount: 0 };
  const triggers = buildTriggers(signals);
  const changeCount = diff.added.length + diff.removed.length + diff.rescheduled.length + diff.reprioritized.length + diff.deferred.length;
  const adapted = hasPreviousVersion && (changeCount > 0 || triggers.length > 0);
  const nearestExam = (signals.exams ?? []).filter(exam => exam.daysUntil >= 0).slice().sort((a, b) => a.daysUntil - b.daysUntil)[0];
  const headline = !hasPreviousVersion ? "نقطة البداية — الخطة أُنشئت من وضعك الحالي"
    : nearestExam && nearestExam.daysUntil <= 1 ? "تعديل عاجل للاستعداد للامتحان"
      : triggers.some(trigger => trigger.code === "low_energy" || trigger.code === "limited_capacity")
        ? "تعديل الحمل ليتناسب مع وقتك وطاقتك"
        : adapted ? "الخطة اتعدّلت بناءً على تغيّر ظروفك" : "الخطة مستقرة — لا تغيير جوهري";
  const rationale = !hasPreviousVersion
    ? "دي النسخة الأساسية التي سنقيس عليها أي تعديل لاحق. تم احتساب الإشارات الحالية عند إنشائها؛ لا توجد نسخة أقدم ندّعي المقارنة بها."
    : triggers.length
      ? "احتفظنا بنسخة البداية، وقارنّاها بالتوزيع الحالي. سبب التعديل: " + triggers.map(trigger => trigger.label).join("، ") + "."
      : "قارن المحرك النسخة الحالية بالخطة الأساسية. لم يظهر سبب طارئ جديد؛ التغييرات ناتجة عن تقدمك والمهام المسجلة.";
  const previousRevision = previousStrategy?.revision;
  const history = [...(Array.isArray(previousStrategy?.history) ? previousStrategy.history : []), ...(previousRevision ? [previousRevision] : [])].slice(-8);
  return { version: 1, baseline, revision: { number: hasPreviousVersion ? (previousRevision?.number ?? 0) + 1 : 0, createdAt: nowIso,
    status: !hasPreviousVersion ? "baseline" : adapted ? "adapted" : "stable", headline, rationale,
    hasPreviousVersion, triggers, diff }, history };
}
