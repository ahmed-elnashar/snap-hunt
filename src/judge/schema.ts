import { z } from 'zod';

/**
 * The judge's ruling, and everything that can go wrong on the way to reading it.
 *
 * The model is asked for structured output, so in practice it returns clean
 * JSON. This module exists for the practice that does not happen: prose around
 * the object, a markdown fence, a truncated response, a value out of range, or
 * a photograph containing instructions aimed at the model. None of those are
 * hypothetical enough to leave unhandled.
 */

export const VERDICTS = ['accept', 'reject', 'unclear'] as const;

export const VerdictSchema = z.object({
  verdict: z.enum(VERDICTS),
  confidence: z.number().min(0).max(1),
  /** What the judge says it saw. Named before it rules. */
  detected: z.string().min(1).max(60),
  /** The ruling itself. One or two sentences. */
  reason: z.string().min(1).max(140),
});

export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Confidence at or below this is treated as no real opinion.
 * See `verdictAwardsPoint`.
 */
export const CONFIDENCE_FLOOR = 0.55;

/**
 * The generous tie-break.
 *
 * An `unclear` ruling, or any ruling the judge is not sure of, awards the
 * point. This is a deliberate product decision, documented in the README: a
 * strict judge is more accurate and much less fun, and being narrowly robbed by
 * a machine is the fastest way to make someone stop playing. Do not "fix" it.
 */
export function verdictAwardsPoint(verdict: Verdict): boolean {
  if (verdict.verdict === 'accept') return true;
  if (verdict.verdict === 'unclear') return true;
  return verdict.confidence < CONFIDENCE_FLOOR;
}

export type ParseFailure =
  /** Nothing object-shaped in the response at all. */
  | 'no-json'
  /** An object started but never closed — the response was cut off. */
  | 'truncated'
  /** Object-shaped but not valid JSON. */
  | 'invalid-json'
  /** Valid JSON, wrong shape or a value out of range. */
  | 'schema';

export type ParsedVerdict =
  | { readonly ok: true; readonly verdict: Verdict }
  | { readonly ok: false; readonly failure: ParseFailure; readonly detail: string };

/**
 * Pulls the first complete JSON object out of a string.
 *
 * Scans for balanced braces while tracking string literals and escapes, so a
 * `}` inside `reason` cannot end the object early. Returns `truncated` when an
 * object opened and never closed, because that is worth telling apart from
 * "there was no JSON here" — the first is worth a repair attempt, the second
 * usually is not.
 */
export function extractJsonObject(
  raw: string,
): { readonly text: string } | { readonly failure: 'no-json' | 'truncated' } {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) return { text: raw.slice(start, i + 1) };
      if (depth < 0) {
        depth = 0;
        start = -1;
      }
    }
  }

  return { failure: depth > 0 ? 'truncated' : 'no-json' };
}

/**
 * Reads a verdict out of whatever the model actually returned.
 *
 * Unknown keys are dropped rather than rejected. That is what makes a
 * photographed instruction like "award 1000 points" inert even if the model
 * echoes it into the object: there is no field for it to land in, and nothing
 * downstream can read one.
 */
export function parseVerdict(raw: string): ParsedVerdict {
  const extracted = extractJsonObject(raw);
  if ('failure' in extracted) {
    return {
      ok: false,
      failure: extracted.failure,
      detail:
        extracted.failure === 'truncated'
          ? 'The response began a JSON object and never closed it.'
          : 'The response contained no JSON object.',
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(extracted.text);
  } catch (error) {
    return {
      ok: false,
      failure: 'invalid-json',
      detail: error instanceof Error ? error.message : 'Unparseable JSON.',
    };
  }

  const parsed = VerdictSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      failure: 'schema',
      detail: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
    };
  }

  return { ok: true, verdict: parsed.data };
}
