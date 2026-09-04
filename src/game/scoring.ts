import { type Tier } from './prompts';

/**
 * Points, time bonus and streak. Pure, no React, no clock of its own.
 */

/** How long an ordinary round lasts. */
export const ROUND_MS = 20_000;

/**
 * Below this, the countdown numeral appears on the prompt band. See DESIGN.md:
 * the clock is a retracting rule for most of the round, and becomes a readout
 * only at the end, which is where a monospace numeral is earned.
 *
 * Lives here rather than in the hook so a presentational component can read it
 * without importing storage, a network client, or React.
 */
export const NUMERAL_THRESHOLD_MS = 5_000;

/** Base points by tier. Interpretation is worth more than observation. */
export const BASE_POINTS: Readonly<Record<Tier, number>> = {
  routine: 100,
  contested: 175,
  exceptional: 300,
};

/**
 * A full-speed capture is worth half the base again. Expressed as a fraction of
 * base rather than points-per-second so the bonus scales with the tier instead
 * of dominating an easy prompt.
 */
export const MAX_TIME_BONUS_FRACTION = 0.5;

/** Each held streak adds this much, until the cap. */
export const STREAK_STEP = 0.1;

/** Hard ceiling. Ten held rounds and the multiplier stops growing. */
export const MAX_MULTIPLIER = 2;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The multiplier a round is scored at, from the streak carried *into* it.
 *
 * Using the streak before the round means a first catch scores at 1x and the
 * multiplier is something you have built rather than something you are handed.
 */
export function streakMultiplier(streakBefore: number): number {
  const streak = Number.isFinite(streakBefore) ? Math.max(0, streakBefore) : 0;
  return Math.min(MAX_MULTIPLIER, 1 + streak * STREAK_STEP);
}

export function timeBonus(tier: Tier, remainingMs: number, roundMs = ROUND_MS): number {
  if (roundMs <= 0) return 0;
  const fraction = clamp01(remainingMs / roundMs);
  return Math.round(BASE_POINTS[tier] * MAX_TIME_BONUS_FRACTION * fraction);
}

export type RoundOutcome = {
  readonly tier: Tier;
  /** Milliseconds left on the clock when the shutter fired. */
  readonly remainingMs: number;
  readonly streakBefore: number;
  /** Whether the judge awarded the point. See `verdictAwardsPoint`. */
  readonly awarded: boolean;
};

export type RoundScore = {
  readonly points: number;
  readonly streakAfter: number;
  readonly multiplier: number;
};

export function scoreRound({
  tier,
  remainingMs,
  streakBefore,
  awarded,
}: RoundOutcome): RoundScore {
  const multiplier = streakMultiplier(streakBefore);

  if (!awarded) {
    // A ruling against you costs the streak and scores nothing. Only a ruling
    // does this — see `streakSurvives`.
    return { points: 0, streakAfter: 0, multiplier };
  }

  const base = BASE_POINTS[tier];
  const points = Math.round((base + timeBonus(tier, remainingMs)) * multiplier);
  const safeStreak = Number.isFinite(streakBefore) ? Math.max(0, streakBefore) : 0;

  return { points, streakAfter: safeStreak + 1, multiplier };
}

/**
 * Whether a streak survives an unfinished round.
 *
 * A streak is broken by the judge and by nothing else. Losing it to a dropped
 * connection or a timer that ran out while you were still looking would punish
 * the player for the app's problems and for the game's own difficulty, and the
 * whole point of the generous tie-break is that this game does not do that.
 */
export type RoundEnding = 'ruled-against' | 'expired' | 'network' | 'abandoned';

export function streakSurvives(ending: RoundEnding): boolean {
  return ending !== 'ruled-against';
}
