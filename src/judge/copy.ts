import { type JudgeFailure } from './client';

/**
 * What the judge says when something goes wrong.
 *
 * Every user-facing string in this app is written by the judge, errors
 * included. "Network error" is a design failure, not a message. Keeping them
 * here rather than inline means they can be tested against the voice rules
 * rather than only reviewed by eye.
 */

export type FailureCopy = {
  /** The judge's sentence. */
  readonly ruling: string;
  /** Supporting line. Says what happened to the round. */
  readonly note: string;
  /** Button label. Never carries an arrow. */
  readonly action: string;
};

function waitPhrase(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) return 'within the hour';
  const minutes = Math.max(1, Math.round(retryAfterSeconds / 60));
  if (minutes >= 55) return 'in about an hour';
  if (minutes === 1) return 'in a minute';
  return `in about ${minutes} minutes`;
}

export function copyForFailure(
  reason: JudgeFailure,
  retryAfterSeconds?: number,
): FailureCopy {
  switch (reason) {
    case 'network':
      return {
        ruling: 'Nothing reached the office.',
        note: 'Your submission is unopened and the round is not spent. Hand it in again when you have a signal.',
        action: 'Hand it in again',
      };
    case 'timeout':
      return {
        ruling: 'The judge is still looking, and has been for longer than is reasonable.',
        note: 'No ruling was made, so the round still stands. Submit it again.',
        action: 'Submit it again',
      };
    case 'unparseable':
      return {
        ruling: 'The ruling came back in a hand I cannot read.',
        note: 'Nothing has been recorded against you. The round still stands.',
        action: 'Submit it again',
      };
    case 'ratelimit':
      return {
        ruling: `The judge is on lunch. Back ${waitPhrase(retryAfterSeconds)}.`,
        note: 'Forty thousand submissions is a considerable number, and the office keeps hours.',
        action: 'Very well',
      };
  }
}

/** Every failure the client can report, for exhaustiveness in tests. */
export const ALL_FAILURES: readonly JudgeFailure[] = [
  'network',
  'timeout',
  'unparseable',
  'ratelimit',
];
