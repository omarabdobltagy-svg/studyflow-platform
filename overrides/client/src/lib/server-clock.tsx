import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

export type ServerClockAnchor = {
  serverTimeAtReceiptMs: number;
  monotonicAtReceiptMs: number;
  roundTripMs: number;
};
export type ServerClockStatus = "syncing" | "synced" | "stale" | "unavailable";
export type ServerClockValue = {
  now: Date | null;
  status: ServerClockStatus;
  lastSynchronizedAt: Date | null;
  refresh: () => Promise<void>;
};

const REFRESH_MS = 5 * 60 * 1_000;
const STALE_AFTER_MS = 15 * 60 * 1_000;

export function createServerClockAnchor(serverTimeMs: number, requestStartedAtMs: number, responseReceivedAtMs: number): ServerClockAnchor {
  if (![serverTimeMs, requestStartedAtMs, responseReceivedAtMs].every(Number.isFinite)) {
    throw new Error("Server clock samples must be finite numbers.");
  }
  if (serverTimeMs <= 0 || responseReceivedAtMs < requestStartedAtMs) {
    throw new Error("Server clock sample is invalid.");
  }
  const roundTripMs = responseReceivedAtMs - requestStartedAtMs;
  return {
    serverTimeAtReceiptMs: serverTimeMs + roundTripMs / 2,
    monotonicAtReceiptMs: responseReceivedAtMs,
    roundTripMs,
  };
}

export function estimateServerTimeMs(anchor: ServerClockAnchor, monotonicNowMs: number): number {
  if (!Number.isFinite(monotonicNowMs)) throw new Error("A valid monotonic timestamp is required.");
  return anchor.serverTimeAtReceiptMs + Math.max(0, monotonicNowMs - anchor.monotonicAtReceiptMs);
}

const ServerClockContext = createContext<ServerClockValue | null>(null);

export function ServerClockProvider({ children }: { children: ReactNode }) {
  const [anchor, setAnchor] = useState<ServerClockAnchor | null>(null);
  const [syncStatus, setSyncStatus] = useState<ServerClockStatus>("syncing");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || typeof performance === "undefined") return;
    const requestStartedAtMs = performance.now();
    try {
      const response = await fetch("/api/system/time", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Server clock request failed with HTTP " + response.status + ".");
      const payload = await response.json() as { serverTimeMs?: unknown };
      const responseReceivedAtMs = performance.now();
      const serverTimeMs = Number(payload.serverTimeMs);
      if (!Number.isFinite(serverTimeMs) || serverTimeMs <= 0) throw new Error("Invalid server time.");
      setAnchor(createServerClockAnchor(serverTimeMs, requestStartedAtMs, responseReceivedAtMs));
      setSyncStatus("synced");
    } catch {
      setSyncStatus(current => current === "syncing" || current === "unavailable" ? "unavailable" : "stale");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tickTimer = window.setInterval(() => setTick(value => value + 1), 1_000);
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    const refreshOnFocus = () => void refresh();
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.clearInterval(tickTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [refresh]);

  void tick;
  const now = useMemo(() => {
    if (!anchor || typeof performance === "undefined") return null;
    return new Date(estimateServerTimeMs(anchor, performance.now()));
  }, [anchor, tick]);

  const status = useMemo<ServerClockStatus>(() => {
    if (!anchor) return syncStatus;
    if (syncStatus === "stale") return "stale";
    if (typeof performance !== "undefined" && performance.now() - anchor.monotonicAtReceiptMs > STALE_AFTER_MS) return "stale";
    return "synced";
  }, [anchor, syncStatus, tick]);

  const value = useMemo<ServerClockValue>(() => ({
    now,
    status,
    lastSynchronizedAt: anchor ? new Date(anchor.serverTimeAtReceiptMs) : null,
    refresh,
  }), [now, status, anchor, refresh]);

  return <ServerClockContext.Provider value={value}>{children}</ServerClockContext.Provider>;
}

export function useServerClock(): ServerClockValue {
  const value = useContext(ServerClockContext);
  if (!value) throw new Error("useServerClock must be used inside ServerClockProvider.");
  return value;
}
