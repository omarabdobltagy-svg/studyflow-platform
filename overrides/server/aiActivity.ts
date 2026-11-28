import { randomUUID } from "node:crypto";
import { listRecentAIBackgroundActivityEvents, recordStudentActivityEvent } from "./db";

export type AIActivityKind = "assistant" | "planner" | "daily_plan" | "teacher_monitor";
export type AIActivityStatus = "running" | "complete" | "failed";
export type AIActivityEventStatus = "active" | "complete" | "failed";
export type AIActivityEvent = {
  stage: string;
  detail: string;
  status: AIActivityEventStatus;
  updatedAt: number;
};
export type AIActivityRecord = {
  id: string;
  kind: AIActivityKind;
  title: string;
  status: AIActivityStatus;
  stage: string;
  detail: string;
  events: AIActivityEvent[];
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  error?: string;
};
export type AIActivitySnapshot = {
  active: AIActivityRecord[];
  recent: AIActivityRecord[];
};

const MAX_RECORDS_PER_USER = 6;
const MAX_EVENTS_PER_RECORD = 16;
const MAX_PERSISTED_EVENTS_READ = 100;
const ACTIVE_STALE_AFTER_MS = 15 * 60 * 1000;
const COMPLETED_RETENTION_MS = 45 * 1000;

type PersistedTransition = "started" | "progress" | "completed" | "failed";
const PERSISTED_EVENT_TYPES: Record<PersistedTransition, string> = {
  started: "ai.activity.started",
  progress: "ai.activity.progress",
  completed: "ai.activity.completed",
  failed: "ai.activity.failed",
};

const activitiesByUser = new Map<number, Map<string, AIActivityRecord>>();
const persistenceQueues = new Map<string, Promise<void>>();
let persistenceEnabled = process.env.NODE_ENV !== "test";

function getUserActivities(userId: number): Map<string, AIActivityRecord> {
  let activities = activitiesByUser.get(userId);
  if (!activities) {
    activities = new Map<string, AIActivityRecord>();
    activitiesByUser.set(userId, activities);
  }
  return activities;
}

function cloneActivity(activity: AIActivityRecord): AIActivityRecord {
  return { ...activity, events: activity.events.map(event => ({ ...event })) };
}

function pruneUserActivities(userId: number, now: number): void {
  const activities = activitiesByUser.get(userId);
  if (!activities) return;

  for (const [id, activity] of activities) {
    if (activity.status === "running" && now - activity.updatedAt > ACTIVE_STALE_AFTER_MS) {
      const current = activity.events[activity.events.length - 1];
      if (current?.status === "active") {
        current.status = "failed";
        current.detail = "توقف وصول تحديثات هذه العملية؛ تحقق من النتيجة قبل إعادة المحاولة.";
        current.updatedAt = now;
      }
      activity.status = "failed";
      activity.stage = "توقف التنفيذ";
      activity.detail = "لم تصل إشارة اكتمال للعملية.";
      activity.error = "انتهت مهلة متابعة العملية.";
      activity.completedAt = now;
      activity.updatedAt = now;
      persistActivityTransition(userId, activity, "failed");
    }

    if (activity.status !== "running" && activity.completedAt !== null
      && now - activity.completedAt > COMPLETED_RETENTION_MS) {
      activities.delete(id);
    }
  }

  if (activities.size > MAX_RECORDS_PER_USER) {
    const ordered = [...activities.values()].sort((left, right) => right.updatedAt - left.updatedAt);
    for (const stale of ordered.slice(MAX_RECORDS_PER_USER)) activities.delete(stale.id);
  }
  if (activities.size === 0) activitiesByUser.delete(userId);
}

function persistActivityTransition(
  userId: number,
  activity: AIActivityRecord,
  transition: PersistedTransition,
): void {
  if (!persistenceEnabled || activity.kind === "assistant") return;
  const key = String(userId) + ":" + activity.id;
  const previous = persistenceQueues.get(key) ?? Promise.resolve();
  const currentEvent: AIActivityEvent = {
    stage: activity.stage,
    detail: activity.detail,
    status: transition === "completed" ? "complete" : transition === "failed" ? "failed" : "active",
    updatedAt: activity.updatedAt,
  };
  const eventType = PERSISTED_EVENT_TYPES[transition];
  const metadata = {
    activityId: activity.id,
    kind: activity.kind,
    title: activity.title,
    status: activity.status,
    stage: activity.stage,
    detail: activity.detail,
    error: activity.error ?? null,
    startedAt: activity.startedAt,
    updatedAt: activity.updatedAt,
    completedAt: activity.completedAt,
    event: currentEvent ? { ...currentEvent } : null,
  };
  const next = previous.then(async () => {
    await recordStudentActivityEvent({
      userId,
      eventType,
      entityType: "ai_activity",
      entityId: activity.id,
      summary: (activity.title + ": " + activity.stage + " — " + activity.detail).slice(0, 500),
      metadata,
    });
  }).catch(error => {
    // Persistence failure must not fail or interrupt the underlying AI task.
    console.warn("[StudyFlow AI activity] Could not persist progress event", {
      activityId: activity.id,
      eventType,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  });
  persistenceQueues.set(key, next);
  void next.then(() => {
    if (persistenceQueues.get(key) === next) persistenceQueues.delete(key);
  });
}

function toSnapshot(records: AIActivityRecord[], now: number): AIActivitySnapshot {
  const normalized = records
    .filter(activity => activity.kind !== "assistant")
    .map(cloneActivity);

  for (const activity of normalized) {
    if (activity.status === "running" && now - activity.updatedAt > ACTIVE_STALE_AFTER_MS) {
      const current = activity.events[activity.events.length - 1];
      if (current?.status === "active") {
        current.status = "failed";
        current.detail = "توقف وصول تحديثات هذه العملية؛ تحقق من النتيجة قبل إعادة المحاولة.";
        current.updatedAt = now;
      }
      activity.status = "failed";
      activity.stage = "توقف التنفيذ";
      activity.detail = "لم تصل إشارة اكتمال للعملية.";
      activity.error = "انتهت مهلة متابعة العملية.";
      activity.completedAt = now;
      activity.updatedAt = now;
    }
  }

  const recordsInWindow = normalized
    .filter(activity => activity.status === "running"
      || activity.completedAt === null
      || now - activity.completedAt <= COMPLETED_RETENTION_MS)
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return {
    active: recordsInWindow.filter(activity => activity.status === "running").slice(0, MAX_RECORDS_PER_USER),
    recent: recordsInWindow.filter(activity => activity.status !== "running").slice(0, 3),
  };
}

function restorePersistentActivityRows(rows: Array<{
  eventType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date | string;
}>): AIActivityRecord[] {
  const restored = new Map<string, AIActivityRecord>();
  const ordered = [...rows].reverse();

  for (const row of ordered) {
    const meta = row.metadata ?? {};
    const id = String(meta.activityId ?? row.entityId ?? "").trim();
    const kindValue = meta.kind;
    if (!id || !["planner", "daily_plan", "teacher_monitor"].includes(String(kindValue))) continue;

    const kind = kindValue as Exclude<AIActivityKind, "assistant">;
    const title = String(meta.title ?? "عملية ذكاء اصطناعي").slice(0, 100);
    const event = meta.event && typeof meta.event === "object"
      ? meta.event as Record<string, unknown>
      : {};
    const timestamp = (value: unknown, fallback: number) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : fallback;
    };
    const rowTime = row.createdAt instanceof Date
      ? row.createdAt.getTime()
      : Date.parse(String(row.createdAt)) || Date.now();
    const eventUpdatedAt = timestamp(event.updatedAt, rowTime);
    const stage = String(event.stage ?? meta.stage ?? "حالة غير محددة").slice(0, 80);
    const detail = String(event.detail ?? meta.detail ?? "").slice(0, 280);
    const eventStatus = (["active", "complete", "failed"].includes(String(event.status))
      ? event.status
      : row.eventType === PERSISTED_EVENT_TYPES.completed ? "complete"
        : row.eventType === PERSISTED_EVENT_TYPES.failed ? "failed" : "active") as AIActivityEventStatus;
    const record = restored.get(id) ?? {
      id,
      kind,
      title,
      status: "running" as AIActivityStatus,
      stage,
      detail,
      events: [],
      startedAt: timestamp(meta.startedAt, rowTime),
      updatedAt: rowTime,
      completedAt: null,
    };
    const current = record.events[record.events.length - 1];

    if (row.eventType === PERSISTED_EVENT_TYPES.started) {
      record.events = [{ stage, detail, status: "active", updatedAt: eventUpdatedAt }];
      record.status = "running";
      record.completedAt = null;
    } else if (row.eventType === PERSISTED_EVENT_TYPES.progress) {
      if (current?.status === "active" && current.stage === stage) {
        current.detail = detail;
        current.updatedAt = eventUpdatedAt;
      } else {
        if (current?.status === "active") {
          current.status = "complete";
          current.updatedAt = eventUpdatedAt;
        }
        record.events.push({ stage, detail, status: "active", updatedAt: eventUpdatedAt });
      }
      record.status = "running";
      record.completedAt = null;
    } else if (row.eventType === PERSISTED_EVENT_TYPES.completed) {
      if (current?.status === "active") {
        current.status = "complete";
        current.updatedAt = eventUpdatedAt;
      }
      record.events.push({ stage, detail, status: "complete", updatedAt: eventUpdatedAt });
      record.status = "complete";
      record.completedAt = timestamp(meta.completedAt, eventUpdatedAt);
    } else if (row.eventType === PERSISTED_EVENT_TYPES.failed) {
      if (current?.status === "active") {
        current.status = "failed";
        current.detail = detail;
        current.updatedAt = eventUpdatedAt;
      } else {
        record.events.push({ stage, detail, status: "failed", updatedAt: eventUpdatedAt });
      }
      record.status = "failed";
      record.error = String(meta.error ?? detail).slice(0, 280);
      record.completedAt = timestamp(meta.completedAt, eventUpdatedAt);
    } else {
      continue;
    }

    if (record.events.length > MAX_EVENTS_PER_RECORD) {
      record.events.splice(0, record.events.length - MAX_EVENTS_PER_RECORD);
    }
    record.title = title;
    record.stage = String(meta.stage ?? stage).slice(0, 80);
    record.detail = String(meta.detail ?? detail).slice(0, 280);
    record.updatedAt = timestamp(meta.updatedAt, rowTime);
    if (record.status === "failed" && meta.error) record.error = String(meta.error).slice(0, 280);
    restored.set(id, record);
  }
  return [...restored.values()];
}

export function startAIActivity(
  userId: number,
  input: { kind: AIActivityKind; title: string; stage: string; detail: string },
): string {
  const now = Date.now();
  pruneUserActivities(userId, now);
  const id = randomUUID();
  const activity: AIActivityRecord = {
    id,
    kind: input.kind,
    title: input.title.slice(0, 100),
    status: "running",
    stage: input.stage.slice(0, 80),
    detail: input.detail.slice(0, 280),
    events: [{
      stage: input.stage.slice(0, 80),
      detail: input.detail.slice(0, 280),
      status: "active",
      updatedAt: now,
    }],
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
  getUserActivities(userId).set(id, activity);
  pruneUserActivities(userId, now);
  persistActivityTransition(userId, activity, "started");
  return id;
}

export function updateAIActivity(userId: number, activityId: string, stage: string, detail: string): void {
  const activity = activitiesByUser.get(userId)?.get(activityId);
  if (!activity || activity.status !== "running") return;
  const now = Date.now();
  const safeStage = stage.slice(0, 80);
  const safeDetail = detail.slice(0, 280);
  const current = activity.events[activity.events.length - 1];

  if (current?.stage === safeStage && current.status === "active") {
    current.detail = safeDetail;
    current.updatedAt = now;
  } else {
    if (current?.status === "active") {
      current.status = "complete";
      current.updatedAt = now;
    }
    activity.events.push({ stage: safeStage, detail: safeDetail, status: "active", updatedAt: now });
    if (activity.events.length > MAX_EVENTS_PER_RECORD) {
      activity.events.splice(0, activity.events.length - MAX_EVENTS_PER_RECORD);
    }
  }
  activity.stage = safeStage;
  activity.detail = safeDetail;
  activity.updatedAt = now;
  persistActivityTransition(userId, activity, "progress");
}

export function completeAIActivity(userId: number, activityId: string, detail: string): void {
  const activity = activitiesByUser.get(userId)?.get(activityId);
  if (!activity || activity.status !== "running") return;
  const now = Date.now();
  const current = activity.events[activity.events.length - 1];
  if (current?.status === "active") {
    current.status = "complete";
    current.updatedAt = now;
  }
  const finalDetail = detail.slice(0, 280);
  activity.events.push({ stage: "اكتملت العملية", detail: finalDetail, status: "complete", updatedAt: now });
  if (activity.events.length > MAX_EVENTS_PER_RECORD) {
    activity.events.splice(0, activity.events.length - MAX_EVENTS_PER_RECORD);
  }
  activity.status = "complete";
  activity.stage = "اكتملت العملية";
  activity.detail = finalDetail;
  activity.updatedAt = now;
  activity.completedAt = now;
  persistActivityTransition(userId, activity, "completed");
}

export function failAIActivity(userId: number, activityId: string, message: string): void {
  const activity = activitiesByUser.get(userId)?.get(activityId);
  if (!activity || activity.status !== "running") return;
  const now = Date.now();
  const current = activity.events[activity.events.length - 1];
  if (current?.status === "active") {
    current.status = "failed";
    current.detail = message.slice(0, 280);
    current.updatedAt = now;
  } else {
    activity.events.push({ stage: "تعذّر الإكمال", detail: message.slice(0, 280), status: "failed", updatedAt: now });
  }
  activity.status = "failed";
  activity.stage = "تعذّر الإكمال";
  activity.detail = message.slice(0, 280);
  activity.error = message.slice(0, 280);
  activity.updatedAt = now;
  activity.completedAt = now;
  persistActivityTransition(userId, activity, "failed");
}

function buildMemorySnapshot(userId: number): AIActivitySnapshot {
  const now = Date.now();
  pruneUserActivities(userId, now);
  const records = [...(activitiesByUser.get(userId)?.values() ?? [])]
    .filter(activity => activity.kind !== "assistant")
    .sort((left, right) => right.updatedAt - left.updatedAt);
  return {
    active: records.filter(activity => activity.status === "running").map(cloneActivity),
    recent: records.filter(activity => activity.status !== "running").slice(0, 3).map(cloneActivity),
  };
}

export function getAIActivitySnapshot(userId: number): AIActivitySnapshot {
  return buildMemorySnapshot(userId);
}

/** Restores the same activity view after a restart or when a request hits another replica. */
export async function getDurableAIActivitySnapshot(userId: number): Promise<AIActivitySnapshot> {
  const pending = [...persistenceQueues.entries()]
    .filter(([key]) => key.startsWith(String(userId) + ":"))
    .map(([, task]) => task);
  if (pending.length) await Promise.all(pending);

  try {
    const rows = await listRecentAIBackgroundActivityEvents(userId, MAX_PERSISTED_EVENTS_READ);
    const persistedRecords = restorePersistentActivityRows(rows);
    const merged = new Map(persistedRecords.map(record => [record.id, record]));
    for (const memoryRecord of activitiesByUser.get(userId)?.values() ?? []) {
      if (memoryRecord.kind === "assistant") continue;
      const saved = merged.get(memoryRecord.id);
      if (!saved || memoryRecord.updatedAt >= saved.updatedAt) merged.set(memoryRecord.id, cloneActivity(memoryRecord));
    }
    return toSnapshot([...merged.values()], Date.now());
  } catch {
    return buildMemorySnapshot(userId);
  }
}

export function setAIActivityPersistenceForTests(enabled: boolean): void {
  if (process.env.NODE_ENV === "test") persistenceEnabled = enabled;
}

export async function flushAIActivityPersistenceForTests(userId: number): Promise<void> {
  const pending = [...persistenceQueues.entries()]
    .filter(([key]) => key.startsWith(String(userId) + ":"))
    .map(([, task]) => task);
  if (pending.length) await Promise.all(pending);
}

export function clearAIActivityForTests(): void {
  activitiesByUser.clear();
}
