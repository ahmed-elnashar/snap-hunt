## What this changes

<!-- One or two sentences. What is different, and why. -->

## Review checklist

Tick what applies. If something does not apply, say so rather than leaving it
blank — a blank box reads as unchecked, not as irrelevant.

- [ ] `npm run typecheck`, `npm run lint` and `npm test` are green
- [ ] No `any`, no `@ts-ignore`, no non-null assertion without a comment saying why
- [ ] Business logic is in pure functions, not in components
- [ ] Every external boundary is Zod-validated — model output, storage, network
- [ ] Every async call has a timeout and a UI-visible error path
- [ ] No hex literal outside `src/design/tokens.ts` (`app.config.ts` is the one
      documented exception, guarded by `src/design/splash.test.ts`)
- [ ] No secret outside the server environment; `npm run scan:secrets` is clean
- [ ] New logic has tests; new UI has an accessibility label
- [ ] Every user-facing string is in the judge's voice — no "Network error"
- [ ] No commented-out code, no stray `console.log`
- [ ] `README.md` updated if behaviour changed
- [ ] `DESIGN.md` amended if the design changed, with the reason written down

## Manual checks

<!-- Which rows of docs/TESTING.md did you actually run? Name them. -->

## Anything you are unsure about

<!-- Better here than discovered in review. -->
