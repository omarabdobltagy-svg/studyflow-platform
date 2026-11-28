import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getYoutubeWebhookSubscription,
  resolveYoutubeWebhookTeacher,
  subscribeSelectedYoutubeTeachers,
  verifyYoutubeWebhookRequest,
  verifyYoutubeWebhookSignature,
} from "./youtube-websub";

describe("YouTube WebSub verification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a signed subscription for a selected public teacher channel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await subscribeSelectedYoutubeTeachers([
      { educationSystem: "baccalaureate", gradeYear: "الصف الثاني الثانوي – دفعة 2027", subjectIds: ["ARB_G2_BAC"], teacherSelections: { ARB_G2_BAC: "T_AR_MOHAMED_SALAH" }, selection: {} },
    ], {
      publicUrl: "https://studyflow.example",
      verifyToken: "test-verify-token",
      secret: "a-secret-long-enough-for-websub-tests",
    });

    expect(result.subscribed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const subscription = getYoutubeWebhookSubscription("UCdur25RCItdfoXA89ORWSkw");
    expect(subscription?.teacherId).toBe("T_AR_MOHAMED_SALAH");
    expect(subscription?.callback).toContain("/webhooks/youtube");
    expect(resolveYoutubeWebhookTeacher("UCdur25RCItdfoXA89ORWSkw", "T_AR_MOHAMED_SALAH")).not.toBeNull();
    expect(resolveYoutubeWebhookTeacher("UCdur25RCItdfoXA89ORWSkw", "T_EN_MAHMOUD_RADWAN")).toBeNull();

    const challenge = "hub-challenge-value";
    expect(verifyYoutubeWebhookRequest({
      channel_id: "UCdur25RCItdfoXA89ORWSkw",
      "hub.mode": "subscribe",
      "hub.topic": subscription!.topic,
      "hub.verify_token": "test-verify-token",
      "hub.challenge": challenge,
    })).toBe(challenge);
    expect(verifyYoutubeWebhookRequest({
      channel_id: "UCdur25RCItdfoXA89ORWSkw",
      "hub.mode": "subscribe",
      "hub.topic": subscription!.topic,
      "hub.verify_token": "wrong-token",
      "hub.challenge": challenge,
    })).toBeNull();
  });

  it("accepts only a valid HMAC-SHA1 WebSub delivery signature", async () => {
    const secret = "another-secret-long-enough-for-websub";
    const body = "<feed><entry><yt:videoId>video-1</yt:videoId></entry></feed>";
    const signature = createHmac("sha1", secret).update(body, "utf8").digest("hex");
    expect(verifyYoutubeWebhookSignature(body, "sha1=" + signature, secret)).toBe(true);
    expect(verifyYoutubeWebhookSignature(body, "sha1=" + signature, "different-secret")).toBe(false);
    expect(verifyYoutubeWebhookSignature(body, "sha256=" + signature, secret)).toBe(false);
    expect(verifyYoutubeWebhookSignature(body, undefined, secret)).toBe(false);
  });

  it("does not request subscriptions without the public callback and strong secret", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await subscribeSelectedYoutubeTeachers([
      { educationSystem: "baccalaureate", gradeYear: "الصف الثاني الثانوي – دفعة 2027", subjectIds: ["ARB_G2_BAC"], teacherSelections: { ARB_G2_BAC: "T_AR_MOHAMED_SALAH" }, selection: {} },
    ], {
      publicUrl: "",
      verifyToken: "test-verify-token",
      secret: "short",
    });
    expect(result).toEqual({ subscribed: 0, skipped: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
