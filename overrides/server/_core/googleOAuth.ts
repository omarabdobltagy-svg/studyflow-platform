import { createHash, randomBytes } from "node:crypto";
import axios from "axios";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const STATE_COOKIE = "sie_google_state";
const NONCE_COOKIE = "sie_google_nonce";
const VERIFIER_COOKIE = "sie_google_pkce";
const TRANSIENT_COOKIE_TTL_MS = 10 * 60 * 1000;

function getOrigin(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("host");
  return host ? proto + "://" + host : "http://localhost";
}

function getRedirectUri(req: Request) {
  return ENV.googleRedirectUri || getOrigin(req) + "/api/oauth/google/callback";
}

function transientCookieOptions(req: Request) {
  return {
    ...getSessionCookieOptions(req),
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: TRANSIENT_COOKIE_TTL_MS,
  };
}

function clearTransientCookies(res: Response, req: Request) {
  const options = { ...transientCookieOptions(req), maxAge: 0 };
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
    res.clearCookie(name, options);
  }
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function safeRedirect(res: Response, path: string) {
  res.redirect(302, path);
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.cookieSecret) {
      res.status(503).send("تسجيل الدخول باستخدام Google غير مهيأ بعد. يلزم إعداد بيانات OAuth وJWT_SECRET في بيئة التشغيل.");
      return;
    }

    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const cookieOptions = transientCookieOptions(req);

    res.cookie(STATE_COOKIE, state, cookieOptions);
    res.cookie(NONCE_COOKIE, nonce, cookieOptions);
    res.cookie(VERIFIER_COOKIE, verifier, cookieOptions);

    const authorizationUrl = new URL(GOOGLE_AUTH_URL);
    authorizationUrl.searchParams.set("client_id", ENV.googleClientId);
    authorizationUrl.searchParams.set("redirect_uri", getRedirectUri(req));
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "openid email profile");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("nonce", nonce);
    authorizationUrl.searchParams.set("code_challenge", challenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("prompt", "select_account");
    authorizationUrl.searchParams.set("access_type", "online");

    res.redirect(302, authorizationUrl.toString());
  });

  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const stateCookie = cookies[STATE_COOKIE];
    const nonceCookie = cookies[NONCE_COOKIE];
    const verifierCookie = cookies[VERIFIER_COOKIE];

    clearTransientCookies(res, req);

    if (!code || !state || !stateCookie || state !== stateCookie || !nonceCookie || !verifierCookie) {
      res.status(400).send("تعذّر التحقق من طلب تسجيل الدخول. ابدأ تسجيل الدخول مرة أخرى.");
      return;
    }

    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).send("تسجيل الدخول باستخدام Google غير مهيأ في بيئة التشغيل.");
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        code,
        code_verifier: verifierCookie,
        grant_type: "authorization_code",
        redirect_uri: getRedirectUri(req),
      });
      const tokenResponse = await axios.post<{
        id_token?: string;
        access_token?: string;
        token_type?: string;
      }>(GOOGLE_TOKEN_URL, tokenBody.toString(), {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        timeout: 30_000,
      });

      const idToken = tokenResponse.data.id_token;
      if (!idToken) {
        res.status(401).send("لم يرجع Google رمز هوية صالحًا. أعد المحاولة.");
        return;
      }

      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        audience: ENV.googleClientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      });

      const googleSub = typeof payload.sub === "string" ? payload.sub : "";
      const googleEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const googleName = typeof payload.name === "string" ? payload.name.trim() : "";
      const emailVerified = payload.email_verified === true;
      const tokenNonce = typeof payload.nonce === "string" ? payload.nonce : "";

      if (!googleSub || !googleEmail || !emailVerified || tokenNonce !== nonceCookie) {
        res.status(401).send("تعذّر اعتماد هوية Google. تأكد من الحساب ثم أعد المحاولة.");
        return;
      }

      const openId = "google:" + googleSub;
      const user = await db.upsertGoogleUser({
        openId,
        name: googleName || googleEmail,
        email: googleEmail,
      });
      if (!user) {
        res.status(503).send("تم التحقق من Google، لكن تعذّر إنشاء جلسة الحساب. أعد المحاولة.");
        return;
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: googleName || googleEmail,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, sameSite: "lax", maxAge: ONE_YEAR_MS });

      const profile = await db.getStudentProfile(user.id);
      safeRedirect(res, profile && user.phone ? "/" : "/onboarding");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).send("حدث خطأ أثناء تسجيل الدخول باستخدام Google. حاول مرة أخرى.");
    }
  });
}
