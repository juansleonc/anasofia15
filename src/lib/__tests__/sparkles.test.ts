import { describe, it, expect } from 'vitest';
import { scatterSparkles, ringSparkles, MAX_SPARKLES, MIN_DISTANCE_PCT, type Sparkle } from '../sparkles';

const SIZE_RANGES: Record<Sparkle['kind'], [number, number]> = {
  glow: [3, 7],
  star: [8, 14],
  bokeh: [26, 58],
};

function scatter(count: number, seed = 2026): Sparkle[] {
  return scatterSparkles({ count, seed });
}

function distancePct(a: Sparkle, b: Sparkle): number {
  return Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
}

describe('scatterSparkles', () => {
  it('returns exactly the requested number of sparkles when under the cap', () => {
    expect(scatter(20)).toHaveLength(20);
  });

  it('caps the sparkle count at 28 for a calmer, organized scatter', () => {
    expect(MAX_SPARKLES).toBeLessThanOrEqual(28);
    expect(scatter(500)).toHaveLength(MAX_SPARKLES);
    expect(scatter(500).length).toBeLessThanOrEqual(28);
  });

  it('returns no sparkles for a non-positive count', () => {
    expect(scatter(0)).toHaveLength(0);
    expect(scatter(-5)).toHaveLength(0);
  });

  it('only ever produces glow, star or bokeh kinds — never the old hard-edged fleck', () => {
    const sparkles = scatter(28);
    expect(sparkles).not.toHaveLength(0);
    for (const sparkle of sparkles) {
      expect(['glow', 'star', 'bokeh']).toContain(sparkle.kind);
      expect(sparkle.kind).not.toBe('fleck');
    }
  });

  it('scatters sparkles across the full cover, including behind the text', () => {
    const sparkles = scatter(28);
    expect(sparkles).not.toHaveLength(0);
    for (const sparkle of sparkles) {
      expect(sparkle.xPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.xPct).toBeLessThanOrEqual(100);
      expect(sparkle.yPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('round-robins the three kinds in an exact 4:2:1 glow:star:bokeh ratio', () => {
    const sparkles = scatter(28);
    const counts = { glow: 0, star: 0, bokeh: 0 };
    for (const sparkle of sparkles) {
      counts[sparkle.kind]++;
    }
    expect(counts.glow).toBe(16);
    expect(counts.star).toBe(8);
    expect(counts.bokeh).toBe(4);
  });

  it('includes all 3 kinds once the count reaches 7', () => {
    const sparkles = scatter(7);
    const kinds = new Set(sparkles.map((sparkle) => sparkle.kind));
    expect(kinds).toEqual(new Set(['glow', 'star', 'bokeh']));
  });

  it('sizes each kind within its own range', () => {
    const sparkles = scatter(28);
    for (const sparkle of sparkles) {
      const [min, max] = SIZE_RANGES[sparkle.kind];
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(min);
      expect(sparkle.sizePx).toBeLessThanOrEqual(max);
    }
  });

  it('staggers sparkle start times within 0-4000ms', () => {
    const sparkles = scatter(28);
    for (const sparkle of sparkles) {
      expect(sparkle.delayMs).toBeGreaterThanOrEqual(0);
      expect(sparkle.delayMs).toBeLessThanOrEqual(4000);
    }
  });

  it('gives every sparkle a gentler, longer 3600-6400ms twinkle duration', () => {
    const sparkles = scatter(28);
    for (const sparkle of sparkles) {
      expect(sparkle.durationMs).toBeGreaterThanOrEqual(3600);
      expect(sparkle.durationMs).toBeLessThanOrEqual(6400);
    }
  });

  it('keeps a Poisson-like minimum distance between every pair of sparkles', () => {
    const sparkles = scatter(28);
    for (let i = 0; i < sparkles.length; i++) {
      for (let j = i + 1; j < sparkles.length; j++) {
        expect(distancePct(sparkles[i], sparkles[j])).toBeGreaterThanOrEqual(MIN_DISTANCE_PCT);
      }
    }
  });

  it('places more sparkles in the top half (near the arch/name) than in the bottom third', () => {
    const sparkles = scatter(28);
    const topHalf = sparkles.filter((sparkle) => sparkle.yPct < 50).length;
    const bottomThird = sparkles.filter((sparkle) => sparkle.yPct > 100 / 1.5).length;
    expect(topHalf).toBeGreaterThan(bottomThird);
  });

  it('is deterministic for a given seed', () => {
    expect(scatter(28, 2026)).toEqual(scatter(28, 2026));
  });

  it('varies the layout when the seed changes', () => {
    expect(scatter(28, 2026)).not.toEqual(scatter(28, 7));
  });
});

// Nov 2026 user-feedback pass: "mucho espacio vacío en el centro" — the arch is being made
// airier in a parallel task, so a small, tightly clustered ring of extra sparkles concentrates
// around the title block to re-balance it, distinct from the whole-cover `scatterSparkles` layer.
describe('ringSparkles', () => {
  function ring(count: number, seed = 4015): Sparkle[] {
    return ringSparkles({ count, seed });
  }

  it('returns exactly the requested number of sparkles', () => {
    expect(ring(5)).toHaveLength(5);
    expect(ring(0)).toHaveLength(0);
  });

  it('only ever produces glow or star kinds — never bokeh (too large/faint for a tight ring)', () => {
    const sparkles = ring(12);
    for (const sparkle of sparkles) {
      expect(['glow', 'star']).toContain(sparkle.kind);
    }
  });

  it('sizes each kind within its own range', () => {
    const sparkles = ring(12);
    for (const sparkle of sparkles) {
      const [min, max] = SIZE_RANGES[sparkle.kind];
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(min);
      expect(sparkle.sizePx).toBeLessThanOrEqual(max);
    }
  });

  it('keeps every sparkle within the 0..100 percentage box', () => {
    const sparkles = ring(12);
    for (const sparkle of sparkles) {
      expect(sparkle.xPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.xPct).toBeLessThanOrEqual(100);
      expect(sparkle.yPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.yPct).toBeLessThanOrEqual(100);
    }
  });

  it('clusters tightly around the centre, unlike the edge-to-edge whole-cover scatter', () => {
    const sparkles = ring(12);
    for (const sparkle of sparkles) {
      const distanceFromCentre = Math.hypot(sparkle.xPct - 50, sparkle.yPct - 50);
      expect(distanceFromCentre).toBeLessThanOrEqual(55);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(ring(12, 4015)).toEqual(ring(12, 4015));
  });

  it('varies the layout when the seed changes', () => {
    expect(ring(12, 4015)).not.toEqual(ring(12, 7));
  });
});
