# Snap Hunt

A camera scavenger hunt game for iOS. The app names a thing — *something round
and blue* — and starts a twenty-second timer. You find one in the real world and
photograph it. A vision model looks at the photo, decides whether it counts, and
stamps a ruling onto it.

The game is one loop. The interest is in the time pressure and in the judge's
personality, not in feature count.

> **Status:** in build. Phase 0 (scaffold) complete. See [PLAN.md](PLAN.md) for
> the full spec and the phase plan.

## Running it

```bash
npm install
cp .env.example .env      # then fill in the two values
npm start                 # scan the QR with Expo Go on a physical iPhone
```

The iOS Simulator has no camera, so the game cannot actually be played there. A
physical device is required for anything past the prompt screen.

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

## Architecture

```
app/                      routes only — thin, no business logic
  _layout.tsx             font loading, root background, error fallback
  api/judge+api.ts        the only place the Anthropic API key exists
src/
  game/                   round state machine + scoring — pure, no React
  judge/                  verdict schema, system prompt, device-side client
  storage/                Zod-validated persistence, anonymous device id
  ui/                     presentational components
  design/tokens.ts        the five colours, the type scale, spacing, motion
assets/prompts.json       ~60 curated prompts across three tiers
```

The round is a single `useReducer` over a discriminated union. Scoring and the
state machine are pure modules with no React import and full unit tests —
components render, they do not decide.

The device never talks to Anthropic. It posts a downscaled JPEG to an Expo Router
API route, which holds the key in its server environment and proxies the call.

## Decisions worth explaining

**The judge is generous on purpose.** An `unclear` verdict, or any verdict with
confidence below 0.55, **awards the point**. A strict judge is more accurate and
much less fun; being narrowly robbed by a machine is the fastest way to make
someone stop playing. This is a product decision, not a bug.

**The prompt pack is static, not generated.** Sixty curated prompts in bundled
JSON. They are instant, free, work offline, and are funnier than anything a model
would produce on demand. The daily challenge picks from the date, so every player
gets the same one with no server coordination.

**The model is `claude-haiku-4-5-20251001`, pinned to the dated snapshot.** In a
timed game the verdict speed *is* the product. Haiku is the fastest model that
can look at a photograph and be funny about it. The version is pinned rather than
aliased so a model update cannot silently change the judge's character.

**Paper and ink, not a dark app with an accent colour.** The whole interface is
an adjudicator's desk: buff paper, two stamp-pad inks, and one moment of
violence when the stamp lands. Full rationale in [DESIGN.md](DESIGN.md).

**No hex literal exists outside `src/design/tokens.ts`.** An ESLint rule fails the
build on one, and a unit test asserts that every ink in the palette clears WCAG
AA against the paper it sits on — so a palette edit that breaks contrast fails
CI rather than shipping.

## Security

- The Anthropic key exists only in the server environment. Never in
  `app.config.ts`, never in an `EXPO_PUBLIC_*` variable, never committed.
- CI builds the bundle and greps it for key material; a hit fails the build. The
  scanner is itself verified against a planted key.
- Images are never persisted server-side and never logged.
- No analytics SDK, no trackers, no fingerprinting. An anonymous device id in
  the secure enclave is the only identifier, and it exists only to rate-limit.

## Known limitations

- **You can photograph a picture of an object on a screen.** Reliable
  screen-detection is out of scope. Naming the hole is better than half-filling it.
- **The judge is inconsistent at the margins.** The generous tie-break above is
  the deliberate response to that, not a fix for it.
- **No offline play.** Judging needs a network round trip.
- **Not on the App Store.** Distribution is a development build and TestFlight.

## Licence

Code is MIT. Archivo and Martian Mono are used under the SIL Open Font License
1.1, which permits embedding in shipped software; each font's licence travels
with it in `node_modules/@expo-google-fonts/*/LICENSE_FONT`.
