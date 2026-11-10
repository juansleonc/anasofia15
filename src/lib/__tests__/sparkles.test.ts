import { describe, it, expect } from 'vitest';
import {
  scatterSparkles,
  ringSparkles,
  lowerGlitter,
  confettiSlivers,
  MAX_SPARKLES,
  MIN_DISTANCE_PCT,
  LOWER_REGION_START_PCT,
  LOWER_MIN_DISTANCE_PCT,
  MAX_SLIVERS,
  SLIVER_WIDTH_PX,
  SLIVER_UPPER_BAND,
  type Sparkle,
  type KeepOutRect,
} from '../sparkles';

const SIZE_RANGES: Record<Sparkle['kind'], [number, number]> = {
  glow: [3, 7],
  star: [8, 14],
  bokeh: [26, 58],
  sliver: [7, 12],
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
    const counts = { glow: 0, star: 0, bokeh: 0, sliver: 0 };
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

// Nov 2026 user-feedback pass: "la mitad inferior se siente desaprovechada" — the lower half
// (below the button) gets its own soft glitter band (tiny twinkling flecks plus a few larger,
// blurred golden bokeh discs) instead of staying a flat, empty gradient.
describe('lowerGlitter', () => {
  function glitter(flakeCount: number, bokehCount: number, seed = 7421): Sparkle[] {
    return lowerGlitter({ flakeCount, bokehCount, seed });
  }

  it('returns exactly flakeCount + bokehCount particles', () => {
    expect(glitter(12, 3)).toHaveLength(15);
    expect(glitter(0, 0)).toHaveLength(0);
  });

  it('produces only glow (flecks) and bokeh (discs) kinds, in the requested amounts', () => {
    const sparkles = glitter(12, 3);
    const counts = { glow: 0, star: 0, bokeh: 0, sliver: 0 };
    for (const sparkle of sparkles) counts[sparkle.kind]++;
    expect(counts.glow).toBe(12);
    expect(counts.bokeh).toBe(3);
    expect(counts.star).toBe(0);
  });

  it('sizes every fleck (glow) between 2 and 5px', () => {
    const sparkles = glitter(12, 3);
    for (const sparkle of sparkles.filter((s) => s.kind === 'glow')) {
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(2);
      expect(sparkle.sizePx).toBeLessThanOrEqual(5);
    }
  });

  it('sizes every bokeh disc within the shared bokeh range', () => {
    const sparkles = glitter(12, 3);
    for (const sparkle of sparkles.filter((s) => s.kind === 'bokeh')) {
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(26);
      expect(sparkle.sizePx).toBeLessThanOrEqual(58);
    }
  });

  it('keeps every particle in the lower region of the cover', () => {
    const sparkles = glitter(12, 3);
    for (const sparkle of sparkles) {
      expect(sparkle.yPct).toBeGreaterThanOrEqual(LOWER_REGION_START_PCT);
      expect(sparkle.yPct).toBeLessThanOrEqual(100);
      expect(sparkle.xPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.xPct).toBeLessThanOrEqual(100);
    }
  });

  it('is denser toward the bottom edge than toward the top of the lower region', () => {
    const sparkles = glitter(12, 3, 1234);
    const midpoint = (LOWER_REGION_START_PCT + 100) / 2;
    const upperHalf = sparkles.filter((sparkle) => sparkle.yPct < midpoint).length;
    const lowerHalf = sparkles.filter((sparkle) => sparkle.yPct >= midpoint).length;
    expect(lowerHalf).toBeGreaterThan(upperHalf);
  });

  it('keeps a minimum spacing between every pair of particles', () => {
    const sparkles = glitter(12, 3);
    for (let i = 0; i < sparkles.length; i++) {
      for (let j = i + 1; j < sparkles.length; j++) {
        const distance = Math.hypot(
          sparkles[i].xPct - sparkles[j].xPct,
          sparkles[i].yPct - sparkles[j].yPct,
        );
        expect(distance).toBeGreaterThanOrEqual(LOWER_MIN_DISTANCE_PCT);
      }
    }
  });

  it('returns no particles for non-positive counts', () => {
    expect(glitter(0, 0)).toHaveLength(0);
    expect(glitter(-3, -1)).toHaveLength(0);
  });

  it('is deterministic for a given seed', () => {
    expect(glitter(12, 3, 7421)).toEqual(glitter(12, 3, 7421));
  });

  it('varies the layout when the seed changes', () => {
    expect(glitter(12, 3, 7421)).not.toEqual(glitter(12, 3, 7));
  });

  // The band used to start at 80% (only the strip under the button); it now starts around the
  // cover's own midpoint so the whole lower half reads alive.
  it('starts the band around the midpoint of the cover, well above the old under-button strip', () => {
    expect(LOWER_REGION_START_PCT).toBeLessThanOrEqual(60);
    expect(LOWER_REGION_START_PCT).toBeGreaterThanOrEqual(50);
  });

  // Mirrors the name/button rects CoverLowerGlitter.astro actually passes in.
  const NAME_AND_BUTTON_KEEP_OUT = [
    { xPct: 8, yPct: 34, widthPct: 84, heightPct: 34 }, // name
    { xPct: 10, yPct: 67, widthPct: 80, heightPct: 21 }, // button, +12px pad baked in
  ];

  // Name/button now carve keep-out rects out of the widened band so particles never land on top
  // of the title or the button.
  it('keeps every particle outside the given keep-out rects', () => {
    const keepOutRects = NAME_AND_BUTTON_KEEP_OUT;
    const sparkles = lowerGlitter({ flakeCount: 12, bokehCount: 3, seed: 7421, keepOutRects });

    expect(sparkles.length).toBeGreaterThan(0);
    for (const sparkle of sparkles) {
      for (const rect of keepOutRects) {
        const insideX = sparkle.xPct >= rect.xPct && sparkle.xPct <= rect.xPct + rect.widthPct;
        const insideY = sparkle.yPct >= rect.yPct && sparkle.yPct <= rect.yPct + rect.heightPct;
        expect(insideX && insideY).toBe(false);
      }
    }
  });

  it('still keeps minimum spacing and particle counts when keep-out rects are supplied', () => {
    const keepOutRects = NAME_AND_BUTTON_KEEP_OUT;
    const sparkles = lowerGlitter({ flakeCount: 12, bokehCount: 3, seed: 7421, keepOutRects });
    expect(sparkles).toHaveLength(15);
    for (let i = 0; i < sparkles.length; i++) {
      for (let j = i + 1; j < sparkles.length; j++) {
        const distance = Math.hypot(
          sparkles[i].xPct - sparkles[j].xPct,
          sparkles[i].yPct - sparkles[j].yPct,
        );
        expect(distance).toBeGreaterThanOrEqual(LOWER_MIN_DISTANCE_PCT);
      }
    }
  });
});

// Nov 2026 north-star pass: a handful of STATIC thin gold foil slivers — the
// north-star reference's scattered confetti ribbons — distinct from the soft-light glints above.
// No round/square chips, no animation (0 cost against the running-animation budget), and never
// over the lead/name/button text.
describe('confettiSlivers', () => {
  const TEXT_KEEP_OUT: KeepOutRect[] = [
    { xPct: 8, yPct: 34, widthPct: 84, heightPct: 34 }, // lead + name
    { xPct: 10, yPct: 67, widthPct: 80, heightPct: 21 }, // button, padded
  ];

  function slivers(count: number, seed = 90210, keepOutRects?: readonly KeepOutRect[]): Sparkle[] {
    return confettiSlivers({ count, seed, keepOutRects });
  }

  it('returns at most MAX_SLIVERS (8) slivers even when more are requested', () => {
    expect(MAX_SLIVERS).toBeLessThanOrEqual(8);
    expect(slivers(50)).toHaveLength(MAX_SLIVERS);
  });

  it('returns no slivers for a non-positive count', () => {
    expect(slivers(0)).toHaveLength(0);
    expect(slivers(-3)).toHaveLength(0);
  });

  it('produces only the sliver kind', () => {
    for (const sparkle of slivers(8)) {
      expect(sparkle.kind).toBe('sliver');
    }
  });

  it('gives every sliver an aspect ratio of at least 3:1 against the fixed sliver width', () => {
    for (const sparkle of slivers(8)) {
      expect(sparkle.sizePx / SLIVER_WIDTH_PX).toBeGreaterThanOrEqual(3);
    }
  });

  it('places every sliver only in the arch interior margin or the lower band, never the clear middle', () => {
    for (const sparkle of slivers(8)) {
      const [upperStart, upperEnd] = SLIVER_UPPER_BAND;
      const inUpperBand = sparkle.yPct >= upperStart && sparkle.yPct <= upperEnd;
      const inLowerBand = sparkle.yPct >= LOWER_REGION_START_PCT && sparkle.yPct <= 100;
      expect(inUpperBand || inLowerBand).toBe(true);
      expect(sparkle.xPct).toBeGreaterThanOrEqual(0);
      expect(sparkle.xPct).toBeLessThanOrEqual(100);
    }
  });

  it('keeps every sliver outside the given text keep-out rects', () => {
    const sparkles = slivers(8, 90210, TEXT_KEEP_OUT);
    expect(sparkles.length).toBeGreaterThan(0);
    for (const sparkle of sparkles) {
      for (const rect of TEXT_KEEP_OUT) {
        const insideX = sparkle.xPct >= rect.xPct && sparkle.xPct <= rect.xPct + rect.widthPct;
        const insideY = sparkle.yPct >= rect.yPct && sparkle.yPct <= rect.yPct + rect.heightPct;
        expect(insideX && insideY).toBe(false);
      }
    }
  });

  it('is static — every sliver carries zero delay and zero duration', () => {
    for (const sparkle of slivers(8)) {
      expect(sparkle.delayMs).toBe(0);
      expect(sparkle.durationMs).toBe(0);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(slivers(8, 90210)).toEqual(slivers(8, 90210));
  });

  it('varies the layout when the seed changes', () => {
    expect(slivers(8, 90210)).not.toEqual(slivers(8, 7));
  });
});
