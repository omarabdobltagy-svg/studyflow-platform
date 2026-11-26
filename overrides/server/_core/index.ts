import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter, ingestYoutubeWebSubFeed, startPlannerReconciliationWorker } from "../routers";
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
  // Attachment payloads are capped at 8 MiB; base64 adds roughly 33% overhead.
  // Keep the parser limit bounded to avoid large request bodies exhausting memory.
  app.use(express.json({ limit: "12mb" }));
  app.use(express.urlencoded({ limit: "12mb", extended: true }));
  registerStorageProxy(app);

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
