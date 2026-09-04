import { type JudgeFailure } from '@/judge/client';
import { type Verdict } from '@/judge/schema';

import { type Prompt } from './prompts';
import { ROUND_MS } from './scoring';

/**
 * The round state machine. Pure: no React, no clock, no network.
 *
 * Every transition is a named action, and an action that does not apply to the
 * current state returns the state unchanged rather than throwing. That is not
 * laziness — it is the whole reason this is a machine. Two races are certain to
 * happen on a real phone:
 *
 *   - the timer expires while the shutter is already firing
 *   - a verdict arrives after the round has expired or been abandoned
 *
 * Both are handled here, once, where they can be tested, rather than in a
 * component with a pile of guards.
 */

export type RoundState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'prompted';
      readonly prompt: Prompt;
      readonly startedAt: number;
      /** Null for the untimed first round. The tutorial is unlosable. */
      readonly deadlineAt: number | null;
    }
  | {
      readonly kind: 'captured';
      readonly prompt: Prompt;
      readonly uri: string;
      readonly elapsedMs: number;
    }
  | {
      readonly kind: 'judging';
      readonly prompt: Prompt;
      readonly uri: string;
      readonly elapsedMs: number;
    }
  | {
      readonly kind: 'verdict';
      readonly prompt: Prompt;
      readonly uri: string;
      readonly verdict: Verdict;
      readonly points: number;
      readonly streakAfter: number;
    }
  | { readonly kind: 'expired'; readonly prompt: Prompt }
  | {
      readonly kind: 'failed';
      readonly prompt: Prompt;
      readonly uri: string;
      readonly elapsedMs: number;
      readonly reason: JudgeFailure;
    };

export type RoundAction =
  | {
      readonly type: 'roundStarted';
      readonly prompt: Prompt;
      readonly at: number;
      /** Omit or pass false for the untimed first round. */
      readonly timed?: boolean;
      readonly durationMs?: number;
    }
  | { readonly type: 'shutterFired'; readonly uri: string; readonly at: number }
  | { readonly type: 'judgingStarted' }
  | {
      readonly type: 'verdictReturned';
      readonly verdict: Verdict;
      readonly points: number;
      readonly streakAfter: number;
    }
  | { readonly type: 'judgingFailed'; readonly reason: JudgeFailure }
  | { readonly type: 'retried' }
  | { readonly type: 'timeExpired' }
  | { readonly type: 'dismissed' };

export const initialRoundState: RoundState = { kind: 'idle' };

/** Milliseconds left, or null when the round is untimed or not running. */
export function remainingMs(state: RoundState, now: number): number | null {
  if (state.kind !== 'prompted' || state.deadlineAt === null) return null;
  return Math.max(0, state.deadlineAt - now);
}

/** True once the clock has run out, so the caller does not compare by hand. */
export function hasExpired(state: RoundState, now: number): boolean {
  const left = remainingMs(state, now);
  return left !== null && left <= 0;
}

export function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'roundStarted': {
      const timed = action.timed ?? true;
      return {
        kind: 'prompted',
        prompt: action.prompt,
        startedAt: action.at,
        deadlineAt: timed ? action.at + (action.durationMs ?? ROUND_MS) : null,
      };
    }

    case 'shutterFired': {
      // Only a running round can be photographed. A late shutter — one that
      // fires after expiry has already been processed — is ignored.
      if (state.kind !== 'prompted') return state;
      return {
        kind: 'captured',
        prompt: state.prompt,
        uri: action.uri,
        elapsedMs: Math.max(0, action.at - state.startedAt),
      };
    }

    case 'judgingStarted': {
      // One action per transition: this is captured -> judging. Re-entry after
      // a failure is `retried`, which is a different thing that happens for a
      // different reason.
      if (state.kind !== 'captured') return state;
      return {
        kind: 'judging',
        prompt: state.prompt,
        uri: state.uri,
        elapsedMs: state.elapsedMs,
      };
    }

    case 'verdictReturned': {
      // The race the brief names: a verdict arriving after the round expired,
      // or after the player walked away. It is dropped. A ruling on a round
      // that is over must not resurrect it or score into it.
      if (state.kind !== 'judging') return state;
      return {
        kind: 'verdict',
        prompt: state.prompt,
        uri: state.uri,
        verdict: action.verdict,
        points: action.points,
        streakAfter: action.streakAfter,
      };
    }

    case 'judgingFailed': {
      if (state.kind !== 'judging') return state;
      return {
        kind: 'failed',
        prompt: state.prompt,
        uri: state.uri,
        elapsedMs: state.elapsedMs,
        reason: action.reason,
      };
    }

    case 'retried': {
      // Re-submits the same photograph. The round was never spent, so the
      // elapsed time the player achieved is carried through unchanged.
      if (state.kind !== 'failed') return state;
      return {
        kind: 'judging',
        prompt: state.prompt,
        uri: state.uri,
        elapsedMs: state.elapsedMs,
      };
    }

    case 'timeExpired': {
      // The other race: the clock runs out while the shutter is already firing,
      // or while the judge is looking. Once the photograph exists the round has
      // been played, and expiry no longer applies to it.
      if (state.kind !== 'prompted') return state;
      return { kind: 'expired', prompt: state.prompt };
    }

    case 'dismissed':
      return { kind: 'idle' };
  }
}
