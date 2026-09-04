import { Image } from 'react-native';

import { type Verdict } from '@/judge/schema';

import { type PreparedImage } from './downscale';

/**
 * The end-to-end harness.
 *
 * The iOS Simulator has no camera: `CameraView` renders blank and
 * `takePictureAsync` is unusable. Without a seam, the one Maestro flow the brief
 * asks for cannot run anywhere except a physical device, which is not somewhere
 * CI can go.
 *
 * With `EXPO_PUBLIC_E2E=1` the shutter yields a bundled photograph and the judge
 * returns a canned ruling. Everything between them — the state machine, the
 * clock, scoring, the streak, persistence, the develop and the stamp — runs for
 * real.
 *
 * **This is a UI-flow harness, not a test of the judge.** Said plainly rather
 * than implied: the model is covered by the fixture suite and by a live probe
 * against the real API, both of which are honest about what they check. Claiming
 * this flow exercises the judge would be a lie about coverage.
 *
 * The rulings below are real outputs from `claude-haiku-4-5-20251001`, kept
 * verbatim so the harness shows the app as it actually behaves.
 */
export function isE2E(): boolean {
  return process.env.EXPO_PUBLIC_E2E === '1';
}

/**
 * The harness waits as long as the real judge does.
 *
 * Measured median is 2.0s. Returning instantly would skip the develop
 * altogether, which is the app's one animation — the flow would pass without
 * ever rendering the screen it is supposed to be checking.
 */
export const E2E_JUDGE_DELAY_MS = 1_800;

export function e2eDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, E2E_JUDGE_DELAY_MS));
}

const FIXTURE = require('@/assets/e2e/submission.jpg') as number;

/** Stands in for a captured photograph. */
export function e2ePhoto(): PreparedImage {
  const source = Image.resolveAssetSource(FIXTURE);
  return {
    uri: source.uri,
    // Empty because the canned judge never sends it. A real capture always
    // carries base64; see prepareForJudge.
    base64: '',
    width: source.width,
    height: source.height,
  };
}

/**
 * A canned ruling, chosen from the prompt so the harness is deterministic but
 * not always the same screen. Both were produced by the real model.
 */
export function e2eVerdict(promptText: string): Verdict {
  const admits = promptText.length % 2 === 0;
  return admits
    ? {
        verdict: 'accept',
        confidence: 0.93,
        detected: 'a blue ceramic bowl',
        reason:
          'A blue bowl on a wooden table. Round, blue, and sitting still. Admitted.',
      }
    : {
        verdict: 'reject',
        confidence: 0.88,
        detected: 'a blue ceramic bowl',
        reason: 'A blue bowl. It is a fine bowl. It is not what was asked for.',
      };
}
