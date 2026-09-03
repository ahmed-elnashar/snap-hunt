import { type Verdict } from './schema';
import { DEVICE_ID_HEADER, JudgeResponseSchema } from './wire';

/**
 * The device side of the judging call. Knows the API's address and nothing
 * about its key.
 */

/** The device stops waiting here. PLAN.md: abort after six seconds. */
export const JUDGE_TIMEOUT_MS = 6_000;

/** Mirrors the `failed` reasons on RoundState. */
export type JudgeFailure = 'network' | 'timeout' | 'unparseable' | 'ratelimit';

export type JudgeResult =
  | { readonly kind: 'verdict'; readonly verdict: Verdict; readonly repaired: boolean }
  | {
      readonly kind: 'failed';
      readonly reason: JudgeFailure;
      readonly retryAfterSeconds?: number;
    };

/**
 * Builds the endpoint from EXPO_PUBLIC_API_URL.
 *
 * An absolute URL rather than a relative `/api/judge`: on native there is no
 * same-origin, and resolving a relative route needs either a baked `origin` or
 * EXPO_UNSTABLE_DEPLOY_SERVER, which conflict with each other. One variable
 * also means the backend can move without touching app code.
 *
 * The URL is an address, not a credential, so EXPO_PUBLIC_ is correct for it.
 */
export function resolveJudgeUrl(base: string | undefined): string | null {
  if (base === undefined) return null;
  const trimmed = base.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) return null;
  if (!/^https?:\/\//.test(trimmed)) return null;
  return `${trimmed}/api/judge`;
}

export type AskTheJudgeInput = {
  readonly promptId: string;
  readonly promptText: string;
  readonly imageBase64: string;
  readonly deviceId: string;
  readonly baseUrl?: string | undefined;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

export async function askTheJudge({
  promptId,
  promptText,
  imageBase64,
  deviceId,
  baseUrl = process.env.EXPO_PUBLIC_API_URL,
  fetchImpl = fetch,
  timeoutMs = JUDGE_TIMEOUT_MS,
}: AskTheJudgeInput): Promise<JudgeResult> {
  const url = resolveJudgeUrl(baseUrl);
  if (url === null) return { kind: 'failed', reason: 'network' };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [DEVICE_ID_HEADER]: deviceId,
      },
      signal: controller.signal,
      body: JSON.stringify({ promptId, promptText, imageBase64 }),
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'failed', reason: 'unparseable' };
    }

    // Our own server is still a boundary; its response is validated like any
    // other. A deploy skew that changes the shape must not reach the UI.
    const parsed = JudgeResponseSchema.safeParse(body);
    if (!parsed.success) return { kind: 'failed', reason: 'unparseable' };

    if (parsed.data.ok) {
      return {
        kind: 'verdict',
        verdict: parsed.data.verdict,
        repaired: parsed.data.repaired,
      };
    }

    if (parsed.data.error === 'ratelimit') {
      const { retryAfterSeconds } = parsed.data;
      return retryAfterSeconds === undefined
        ? { kind: 'failed', reason: 'ratelimit' }
        : { kind: 'failed', reason: 'ratelimit', retryAfterSeconds };
    }

    return { kind: 'failed', reason: 'network' };
  } catch {
    return { kind: 'failed', reason: timedOut ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
