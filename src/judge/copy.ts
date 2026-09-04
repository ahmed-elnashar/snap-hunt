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

/**
 * What the judge says on a screen that is not a ruling.
 *
 * These lived inline in the route files, where the voice rules below could not
 * reach them — so the one part of the app the rules exist to protect was the
 * one part they did not cover. Accessibility hints stay in the components on
 * purpose: a VoiceOver hint describes what a control does, and dressing that
 * in character would cost a blind player clarity to buy a joke.
 */
export type ScreenCopy = {
  readonly ruling: string;
  readonly note: string;
  readonly action: string;
};

export const SCREEN_COPY = {
  /** Permission priming, before the OS dialog. */
  cameraPriming: {
    ruling: 'The judge cannot rule on a photograph it has not been shown.',
    note: 'The camera is used for one thing: the picture you hand in. It is sent to the judge, ruled on, and discarded. It is never stored, and no one else sees it.',
    action: 'Hand over the camera',
  },
  /** Refused permanently; only Settings can undo it. */
  cameraBlocked: {
    ruling: 'The camera has been withheld.',
    note: 'Nothing can be submitted until the office is permitted to look. Settings will let you reverse that; the round will be waiting.',
    action: 'Open Settings',
  },
  /** The request itself threw, so the OS never answered. */
  cameraAskFailed: {
    ruling: 'The camera was asked for and the question went unanswered.',
    note: 'Nothing has been decided and nothing is held against you. Ask again; the office keeps the file open.',
    action: 'Ask again',
  },
  /** The permission query has not come back at all. */
  cameraStalled: {
    ruling: "The camera's paperwork has not come back.",
    note: 'iOS was asked whether this office may look, and has not answered. Ask it again; nothing is lost either way.',
    action: 'Ask again',
  },
  /** The stored record could not be read within its bound. */
  recordUnreadable: {
    ruling: 'Your record is in a drawer that will not open.',
    note: 'Nothing has been lost. Starting you at nothing would be the greater error, so the office would rather try the drawer again.',
    action: 'Try the drawer again',
  },
  /** The clock ran out before a photograph was handed in. */
  timeExpired: {
    ruling: 'Time. The submission was not made.',
    note: 'No ruling, and nothing against you. Your streak is intact.',
    action: 'Take the next one',
  },
} as const satisfies Record<string, ScreenCopy>;

/** Every screen, for exhaustiveness in the voice tests. */
export const ALL_SCREENS = Object.keys(SCREEN_COPY) as (keyof typeof SCREEN_COPY)[];
