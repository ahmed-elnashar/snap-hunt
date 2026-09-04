import {
  BASE_POINTS,
  MAX_MULTIPLIER,
  ROUND_MS,
  type RoundEnding,
  scoreRound,
  streakMultiplier,
  streakSurvives,
  timeBonus,
} from './scoring';

describe('streakMultiplier', () => {
  it('starts at 1, so a first catch is not inflated', () => {
    expect(streakMultiplier(0)).toBe(1);
  });

  it('grows a tenth per held round', () => {
    expect(streakMultiplier(1)).toBeCloseTo(1.1);
    expect(streakMultiplier(5)).toBeCloseTo(1.5);
  });

  it('stops at the cap', () => {
    expect(streakMultiplier(10)).toBe(MAX_MULTIPLIER);
    expect(streakMultiplier(11)).toBe(MAX_MULTIPLIER);
    expect(streakMultiplier(1000)).toBe(MAX_MULTIPLIER);
  });

  it('reaches the cap exactly at ten, not before', () => {
    expect(streakMultiplier(9)).toBeLessThan(MAX_MULTIPLIER);
    expect(streakMultiplier(10)).toBe(MAX_MULTIPLIER);
  });

  it('treats nonsense as no streak rather than propagating it', () => {
    expect(streakMultiplier(-5)).toBe(1);
    expect(streakMultiplier(Number.NaN)).toBe(1);
    expect(streakMultiplier(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('timeBonus', () => {
  it('is nothing when the clock has run out', () => {
    expect(timeBonus('routine', 0)).toBe(0);
  });

  it('is half the base when the shutter fires instantly', () => {
    expect(timeBonus('routine', ROUND_MS)).toBe(BASE_POINTS.routine * 0.5);
    expect(timeBonus('exceptional', ROUND_MS)).toBe(BASE_POINTS.exceptional * 0.5);
  });

  it('is a quarter of the base at the halfway mark', () => {
    expect(timeBonus('routine', ROUND_MS / 2)).toBe(25);
  });

  it('scales with the tier rather than being a flat rate', () => {
    expect(timeBonus('exceptional', ROUND_MS / 2)).toBeGreaterThan(
      timeBonus('routine', ROUND_MS / 2),
    );
  });

  it('clamps a clock that somehow reads past full', () => {
    expect(timeBonus('routine', ROUND_MS * 3)).toBe(timeBonus('routine', ROUND_MS));
  });

  it('clamps a negative clock rather than subtracting points', () => {
    expect(timeBonus('routine', -5000)).toBe(0);
  });

  it('awards nothing for a nonsense clock rather than the maximum', () => {
    // A corrupt clock must not be worth full marks. Clamping NaN or Infinity
    // up to 1 would make garbage the most valuable input there is.
    expect(timeBonus('routine', Number.NaN)).toBe(0);
    expect(timeBonus('routine', Number.POSITIVE_INFINITY)).toBe(0);
    expect(timeBonus('routine', Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('is zero for a zero-length round rather than dividing by zero', () => {
    expect(timeBonus('routine', 1000, 0)).toBe(0);
  });
});

describe('scoreRound', () => {
  const base = {
    tier: 'routine',
    remainingMs: 0,
    streakBefore: 0,
    awarded: true,
  } as const;

  it('awards the base with no time left and no streak', () => {
    expect(scoreRound(base)).toEqual({ points: 100, streakAfter: 1, multiplier: 1 });
  });

  it('adds the time bonus', () => {
    expect(scoreRound({ ...base, remainingMs: ROUND_MS }).points).toBe(150);
  });

  it('multiplies base and bonus together, not base alone', () => {
    // (100 + 50) * 1.5, not (100 * 1.5) + 50.
    expect(scoreRound({ ...base, remainingMs: ROUND_MS, streakBefore: 5 }).points).toBe(
      225,
    );
  });

  it('scores an exceptional prompt higher than a routine one', () => {
    const routine = scoreRound({ ...base, tier: 'routine' }).points;
    const exceptional = scoreRound({ ...base, tier: 'exceptional' }).points;
    expect(exceptional).toBeGreaterThan(routine);
  });

  it('extends the streak on an award', () => {
    expect(scoreRound({ ...base, streakBefore: 3 }).streakAfter).toBe(4);
  });

  it('scores nothing and resets the streak when the point is withheld', () => {
    expect(scoreRound({ ...base, streakBefore: 7, awarded: false })).toMatchObject({
      points: 0,
      streakAfter: 0,
    });
  });

  it('honours the multiplier cap in the points it awards', () => {
    const atCap = scoreRound({ ...base, streakBefore: 10 }).points;
    const wayPastCap = scoreRound({ ...base, streakBefore: 500 }).points;
    expect(atCap).toBe(wayPastCap);
    expect(atCap).toBe(200);
  });

  it('always returns a whole number of points', () => {
    for (const streakBefore of [0, 1, 3, 7, 9, 10]) {
      for (const remainingMs of [0, 1, 3333, 9999, ROUND_MS]) {
        const { points } = scoreRound({ ...base, streakBefore, remainingMs });
        expect(Number.isInteger(points)).toBe(true);
        expect(points).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never returns a negative streak from corrupt input', () => {
    expect(scoreRound({ ...base, streakBefore: -9 }).streakAfter).toBe(1);
    expect(scoreRound({ ...base, streakBefore: Number.NaN }).streakAfter).toBe(1);
  });
});

describe('streakSurvives — the streak is broken by the judge and nothing else', () => {
  it('breaks only on a ruling against the player', () => {
    expect(streakSurvives('ruled-against')).toBe(false);
  });

  it.each<RoundEnding>(['expired', 'network', 'abandoned'])('survives %s', (ending) => {
    expect(streakSurvives(ending)).toBe(true);
  });

  it('specifically survives a network failure, which is the app’s fault', () => {
    // PLAN.md: "Streak resets on a reject, never on a network failure."
    expect(streakSurvives('network')).toBe(true);
  });
});
