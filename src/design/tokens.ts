/**
 * The Adjudicator's Desk — design tokens.
 *
 * This is the ONLY file in the codebase permitted to contain a hex colour
 * literal. The `no-restricted-syntax` rule in eslint.config.js fails the build
 * on a hex literal anywhere else. If you need a value that is not here, that is
 * a design decision: raise it, do not invent it inline.
 *
 * Rationale for every value lives in DESIGN.md.
 */

/**
 * Five colours. Each is named for what it means on the adjudicator's desk, not
 * for its position in a hierarchy.
 *
 * Contrast ratios are measured against `buff`, which is the ground for all text
 * in the app. All four ink values clear WCAG AA (4.5:1) for normal-size text.
 */
export const colour = {
  /** The paper. Everything sits on this. The app has no other background. */
  buff: '#E8DCC4',
  /** Warm near-black. All primary type and every rule drawn in pen. 15.1:1 */
  ink: '#1C1A17',
  /** The stamp pad. Used by BOTH verdicts — see DESIGN.md on why. 7.66:1 */
  padViolet: '#4B2E83',
  /** The second pad: printed rules, the timer bar, the shutter ring. 5.67:1 */
  padTeal: '#1F5C58',
  /** Ink soaked into the fibre. Secondary and supporting text only. 4.72:1 */
  bleed: '#6B5D46',
} as const;

export type ColourName = keyof typeof colour;

/**
 * Font families, resolved from the two OFL-1.1 licensed families loaded in
 * app/_layout.tsx. Licence verified in node_modules/@expo-google-fonts/
 * {archivo,martian-mono}/LICENSE_FONT — both permit embedding in shipped
 * software.
 *
 * Martian Mono appears in exactly two roles, both genuine numeric readouts.
 * It is not used for small labels to look technical.
 */
export const family = {
  archivoRegular: 'Archivo_400Regular',
  archivoMedium: 'Archivo_500Medium',
  archivoSemiBold: 'Archivo_600SemiBold',
  archivoBold: 'Archivo_700Bold',
  monoRegular: 'MartianMono_400Regular',
  monoSemiBold: 'MartianMono_600SemiBold',
} as const;

/**
 * Type scale, by role rather than by size. Sizes are unscaled points; React
 * Native applies the user's Dynamic Type setting on top, so no layout may
 * assume a fixed text height.
 */
export const type = {
  /** The hunt prompt on the band above the preview. Read at a glance. */
  prompt: { fontFamily: family.archivoSemiBold, fontSize: 30, lineHeight: 36 },
  /** The judge's sentence on the verdict card. */
  ruling: { fontFamily: family.archivoMedium, fontSize: 21, lineHeight: 28 },
  /** Running text: priming copy, about screen, error states. */
  body: { fontFamily: family.archivoRegular, fontSize: 17, lineHeight: 25 },
  /** Supporting text. Always rendered in `bleed`, never smaller than this. */
  label: { fontFamily: family.archivoMedium, fontSize: 13, lineHeight: 18 },
  /** The word cut into the rubber: ADMITTED / NOT ADMITTED. */
  stampFace: { fontFamily: family.archivoBold, fontSize: 19, lineHeight: 21 },
  /** Readout 1: the countdown numeral, last five seconds only. */
  countdown: { fontFamily: family.monoSemiBold, fontSize: 40, lineHeight: 44 },
  /** Readout 2: the case number printed on the stamp. */
  caseNumber: { fontFamily: family.monoRegular, fontSize: 11, lineHeight: 14 },
} as const;

export type TypeRole = keyof typeof type;

/** Spacing rhythm. A form is set on a grid; so is this. */
export const space = {
  hair: 2,
  tight: 4,
  snug: 8,
  base: 12,
  roomy: 20,
  wide: 32,
  vast: 48,
} as const;

/** Line weights, in points. Printed rules are thin; stamped edges are not. */
export const stroke = {
  rule: 1,
  timer: 4,
  stamp: 3,
} as const;

/**
 * Motion. One orchestrated moment (develop, then stamp) and nothing else.
 * Durations are milliseconds. With reduce-motion enabled every duration
 * collapses to `still` and the final composition is presented intact.
 */
export const motion = {
  still: 0,
  /** The print coming up to full contrast. Covers the judge's round trip. */
  develop: 1400,
  /** The stamp travelling down onto the print. Deliberately abrupt. */
  strike: 180,
  /** Paper sliding away as the next round is dealt. */
  deal: 260,
  /** The stamp's resting rotation, in degrees. Never zero. */
  stampTiltDeg: -7,
} as const;
