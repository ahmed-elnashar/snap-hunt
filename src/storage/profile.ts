import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

/**
 * The player's running record.
 *
 * Everything read back from storage is Zod-validated before it is used. A
 * corrupt, truncated, hand-edited or older-format value degrades to a fresh
 * profile rather than crashing: losing a score is annoying, and an app that
 * will not open is worse.
 */

const KEY = 'snap-hunt.profile.v1';

export const ProfileSchema = z.object({
  version: z.literal(1),
  totalPoints: z.number().int().nonnegative(),
  /** Current run of rounds the judge has not ruled against. */
  streak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  roundsPlayed: z.number().int().nonnegative(),
  roundsAdmitted: z.number().int().nonnegative(),
  /** False until the untimed first round has been completed once. */
  hasPlayed: z.boolean(),
  /** Day key of the last daily challenge played, or null. */
  lastDailyKey: z.string().max(10).nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const FRESH_PROFILE: Profile = Object.freeze({
  version: 1,
  totalPoints: 0,
  streak: 0,
  bestStreak: 0,
  roundsPlayed: 0,
  roundsAdmitted: 0,
  hasPlayed: false,
  lastDailyKey: null,
});

/**
 * Parses stored text into a profile, or returns a fresh one.
 *
 * Pure, so every way a stored value can be wrong is testable without a device.
 */
export function parseProfile(stored: string | null): Profile {
  if (stored === null) return FRESH_PROFILE;

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return FRESH_PROFILE;
  }

  const parsed = ProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : FRESH_PROFILE;
}

/**
 * Folds a completed round into the record. Pure.
 *
 * `streakAfter` comes from `scoreRound`, which owns the rule that only a ruling
 * against the player breaks a streak.
 */
export function applyRound(
  profile: Profile,
  round: {
    readonly points: number;
    readonly streakAfter: number;
    readonly awarded: boolean;
  },
): Profile {
  const points = Number.isFinite(round.points)
    ? Math.max(0, Math.round(round.points))
    : 0;
  const streak = Number.isFinite(round.streakAfter)
    ? Math.max(0, Math.round(round.streakAfter))
    : 0;

  return {
    ...profile,
    totalPoints: profile.totalPoints + points,
    streak,
    bestStreak: Math.max(profile.bestStreak, streak),
    roundsPlayed: profile.roundsPlayed + 1,
    roundsAdmitted: profile.roundsAdmitted + (round.awarded ? 1 : 0),
    hasPlayed: true,
  };
}

/** Records that today's daily challenge has been played. Pure. */
export function markDailyPlayed(profile: Profile, key: string): Profile {
  return { ...profile, lastDailyKey: key };
}

export function hasPlayedDaily(profile: Profile, key: string): boolean {
  return profile.lastDailyKey === key;
}

export async function loadProfile(): Promise<Profile> {
  try {
    return parseProfile(await AsyncStorage.getItem(KEY));
  } catch {
    // Storage itself unavailable. A fresh profile keeps the game playable.
    return FRESH_PROFILE;
  }
}

/** Returns false when the write failed, so a caller can decide whether to care. */
export async function saveProfile(profile: Profile): Promise<boolean> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export async function resetProfile(): Promise<Profile> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do. The in-memory profile below is still the fresh one.
  }
  return FRESH_PROFILE;
}
