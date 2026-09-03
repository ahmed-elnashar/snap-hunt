/**
 * Longest-edge fit for the image sent to the judge.
 *
 * Pure. The impure resize lives in downscale.ts; this is the arithmetic, so it
 * can be tested without a camera, a file system, or a native module.
 */

/** The longest edge the judge is sent. See PLAN.md, judging pipeline. */
export const JUDGE_MAX_EDGE = 1024;

export type Fit = {
  readonly width: number;
  readonly height: number;
  /** False when the source is already within the limit. */
  readonly needsResize: boolean;
  /** Which axis to hand the resizer; the other is derived from the ratio. */
  readonly constrain: 'width' | 'height';
};

/**
 * Scales `width` x `height` so its longest edge is at most `maxEdge`, preserving
 * the aspect ratio.
 *
 * Never upscales: enlarging a photograph adds bytes and latency without adding
 * any information for the model to look at.
 */
export function fitLongestEdge(
  width: number,
  height: number,
  maxEdge: number = JUDGE_MAX_EDGE,
): Fit {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Image dimensions must be finite: got ${width}x${height}`);
  }
  if (width <= 0 || height <= 0) {
    throw new Error(`Image dimensions must be positive: got ${width}x${height}`);
  }
  if (maxEdge <= 0) {
    throw new Error(`maxEdge must be positive: got ${maxEdge}`);
  }

  const constrain = width >= height ? 'width' : 'height';
  const longest = Math.max(width, height);

  if (longest <= maxEdge) {
    return { width, height, needsResize: false, constrain };
  }

  const scale = maxEdge / longest;
  return {
    // The constrained axis is exact; the other is rounded and floored at 1 so a
    // very wide panorama cannot round its short edge away to zero.
    width: constrain === 'width' ? maxEdge : Math.max(1, Math.round(width * scale)),
    height: constrain === 'height' ? maxEdge : Math.max(1, Math.round(height * scale)),
    needsResize: true,
    constrain,
  };
}
