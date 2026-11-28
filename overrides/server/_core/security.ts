const DEFAULT_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Permitted-Cross-Domain-Policies": "none",
} as const;

/** Security headers suitable for the same-origin StudyFlow web application. */
export function getSecurityHeaders(isSecureTransport: boolean): Record<string, string> {
  return {
    ...DEFAULT_SECURITY_HEADERS,
    ...(isSecureTransport ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

function firstHeaderValue(value: string): string {
  return value.split(",")[0].trim();
}

/**
 * Browser-origin validation for state-changing cookie-authenticated requests.
 * Missing Origin is allowed for non-browser integrations; callers should also
 * reject Fetch Metadata explicitly marked as cross-site.
 */
export function isAllowedSameOrigin(
  origin: string | undefined,
  host: string,
  protocol: string,
): boolean {
  if (!origin) return true;
  const expectedHost = firstHeaderValue(host).toLowerCase();
  const expectedProtocol = firstHeaderValue(protocol).replace(/:$/, "").toLowerCase();
  if (!expectedHost || !["http", "https"].includes(expectedProtocol)) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:")
      && parsed.host.toLowerCase() === expectedHost
      && parsed.protocol.slice(0, -1) === expectedProtocol;
  } catch {
    return false;
  }
}
