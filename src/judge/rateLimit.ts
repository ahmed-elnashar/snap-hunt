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
   * Total requests allowed across every device in a window.
   *
   * The per-device cap alone does not bound spend: the device id arrives in a
   * header the client controls, so anyone can mint a fresh one per request and
   * the per-device limit never engages. This is the ceiling that actually
   * bounds the bill. It is deliberately far above real play — a player using
   * their whole hourly allowance is a rounding error against it — so reaching
   * it means something is wrong rather than that someone is enjoying the game.
   *
   * Omit for no global ceiling.
   */
  readonly globalLimit?: number;
  /**
   * Most devices this instance will track. Beyond it, the least recently seen
   * are dropped, so a stream of invented device ids cannot grow the map without
   * bound. Dropping a key is safe: it only forgives requests.
   */
  readonly maxKeys?: number;
};

export type RateLimiter = {
  /**
   * Would this device be allowed, without recording anything.
   *
   * Lets a caller refuse an over-limit device before reading its request body,
   * while still only charging the allowance once the request is known to be
   * worth charging for.
   */
  peek(key: string, now: number): RateLimitDecision;
  /** Records a hit and decides. */
  check(key: string, now: number): RateLimitDecision;
  /** Devices currently tracked. For tests and diagnostics. */
  size(): number;
  /** Hits counted against the global ceiling in the window. For tests. */
  globalSize(now: number): number;
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
  globalLimit,
}: RateLimiterOptions): RateLimiter {
  if (limit < 1) throw new Error(`limit must be at least 1: got ${limit}`);
  if (windowMs < 1) throw new Error(`windowMs must be at least 1: got ${windowMs}`);
  if (globalLimit !== undefined && globalLimit < limit) {
    throw new Error(
      `globalLimit must be at least limit (${limit}): got ${globalLimit}. ` +
        'A ceiling below the per-device cap would refuse a single honest player.',
    );
  }

  // Insertion-ordered, so the first key is the least recently touched.
  const hits = new Map<string, number[]>();
  /** Every hit in the window, regardless of device. Oldest first. */
  let globalHits: number[] = [];

  function evictIfCrowded(): void {
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done === true) break;
      hits.delete(oldest.value);
    }
  }

  /** Hits inside the window, oldest first. */
  function recentFor(key: string, now: number): number[] {
    const cutoff = now - windowMs;
    return (hits.get(key) ?? []).filter((at) => at > cutoff);
  }

  function refused(recent: number[], now: number): RateLimitDecision {
    // recent.length >= limit >= 1, so index 0 exists.
    const oldest = recent[0] as number;
    return { allowed: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }

  /** True once the whole service has spent its window. */
  function globalIsFull(now: number): boolean {
    if (globalLimit === undefined) return false;
    globalHits = globalHits.filter((at) => at > now - windowMs);
    return globalHits.length >= globalLimit;
  }

  return {
    peek(key, now) {
      if (globalIsFull(now)) return refused(globalHits, now);
      const recent = recentFor(key, now);
      return recent.length >= limit
        ? refused(recent, now)
        : { allowed: true, remaining: limit - recent.length };
    },

    check(key, now) {
      // Checked first: once the service ceiling is reached nobody is admitted,
      // and a refused request must not consume the ceiling it just hit.
      if (globalIsFull(now)) return refused(globalHits, now);

      const recent = recentFor(key, now);

      if (recent.length >= limit) {
        // Re-insert so a device that keeps knocking stays more recently used
        // than quieter ones, and so outlives them under eviction. It is not
        // pinned: a key that cannot be evicted is a way to fill the map on
        // purpose, and forgiving a device is the safer failure.
        hits.delete(key);
        hits.set(key, recent);
        return refused(recent, now);
      }

      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      evictIfCrowded();
      if (globalLimit !== undefined) globalHits.push(now);

      return { allowed: true, remaining: limit - recent.length };
    },

    size() {
      return hits.size;
    },

    globalSize(now) {
      globalHits = globalHits.filter((at) => at > now - windowMs);
      return globalHits.length;
    },
  };
}
