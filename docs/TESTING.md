# Testing

Automated where it catches something, manual where a machine cannot go.

## Automated

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform web --output-dir dist && npm run scan:secrets
```

All five run on every push and pull request. The secret scan builds the bundle
and greps it for key material; it is itself verified by planting a fake key and
watching it exit non-zero.

**What the unit tests are for.** Not coverage. The suite concentrates on the
things that will actually break: the two round races, the schema against
malformed model output, corrupt storage, contrast in both schemes, and the
judge's voice rules applied mechanically to every user-facing string.

## The one Maestro flow

```bash
EXPO_PUBLIC_E2E=1 npx expo run:ios     # native build onto the simulator
maestro test .maestro/round.yaml
```

The native build needs `patches/expo-modules-jsi+57.0.7.patch`, applied
automatically on `npm install`. See the README's "Building natively".

`EXPO_PUBLIC_E2E=1` stands in for the camera the simulator does not have and for
the judge. Everything between them is real.

**This flow does not test the judge**, and saying otherwise would be a lie about
coverage. The model is covered by the fixture suite (`src/judge/schema.test.ts`)
and by a live probe against the real API, recorded in the README.

It is not in CI. Running it needs a macOS runner, a full native build and a
booted simulator on every push, which is a lot of minutes for a flow whose
failure modes are already covered by component tests. It is run before a release
tag instead.

## Manual matrix

These need a physical iPhone. The simulator has no camera, no Taptic Engine, no
silent switch and no real network conditions.

| # | Case | Expected |
|---|---|---|
| 1 | **Airplane mode mid-judgement.** Submit, then enable airplane mode before the ruling lands. | "Nothing reached the office." The round is not spent and the streak is intact. Retry works once signal returns. |
| 2 | **Permission denied, then granted in Settings.** Deny at the prompt, deny again, then enable Camera in Settings and return. | First denial offers a retry. Permanent denial offers a Settings deep link, never a repeated request. Returning from Settings lands on a playable round. |
| 3 | **Backgrounded during the timer.** Start a round, background the app for 30s, return. | Either a clean expiry or a running clock — never a negative timer, never a stuck screen, never a round that cannot be left. |
| 4 | **Very dark room.** Submit a photograph with almost no light. | The prompt and shutter stay legible: they sit on opaque paper, never over the preview. The judge rules `unclear` and the point is awarded. |
| 5 | **Timer expiring exactly as the shutter fires.** Press the shutter as the numeral hits 00. | The photograph wins. Once the shutter is pressed the round is played, and expiry does not steal it. |
| 6 | **Largest Dynamic Type.** Settings → Accessibility → Display & Text Size → Larger Text, at maximum. | Nothing clipped on any screen. Buttons grow with their labels. The prompt band grows and the preview shrinks. |
| 7 | **Reduce Motion on.** Settings → Accessibility → Motion → Reduce Motion. | The verdict is a composed still: stamp already landed, still tilted, still off-register. The haptic still fires. Fully playable and still worth watching. |
| 8 | **VoiceOver, whole round.** Settings → Accessibility → VoiceOver. | The prompt, the time left, the shutter, the ruling and the score are all reachable and sensibly labelled. The ruling is announced when it lands without needing to be found. |
| 9 | **Silent switch on.** Flip the physical switch and play a round. | Silent. `expo-audio` defaults to overriding the switch; this app turns that off, and case 9 is the only way to be sure. |
| 10 | **Rate limit.** Play more than 60 rounds in an hour on one device. | "The judge is on lunch." Never a raw 429, and never a crash. |

## Known gaps

- The Maestro flow does not exercise the real judge, by design.
- **The harness bypasses the camera permission gate entirely.** `EXPO_PUBLIC_E2E=1`
  makes the round screen skip the permission branch, because the simulator has
  no camera to grant. Every screenshot and recording in `docs/` was captured
  that way, so none of them exercise onboarding -> grant -> round. A redirect
  loop lived in exactly that branch and was invisible to all of them. `roundGate`
  in `src/capture/permission.ts` now covers it in unit tests; the flow itself
  still needs case 2 below, run by hand.
- Nothing automatically verifies Dynamic Type or VoiceOver; cases 6–8 are the
  only coverage those have.
- The rate limit is in-memory and per-instance, so case 10 depends on hitting
  the same server instance.
