import { performance } from "node:perf_hooks";

const TIME_SOURCES = [
  { id: "google", url: "https://www.google.com/generate_204" },
  { id: "cloudflare", url: "https://www.cloudflare.com/cdn-cgi/trace" },
] as const;
const TIMEOUT_MS = 3_000;
const RESYNC_MS = 5 * 60 * 1_000;
const MAX_AGE_MS = 15 * 60 * 1_000;
const MAX_DISAGREEMENT_MS = 12_000;

export type NetworkTimeReading = {
  provider: string;
  timeAtReceiptMs: number;
  monotonicAtReceiptMs: number;
  roundTripMs: number;
};
export type NetworkTimeAnchor = {
  utcAtSyncMs: number;
  monotonicAtSyncMs: number;
  providers: string[];
};

let anchor: NetworkTimeAnchor | null = null;
let inFlight: Promise<void> | null = null;
let timerStarted = false;

export function reconcileNetworkTimeReadings(
  readings: NetworkTimeReading[],
  monotonicNowMs: number,
): NetworkTimeAnchor | null {
  if (!Number.isFinite(monotonicNowMs) || !readings.length) return null;
  const normalized = readings
    .filter(item => [item.timeAtReceiptMs, item.monotonicAtReceiptMs, item.roundTripMs].every(Number.isFinite)
      && item.timeAtReceiptMs > 0 && monotonicNowMs >= item.monotonicAtReceiptMs)
    .map(item => ({
      provider: item.provider,
      utcNowMs: item.timeAtReceiptMs + monotonicNowMs - item.monotonicAtReceiptMs,
    }))
    .sort((a, b) => a.utcNowMs - b.utcNowMs);
  if (!normalized.length) return null;
  if (normalized.length > 1
    && normalized[normalized.length - 1].utcNowMs - normalized[0].utcNowMs > MAX_DISAGREEMENT_MS) {
    return null;
  }
  const midpoint = Math.floor(normalized.length / 2);
  const utcAtSyncMs = normalized.length % 2
    ? normalized[midpoint].utcNowMs
    : (normalized[midpoint - 1].utcNowMs + normalized[midpoint].utcNowMs) / 2;
  return {
    utcAtSyncMs,
    monotonicAtSyncMs: monotonicNowMs,
    providers: normalized.map(item => item.provider),
  };
}

async function readTimeSource(source: typeof TIME_SOURCES[number]): Promise<NetworkTimeReading> {
  const started = performance.now();
  const response = await fetch(source.url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "*/*" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const received = performance.now();
  if (!response.ok) throw new Error(source.id + " returned HTTP " + response.status + ".");
  const header = response.headers.get("date");
  const headerTime = header ? Date.parse(header) : Number.NaN;
  if (!Number.isFinite(headerTime)) throw new Error(source.id + " returned no valid HTTP Date header.");
  if (response.body) await response.body.cancel().catch(() => undefined);
  const roundTripMs = received - started;
  return {
    provider: source.id,
    timeAtReceiptMs: headerTime + roundTripMs / 2,
    monotonicAtReceiptMs: received,
    roundTripMs,
  };
}

export async function refreshNetworkTime() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const results = await Promise.allSettled(TIME_SOURCES.map(readTimeSource));
    const readings = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    const next = reconcileNetworkTimeReadings(readings, performance.now());
    if (next) {
      anchor = next;
      console.info("[Network clock] Internet time synchronized.", { providers: next.providers });
    } else if (readings.length > 1) {
      console.warn("[Network clock] Time providers disagreed; keeping the last valid sample.");
    } else if (readings.length === 0) {
      console.warn("[Network clock] Internet time is unavailable; using the application server clock.");
    }
  })().catch(error => {
    console.warn("[Network clock] Synchronization failed:", error instanceof Error ? error.message : String(error));
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function startNetworkTimeSync() {
  if (timerStarted) return;
  timerStarted = true;
  void refreshNetworkTime();
  const timer = setInterval(() => void refreshNetworkTime(), RESYNC_MS);
  timer.unref?.();
}

export function getNetworkTimeSnapshot() {
  if (anchor) {
    const ageMs = performance.now() - anchor.monotonicAtSyncMs;
    if (ageMs >= 0 && ageMs <= MAX_AGE_MS) {
      return {
        serverTimeMs: anchor.utcAtSyncMs + ageMs,
        source: "internet" as const,
        synchronizedAtMs: anchor.utcAtSyncMs,
        providers: anchor.providers,
      };
    }
  }
  return {
    serverTimeMs: Date.now(),
    source: "application-server" as const,
    synchronizedAtMs: null,
    providers: [],
  };
}
