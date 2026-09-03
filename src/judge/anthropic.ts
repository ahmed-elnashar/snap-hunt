import { parseVerdict, type Verdict } from './schema';
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeRequest,
  buildRepairRequest,
} from './systemPrompt';

/**
 * The call to the model. Server-side only — this module is imported by
 * app/api/judge+api.ts and by nothing the device bundles.
 *
 * Raw fetch rather than @anthropic-ai/sdk: EAS Hosting runs on Cloudflare
 * Workers, where the SDK's filesystem and dynamic-import assumptions are a
 * bundling risk, and one request shape does not need a client library.
 *
 * Never log `imageBase64`, and never log a request or response body that
 * contains it.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Pinned to the dated snapshot, not the `claude-haiku-4-5` alias. The judge's
 * character is calibrated against this exact model; an alias would let a model
 * update change it silently.
 */
export const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

/**
 * The ruling is four short fields. This is generous enough that truncation is
 * not a routine failure, which matters because a truncated object costs a
 * repair round trip.
 */
const MAX_TOKENS = 400;

/**
 * Total server budget. The device gives up at six seconds, so the server aims
 * to be finished before that even when a repair is needed.
 */
export const SERVER_BUDGET_MS = 5_000;

/** Below this much remaining budget, skip the repair and return unclear. */
const REPAIR_MIN_BUDGET_MS = 1_500;

/**
 * Sent to the model as `output_config.format`.
 *
 * Deliberately carries no `minimum`, `maximum`, `minLength` or `maxLength`:
 * structured outputs does not support numeric or string constraints and would
 * reject the schema. The caps in VerdictSchema are the real enforcement, which
 * is exactly why the out-of-range fixtures matter.
 */
export const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['accept', 'reject', 'unclear'] },
    confidence: { type: 'number' },
    detected: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['verdict', 'confidence', 'detected', 'reason'],
  additionalProperties: false,
} as const;

/**
 * What the judge says when its own answer came back illegible twice. Still in
 * character, and `unclear` means the generous tie-break awards the point.
 */
export const ILLEGIBLE_RULING: Verdict = {
  verdict: 'unclear',
  confidence: 0,
  detected: 'a submission I could not read',
  reason:
    'Something was in the frame and my notes on it are illegible. I will assume the best of you.',
};

export type JudgeOutcome =
  | { readonly ok: true; readonly verdict: Verdict; readonly repaired: boolean }
  | { readonly ok: false; readonly failure: 'upstream' };

export type RuleOnPhotographInput = {
  readonly apiKey: string;
  readonly promptText: string;
  readonly imageBase64: string;
  /** Injected so the pipeline can be tested without a network. */
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
};

type ContentBlock = { readonly type?: string; readonly text?: string };

function textFromMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return (content as ContentBlock[])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('\n');
}

export async function ruleOnPhotograph({
  apiKey,
  promptText,
  imageBase64,
  fetchImpl = fetch,
  now = Date.now,
}: RuleOnPhotographInput): Promise<JudgeOutcome> {
  const deadline = now() + SERVER_BUDGET_MS;

  const imageBlock = {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
  };

  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    {
      role: 'user',
      content: [imageBlock, { type: 'text', text: buildJudgeRequest(promptText) }],
    },
  ];

  async function callModel(): Promise<string | null> {
    const remaining = deadline - now();
    if (remaining <= 0) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetchImpl(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: JUDGE_MODEL,
          max_tokens: MAX_TOKENS,
          system: JUDGE_SYSTEM_PROMPT,
          // No `thinking` and no `output_config.effort`: Haiku 4.5 rejects
          // effort, and a judge in a timed game should not be thinking.
          output_config: {
            format: { type: 'json_schema', schema: VERDICT_JSON_SCHEMA },
          },
          messages,
        }),
      });

      if (!response.ok) return null;
      return textFromMessage(await response.json());
    } catch {
      // Network failure or abort. Never surface the cause: it can carry the
      // request body, and the request body is the player's photograph.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const first = await callModel();
  if (first === null) return { ok: false, failure: 'upstream' };

  const parsed = parseVerdict(first);
  if (parsed.ok) return { ok: true, verdict: parsed.verdict, repaired: false };

  // One repair attempt, sending the model its own malformed output — but only
  // if there is time left for it before the device stops waiting.
  if (deadline - now() < REPAIR_MIN_BUDGET_MS) {
    return { ok: true, verdict: ILLEGIBLE_RULING, repaired: true };
  }

  messages.push({ role: 'assistant', content: first });
  messages.push({
    role: 'user',
    content: buildRepairRequest(first, parsed.detail),
  });

  const repairedText = await callModel();
  if (repairedText === null) return { ok: false, failure: 'upstream' };

  const repaired = parseVerdict(repairedText);
  if (repaired.ok) return { ok: true, verdict: repaired.verdict, repaired: true };

  return { ok: true, verdict: ILLEGIBLE_RULING, repaired: true };
}
