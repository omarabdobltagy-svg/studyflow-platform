import { createHash } from "node:crypto";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown, limit = 240): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function stringList(value: unknown, limit = 16): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map(item => item.trim().slice(0, 180))
    .slice(0, limit);
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as UnknownRecord;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonicalize(record[key])]));
  }
  return value;
}

function buildTeacherPlanningSignals(rawUpdates: unknown): UnknownRecord[] {
  if (!Array.isArray(rawUpdates)) return [];

  const signals: UnknownRecord[] = [];
  for (const raw of rawUpdates) {
    const update = asRecord(raw);
    const externalId = text(update.externalId, 180);
    const teacherId = text(update.teacherId, 100);
    if (!externalId || !teacherId) continue;

    const announcementType = text(update.announcementType, 60);
    const isExplicitScheduleChange = update.confidence === "high"
      && ["lecture_cancelled", "class_suspended", "schedule_changed"].includes(announcementType);

    const analysis = asRecord(update.contentAnalysis);
    const topics = Array.isArray(analysis.topics)
      ? analysis.topics.slice(0, 30).map(rawTopic => {
          const topic = asRecord(rawTopic);
          return {
            titleAr: text(topic.titleAr, 180),
            descriptionAr: text(topic.descriptionAr, 500),
            startSeconds: Number.isFinite(Number(topic.startSeconds)) ? Math.max(0, Math.floor(Number(topic.startSeconds))) : null,
            endSeconds: Number.isFinite(Number(topic.endSeconds)) ? Math.max(0, Math.floor(Number(topic.endSeconds))) : null,
            subjectHints: stringList(topic.subjectHints, 8),
            branchHints: stringList(topic.branchHints, 8),
            curriculumKeywords: stringList(topic.curriculumKeywords, 16),
            confidence: ["high", "medium", "low"].includes(String(topic.confidence)) ? topic.confidence : "unknown",
          };
        }).filter(topic => topic.titleAr || topic.descriptionAr)
      : [];

    const teacherInstructions = Array.isArray(analysis.teacherInstructions)
      ? analysis.teacherInstructions.slice(0, 20).map(rawInstruction => asRecord(rawInstruction))
          .filter(instruction => instruction.explicit === true)
          .map(instruction => ({
            instructionAr: text(instruction.instructionAr, 280),
            kind: text(instruction.kind, 40),
            startSeconds: Number.isFinite(Number(instruction.startSeconds)) ? Math.max(0, Math.floor(Number(instruction.startSeconds))) : null,
            confidence: ["high", "medium", "low"].includes(String(instruction.confidence)) ? instruction.confidence : "unknown",
          }))
          .filter(instruction => instruction.instructionAr)
      : [];

    const descriptionMatch = asRecord(update.descriptionMatch);
    const matchedSubject = text(descriptionMatch.subjectId, 100);
    const matchedBranch = text(descriptionMatch.branchId, 120);
    const verifiedDescriptionMatch = Boolean(matchedSubject && matchedBranch);

    const hasCompletedAnalysis = analysis.status === "complete"
      && (topics.length > 0 || teacherInstructions.length > 0 || Boolean(text(analysis.summaryAr, 800)));

    if (!isExplicitScheduleChange && !hasCompletedAnalysis && !verifiedDescriptionMatch) continue;

    signals.push({
      externalId,
      teacherId,
      publishedAt: text(update.publishedAt, 50),
      ...(isExplicitScheduleChange ? {
        scheduleChange: {
          announcementType,
          confidence: "high",
          affectedDate: text(update.affectedDate, 40),
          title: text(update.title, 240),
          description: text(update.description, 1_200),
          url: text(update.url, 700),
        },
      } : {}),
      ...(verifiedDescriptionMatch ? {
        verifiedDescriptionMatch: {
          subjectId: matchedSubject,
          branchId: matchedBranch,
          topics: stringList(descriptionMatch.topics, 16),
          verifiedAt: text(descriptionMatch.verifiedAt, 50),
        },
      } : {}),
      ...(hasCompletedAnalysis ? {
        completedVideoAnalysis: {
          contentType: text(analysis.contentType, 40),
          summaryAr: text(analysis.summaryAr, 900),
          topics,
          teacherInstructions,
          topicsNotCovered: stringList(analysis.topicsNotCovered, 20),
        },
      } : {}),
    });
  }

  return signals.sort((left, right) => String(left.externalId).localeCompare(String(right.externalId)));
}

/**
 * Remove operational chatter from planning inputs. Public uploads are retained
 * in the student profile and teacher activity feed, but only verified schedule
 * changes, completed video analysis, and verified curriculum matches can
 * invalidate a saved daily plan.
 */
export function createPlannerRelevantSelection(value: unknown): UnknownRecord {
  const selection = asRecord(value);
  const stableSelection: UnknownRecord = { ...selection };

  delete stableSelection.teacherPublicScanState;
  delete stableSelection.teacherYoutubeChannels;
  delete stableSelection.teacherPublicUpdates;
  delete stableSelection.assistantMemory;
  delete stableSelection.assistantMemoryUpdatedAt;

  const teacherPlanningSignals = buildTeacherPlanningSignals(selection.teacherPublicUpdates);
  if (teacherPlanningSignals.length) {
    stableSelection.teacherPlanningSignals = teacherPlanningSignals;
  } else {
    delete stableSelection.teacherPlanningSignals;
  }

  return stableSelection;
}

/** Stable, non-reversible identifier for the current student planning inputs. */
export function createDailyPlanSourceFingerprint(source: unknown): string {
  const serialized = JSON.stringify(canonicalize(source) ?? null);
  return createHash("sha256").update(serialized).digest("hex").slice(0, 32);
}
