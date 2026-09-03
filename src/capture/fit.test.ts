import { JUDGE_MAX_EDGE, fitLongestEdge } from './fit';

describe('fitLongestEdge', () => {
  it('scales a landscape photo to the limit on its width', () => {
    expect(fitLongestEdge(4032, 3024)).toEqual({
      width: 1024,
      height: 768,
      needsResize: true,
      constrain: 'width',
    });
  });

  it('scales a portrait photo to the limit on its height', () => {
    expect(fitLongestEdge(3024, 4032)).toEqual({
      width: 768,
      height: 1024,
      needsResize: true,
      constrain: 'height',
    });
  });

  it('handles a square photo, constraining width by convention', () => {
    expect(fitLongestEdge(2000, 2000)).toEqual({
      width: 1024,
      height: 1024,
      needsResize: true,
      constrain: 'width',
    });
  });

  it('never upscales a photo that is already smaller', () => {
    expect(fitLongestEdge(640, 480)).toEqual({
      width: 640,
      height: 480,
      needsResize: false,
      constrain: 'width',
    });
  });

  it('does not resize a photo sitting exactly on the limit', () => {
    const fit = fitLongestEdge(1024, 768);
    expect(fit.needsResize).toBe(false);
    expect(fit.width).toBe(1024);
  });

  it('resizes a photo one pixel over the limit', () => {
    expect(fitLongestEdge(1025, 1025).needsResize).toBe(true);
  });

  it('keeps the short edge of an extreme panorama at least one pixel', () => {
    const fit = fitLongestEdge(20000, 3);
    expect(fit.width).toBe(1024);
    expect(fit.height).toBeGreaterThanOrEqual(1);
  });

  it('preserves aspect ratio within a rounding pixel', () => {
    const cases: readonly (readonly [number, number])[] = [
      [4032, 3024],
      [3000, 1687],
      [1600, 1201],
      [2049, 1366],
    ];
    for (const [w, h] of cases) {
      const fit = fitLongestEdge(w, h);
      expect(Math.abs(w / h - fit.width / fit.height)).toBeLessThan(0.01);
    }
  });

  it('honours a custom max edge', () => {
    expect(fitLongestEdge(4032, 3024, 768).width).toBe(768);
  });

  it('defaults to the judge limit', () => {
    expect(JUDGE_MAX_EDGE).toBe(1024);
    expect(fitLongestEdge(4032, 3024).width).toBe(JUDGE_MAX_EDGE);
  });

  it.each([
    [0, 100],
    [100, 0],
    [-1, 100],
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
  ])('rejects invalid dimensions %p x %p', (w, h) => {
    expect(() => fitLongestEdge(w, h)).toThrow(/dimensions must be/);
  });

  it('rejects a non-positive max edge', () => {
    expect(() => fitLongestEdge(100, 100, 0)).toThrow(/maxEdge must be positive/);
  });
});
