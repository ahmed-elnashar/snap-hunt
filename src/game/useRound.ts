import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { type PreparedImage } from '@/capture/downscale';
import { e2eDelay, e2eVerdict, isE2E } from '@/capture/e2e';
import { askTheJudge } from '@/judge/client';
import { verdictAwardsPoint } from '@/judge/schema';
import { getDeviceId } from '@/storage/deviceId';
import {
  type Profile,
  FRESH_PROFILE,
  applyRound,
  hasPlayedDaily,
  loadProfile,
  markDailyPlayed,
  saveProfile,
} from '@/storage/profile';

import {
  type RoundState,
  hasExpired,
  initialRoundState,
  remainingMs,
  roundReducer,
} from './machine';
import { type Prompt, dailyPrompt, dayKey, pickPrompt } from './prompts';
import { ROUND_MS, scoreRound } from './scoring';

/**
 * Drives one round: the clock, the judge call, and the record.
 *
 * Every rule lives in machine.ts, scoring.ts and profile.ts, which are pure and
 * tested. This owns only the React parts — effects, timers, and the async
 * sequence — so no rule needs a rendered component to be verified.
 */

/**
 * How often the clock is read. Enough for a retracting rule and a whole-second
 * numeral, and cheap enough not to matter. Phase 4 moves the rule to Reanimated
 * and this becomes a once-a-second concern.
 */
const TICK_MS = 200;

export type UseRoundOptions = {
  /** Owned by the screen, because the camera ref lives there. */
  readonly takePhoto: () => Promise<PreparedImage | null>;
  readonly random?: () => number;
  readonly now?: () => number;
};

export type UseRound = {
  readonly state: RoundState;
  readonly profile: Profile;
  readonly loaded: boolean;
  /** Milliseconds left, or null when untimed or not running. */
  readonly remaining: number | null;
  readonly isDaily: boolean;
  readonly submitting: boolean;
  startRound: () => void;
  submit: () => void;
  retry: () => void;
  dismiss: () => void;
  replaceProfile: (profile: Profile) => void;
};

export function useRound({
  takePhoto,
  random = Math.random,
  now = Date.now,
}: UseRoundOptions): UseRound {
  const [state, dispatch] = useReducer(roundReducer, initialRoundState);
  const [profile, setProfileState] = useState<Profile>(FRESH_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(() => now());
  const [isDaily, setIsDaily] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * True from the press of the shutter until the photograph exists. The clock
   * may not expire the round during that window: the player pressed in time,
   * and taking the picture is the app's work, not theirs. This is the
   * expiry-mid-capture race, handled where it starts rather than papered over
   * downstream.
   */
  const capturing = useRef(false);

  /** The submitted photograph, kept so a retry can resend it. */
  const submitted = useRef<{
    readonly image: PreparedImage;
    readonly elapsedMs: number;
    readonly timed: boolean;
  } | null>(null);

  /**
   * Latest values, for reading inside async work that outlives the render it
   * started in — a verdict arriving must score against the profile as it is
   * *now*, not as it was when the request went out.
   *
   * Synced in an effect rather than assigned during render: writing a ref while
   * rendering is a side effect, and React is entitled to render more than once
   * before committing.
   */
  const profileRef = useRef(profile);
  const dailyRef = useRef(isDaily);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    dailyRef.current = isDaily;
  }, [isDaily]);

  useEffect(() => {
    let alive = true;
    void loadProfile().then((stored) => {
      if (!alive) return;
      setProfileState(stored);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((next: Profile) => {
    setProfileState(next);
    void saveProfile(next);
  }, []);

  // The clock. Runs only while a timed round is in progress.
  const deadlineAt = state.kind === 'prompted' ? state.deadlineAt : null;
  useEffect(() => {
    if (deadlineAt === null) return;
    const id = setInterval(() => setTick(now()), TICK_MS);
    return () => clearInterval(id);
  }, [deadlineAt, now]);

  useEffect(() => {
    if (capturing.current) return;
    if (hasExpired(state, tick)) dispatch({ type: 'timeExpired' });
  }, [state, tick]);

  const startRound = useCallback(() => {
    const at = now();
    const current = profileRef.current;
    const today = dayKey(new Date(at));

    // The daily challenge is the first round of the day; after that, the pack.
    const useDaily = !hasPlayedDaily(current, today);
    const prompt: Prompt = useDaily
      ? dailyPrompt(new Date(at))
      : pickPrompt(random, {
          ...(state.kind === 'idle' ? {} : { excludeId: state.prompt.id }),
        });

    setIsDaily(useDaily);
    submitted.current = null;

    // Round zero is untimed. The first round is the tutorial and is unlosable.
    dispatch({ type: 'roundStarted', prompt, at, timed: current.hasPlayed });
    setTick(at);
  }, [now, random, state]);

  /** Sends a photograph and records the outcome. Assumes state is `judging`. */
  const judge = useCallback(
    async (prompt: Prompt, image: PreparedImage, elapsedMs: number, timed: boolean) => {
      // The E2E harness stands in for the network so the flow can run on a
      // simulator with no camera, no key and no signal. See src/capture/e2e.ts.
      const result = isE2E()
        ? await e2eDelay().then(
            () =>
              ({
                kind: 'verdict',
                verdict: e2eVerdict(prompt.text),
                repaired: false,
              }) as const,
          )
        : await askTheJudge({
            promptId: prompt.id,
            promptText: prompt.text,
            imageBase64: image.base64,
            deviceId: await getDeviceId(),
          });

      if (result.kind === 'failed') {
        // The round is not spent and the streak is untouched: a failure here is
        // the app's problem, not the player's.
        dispatch({ type: 'judgingFailed', reason: result.reason });
        return;
      }

      const awarded = verdictAwardsPoint(result.verdict);
      const current = profileRef.current;
      // An untimed round earns no time bonus: there was no clock to beat.
      const left = timed ? Math.max(0, ROUND_MS - elapsedMs) : 0;
      const score = scoreRound({
        tier: prompt.tier,
        remainingMs: left,
        streakBefore: current.streak,
        awarded,
      });

      dispatch({
        type: 'verdictReturned',
        verdict: result.verdict,
        points: score.points,
        streakAfter: score.streakAfter,
      });

      const played = applyRound(current, {
        points: score.points,
        streakAfter: score.streakAfter,
        awarded,
      });
      persist(
        dailyRef.current ? markDailyPlayed(played, dayKey(new Date(now()))) : played,
      );
    },
    [now, persist],
  );

  const submit = useCallback(() => {
    if (state.kind !== 'prompted' || submitting) return;

    const firedAt = now();
    const timed = state.deadlineAt !== null;
    const elapsedMs = Math.max(0, firedAt - state.startedAt);
    capturing.current = true;
    setSubmitting(true);

    void (async () => {
      try {
        const image = await takePhoto();
        if (image === null) {
          dispatch({ type: 'shutterFired', uri: '', at: firedAt });
          dispatch({ type: 'judgingStarted' });
          dispatch({ type: 'judgingFailed', reason: 'unparseable' });
          return;
        }
        submitted.current = { image, elapsedMs, timed };
        // Dispatched with the press time, not the time the file appeared, so
        // the player is not charged for the app's processing.
        dispatch({ type: 'shutterFired', uri: image.uri, at: firedAt });
        dispatch({ type: 'judgingStarted' });
        await judge(state.prompt, image, elapsedMs, timed);
      } catch {
        dispatch({ type: 'judgingFailed', reason: 'unparseable' });
      } finally {
        capturing.current = false;
        setSubmitting(false);
      }
    })();
  }, [judge, now, state, submitting, takePhoto]);

  const retry = useCallback(() => {
    const previous = submitted.current;
    if (state.kind !== 'failed' || previous === null || submitting) return;

    setSubmitting(true);
    dispatch({ type: 'retried' });
    void (async () => {
      try {
        await judge(state.prompt, previous.image, previous.elapsedMs, previous.timed);
      } catch {
        dispatch({ type: 'judgingFailed', reason: 'unparseable' });
      } finally {
        setSubmitting(false);
      }
    })();
  }, [judge, state, submitting]);

  const dismiss = useCallback(() => dispatch({ type: 'dismissed' }), []);

  return {
    state,
    profile,
    loaded,
    remaining: remainingMs(state, tick),
    isDaily,
    submitting,
    startRound,
    submit,
    retry,
    dismiss,
    replaceProfile: persist,
  };
}
