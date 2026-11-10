import { describe, it, expect } from 'vitest';
import { scatterSparkles, MAX_SPARKLES, type Sparkle } from '../sparkles';

const SIZE_RANGES: Record<Sparkle['kind'], [number, number]> = {
  fleck: [4, 9],
  star: [8, 16],
  bokeh: [24, 60],
};

function scatter(count: number, seed = 2026): Sparkle[] {
  return scatterSparkles({ count, seed });
}

describe('scatterSparkles', () => {
  it('returns exactly the requested number of sparkles when under the cap', () => {
    expect(scatter(30)).toHaveLength(30);
  });

  it('caps the sparkle count for mobile performance', () => {
    expect(scatter(500)).toHaveLength(MAX_SPARKLES);
  });

  it('returns no sparkles for a non-positive count', () => {
    expect(scatter(0)).toHaveLength(0);
    expect(scatter(-5)).toHaveLength(0);
  });

  it('scatters sparkles across the full cover, including behind the text', () => {
    const sparkles = scatter(36);
    expect(sparkles).not.toHaveLength(0);
    for (const sparkle of sparkles) {
      expect(sparkle.xPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.xPct).toBeLessThanOrEqual(100);
      expect(sparkle.yPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('round-robins the three kinds in an exact 3:2:1 fleck:star:bokeh ratio', () => {
    const sparkles = scatter(24);
    const counts = { fleck: 0, star: 0, bokeh: 0 };
    for (const sparkle of sparkles) {
      counts[sparkle.kind]++;
    }
    expect(counts.fleck).toBe(12);
    expect(counts.star).toBe(8);
    expect(counts.bokeh).toBe(4);
  });

  it('includes all 3 kinds once the count reaches 6', () => {
    const sparkles = scatter(6);
    const kinds = new Set(sparkles.map((sparkle) => sparkle.kind));
    expect(kinds).toEqual(new Set(['fleck', 'star', 'bokeh']));
  });

  it('sizes each kind within its own range', () => {
    const sparkles = scatter(36);
    for (const sparkle of sparkles) {
      const [min, max] = SIZE_RANGES[sparkle.kind];
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(min);
      expect(sparkle.sizePx).toBeLessThanOrEqual(max);
    }
  });

  it('staggers sparkle start times within 0-4000ms', () => {
    const sparkles = scatter(36);
    for (const sparkle of sparkles) {
      expect(sparkle.delayMs).toBeGreaterThanOrEqual(0);
      expect(sparkle.delayMs).toBeLessThanOrEqual(4000);
    }
  });

  it('gives every sparkle a 2400-4800ms twinkle duration', () => {
    const sparkles = scatter(36);
    for (const sparkle of sparkles) {
      expect(sparkle.durationMs).toBeGreaterThanOrEqual(2400);
      expect(sparkle.durationMs).toBeLessThanOrEqual(4800);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(scatter(36, 2026)).toEqual(scatter(36, 2026));
  });

  it('varies the layout when the seed changes', () => {
    expect(scatter(36, 2026)).not.toEqual(scatter(36, 7));
  });
});
