import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { withTimeout } from '@/util/withTimeout';

import { fitLongestEdge } from './fit';

/**
 * Prepares a captured photograph for submission to the judge.
 *
 * Never log the result. `base64` is the player's photograph.
 */

/** JPEG quality for the submitted image. See PLAN.md, judging pipeline. */
export const JUDGE_JPEG_QUALITY = 0.6;

/**
 * Local image work has no abort signal, so this bound races rather than
 * cancels. It exists so a wedged native module surfaces as an error the player
 * can act on instead of a shutter that never comes back.
 */
const PREPARE_TIMEOUT_MS = 8_000;

export type CapturedPhoto = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
};

export type PreparedImage = {
  readonly uri: string;
  readonly base64: string;
  readonly width: number;
  readonly height: number;
};

export async function prepareForJudge(photo: CapturedPhoto): Promise<PreparedImage> {
  const fit = fitLongestEdge(photo.width, photo.height);

  const context = ImageManipulator.manipulate(photo.uri);
  if (fit.needsResize) {
    // Constrain one axis and let the library derive the other, so the ratio is
    // preserved exactly rather than by two independent roundings.
    context.resize(
      fit.constrain === 'width' ? { width: fit.width } : { height: fit.height },
    );
  }

  const rendered = await withTimeout(
    context.renderAsync(),
    PREPARE_TIMEOUT_MS,
    'Preparing the photograph',
  );

  const saved = await withTimeout(
    rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: JUDGE_JPEG_QUALITY,
      base64: true,
    }),
    PREPARE_TIMEOUT_MS,
    'Encoding the photograph',
  );

  if (saved.base64 === undefined || saved.base64.length === 0) {
    throw new Error('The photograph encoded to nothing.');
  }

  return {
    uri: saved.uri,
    base64: saved.base64,
    width: saved.width,
    height: saved.height,
  };
}
