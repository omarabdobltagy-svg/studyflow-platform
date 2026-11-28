import { isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";

type ClientIpRequest = {
  headers: IncomingHttpHeaders;
  ip?: string;
  socket?: { remoteAddress?: string };
};

/**
 * Railway's public HTTP edge overwrites X-Real-IP with the connecting client IP.
 * This deployment has no untrusted services on the private environment network;
 * those private callers remain inside the deployment's trust boundary.
 *
 * Do not use Express req.ip / X-Forwarded-For hop positions here: Express does
 * not consume X-Real-IP, and Railway does not promise a fixed proxy hop count.
 */
export function getRateLimitClientIp(request: ClientIpRequest): string {
  const header = request.headers["x-real-ip"];
  const candidate = Array.isArray(header) ? header[0] : header;
  const publicEdgeIp = typeof candidate === "string" ? candidate.trim() : "";
  if (publicEdgeIp && isIP(publicEdgeIp)) return publicEdgeIp;

  const expressIp = typeof request.ip === "string" ? request.ip.trim() : "";
  if (expressIp && isIP(expressIp)) return expressIp;

  const socketIp = typeof request.socket?.remoteAddress === "string"
    ? request.socket.remoteAddress.trim()
    : "";
  if (socketIp && isIP(socketIp)) return socketIp;

  return "unknown";
}
