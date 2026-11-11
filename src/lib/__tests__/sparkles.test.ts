import { describe, it, expect } from 'vitest';
import {
  scatterSparkles,
  ringSparkles,
  lowerGlitter,
  fallingConfetti,
  driftingSparkles,
  RIBBON_WIDTH_PX,
  MAX_SPARKLES,
  MIN_DISTANCE_PCT,
  LOWER_REGION_START_PCT,
  LOWER_MIN_DISTANCE_PCT,
  type Sparkle,
} from '../sparkles';

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

// A small, tightly clustered ring of extra sparkles concentrates around the title block,
// distinct from the whole-cover `scatterSparkles` layer.
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

// The lower half (below the button) gets its own soft glitter band (tiny twinkling flecks plus a
// few larger, blurred golden bokeh discs) instead of staying a flat, empty gradient.
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
    const counts = { glow: 0, star: 0, bokeh: 0 };
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

  // Every sampled candidate is seeded-random and never lands exactly on yPct 100 (biasedLowerYPct
  // uses `random() < 1`, so its ceiling is approached but never reached) — a keep-out rect that
  // swallows the entire band still lets every placement attempt land inside it, exhausting the
  // budget and forcing the last-resort corner-anchor fallback.
  it('falls back to a fixed corner anchor when every sampled candidate lands in a keep-out rect', () => {
    const wholeBand = [{ xPct: 0, yPct: LOWER_REGION_START_PCT, widthPct: 100, heightPct: 42 }];
    const sparkles = lowerGlitter({ flakeCount: 1, bokehCount: 0, seed: 7421, keepOutRects: wholeBand });

    expect(sparkles).toHaveLength(1);
    // Every fixed anchor ({2|98|50}, {58|100}) is also inside a rect covering the whole band, so
    // the fallback exhausts its own anchor list too and settles on the last one.
    expect(sparkles[0]).toMatchObject({ xPct: 50, yPct: 100 });
  });

  it('prefers the first fixed anchor that escapes the keep-out rects over the last-resort default', () => {
    // Covers the band up to yPct 99.95 — below every candidate the seeded RNG actually draws here,
    // so sampling still exhausts its budget — but stops short of the anchors sitting at yPct 100,
    // so the first such anchor (2, 100) is found instead of falling through to the default.
    const almostWholeBand = [
      { xPct: 0, yPct: LOWER_REGION_START_PCT, widthPct: 100, heightPct: 41.95 },
    ];
    const sparkles = lowerGlitter({
      flakeCount: 1,
      bokehCount: 0,
      seed: 7421,
      keepOutRects: almostWholeBand,
    });

    expect(sparkles).toHaveLength(1);
    expect(sparkles[0]).toMatchObject({ xPct: 2, yPct: 100 });
  });
});

describe('fallingConfetti', () => {
  function pieces(seed = 1515) {
    return fallingConfetti({ ribbons: 12, seed });
  }

  it('returns only ribbons — falling glitter moved to the drift set', () => {
    const confetti = pieces();
    expect(confetti).toHaveLength(12);
    expect(confetti.every((piece) => piece.kind === 'ribbon')).toBe(true);
  });

  it('returns nothing for a non-positive count', () => {
    expect(fallingConfetti({ ribbons: 0, seed: 1 })).toHaveLength(0);
  });

  it('falls gently: 9-15s per fall, already mid-fall at load', () => {
    for (const piece of pieces()) {
      expect(piece.durationMs).toBeGreaterThanOrEqual(9000);
      expect(piece.durationMs).toBeLessThanOrEqual(15000);
      expect(piece.delayMs).toBeLessThanOrEqual(0);
      expect(piece.delayMs).toBeGreaterThanOrEqual(-piece.durationMs);
    }
  });

  it('spawns across the cover with a small drift and a half-to-one-and-a-half turn spin', () => {
    for (const piece of pieces()) {
      expect(piece.xPct).toBeGreaterThanOrEqual(6);
      expect(piece.xPct).toBeLessThanOrEqual(94);
      expect(Math.abs(piece.driftPx)).toBeLessThanOrEqual(30);
      expect(piece.spinDeg).toBeGreaterThanOrEqual(180);
      expect(piece.spinDeg).toBeLessThanOrEqual(540);
    }
  });

  it('rests each piece between 30% and 90% of the cover for reduced motion', () => {
    for (const piece of pieces()) {
      expect(piece.restYPct).toBeGreaterThanOrEqual(30);
      expect(piece.restYPct).toBeLessThanOrEqual(90);
    }
  });

  it('keeps every ribbon at least three times as long as it is wide', () => {
    const ribbons = pieces().filter((piece) => piece.kind === 'ribbon');
    expect(ribbons).toHaveLength(12);
    for (const ribbon of ribbons) {
      expect(ribbon.lengthPx / RIBBON_WIDTH_PX).toBeGreaterThanOrEqual(3);
    }
  });

  it('is deterministic for a seed and varies with it', () => {
    expect(pieces(1515)).toEqual(pieces(1515));
    expect(pieces(1515)).not.toEqual(pieces(42));
  });
});

// Sparkle particles drift from the garland toward the center and the name, rather than just
// falling straight down or twinkling in place, in visibly gold tones (see CoverConfettiFall.astro
// for the gold rendering).
describe('driftingSparkles', () => {
  function drift(seed = 3344) {
    return driftingSparkles({ glitter: 12, stars: 6, bokeh: 4, seed });
  }

  const SIZE_RANGES = {
    glitter: [3, 6] as [number, number],
    star: [14, 22] as [number, number],
    bokeh: [16, 30] as [number, number],
  };

  const PEAK_OPACITY = {
    glitter: 0.9,
    star: 0.95,
    bokeh: 0.32,
  };

  it('returns exactly the requested count per kind', () => {
    const sparkles = drift();
    expect(sparkles).toHaveLength(22);
    expect(sparkles.filter((s) => s.kind === 'glitter')).toHaveLength(12);
    expect(sparkles.filter((s) => s.kind === 'star')).toHaveLength(6);
    expect(sparkles.filter((s) => s.kind === 'bokeh')).toHaveLength(4);
  });

  it('is deterministic for a given seed and varies with it', () => {
    expect(drift(3344)).toEqual(drift(3344));
    expect(drift(3344)).not.toEqual(drift(9));
  });

  it('spawns on the garland arc: x in [20, 80], y tracking the crown curve within 1.5', () => {
    for (const sparkle of drift()) {
      expect(sparkle.xPct).toBeGreaterThanOrEqual(20);
      expect(sparkle.xPct).toBeLessThanOrEqual(80);
      const expectedY = 29 + 9 * Math.pow((sparkle.xPct - 50) / 30, 2);
      expect(Math.abs(sparkle.yPct - expectedY)).toBeLessThanOrEqual(1.5);
    }
  });

  it('travels 75-100% of the way toward (50, 57), downward and toward the centre', () => {
    for (const sparkle of drift()) {
      const toCentreX = 50 - sparkle.xPct;
      const toCentreY = 57 - sparkle.yPct;
      expect(sparkle.dyPct).toBeGreaterThan(0);
      if (sparkle.dxPct !== 0) {
        expect(Math.sign(sparkle.dxPct)).toBe(Math.sign(toCentreX));
      }
      const travelled = Math.hypot(sparkle.dxPct, sparkle.dyPct);
      const toCentre = Math.hypot(toCentreX, toCentreY);
      const fraction = travelled / toCentre;
      expect(fraction).toBeGreaterThanOrEqual(0.75);
      expect(fraction).toBeLessThanOrEqual(1.0);
    }
  });

  it('times each piece 9-14s with a negative delay already mid-flight', () => {
    for (const sparkle of drift()) {
      expect(sparkle.durationMs).toBeGreaterThanOrEqual(9000);
      expect(sparkle.durationMs).toBeLessThanOrEqual(14000);
      expect(sparkle.delayMs).toBeLessThanOrEqual(0);
      expect(sparkle.delayMs).toBeGreaterThanOrEqual(-sparkle.durationMs);
    }
  });

  it('sizes each kind within its own range, and peaks at its own fixed opacity', () => {
    for (const sparkle of drift()) {
      const [min, max] = SIZE_RANGES[sparkle.kind];
      expect(sparkle.sizePx).toBeGreaterThanOrEqual(min);
      expect(sparkle.sizePx).toBeLessThanOrEqual(max);
      expect(sparkle.peakOpacity).toBe(PEAK_OPACITY[sparkle.kind]);
    }
  });

  it('returns no particles for non-positive counts', () => {
    expect(driftingSparkles({ glitter: 0, stars: 0, bokeh: 0, seed: 1 })).toHaveLength(0);
    expect(driftingSparkles({ glitter: -2, stars: -1, bokeh: -1, seed: 1 })).toHaveLength(0);
  });
});
