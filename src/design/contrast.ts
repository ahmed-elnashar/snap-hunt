/**
 * WCAG 2.1 contrast, per w3.org/TR/WCAG21/#dfn-relative-luminance.
 *
 * Shared by the palette test, which fails the build when an ink drops below the
 * floor, and by the specimen sheet, which shows the live ratios. One
 * implementation so the screen cannot disagree with the test.
 */

/** Minimum ratio for normal-size text. */
export const AA_NORMAL = 4.5;

/** Minimum ratio for large text (>=18pt, or >=14pt bold) and UI components. */
export const AA_LARGE = 3;

function channel(srgb8: number): number {
  const c = srgb8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (match === null) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const n = Number.parseInt(match[1] as string, 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAA(foreground: string, background: string): boolean {
  return contrast(foreground, background) >= AA_NORMAL;
}
