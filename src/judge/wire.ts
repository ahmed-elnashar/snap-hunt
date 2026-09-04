import { z } from 'zod';

import { VerdictSchema } from './schema';

/**
 * The contract between the device and /api/judge, in one place so the two ends
 * cannot drift. Both directions are Zod-validated at the boundary: the server
 * does not trust the device, and the device does not trust the server.
 */

/**
 * A 1024px JPEG at quality 0.6 is typically 100-300 KB, so roughly 140-400 KB
 * of base64. This ceiling is generous enough to never reject a real submission
 * and small enough that a malicious body cannot occupy a worker.
 */
export const MAX_IMAGE_BASE64_CHARS = 2_000_000;

/**
 * Ceiling on the declared body size, checked from `content-length` before the
 * body is read.
 *
 * MAX_IMAGE_BASE64_CHARS alone does not keep a large body out of the worker:
 * it is a Zod check, and Zod runs after `request.json()` has already buffered
 * the whole thing. This is the check that happens first. It is generous enough
 * to clear the largest legitimate submission plus its JSON envelope.
 *
 * A chunked request declares no length, so this cannot be the only defence —
 * the Zod cap still backs it up.
 */
export const MAX_REQUEST_BYTES = 2_200_000;

/** Header carrying the anonymous device id used only for rate limiting. */
export const DEVICE_ID_HEADER = 'x-snap-hunt-device';

export const DeviceIdSchema = z.string().min(8).max(64);

export const JudgeRequestSchema = z.object({
  promptId: z.string().min(1).max(64),
  promptText: z.string().min(1).max(120),
  /** Raw base64, no data: URI prefix. Never logged. */
  imageBase64: z.string().min(64).max(MAX_IMAGE_BASE64_CHARS),
});

export type JudgeRequest = z.infer<typeof JudgeRequestSchema>;

export const JudgeSuccessSchema = z.object({
  ok: z.literal(true),
  verdict: VerdictSchema,
  /** True when the first response had to be sent back for repair. */
  repaired: z.boolean(),
});

/**
 * Failure codes, not sentences. The device owns every user-facing string, so
 * the judge's voice lives in the app rather than being assembled across a
 * network boundary.
 */
export const JUDGE_ERRORS = ['ratelimit', 'bad-request', 'upstream'] as const;

export const JudgeErrorSchema = z.object({
  ok: z.literal(false),
  error: z.enum(JUDGE_ERRORS),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
});

export const JudgeResponseSchema = z.discriminatedUnion('ok', [
  JudgeSuccessSchema,
  JudgeErrorSchema,
]);

export type JudgeResponse = z.infer<typeof JudgeResponseSchema>;
