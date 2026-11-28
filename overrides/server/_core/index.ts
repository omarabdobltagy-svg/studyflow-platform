import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter, assistantChatInputSchema, runAssistantChat, ingestYoutubeWebSubFeed, startPlannerReconciliationWorker } from "../routers";
import { listStudentTeacherMonitoringProfiles } from "../db";
import {
  resolveYoutubeWebhookTeacher,
  subscribeSelectedYoutubeTeachers,
  verifyYoutubeWebhookRequest,
  verifyYoutubeWebhookSignature,
} from "../youtube-websub";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { processScheduledReminder } from "../reminders";
import { getSecurityHeaders, isAllowedSameOrigin } from "./security";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    const isSecure = req.secure || forwardedProto === "https";
    for (const [name, value] of Object.entries(getSecurityHeaders(isSecure))) {
      res.setHeader(name, value);
    }
    if (req.originalUrl.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
    }

    const isUnsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
    const isApiRequest = req.originalUrl.startsWith("/api/");
    const isScheduledReminder = req.path === "/api/scheduled/daily-reminder";
    if (isUnsafeMethod && isApiRequest && !isScheduledReminder) {
      const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
      const requestHost = (req.get("x-forwarded-host") ?? req.get("host") ?? "")
        .split(",")[0].trim();
      const requestProto = forwardedProto || (req.secure ? "https" : "http");
      if (fetchSite === "cross-site"
        || !isAllowedSameOrigin(req.get("origin"), requestHost, requestProto)) {
        return res.status(403).json({ error: "cross-origin request rejected" });
      }
    }
    return next();
  });
  // Attachment payloads are capped at 8 MiB; base64 adds roughly 33% overhead.
  // Keep the parser limit bounded to avoid large request bodies exhausting memory.
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  registerStorageProxy(app);

  // Authoritative server time. Date-sensitive UI must not read the device wall clock.
  app.get("/api/system/time", (_req, res) => {
    const serverTimeMs = Date.now();
    return res.status(200).json({
      serverTimeMs,
      serverTime: new Date(serverTimeMs).toISOString(),
      timeZone: "Africa/Cairo",
      source: "application-server",
    });
  });

  // YouTube WebSub verification and delivery endpoint. Only public channel feed
  // events are accepted; the signature is validated before ingestion.
  app.get("/webhooks/youtube", (req, res) => {
    const challenge = verifyYoutubeWebhookRequest(req.query as Record<string, unknown>);
    if (!challenge) return res.status(404).type("text/plain").send("not found");
    console.info("[StudyFlow WebSub] YouTube channel verification challenge accepted", {
      channelId: typeof req.query.channel_id === "string" ? req.query.channel_id : "unknown",
      teacherId: typeof req.query.teacher_id === "string" ? req.query.teacher_id : "unknown",
      mode: typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "unknown",
    });
    return res.status(200).type("text/plain").send(challenge);
  });

  app.post(
    "/webhooks/youtube",
    express.text({ type: ["application/atom+xml", "application/xml", "text/xml"], limit: "1mb" }),
    async (req, res) => {
      const channelId = typeof req.query.channel_id === "string" ? req.query.channel_id : "";
      const teacherId = typeof req.query.teacher_id === "string" ? req.query.teacher_id : "";
      const subscription = resolveYoutubeWebhookTeacher(channelId, teacherId);
      if (!subscription) return res.status(404).end();
      const body = typeof req.body === "string" ? req.body : "";
      if (!body || !verifyYoutubeWebhookSignature(body, req.header("x-hub-signature"), subscription.secret)) {
        return res.status(401).end();
      }
      try {
        const result = await ingestYoutubeWebSubFeed(teacherId, body);
        return res.status(202).json({ received: result.received });
      } catch (error) {
        console.error("[StudyFlow WebSub] YouTube feed ingestion failed", {
          teacherId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return res.status(500).end();
      }
    },
  );
  app.post("/api/scheduled/daily-reminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      return res.json(await processScheduledReminder(user.taskUid));
    } catch (error) {
      return res.status(500).json({ error: String(error), context: { path: req.path }, timestamp: new Date().toISOString() });
    }
  });
  // Authenticated assistant streaming endpoint. It shares the same session
  // context and resolver as the tRPC mutation; only the response transport differs.
  app.post("/api/assistant/stream", async (req, res) => {
    const origin = req.get("origin");
    const requestHost = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim();
    if (origin) {
      try {
        if (new URL(origin).host !== requestHost) return res.status(403).json({ error: "cross-origin request rejected" });
      } catch {
        return res.status(403).json({ error: "invalid request origin" });
      }
    }
    if (!req.is("application/json")) return res.status(415).json({ error: "application/json required" });

    const context = await createContext({ req, res } as unknown as Parameters<typeof createContext>[0]);
    if (!context.user) return res.status(401).json({ error: "authentication required" });
    const parsed = assistantChatInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid assistant request" });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let emittedText = "";
    const sendToken = (token: string) => {
      if (!token || res.writableEnded || res.destroyed) return;
      emittedText += token;
      res.write("data: " + JSON.stringify({ token }) + "\n\n");
    };

    try {
      const result = await runAssistantChat(context.user.id, parsed.data, sendToken);
      // Configuration errors can return a helpful plain-text response without
      // invoking the model; deliver that response through the same stream.
      if (!emittedText && result.content) sendToken(result.content);
      if (!res.writableEnded && !res.destroyed) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    } catch (error) {
      console.error("[StudyFlow AI] Streaming request failed:", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) return res.status(502).json({ error: "assistant temporarily unavailable" });
      if (!res.writableEnded && !res.destroyed) {
        res.write("event: error\ndata: " + JSON.stringify({ error: "assistant temporarily unavailable" }) + "\n\n");
        res.end();
      }
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  startPlannerReconciliationWorker();

  const syncYoutubeSubscriptions = async () => {
    const publicUrl = process.env.STUDYFLOW_PUBLIC_URL?.trim()
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN.trim() : "");
    const verifyToken = process.env.STUDYFLOW_YOUTUBE_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
    const secret = process.env.STUDYFLOW_YOUTUBE_WEBHOOK_SECRET?.trim() ?? "";
    if (!publicUrl || !verifyToken || secret.length < 24) {
      console.info("[StudyFlow WebSub] YouTube push is not configured; the periodic feed scan remains the fallback.");
      return;
    }
    try {
      const profiles = await listStudentTeacherMonitoringProfiles();
      const result = await subscribeSelectedYoutubeTeachers(profiles, { publicUrl, verifyToken, secret });
      console.info("[StudyFlow WebSub] Subscription sync finished", result);
    } catch (error) {
      console.warn("[StudyFlow WebSub] Subscription sync failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  };
  void syncYoutubeSubscriptions();
  const youtubeSubscriptionTimer = setInterval(() => void syncYoutubeSubscriptions(), 6 * 60 * 60 * 1_000);
  youtubeSubscriptionTimer.unref?.();
}

startServer().catch(console.error);
