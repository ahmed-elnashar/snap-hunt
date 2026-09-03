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
 * Per device, per hour. Generous for playing, small enough that a runaway
 * client cannot spend the budget. Module scope, so it survives between requests
 * in the same instance — and resets when that instance recycles. A courtesy
 * limit, not a billing control; the README says so rather than implying more.
 */
const limiter = createRateLimiter({ limit: 60, windowMs: 3_600_000 });

const handle = createJudgeHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  limiter,
  rule: ruleOnPhotograph,
});

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
