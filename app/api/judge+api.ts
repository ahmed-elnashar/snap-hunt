import { ruleOnPhotograph } from '@/judge/anthropic';
import { createJudgeHandler } from '@/judge/handler';
import { createRateLimiter } from '@/judge/rateLimit';

/**
 * The judge's chambers. This is the ONLY place the Anthropic API key is read.
 *
 * It is taken from the server environment, never returned, never logged, and
 * sent nowhere but api.anthropic.com. CI builds the client bundle and greps it
 * for key material; a hit fails the build.
 *
 * The handler itself is in src/judge/handler.ts. Routes stay thin.
 */

/**
 * Two ceilings, per hour.
 *
 * `limit` is per device: generous for playing, small enough that a runaway
 * client cannot spend the budget. On its own it bounds nothing, because the
 * device id arrives in a header the client controls — anyone can mint a fresh
 * one per request and never engage it.
 *
 * `globalLimit` is the one that actually bounds the bill. 600/hour is ten
 * honest players at their full allowance, so real play will not reach it; a
 * public endpoint on a public repo will, if someone decides to hold the button
 * down. When it is reached everyone gets the judge's lunch break rather than
 * an unbounded invoice.
 *
 * Module scope, so both survive between requests in the same instance — and
 * reset when it recycles. Per-instance, so this is a brake, not a billing
 * control. The account spend limit is the real backstop; the README says so
 * rather than implying more.
 */
const limiter = createRateLimiter({
  limit: 60,
  globalLimit: 600,
  windowMs: 3_600_000,
});

const handle = createJudgeHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  limiter,
  rule: ruleOnPhotograph,
});

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
