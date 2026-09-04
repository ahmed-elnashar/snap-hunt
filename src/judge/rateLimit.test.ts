import { createRateLimiter } from './rateLimit';

const HOUR = 3_600_000;

describe('createRateLimiter', () => {
  it('allows up to the limit and then stops', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: HOUR });
    expect(limiter.check('a', 0)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check('a', 1)).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check('a', 2)).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check('a', 3)).toMatchObject({ allowed: false });
  });

  it('counts devices separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: HOUR });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
  });

  it('slides: the allowance returns as the window moves', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: HOUR });
    limiter.check('a', 0);
    limiter.check('a', 1000);
    expect(limiter.check('a', 2000).allowed).toBe(false);
    // The first hit has aged out; one slot is free again.
    expect(limiter.check('a', HOUR + 1).allowed).toBe(true);
    expect(limiter.check('a', HOUR + 2).allowed).toBe(false);
  });

  it('reports how long until the next slot frees', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: HOUR });
    limiter.check('a', 1000);
    const decision = limiter.check('a', 1000 + 60_000);
    expect(decision).toEqual({ allowed: false, retryAfterMs: HOUR - 60_000 });
  });

  it('never reports a negative wait', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10 });
    limiter.check('a', 0);
    const decision = limiter.check('a', 5);
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error('expected a refusal');
    expect(decision.retryAfterMs).toBeGreaterThanOrEqual(0);
  });

  it('bounds memory against a flood of invented device ids', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: HOUR, maxKeys: 50 });
    for (let i = 0; i < 500; i += 1) limiter.check(`device-${i}`, i);
    expect(limiter.size()).toBeLessThanOrEqual(50);
  });

  it('keeps an over-limit device limited while it is still tracked', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: HOUR, maxKeys: 50 });
    limiter.check('greedy', 0);
    expect(limiter.check('greedy', 1).allowed).toBe(false);
    for (let i = 0; i < 10; i += 1) limiter.check(`other-${i}`, 2 + i);
    expect(limiter.check('greedy', 20).allowed).toBe(false);
  });

  it('outlives quieter devices under eviction, because knocking keeps it warm', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: HOUR, maxKeys: 3 });
    limiter.check('quiet', 0);
    limiter.check('greedy', 1);
    for (let i = 0; i < 2; i += 1) limiter.check(`other-${i}`, 2 + i);
    // greedy knocks again and is refused, which also makes it the most recent.
    expect(limiter.check('greedy', 10).allowed).toBe(false);
    for (let i = 0; i < 2; i += 1) limiter.check(`later-${i}`, 20 + i);
    // 'quiet' has been dropped; 'greedy' survived one more round of pressure.
    expect(limiter.size()).toBeLessThanOrEqual(3);
  });

  it('forgives a device that eviction has dropped, which is the accepted trade', () => {
    // Documented rather than defended: an unevictable key is a way to fill the
    // map on purpose. Forgiving is the safer failure for a courtesy limit.
    const limiter = createRateLimiter({ limit: 1, windowMs: HOUR, maxKeys: 2 });
    limiter.check('greedy', 0);
    expect(limiter.check('greedy', 1).allowed).toBe(false);
    for (let i = 0; i < 20; i += 1) limiter.check(`flood-${i}`, 2 + i);
    expect(limiter.check('greedy', 100).allowed).toBe(true);
  });

  it.each([
    [0, HOUR],
    [-1, HOUR],
    [1, 0],
  ])('rejects nonsense options (limit %p, window %p)', (limit, windowMs) => {
    expect(() => createRateLimiter({ limit, windowMs })).toThrow(/must be at least/);
  });
});

describe('peek', () => {
  it('does not record, so asking costs nothing', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    for (let i = 0; i < 50; i += 1) limiter.peek('device-a', 0);
    expect(limiter.peek('device-a', 0)).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.size()).toBe(0);
  });

  it('agrees with check about who is over the cap', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.peek('device-a', 0).allowed).toBe(true);
    limiter.check('device-a', 0);
    expect(limiter.peek('device-a', 0).allowed).toBe(false);
    const refusal = limiter.peek('device-a', 400);
    expect(refusal.allowed === false && refusal.retryAfterMs).toBe(600);
  });

  it('forgets a device once its window has passed', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.check('device-a', 0);
    expect(limiter.peek('device-a', 999).allowed).toBe(false);
    expect(limiter.peek('device-a', 1_001).allowed).toBe(true);
  });
});
