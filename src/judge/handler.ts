import { type JudgeOutcome, type RuleOnPhotographInput } from './anthropic';
import { type RateLimiter } from './rateLimit';
import {
  DEVICE_ID_HEADER,
  DeviceIdSchema,
  JudgeRequestSchema,
  MAX_REQUEST_BYTES,
  type JudgeResponse,
} from './wire';

/**
 * The /api/judge handler, separated from the route file so it can be tested
 * against real Request and Response objects with no network and no key.
 *
 * Routes are thin; business logic lives here. Nothing in this module logs a
 * request or response body — the body is the player's photograph, and an image
 * in a log is an image that has been stored.
 */

export type JudgeHandlerDeps = {
  /** Read from the server environment by the route. Never returned to anyone. */
  readonly apiKey: string | undefined;
  readonly limiter: RateLimiter;
  readonly rule: (input: RuleOnPhotographInput) => Promise<JudgeOutcome>;
  readonly now?: () => number;
};

function json(body: JudgeResponse, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function refuse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return json({ ok: false, error: 'ratelimit', retryAfterSeconds }, 429, {
    'retry-after': String(retryAfterSeconds),
  });
}

export function createJudgeHandler({
  apiKey,
  limiter,
  rule,
  now = Date.now,
}: JudgeHandlerDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (apiKey === undefined || apiKey.length === 0) {
      // A misconfigured server is an upstream problem from the device's side.
      // Saying more would describe our own deployment to a stranger.
      return json({ ok: false, error: 'upstream' }, 503);
    }

    const device = DeviceIdSchema.safeParse(request.headers.get(DEVICE_ID_HEADER));
    if (!device.success) return json({ ok: false, error: 'bad-request' }, 400);

    // Before the body is read, so an oversized one is refused rather than
    // buffered. Absent on a chunked request; the Zod cap backs it up.
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      return json({ ok: false, error: 'bad-request' }, 413);
    }

    // Peek before reading the body, so a device that is already over its cap
    // costs this worker nothing: it is answered without its photograph ever
    // being buffered. The allowance is spent further down, once the request
    // has proved itself well formed.
    const before = limiter.peek(device.data, now());
    if (!before.allowed) return refuse(before.retryAfterMs);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ ok: false, error: 'bad-request' }, 400);
    }

    const parsed = JudgeRequestSchema.safeParse(raw);
    if (!parsed.success) {
      // The Zod issues are not returned: they quote the offending value, and
      // the offending value can be the photograph.
      return json({ ok: false, error: 'bad-request' }, 400);
    }

    // Charged only now the request is known to be well formed. The limit exists
    // so one device cannot spend the API budget, and a malformed request spends
    // none of it — taking an hourly allowance away for a client bug would cost
    // the player rounds they never got to play.
    const decision = limiter.check(device.data, now());
    if (!decision.allowed) return refuse(decision.retryAfterMs);

    const outcome = await rule({
      apiKey,
      promptText: parsed.data.promptText,
      imageBase64: parsed.data.imageBase64,
    });

    if (!outcome.ok) return json({ ok: false, error: 'upstream' }, 502);

    return json({ ok: true, verdict: outcome.verdict, repaired: outcome.repaired }, 200, {
      'cache-control': 'no-store',
    });
  };
}
