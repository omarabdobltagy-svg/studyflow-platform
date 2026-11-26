import { randomUUID } from "node:crypto";

export type AIActivityKind = "assistant" | "planner" | "daily_plan";
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
const MAX_EVENTS_PER_RECORD = 12;
const ACTIVE_STALE_AFTER_MS = 15 * 60 * 1000;
const COMPLETED_RETENTION_MS = 45 * 1000;

const activitiesByUser = new Map<number, Map<string, AIActivityRecord>>();

function getUserActivities(userId: number): Map<string, AIActivityRecord> {
  let activities = activitiesByUser.get(userId);
  if (!activities) {
    activities = new Map<string, AIActivityRecord>();
    activitiesByUser.set(userId, activities);
  }
  return activities;
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

export function startAIActivity(
  userId: number,
  input: {
    kind: AIActivityKind;
    title: string;
    stage: string;
    detail: string;
  },
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
  return id;
}

export function updateAIActivity(
  userId: number,
  activityId: string,
  stage: string,
  detail: string,
): void {
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
    activity.events.push({
      stage: safeStage,
      detail: safeDetail,
      status: "active",
      updatedAt: now,
    });
    if (activity.events.length > MAX_EVENTS_PER_RECORD) {
      activity.events.splice(0, activity.events.length - MAX_EVENTS_PER_RECORD);
    }
  }

  activity.stage = safeStage;
  activity.detail = safeDetail;
  activity.updatedAt = now;
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
  activity.events.push({
    stage: "اكتملت العملية",
    detail: finalDetail,
    status: "complete",
    updatedAt: now,
  });
  if (activity.events.length > MAX_EVENTS_PER_RECORD) {
    activity.events.splice(0, activity.events.length - MAX_EVENTS_PER_RECORD);
  }
  activity.status = "complete";
  activity.stage = "اكتملت العملية";
  activity.detail = finalDetail;
  activity.updatedAt = now;
  activity.completedAt = now;
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
    activity.events.push({
      stage: "تعذّر الإكمال",
      detail: message.slice(0, 280),
      status: "failed",
      updatedAt: now,
    });
  }
  activity.status = "failed";
  activity.stage = "تعذّر الإكمال";
  activity.detail = message.slice(0, 280);
  activity.error = message.slice(0, 280);
  activity.updatedAt = now;
  activity.completedAt = now;
}

export function getAIActivitySnapshot(userId: number): AIActivitySnapshot {
  const now = Date.now();
  pruneUserActivities(userId, now);
  const records = [...(activitiesByUser.get(userId)?.values() ?? [])]
    .sort((left, right) => right.updatedAt - left.updatedAt);
  return {
    active: records.filter(activity => activity.status === "running").map(activity => ({
      ...activity,
      events: activity.events.map(event => ({ ...event })),
    })),
    recent: records.filter(activity => activity.status !== "running").slice(0, 3).map(activity => ({
      ...activity,
      events: activity.events.map(event => ({ ...event })),
    })),
  };
}

export function clearAIActivityForTests(): void {
  activitiesByUser.clear();
}
