# Snap Hunt — Design

**The Adjudicator's Desk.**

Binding once written. Read this before touching any UI. Deviating from it is
allowed when it is wrong; drifting from it silently is not. Changes go in the
[Amendments](#amendments) section at the bottom with a reason.

---

## The premise

Snap Hunt is not a camera app with a game attached. It is a **submissions
process**. You are an applicant. You submit a photograph to an office. The office
rules on it. The ruling is a rubber stamp landing on a print that has just
finished developing.

Every design decision below falls out of that one sentence. The reason to pick a
premise this specific is that it answers questions taste cannot: what does a
failure look like, what does an error message sound like, what happens while you
wait. An office already has answers to those.

---

## Pass 1 — the proposal

### Palette

Five roles, two schemes. Named for what they are on the desk, not for rank.

**Light — the top copy.** The form as it is handed to the applicant, in daylight.

| Token | Hex | Role | Contrast on `buff` |
|---|---|---|---|
| `buff` | `#E8DCC4` | The paper. Everything sits on it; there is no other background. | — |
| `ink` | `#1C1A17` | Warm near-black. All primary type, all pen rules. | 12.79 : 1 |
| `padViolet` | `#4B2E83` | The stamp pad. **Both** verdicts, accept and reject. | 7.66 : 1 |
| `padTeal` | `#1F5C58` | The second pad: printed rules, the timer bar, the shutter ring. | 5.66 : 1 |
| `bleed` | `#6B5D46` | Ink soaked into the fibre. Secondary and supporting text only. | 4.72 : 1 |

**Dark — the file copy.** An office does not make one of anything. Every
submission is taken in duplicate: the top copy goes to the applicant, the file
copy stays in the drawer, on darker stock, and never sees daylight. Dark mode is
that second sheet. Same document, same layout, same stamp — a different physical
object, which is why the values move the way they do.

| Token | Hex | Role | Contrast on `buff` |
|---|---|---|---|
| `buff` | `#2B2722` | File-copy stock. Warm brown-grey; still legibly paper, never void. | — |
| `ink` | `#EDE4D2` | The impression, read as unlifted stock. Off-white, never pure white. | 11.74 : 1 |
| `padViolet` | `#A98BDB` | The same pad, sitting on the sheet rather than soaking into it. | 5.23 : 1 |
| `padTeal` | `#5FA69C` | Second pad on file stock. | 5.24 : 1 |
| `bleed` | `#A2957E` | Secondary text on file stock. | 5.04 : 1 |

Both schemes name **exactly the same five tokens**, so no component branches on
scheme — a call site asks for `colour.padViolet` and gets whichever sheet it is
printed on. `useColours()` resolves it.

Ratios are computed by `src/design/tokens.test.ts`, which runs the same suite
over both schemes and fails the build if any ink drops below WCAG AA against its
own paper. The numbers above are that test's output, not estimates.

**Rationale.** Buff, aniline violet and a dull teal are the actual colours of
municipal stationery and rubber-stamp pads. They come from the subject. Nothing
in either palette is red or green, which is what lets a rejection be funny rather
than punitive.

**Why the dark scheme is not an inversion.** Inverting to a near-black ground
with one bright accent is the first tell on the brief's list, and it would also
break the premise — the app stops being a document and becomes a dark UI. The
file copy gives the shift a reason from the subject instead: the ground is a warm
brown-grey at roughly 20% lightness that still reads as a sheet, the ink lightens
because pigment now sits *on* dark stock rather than soaking into light stock,
and there are still two inks and a secondary rather than a single accent. The
test asserts the paper is clear of both pure white and pure black, so neither
scheme can drift into being a surface.

### Type

Two families, both **SIL Open Font License 1.1**, which explicitly permits fonts
to be "bundled, embedded, redistributed and/or sold with any software". Verified
by reading `node_modules/@expo-google-fonts/{archivo,martian-mono}/LICENSE_FONT`,
not by trusting a search result.

- **Archivo** (Omnibus-Type) — a grotesque. Everything.
- **Martian Mono** (Evil Martians) — **two roles only**, both genuine numeric
  readouts.

| Role | Face | Size / line | Where |
|---|---|---|---|
| `prompt` | Archivo SemiBold | 30 / 36 | The hunt prompt on the band. Read while walking. |
| `ruling` | Archivo Medium | 21 / 28 | The judge's sentence on the verdict card. |
| `body` | Archivo Regular | 17 / 25 | Priming copy, about screen, error states. |
| `label` | Archivo Medium | 13 / 18 | Supporting text. Always `bleed`. Never smaller. |
| `stampFace` | Archivo Bold | 19 / 21 | The word cut into the rubber. |
| `countdown` | Martian Mono SemiBold | 40 / 44 | The numeral, last five seconds only. |
| `caseNumber` | Martian Mono Regular | 11 / 14 | The case number printed on the stamp. |

Sizes are unscaled points; React Native applies Dynamic Type on top, so no layout
may assume a fixed text height.

**Rationale.** A grotesque is what forms are set in — it is institutional without
being nostalgic, and it holds up at 30pt on a band over live video. The monospace
is the one the brief warns about, so it earns its place or it does not appear:
both roles are literal readouts, a count and a serial. It never labels anything.

### Motion

**One orchestrated moment.** Everything else is still.

The verdict reveal, in three beats:

1. **Develop** — however long the judge takes, with a 1400 ms floor. The
   captured frame appears immediately as a flat, washed-out print and comes up
   to full contrast. This is not a loading state dressed up — it *is* the wait.
   The app contains no spinner.

   Measured against the live model: **median 2.0 s, p90 2.9 s** over eight warm
   requests at 1024 px. The develop is therefore driven by the response
   arriving, not by a fixed duration — a fixed 1400 ms would finish while the
   judge is still thinking and leave a fully developed print sitting under
   nothing, which is worse than a spinner because it lies. The floor exists so
   an unusually fast ruling still reads as development rather than a flicker.
2. **Strike** (180 ms). The stamp comes down. Deliberately abrupt — faster than
   feels comfortable. Haptic impact on contact.
3. **Rest.** It stays where it landed: rotated −7°, off-register, ink broken.

Still: the camera screen, the prompt band, every screen transition (cross-fade at
most). The timer rule retracts, but that is information, not decoration.

**Reduce-motion.** Not "the same thing, instantly". The verdict is presented as a
composed still: print already developed, stamp already landed, still rotated,
still broken-inked, haptic still firing. The joke survives, because the joke was
never in the tween.

**Rationale.** The one to two seconds of model latency is the only unavoidable
cost in the loop, and development time for instant film is about the same. That
coincidence is the whole design; it converts the app's worst moment into its
second-best one.

### Sound

**Two.** Not three.

| Sound | When | Why it exists |
|---|---|---|
| Shutter clack | Capture | Mechanical, not the iOS shutter. Confirms the submission left your hands. |
| Stamp thump | Verdict lands | Wood on paper. The single loudest thing in the app, at the single most important moment. |

No sound on app open. No music. Silent switch respected
(`playsInSilentMode` is **not** forced). Mute toggle in `about`. Audio session
uses `mixWithOthers` so the app never stops the player's music.

**Rationale.** An office is quiet apart from two noises, and both are the sound
of something being decided. A third sound would be filling an allowance rather
than making a decision — see the [Pass 2 critique](#pass-2--critique).

### Icon

**Concept.** A single stamp impression, caught half off the edge of the paper.

**Construction.** 1024×1024, no alpha, no transparency, no rounded corners baked
in.

- Ground: solid `buff`, edge to edge.
- One ring in `padViolet`, stroke ≈ 62 px, outer diameter ≈ 760 px.
- Centred at roughly (58%, 46%) so the ring **crops against the right edge**.
- Rotated −7°, matching the stamp's resting angle in the app.
- Ink broken: three or four irregular gaps in the stroke, heavier deposit on the
  lower-left arc where a real stamp is pressed harder.
- No text. No glyph inside. The interior is bare paper.

Must be checked by rendering at 180 px, 120 px and 60 px before acceptance.

**Rationale.** The obvious answers are a camera and a magnifying glass, which is
the reason not to use them — and neither is what this app is *about*. The app is
about being ruled on. The cropped, tilted, imperfectly inked ring has an
asymmetric silhouette, which is what makes it findable at 60 px in a grid where
almost every other icon is a centred glyph in a rounded square.

### Principles

1. **Type never sits on live video.** Chrome is opaque paper laid across the
   preview, never a scrim, never translucency. This is what makes the interface
   survive a white wall and a night street identically.
2. **One thing is loud.** The stamp. Everything around it is a form: thin rules,
   flat paper, no shadows, no cards, no radius that is not a physical edge.
3. **The office never breaks character.** Every string — errors, rate limits,
   empty states — is written by the judge. "Network error" is a design failure.
4. **Difference is never carried by colour alone.** Accept and reject share an
   ink and differ in form. That is not an accessibility concession bolted on; it
   is the design.

---

## The judge

> A long-serving adjudicator of a small municipal photographic society, who has
> ruled on some forty thousand submissions and stopped being surprised somewhere
> around the eight hundredth. They name exactly what they see, apply the rule to
> it, and move on — dry, unhurried, and privately amused by work they would never
> admit to finding amusing.

Rules, which hold whatever else changes:

- One or two sentences. Never more.
- **Names the object it actually saw, before ruling.** The specificity is what
  makes it feel like it is really looking, and it is usually where the joke is.
- No exclamation marks. No emoji. No praise words — "great job" is a failure.
- Rules against the player without softening it and without insulting them.
  Amused, never mean.
- Never breaks character, including in errors and rate limits.

### Ten calibration verdicts

These go into the system prompt verbatim as few-shot calibration. Prompt in each
case: *something round and blue*.

**Accept**

1. "A blue enamel mug. Round on every axis I can test from here. Admitted."
2. "A bicycle wheel, photographed at an angle that flatters it. The rule is satisfied."
3. "That is a drain cover, it is round, and it is arguably blue. I will allow it."
4. "A globe. I note that you did not have to leave the room. Admitted regardless."

**Reject**

5. "A fire extinguisher. Red is not blue under any lighting I recognise."
6. "A dog. Dogs are not round, whatever their owners maintain."
7. "The ceiling. I have looked at it carefully and it is still the ceiling."
8. "A blue rectangle. You were half right, which is not the same as right."

**Unclear**

9. "I see a shape, a wall, and possibly a thumb. I will assume the best of you."
10. "This is either a plate or a very committed moon. The point stands either way."

### Copy elsewhere, same voice

| Situation | String |
|---|---|
| Priming | "The judge cannot rule on a photograph it has not been shown." |
| Permission denied | "The camera has been withheld. Nothing can be submitted until the office is permitted to look." |
| Timer expired | "Time. The submission was not made." |
| Network failure | "Nothing reached the office. Your submission is unopened, and the round is not spent." |
| Timeout | "The judge is still looking, and has been for longer than is reasonable. Submit it again." |
| Rate limited | "The judge is on lunch. Back in an hour." |
| Fonts failed to load | "The office typewriter has failed to arrive." |
| Empty history | "No rulings on file." |

---

## Pass 2 — critique

The test applied to every element: **would I have produced this for any other app
with a similar brief?** If yes, it is a default rather than a decision. Four
failed. All four were changed.

### 1. `bleed` was chosen by eye and failed WCAG AA — changed

Pass 1 had `bleed` at `#8E7F63`, picked because it looked like faded ink. Measured
against `buff` it is **2.85 : 1**, well under the 4.5 : 1 floor, and it is exactly
the "lightest secondary text" the brief said to check specifically.

**Changed to `#6B5D46`, measured at 4.72 : 1.** More than that: the measurement is
now a unit test, so a future palette edit that breaks contrast fails the build
instead of shipping. Judging a contrast ratio by eye is a default; a failing test
is a decision.

### 2. The reject stamp had its own colour — removed

Pass 1 stamped accept in `padViolet` and reject in `padTeal`. Two states, two
colours is the reflex; I would have done it for any app. It also quietly
reintroduces the thing the palette was built to avoid — a colour that *means*
failure — and it makes the colour-blind case an afterthought rather than the
design.

**Both stamps are now `padViolet`.** They differ by form and word alone: accept is
a **ring** stamp reading `ADMITTED`; reject is a **bar** stamp reading
`NOT ADMITTED`. Two different objects on the desk, inked from the same pad.
"Differs by more than colour" stops being a checklist item and becomes structural.

**This is also the one thing removed.** `padTeal` survives, but only where it was
always doing real work: printed rules, the timer, the shutter ring.

### 3. Three sounds, because three were allowed — cut to two

Pass 1 had a third sound for timer expiry. The brief permits three; filling an
allowance is not designing. Expiry already has two channels — the timer rule
reaching zero, and a haptic — and a sound on failure is precisely the punitive
note the whole palette was built to avoid.

**Cut. Two sounds: shutter, stamp.**

### 4. The print was going to have a Polaroid frame — removed

"Instant film" is the right mechanism and the wrong costume. A white frame with a
fat bottom border is a stock visual that would have appeared in any app with a
photo reveal, and it would have dragged in a second white that is not in the
palette.

**The print is a plain rectangle of the photograph with a torn top edge**, sitting
directly on the buff. The *development* is the reference; the frame was only
decoration announcing it.

### What survived the test, and why

- **Buff paper with a grotesque.** Close to the "warm cream + high-contrast serif
  + terracotta accent" tell, so worth stating plainly why it is not that: there is
  no serif, there is no terracotta, and the accent is not a swatch — it is an
  object that lands on things. Buff comes from the subject (this is what the forms
  are printed on), not from wanting warmth.
- **Opaque bands over the preview.** Costs preview area, which is a real
  trade-off. It survives because the alternative — translucent chrome with a
  scrim — cannot be made to work over both a white wall and a night street, and
  the player is looking at the world more than the screen anyway.
- **Develop-as-wait.** The strongest idea here and the only one that turns a cost
  into content. Kept without change.

### Tells audited against, and where this lands

| Tell | Status |
|---|---|
| Near-black + acid accent | Avoided in both schemes. The dark ground is a warm brown-grey at ~20% lightness that reads as stock, not a surface, and carries two inks plus a secondary rather than one accent. A test asserts the paper is clear of pure black. |
| Cream + serif + terracotta | Adjacent; no serif, no terracotta. Argued above. |
| Identical rounded cards with soft grey shadows | Not present. No cards, no shadows, no radius. |
| Gradient washes | Not present. Every fill is flat. |
| Tracked-out all-caps eyebrow labels | Not present. |
| Meta strings joined with middle dots | Not present. |
| Monospace for small labels | Avoided by rule: mono appears in two readouts only. |
| Arrow appended to button text | Not present. |
| One headline word in an accent colour | Not present. |

---

## Amendments

Changes made after the Pass 2 critique, recorded rather than drifted into.

### A1 — the app has a dark mode

**What changed.** Pass 1 and Pass 2 both concluded the app should have no dark
mode, on the grounds that paper does not have one. Overruled by the product
owner: dark mode is required.

**How it was resolved.** The lazy discharge of that instruction is a near-black
ground with the violet turned up, which is both the first generated-design tell
on the brief's list and the end of the premise — it stops being a document.

Instead the requirement was answered from inside the fiction. An office takes
every submission in duplicate; the second sheet is the file copy, on darker
stock, kept in a drawer. Dark mode is that sheet. This keeps every property the
design depends on: the ground is still paper rather than a surface, there are
still two inks and a secondary rather than one accent, the accept and reject
stamps still share an ink and differ only in form, and the type scale, spacing
and motion are untouched.

**What it cost.** The original reasoning — "paper has no dark mode" — was true
of a single sheet and wrong about an office. Being made to build the thing found
a better answer than the one that was argued for, which is worth recording
plainly.

**Mechanics.** `palette.light` and `palette.dark` name identical token sets, so
no component branches on scheme; `useColours()` resolves one.
`userInterfaceStyle` is `automatic`. The contrast suite runs over both schemes,
and every ink in both clears WCAG AA against its own paper — the tightest is
`bleed` on the top copy at 4.72 : 1.

### A2 — the stamp reports the outcome, not the raw verdict

**What was underspecified.** Pass 1 defined two stamps, `ADMITTED` and
`NOT ADMITTED`, and the judge returns three rulings: accept, reject, unclear.
Building the verdict screen exposed the gap: there was no stamp for `unclear`.

**Resolved.** The stamp reports **whether the point was awarded**, which is the
thing the player actually cares about, and the ruling text underneath carries
what the judge thought. So:

- point awarded — accept, unclear, or a reject below the confidence floor →
  the **ring** die, `ADMITTED`
- point withheld — a confident reject → the **bar** die, `NOT ADMITTED`

**Why this is better than adding a third stamp.** It keeps the two dies the
design committed to, it makes the two shapes mean something legible rather than
being two arbitrary marks, and it puts the generous tie-break on screen: a
reject the judge is unsure of gets an `ADMITTED` ring above a ruling that
grumbles about the object. That contradiction is the joke, and it was invisible
until the stamp was made to report the outcome.

Both dies are still inked in the same violet. `Ruling` computes the shape from
`verdictAwardsPoint`, so the screen cannot disagree with the scoring rule.
