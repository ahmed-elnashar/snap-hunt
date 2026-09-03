/**
 * A per-device hourly cap, so one device cannot spend the project's API budget.
 *
 * In-memory and therefore per-instance: on a serverless host the counter resets
 * when an instance recycles, and two instances do not share a view. That is
 * accepted — this is a courtesy limit against accidental loops and casual
 * abuse, not a billing control. PLAN.md says in-memory is fine; the README
 * says so out loud rather than implying something stronger.
 *
 * Pure apart from the clock, which is passed in.
 */

export type RateLimitDecision =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterMs: number };

export type RateLimiterOptions = {
  readonly limit: number;
  readonly windowMs: number;
  /**
   * Most devices this instance will track. Beyond it, the least recently seen
   * are dropped, so a stream of invented device ids cannot grow the map without
   * bound. Dropping a key is safe: it only forgives requests.
   */
  readonly maxKeys?: number;
};

export type RateLimiter = {
  check(key: string, now: number): RateLimitDecision;
  /** Devices currently tracked. For tests and diagnostics. */
  size(): number;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: RateLimiterOptions): RateLimiter {
  if (limit < 1) throw new Error(`limit must be at least 1: got ${limit}`);
  if (windowMs < 1) throw new Error(`windowMs must be at least 1: got ${windowMs}`);

  // Insertion-ordered, so the first key is the least recently touched.
  const hits = new Map<string, number[]>();

  function evictIfCrowded(): void {
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done === true) break;
      hits.delete(oldest.value);
    }
  }

  return {
    check(key, now) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

      if (recent.length >= limit) {
        // Re-insert so a device that keeps knocking stays more recently used
        // than quieter ones, and so outlives them under eviction. It is not
        // pinned: a key that cannot be evicted is a way to fill the map on
        // purpose, and forgiving a device is the safer failure.
        hits.delete(key);
        hits.set(key, recent);
        const oldest = recent[0] as number;
        return { allowed: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
      }

      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      evictIfCrowded();

      return { allowed: true, remaining: limit - recent.length };
    },

    size() {
      return hits.size;
    },
  };
}
