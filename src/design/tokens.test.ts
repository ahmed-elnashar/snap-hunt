import { AA_NORMAL, contrast } from './contrast';
import { fontAssets } from './fonts';
import { SCHEMES, family, palette, type } from './tokens';

/**
 * The brief requires every text colour to meet WCAG AA against its background,
 * and specifically calls out checking the lightest secondary text. Asserting it
 * here means a palette edit that breaks contrast fails the build rather than
 * shipping — in either scheme, which is the point of running the same suite
 * over both.
 */
describe.each(SCHEMES)('%s scheme', (scheme) => {
  const { buff, ...inks } = palette[scheme];
  const inkEntries = Object.entries(inks);

  it.each(inkEntries)('%s meets WCAG AA against its own paper', (name, value) => {
    const ratio = contrast(value, buff);
    expect({ name, ratio: Number(ratio.toFixed(2)) }).toEqual({
      name,
      ratio: expect.any(Number),
    });
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('uses bleed as the lightest ink, and it still clears AA', () => {
    const ratios = inkEntries.map(([, value]) => contrast(value, buff));
    const bleedRatio = contrast(palette[scheme].bleed, buff);
    expect(bleedRatio).toBe(Math.min(...ratios));
    expect(bleedRatio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps the paper clear of both extremes, so it still reads as paper', () => {
    // A ground at pure white or pure black is a UI surface, not a sheet.
    expect(contrast(buff, '#FFFFFF')).toBeGreaterThan(1.05);
    expect(contrast(buff, '#000000')).toBeGreaterThan(1.05);
  });
});

describe('the two schemes', () => {
  it('name exactly the same tokens, so no call site can branch on scheme', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(Object.keys(palette.light).sort());
  });

  it('shares no value between them', () => {
    const light = new Set<string>(Object.values(palette.light));
    for (const value of Object.values(palette.dark)) {
      expect({ value, reusedFromLight: light.has(value) }).toEqual({
        value,
        reusedFromLight: false,
      });
    }
  });

  it('inverts the paper relative to the primary ink in both directions', () => {
    // Light: dark ink on light paper. Dark: light ink on dark paper.
    expect(contrast(palette.light.ink, '#FFFFFF')).toBeGreaterThan(
      contrast(palette.light.buff, '#FFFFFF'),
    );
    expect(contrast(palette.dark.ink, '#000000')).toBeGreaterThan(
      contrast(palette.dark.buff, '#000000'),
    );
  });
});

describe('contrast helper', () => {
  it('matches known values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects a value that is not a six-digit hex colour', () => {
    expect(() => contrast('#FFF', '#FFFFFF')).toThrow(/six-digit hex/);
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
    const loaded = new Set<string>(Object.keys(fontAssets));
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
    const loaded = new Set<string>(Object.keys(fontAssets));
    for (const [alias, name] of Object.entries(family)) {
      expect({ alias, loaded: loaded.has(name) }).toEqual({ alias, loaded: true });
    }
  });
});
