import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveTeacherYoutubeChannelId } from "./teacher-content-monitor";

const YOUTUBE_WEBSUB_HUB = "https://pubsubhubbub.appspot.com/subscribe";
const RENEW_AFTER_MS = 6 * 24 * 60 * 60 * 1_000;

type ActiveSubscription = {
  teacherId: string;
  channelId: string;
  topic: string;
  callback: string;
  verifyToken: string;
  secret: string;
  requestedAt: number;
};

const activeSubscriptions = new Map<string, ActiveSubscription>();
let syncInFlight: Promise<{ subscribed: number; skipped: number; failed: number }> | null = null;

function channelTopic(channelId: string) {
  return "https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(channelId);
}

export function getYoutubeWebhookSubscription(channelId: string) {
  return activeSubscriptions.get(channelId) ?? null;
}

export async function subscribeSelectedYoutubeTeachers(
  profiles: Array<{ teacherSelections?: Record<string, string>; selection?: Record<string, any> }>,
  options: { publicUrl: string; verifyToken: string; secret: string },
) {
  if (syncInFlight) return syncInFlight;
  const publicUrl = options.publicUrl.trim().replace(/\/+$/, "");
  const verifyToken = options.verifyToken.trim();
  const secret = options.secret.trim();
  if (!/^https:\/\/[^/]+/i.test(publicUrl) || !verifyToken || secret.length < 24) {
    return { subscribed: 0, skipped: 0, failed: 0 };
  }

  syncInFlight = (async () => {
    const teacherIds = new Set<string>();
    for (const profile of profiles) {
      const choices = {
        ...(profile.teacherSelections ?? {}),
        ...((profile.selection?.teacherChoices && typeof profile.selection.teacherChoices === "object")
          ? profile.selection.teacherChoices as Record<string, string>
          : {}),
      };
      for (const teacherId of Object.values(choices)) {
        if (typeof teacherId === "string" && teacherId && teacherId !== "__SKIP__" && teacherId !== "__DEFERRED__") {
          teacherIds.add(teacherId);
        }
      }
    }

    let subscribed = 0;
    let skipped = 0;
    let failed = 0;
    for (const teacherId of teacherIds) {
      let channelId: string | null = null;
      try {
        channelId = await resolveTeacherYoutubeChannelId(teacherId);
      } catch (error) {
        failed += 1;
        console.warn("[StudyFlow WebSub] Could not resolve selected YouTube channel", {
          teacherId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        continue;
      }
      if (!channelId) {
        skipped += 1;
        continue;
      }

      const existing = activeSubscriptions.get(channelId);
      if (existing && Date.now() - existing.requestedAt < RENEW_AFTER_MS) {
        skipped += 1;
        continue;
      }

      const topic = channelTopic(channelId);
      const callbackUrl = new URL("/webhooks/youtube", publicUrl);
      callbackUrl.searchParams.set("channel_id", channelId);
      callbackUrl.searchParams.set("teacher_id", teacherId);
      const callback = callbackUrl.toString();
      const params = new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.topic": topic,
        "hub.callback": callback,
        "hub.verify": "async",
        "hub.verify_token": verifyToken,
        "hub.secret": secret,
        "hub.lease_seconds": String(10 * 24 * 60 * 60),
      });

      // Publish the pending subscription before requesting it; the hub may
      // verify the callback immediately after accepting the form post.
      activeSubscriptions.set(channelId, {
        teacherId, channelId, topic, callback, verifyToken, secret, requestedAt: Date.now(),
      });
      try {
        const response = await fetch(YOUTUBE_WEBSUB_HUB, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: params.toString(),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Hub returned HTTP " + response.status);
        subscribed += 1;
      } catch (error) {
        activeSubscriptions.delete(channelId);
        failed += 1;
        console.warn("[StudyFlow WebSub] Subscription request failed", {
          teacherId,
          channelId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
    console.info("[StudyFlow WebSub] YouTube subscription sync completed", {
      selectedTeachers: teacherIds.size,
      subscribed, skipped, failed,
    });
    return { subscribed, skipped, failed };
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export function verifyYoutubeWebhookRequest(query: Record<string, unknown>) {
  const channelId = typeof query.channel_id === "string" ? query.channel_id : "";
  const subscription = activeSubscriptions.get(channelId);
  if (!subscription) return null;
  const mode = typeof query["hub.mode"] === "string" ? query["hub.mode"] : "";
  const topic = typeof query["hub.topic"] === "string" ? query["hub.topic"] : "";
  const verifyToken = typeof query["hub.verify_token"] === "string" ? query["hub.verify_token"] : "";
  const challenge = typeof query["hub.challenge"] === "string" ? query["hub.challenge"] : "";
  if ((mode !== "subscribe" && mode !== "unsubscribe")
    || topic !== subscription.topic
    || verifyToken !== subscription.verifyToken
    || !challenge) return null;
  return challenge;
}

export function verifyYoutubeWebhookSignature(body: string, signatureHeader: string | undefined, secret: string) {
  if (!signatureHeader || !secret) return false;
  const [algorithm, signature] = signatureHeader.split("=", 2);
  if (algorithm !== "sha1" || !signature || !/^[a-f0-9]{40}$/i.test(signature)) return false;
  const expected = createHmac("sha1", secret).update(body, "utf8").digest();
  const supplied = Buffer.from(signature, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function resolveYoutubeWebhookTeacher(channelId: string, teacherId: string) {
  const subscription = activeSubscriptions.get(channelId);
  return subscription?.teacherId === teacherId ? subscription : null;
}
