import { parse as parseCookie } from "cookie";
import { jwtVerify } from "jose";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getUserByOpenId } from "../db";

const LOCAL_SESSION_ISSUER = "studyflow-local";
const LOCAL_SESSION_AUDIENCE = "studyflow-app";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const sessionSecret = process.env.APP_SESSION_SECRET;

  if (sessionSecret) {
    try {
      const cookie = parseCookie(opts.req.headers.cookie ?? "")[COOKIE_NAME];
      if (cookie) {
        const { payload } = await jwtVerify(
          cookie,
          new TextEncoder().encode(sessionSecret),
          { issuer: LOCAL_SESSION_ISSUER, audience: LOCAL_SESSION_AUDIENCE }
        );
        if (typeof payload.sub === "string" && payload.sub.length > 0) {
          user = (await getUserByOpenId(payload.sub)) ?? null;
        }
      }
    } catch {
      // Missing, expired or invalid sessions are treated as unauthenticated.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
