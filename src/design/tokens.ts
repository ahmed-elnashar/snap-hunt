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
 * Five colours, in two schemes.
 *
 * Light is the TOP COPY: the form as it is handed to the applicant, in daylight.
 * Dark is the FILE COPY: the office's own duplicate, on the darker stock that
 * lives in the drawer and never sees daylight. Same document, same layout, same
 * stamp — a different physical sheet, which is why the values move the way they
 * do. It is not an inversion; see DESIGN.md.
 *
 * Every ink in BOTH schemes is asserted to clear WCAG AA (4.5:1) against its own
 * paper by src/design/tokens.test.ts. Ratios in the comments are that test's
 * output, not estimates.
 */
export const palette = {
  light: {
    /** The paper. Everything sits on it; there is no other background. */
    buff: '#E8DCC4',
    /** Warm near-black. Primary type and pen rules. 12.79:1 */
    ink: '#1C1A17',
    /** The stamp pad. BOTH verdicts — see DESIGN.md on why. 7.66:1 */
    padViolet: '#4B2E83',
    /** Second pad: printed rules, timer bar, shutter ring. 5.66:1 */
    padTeal: '#1F5C58',
    /** Ink soaked into the fibre. Secondary text only. 4.72:1 */
    bleed: '#6B5D46',
  },
  dark: {
    /** File-copy stock. Warm brown-grey, still legibly paper, never void. */
    buff: '#2B2722',
    /** The impression, read as unlifted stock. Off-white, never pure. 11.74:1 */
    ink: '#EDE4D2',
    /** The same pad, sitting on the sheet rather than soaking in. 5.23:1 */
    padViolet: '#A98BDB',
    /** Second pad on file stock. 5.24:1 */
    padTeal: '#5FA69C',
    /** Secondary text on file stock. 5.04:1 */
    bleed: '#A2957E',
  },
} as const;

export type Scheme = keyof typeof palette;
export type Palette = (typeof palette)[Scheme];
export type ColourName = keyof Palette;

export const SCHEMES: readonly Scheme[] = ['light', 'dark'];

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
 * assume a fixed text height. The scale does not change between schemes.
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
  /** Readout: the countdown numeral, last five seconds only. */
  countdown: { fontFamily: family.monoSemiBold, fontSize: 40, lineHeight: 44 },
  /** Readout: the case number printed on the stamp. */
  caseNumber: { fontFamily: family.monoRegular, fontSize: 11, lineHeight: 14 },
  /** Readout: figures in the tally, which need to align in a column. */
  tally: { fontFamily: family.monoSemiBold, fontSize: 26, lineHeight: 32 },
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
  /**
   * Floor for the print coming up to full contrast, NOT a fixed duration.
   *
   * Measured judge latency is a median of 2.0s and a p90 of 2.9s, so a fixed
   * 1400ms develop would finish while the judge is still thinking and leave a
   * developed print sitting under nothing. The animation is driven by the
   * response arriving; this is only the minimum, so a fast ruling still reads
   * as development rather than a flicker.
   */
  develop: 1400,
  /** The stamp travelling down onto the print. Deliberately abrupt. */
  strike: 180,
  /** Paper sliding away as the next round is dealt. */
  deal: 260,
  /** The stamp's resting rotation, in degrees. Never zero. */
  stampTiltDeg: -7,
} as const;
