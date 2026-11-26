type AttemptWindow = { count: number; resetAt: number };

/** Bounded fixed-window limiter for the current single-replica deployment. */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, AttemptWindow>();
  private operations = 0;

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1_000,
    private readonly maxKeys = 10_000,
  ) {
    if (![maxAttempts, windowMs, maxKeys].every(Number.isSafeInteger) ||
        maxAttempts < 1 || windowMs < 1 || maxKeys < 1) {
      throw new Error("Rate limiter options must be positive safe integers.");
    }
  }

  isLimited(key: string, now = Date.now()): boolean {
    const bucket = this.getBucket(key, now, false);
    return Boolean(bucket && bucket.count >= this.maxAttempts);
  }

  record(key: string, now = Date.now()): void {
    const bucket = this.getBucket(key, now, true);
    if (bucket) bucket.count = Math.min(this.maxAttempts, bucket.count + 1);
  }

  consume(key: string, now = Date.now()): boolean {
    if (this.isLimited(key, now)) return false;
    this.record(key, now);
    return true;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private getBucket(key: string, now: number, create: boolean): AttemptWindow | undefined {
    this.operations += 1;
    if (this.operations % 128 === 0) this.pruneExpired(now);

    let bucket = this.buckets.get(key);
    if (bucket && bucket.resetAt <= now) {
      this.buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket && create) {
      if (this.buckets.size >= this.maxKeys) {
        const oldest = this.buckets.keys().next();
        if (!oldest.done) this.buckets.delete(oldest.value);
      }
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private pruneExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
