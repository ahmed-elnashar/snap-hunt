import { type Verdict } from '@/judge/schema';

import {
  type RoundAction,
  type RoundState,
  hasExpired,
  initialRoundState,
  remainingMs,
  roundReducer,
} from './machine';
import { type Prompt } from './prompts';
import { ROUND_MS } from './scoring';

const PROMPT: Prompt = {
  id: 'round-and-blue',
  text: 'something round and blue',
  tier: 'routine',
};

const VERDICT: Verdict = {
  verdict: 'accept',
  confidence: 0.91,
  detected: 'a blue enamel mug',
  reason: 'A blue enamel mug. Round on every axis I can test from here. Admitted.',
};

const START: RoundAction = { type: 'roundStarted', prompt: PROMPT, at: 1000 };
const SHUTTER: RoundAction = { type: 'shutterFired', uri: 'file:///p.jpg', at: 6000 };
const JUDGING: RoundAction = { type: 'judgingStarted' };
const RULED: RoundAction = {
  type: 'verdictReturned',
  verdict: VERDICT,
  points: 150,
  streakAfter: 1,
};

/** Applies a sequence from idle, for readable multi-step tests. */
function run(...actions: RoundAction[]): RoundState {
  return actions.reduce(roundReducer, initialRoundState);
}

describe('the happy path', () => {
  it('starts idle', () => {
    expect(initialRoundState).toEqual({ kind: 'idle' });
  });

  it('runs idle → prompted → captured → judging → verdict', () => {
    expect(run(START).kind).toBe('prompted');
    expect(run(START, SHUTTER).kind).toBe('captured');
    expect(run(START, SHUTTER, JUDGING).kind).toBe('judging');
    expect(run(START, SHUTTER, JUDGING, RULED).kind).toBe('verdict');
  });

  it('carries the prompt all the way to the ruling', () => {
    const state = run(START, SHUTTER, JUDGING, RULED);
    expect(state).toMatchObject({ kind: 'verdict', prompt: PROMPT });
  });

  it('records how long the player took', () => {
    expect(run(START, SHUTTER)).toMatchObject({ elapsedMs: 5000 });
  });

  it('never records a negative elapsed time from a clock that went backwards', () => {
    const state = run(START, { type: 'shutterFired', uri: 'file:///p.jpg', at: 0 });
    expect(state).toMatchObject({ elapsedMs: 0 });
  });

  it('returns to idle when dismissed', () => {
    expect(run(START, SHUTTER, JUDGING, RULED, { type: 'dismissed' })).toEqual({
      kind: 'idle',
    });
  });
});

describe('the clock', () => {
  it('sets a deadline a round-length after the start', () => {
    expect(run(START)).toMatchObject({ deadlineAt: 1000 + ROUND_MS });
  });

  it('honours a custom duration', () => {
    const state = run({ ...START, durationMs: 5000 } as RoundAction);
    expect(state).toMatchObject({ deadlineAt: 6000 });
  });

  it('leaves the first round untimed, so the tutorial is unlosable', () => {
    const state = run({ ...START, timed: false } as RoundAction);
    expect(state).toMatchObject({ deadlineAt: null });
    expect(remainingMs(state, 999_999)).toBeNull();
    expect(hasExpired(state, 999_999)).toBe(false);
  });

  it('counts down', () => {
    const state = run(START);
    expect(remainingMs(state, 1000)).toBe(ROUND_MS);
    expect(remainingMs(state, 11_000)).toBe(ROUND_MS - 10_000);
  });

  it('never counts below zero', () => {
    expect(remainingMs(run(START), 999_999)).toBe(0);
  });

  it('reports expiry only once the clock is actually out', () => {
    const state = run(START);
    expect(hasExpired(state, 1000 + ROUND_MS - 1)).toBe(false);
    expect(hasExpired(state, 1000 + ROUND_MS)).toBe(true);
  });

  it('has no clock outside a running round', () => {
    expect(remainingMs({ kind: 'idle' }, 0)).toBeNull();
    expect(remainingMs(run(START, SHUTTER), 999_999)).toBeNull();
    expect(hasExpired(run(START, SHUTTER), 999_999)).toBe(false);
  });

  it('expires a running round', () => {
    expect(run(START, { type: 'timeExpired' })).toEqual({
      kind: 'expired',
      prompt: PROMPT,
    });
  });
});

describe('expiry racing the shutter', () => {
  /**
   * The player presses the shutter as the clock hits zero. Both events are in
   * flight. Whichever the reducer sees first must win cleanly, and the loser
   * must not corrupt the result.
   */

  it('keeps a photograph taken before expiry was processed', () => {
    const state = run(START, SHUTTER, { type: 'timeExpired' });
    expect(state.kind).toBe('captured');
  });

  it('lets that photograph go on to be judged and scored', () => {
    const state = run(START, SHUTTER, { type: 'timeExpired' }, JUDGING, RULED);
    expect(state).toMatchObject({ kind: 'verdict', points: 150 });
  });

  it('ignores a shutter that fires after expiry was processed', () => {
    const state = run(START, { type: 'timeExpired' }, SHUTTER);
    expect(state).toEqual({ kind: 'expired', prompt: PROMPT });
  });

  it('does not expire a round that is already being judged', () => {
    const state = run(START, SHUTTER, JUDGING, { type: 'timeExpired' });
    expect(state.kind).toBe('judging');
  });

  it('does not expire a round that has already been ruled on', () => {
    const state = run(START, SHUTTER, JUDGING, RULED, { type: 'timeExpired' });
    expect(state.kind).toBe('verdict');
  });
});

describe('a verdict arriving late', () => {
  it('is dropped when the round has expired', () => {
    const state = run(START, { type: 'timeExpired' }, RULED);
    expect(state).toEqual({ kind: 'expired', prompt: PROMPT });
  });

  it('is dropped when the player has walked away', () => {
    const state = run(START, SHUTTER, JUDGING, { type: 'dismissed' }, RULED);
    expect(state).toEqual({ kind: 'idle' });
  });

  it('cannot score into a round that is already over', () => {
    const state = run(START, SHUTTER, JUDGING, RULED, {
      type: 'verdictReturned',
      verdict: { ...VERDICT, verdict: 'reject' },
      points: 9999,
      streakAfter: 99,
    });
    // The first ruling stands; a second cannot overwrite it.
    expect(state).toMatchObject({ points: 150, streakAfter: 1 });
  });

  it('is dropped when nothing has been submitted at all', () => {
    expect(roundReducer(initialRoundState, RULED)).toEqual({ kind: 'idle' });
  });
});

describe('failure and retry', () => {
  const FAILED: RoundAction = { type: 'judgingFailed', reason: 'network' };

  it('moves to failed from judging, keeping the photograph', () => {
    const state = run(START, SHUTTER, JUDGING, FAILED);
    expect(state).toEqual({
      kind: 'failed',
      prompt: PROMPT,
      uri: 'file:///p.jpg',
      elapsedMs: 5000,
      reason: 'network',
    });
  });

  it('retries the same photograph without spending the round', () => {
    const state = run(START, SHUTTER, JUDGING, FAILED, { type: 'retried' });
    expect(state).toMatchObject({ kind: 'judging', uri: 'file:///p.jpg' });
  });

  it('keeps the time the player achieved across a retry, so it still scores', () => {
    const state = run(START, SHUTTER, JUDGING, FAILED, { type: 'retried' });
    expect(state).toMatchObject({ elapsedMs: 5000 });
  });

  it('does not re-enter judging via judgingStarted, which is a different transition', () => {
    const failed = run(START, SHUTTER, JUDGING, FAILED);
    expect(roundReducer(failed, JUDGING)).toBe(failed);
  });

  it('can be ruled on after a retry', () => {
    const state = run(START, SHUTTER, JUDGING, FAILED, { type: 'retried' }, RULED);
    expect(state.kind).toBe('verdict');
  });

  it('survives failing twice', () => {
    const state = run(
      START,
      SHUTTER,
      JUDGING,
      FAILED,
      { type: 'retried' },
      { type: 'judgingFailed', reason: 'timeout' },
    );
    expect(state).toMatchObject({ kind: 'failed', reason: 'timeout' });
  });

  it('ignores a failure that arrives when nothing is being judged', () => {
    expect(run(START, FAILED).kind).toBe('prompted');
    expect(roundReducer(initialRoundState, FAILED)).toEqual({ kind: 'idle' });
  });

  it('ignores a retry when there is nothing to retry', () => {
    expect(run(START, { type: 'retried' }).kind).toBe('prompted');
  });
});

describe('actions that do not apply', () => {
  const EVERY_ACTION: RoundAction[] = [
    START,
    SHUTTER,
    JUDGING,
    RULED,
    { type: 'judgingFailed', reason: 'network' },
    { type: 'retried' },
    { type: 'timeExpired' },
    { type: 'dismissed' },
  ];

  const EVERY_STATE: RoundState[] = [
    initialRoundState,
    run(START),
    run(START, SHUTTER),
    run(START, SHUTTER, JUDGING),
    run(START, SHUTTER, JUDGING, RULED),
    run(START, { type: 'timeExpired' }),
    run(START, SHUTTER, JUDGING, { type: 'judgingFailed', reason: 'network' }),
  ];

  it('never throws, whatever arrives in whatever order', () => {
    for (const state of EVERY_STATE) {
      for (const action of EVERY_ACTION) {
        expect(() => roundReducer(state, action)).not.toThrow();
      }
    }
  });

  it('always returns a state of a known kind', () => {
    const kinds = new Set([
      'idle',
      'prompted',
      'captured',
      'judging',
      'verdict',
      'expired',
      'failed',
    ]);
    for (const state of EVERY_STATE) {
      for (const action of EVERY_ACTION) {
        expect(kinds.has(roundReducer(state, action).kind)).toBe(true);
      }
    }
  });

  it('returns the identical object when an action does not apply', () => {
    // Referential equality matters: a reducer that returns a fresh equal object
    // re-renders the whole screen on every ignored tick.
    const judging = run(START, SHUTTER, JUDGING);
    expect(roundReducer(judging, { type: 'timeExpired' })).toBe(judging);
    expect(roundReducer(judging, SHUTTER)).toBe(judging);
    expect(roundReducer(judging, { type: 'retried' })).toBe(judging);
  });

  it('can always be restarted, from any state', () => {
    for (const state of EVERY_STATE) {
      expect(roundReducer(state, START).kind).toBe('prompted');
    }
  });
});
