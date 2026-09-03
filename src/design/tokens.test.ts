import { fontAssets } from './fonts';
import { colour, family, type } from './tokens';

/**
 * The brief requires every text colour to meet WCAG AA against its background,
 * and specifically calls out checking the lightest secondary text. Asserting it
 * here means a future palette edit fails the build rather than shipping.
 *
 * WCAG 2.1 relative luminance, per w3.org/TR/WCAG21/#dfn-relative-luminance.
 */
function channel(srgb8: number): number {
  const c = srgb8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (m === null) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL = 4.5;

describe('palette contrast against buff', () => {
  const inks = [
    ['ink', colour.ink],
    ['padViolet', colour.padViolet],
    ['padTeal', colour.padTeal],
    ['bleed', colour.bleed],
  ] as const;

  it.each(inks)('%s meets WCAG AA for normal text', (name, value) => {
    const ratio = contrast(value, colour.buff);
    expect({ name, ratio: Number(ratio.toFixed(2)) }).toEqual({
      name,
      ratio: expect.any(Number),
    });
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('bleed is the lightest ink and still clears AA', () => {
    const ratios = inks.map(([, value]) => contrast(value, colour.buff));
    const bleedRatio = contrast(colour.bleed, colour.buff);
    expect(bleedRatio).toBe(Math.min(...ratios));
    expect(bleedRatio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('sanity-checks the contrast function against known values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('type scale', () => {
  it('never sets text smaller than 11pt', () => {
    for (const [role, style] of Object.entries(type)) {
      expect({ role, size: style.fontSize }).toEqual({
        role,
        size: expect.any(Number),
      });
      expect(style.fontSize).toBeGreaterThanOrEqual(11);
    }
  });

  it('gives every role a line height with room to breathe', () => {
    for (const style of Object.values(type)) {
      expect(style.lineHeight).toBeGreaterThan(style.fontSize);
    }
  });

  it('uses Martian Mono for exactly the two readout roles', () => {
    const mono = Object.entries(type)
      .filter(([, style]) => style.fontFamily.startsWith('MartianMono'))
      .map(([role]) => role);
    expect(mono.sort()).toEqual(['caseNumber', 'countdown']);
  });
});

describe('fonts', () => {
  /**
   * A font family named in tokens but never loaded falls back to the system
   * face silently — it renders, it just renders wrong, and nobody notices in
   * review. This is the test that catches it.
   */
  it('loads every family named in the type scale', () => {
    const loaded = new Set(Object.keys(fontAssets));
    for (const [role, style] of Object.entries(type)) {
      expect({ role, loaded: loaded.has(style.fontFamily) }).toEqual({
        role,
        loaded: true,
      });
    }
  });

  it('bundles no face the type scale does not use', () => {
    const used = new Set<string>(Object.values(type).map((s) => s.fontFamily));
    for (const name of Object.keys(fontAssets)) {
      expect({ name, used: used.has(name) }).toEqual({ name, used: true });
    }
  });

  it('keeps the family token map in step with the loaded faces', () => {
    const loaded = new Set(Object.keys(fontAssets));
    for (const [alias, name] of Object.entries(family)) {
      expect({ alias, loaded: loaded.has(name) }).toEqual({ alias, loaded: true });
    }
  });
});
