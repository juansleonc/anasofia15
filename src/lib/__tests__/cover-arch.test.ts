import { describe, it, expect } from 'vitest';
import {
  ARCH_SPECS,
  archClearanceVars,
  archFadeMask,
  archSpinePoint,
  buildArch,
  type ArchItem,
  type ArchSpec,
} from '../cover-arch';

const SPECS: ArchSpec[] = [ARCH_SPECS.portrait, ARCH_SPECS.landscape];
const EXTRA_SEEDS = [2, 100, 4242, 777777, 9];
const SEEDED_SPECS: ArchSpec[] = [
  ...SPECS,
  ...SPECS.flatMap((spec) => EXTRA_SEEDS.map((seed) => ({ ...spec, seed }))),
];

describe('buildArch', () => {
  it('produces an identical layout for the same spec, run twice', () => {
    for (const spec of SPECS) {
      expect(buildArch(spec)).toEqual(buildArch(spec));
    }
  });

  it('produces a different layout for a different seed', () => {
    for (const spec of SPECS) {
      const a = buildArch(spec);
      const b = buildArch({ ...spec, seed: spec.seed + 1 });
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    }
  });

  it('sorts items by layer, non-decreasing', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      for (let i = 1; i < items.length; i++) {
        expect(items[i].layer).toBeGreaterThanOrEqual(items[i - 1].layer);
      }
    }
  });

  it('places exactly the spec-requested number of balloons, fillers included', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      expect(balloons).toHaveLength(spec.counts.balloons + spec.counts.fillers);
    }
  });

  it('returns the spec viewBox as width/height', () => {
    for (const spec of SPECS) {
      const layout = buildArch(spec);
      expect(layout.width).toBe(spec.width);
      expect(layout.height).toBe(spec.height);
    }
  });

  it('guarantees every balloon tone a floor(n/3) share, for both specs', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      const minShare = Math.floor(spec.counts.balloons / 3);
      const tallies = { pink: 0, rosegold: 0, champagne: 0 } as Record<string, number>;
      for (const balloon of balloons) {
        tallies[balloon.tone as string] += 1;
      }
      expect(tallies.pink).toBeGreaterThanOrEqual(minShare);
      expect(tallies.rosegold).toBeGreaterThanOrEqual(minShare);
      expect(tallies.champagne).toBeGreaterThanOrEqual(minShare);
    }
  });

  it('each metallic tone shows both the chrome and the satin finish', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const symbols = items.filter((item) => item.kind === 'balloon').map((item) => item.symbol);
      expect(symbols).toEqual(expect.arrayContaining(['balloon-rosegold', 'balloon-rosegold-satin']));
      expect(symbols).toEqual(expect.arrayContaining(['balloon-champagne', 'balloon-champagne-satin']));
      expect(symbols).not.toContain('balloon-pink-satin');
    }
  });

  it('keeps every balloon symbol matching its own tone, pink always pearl', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      for (const item of items.filter((i) => i.kind === 'balloon')) {
        if (item.tone === 'pink') {
          expect(item.symbol).toBe('balloon-pink');
        } else if (item.tone === 'rosegold') {
          expect(['balloon-rosegold', 'balloon-rosegold-satin']).toContain(item.symbol);
        } else {
          expect(item.tone).toBe('champagne');
          expect(['balloon-champagne', 'balloon-champagne-satin']).toContain(item.symbol);
        }
      }
    }
  });

  it('assigns one of each tone when a spec asks for exactly three balloons', () => {
    const spec: ArchSpec = { ...ARCH_SPECS.portrait, counts: { ...ARCH_SPECS.portrait.counts, balloons: 3, fillers: 0 } };
    const { items } = buildArch(spec);
    const tones = items.filter((item) => item.kind === 'balloon').map((item) => item.symbol);
    expect(tones.sort()).toEqual(['balloon-champagne', 'balloon-pink', 'balloon-rosegold']);
  });

  it('places exactly the spec-requested number of flowers, using all four flower symbols', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((item) => item.kind === 'flower');
      expect(flowers).toHaveLength(spec.counts.flowers);
      const symbols = new Set(flowers.map((item) => item.symbol));
      expect(symbols).toEqual(new Set(['rose-pink', 'rose-cream', 'peony-blush', 'blossom']));
    }
  });

  it('places exactly the spec-requested number of leaves, using all three leaf symbols', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const leaves = items.filter((item) => item.kind === 'leaf');
      expect(leaves).toHaveLength(spec.counts.leaves);
      const symbols = new Set(leaves.map((item) => item.symbol));
      expect(symbols).toEqual(new Set(['leaf-eucalyptus', 'leaf-olive', 'leaf-gold']));
    }
  });

  it('paints leaves on layer 0 and flowers on the top layer, in front of every balloon', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((i) => i.kind === 'flower');
      const balloons = items.filter((i) => i.kind === 'balloon');
      expect(flowers.length).toBeGreaterThan(0);
      const topBalloonLayer = Math.max(...balloons.map((b) => b.layer));
      for (const item of flowers) {
        expect(item.layer).toBe(3);
        expect(item.layer).toBeGreaterThan(topBalloonLayer);
      }
      for (const item of items.filter((i) => i.kind === 'leaf')) {
        expect(item.layer).toBe(0);
      }
    }
  });

  it('keeps every item center within the viewBox, allowing bleed up to its max size', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const maxSize = spec.sizeRange[1];
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.x).toBeGreaterThanOrEqual(-maxSize);
        expect(item.x).toBeLessThanOrEqual(spec.width + maxSize);
        expect(item.y).toBeGreaterThanOrEqual(-maxSize);
        expect(item.y).toBeLessThanOrEqual(spec.height);
      }
    }
  });

  it('keeps every item circle clear of the text zone below the band', () => {
    const extraSeeds = [2, 100, 4242, 777777, 9];
    const specs = [
      ...SPECS,
      ...SPECS.flatMap((spec) => extraSeeds.map((seed) => ({ ...spec, seed }))),
    ];
    for (const spec of specs) {
      const { items } = buildArch(spec);
      for (const item of items) {
        const r = item.size / 2;
        const nearestX = clampNumber(item.x, spec.gutter, spec.width - spec.gutter);
        const nearestY = clampNumber(item.y, spec.band, spec.height);
        const distance = Math.hypot(item.x - nearestX, item.y - nearestY);
        expect(distance).toBeGreaterThanOrEqual(r);
      }
    }
  });

  it('really descends both side columns down to near sideDepth', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const leftThird = spec.width / 3;
      const rightThird = (spec.width * 2) / 3;
      const minY = spec.sideDepth - spec.sizeRange[1];
      const leftDescends = items.some((item) => item.x < leftThird && item.y >= minY);
      const rightDescends = items.some((item) => item.x > rightThird && item.y >= minY);
      expect(leftDescends).toBe(true);
      expect(rightDescends).toBe(true);
    }
  });

  it('spans the crown from past the left gutter to past the right gutter', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const crownLeft = items.some((item) => item.x < spec.gutter && item.y < spec.band);
      const crownRight = items.some((item) => item.x > spec.width - spec.gutter && item.y < spec.band);
      expect(crownLeft).toBe(true);
      expect(crownRight).toBe(true);
    }
  });

  it('fills the crown with most of the balloons', () => {
    const extraSeeds = [2, 100, 4242, 777777, 9];
    const specs = [...SPECS, ...SPECS.flatMap((spec) => extraSeeds.map((seed) => ({ ...spec, seed })))];
    for (const spec of specs) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      const inCrown = balloons.filter((item) => item.y < spec.band).length;
      expect(inCrown / balloons.length).toBeGreaterThanOrEqual(0.55);
    }
  });

  it('balloons overlap into a full garland', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      const overlapping = balloons.filter((item) =>
        balloons.some(
          (other) =>
            other !== item &&
            Math.hypot(item.x - other.x, item.y - other.y) < (item.size + other.size) / 2,
        ),
      );
      expect(overlapping.length / balloons.length).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe('airy garland', () => {
  // Below `fadeStart` the side columns are masked out, so only the opaque part has to stay whole.
  it('keeps every visible item wholly inside the canvas, never cut at an edge', () => {
    for (const spec of SEEDED_SPECS) {
      const visible = buildArch(spec).items.filter((item) => item.y <= spec.fadeStart);
      expect(visible.length).toBeGreaterThan(0);
      for (const item of visible) {
        const r = item.size / 2;
        const where = `${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)}) size ${item.size.toFixed(1)}`;
        expect(item.x - r, where).toBeGreaterThanOrEqual(0);
        expect(item.x + r, where).toBeLessThanOrEqual(spec.width);
        expect(item.y - r, where).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // Overlap stays modest: no balloon or flower hides more than 40% of itself behind the items
  // painted in front of it.
  it('never buries a balloon or flower more than 40% under the items in front of it', () => {
    for (const spec of SEEDED_SPECS) {
      const { items } = buildArch(spec);
      const solids = items.filter((item) => item.kind !== 'leaf');
      expect(solids.length).toBeGreaterThan(0);
      solids.forEach((item, index) => {
        const inFront = solids.slice(index + 1);
        const where = `${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`;
        expect(coveredFraction(item, inFront), where).toBeLessThanOrEqual(0.4);
      });
    }
  });

  // Airy but continuous: background shows between items along the spine, yet no hole along it is
  // wider than a big balloon, so the ∩ still reads as one band.
  it('covers the visible spine with soft gaps but no big holes', () => {
    for (const spec of SEEDED_SPECS) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      const runs = spineCoverage(spec, solids);
      expect(runs.samples).toBeGreaterThan(300);
      expect(runs.covered / runs.samples).toBeGreaterThanOrEqual(0.65);
      expect(runs.covered / runs.samples).toBeLessThanOrEqual(0.9);
      const maxBalloon = Math.max(...solids.filter((item) => item.kind === 'balloon').map((item) => item.size));
      expect(runs.maxGap).toBeLessThanOrEqual(1.2 * maxBalloon);
    }
  });

  // The reference mockup's corners carry a little more balloon mass than the middle of the crown
  // — a crown spread evenly by area would put ~50% in the outer quarters — without piling up.
  it('weights the crown gently toward its two top corners', () => {
    for (const spec of SEEDED_SPECS) {
      const crown = buildArch(spec).items.filter((item) => item.kind === 'balloon' && item.y < spec.band);
      const inCorners = crown.filter((item) => item.x < spec.width * 0.25 || item.x > spec.width * 0.75);
      const weight = balloonArea(inCorners) / balloonArea(crown);
      expect(weight).toBeGreaterThanOrEqual(0.5);
      expect(weight).toBeLessThanOrEqual(0.65);
    }
  });
});

describe('flower prominence', () => {
  // The reference mockup's roses and peonies read almost as big as the balloons beside them,
  // sitting in front and clustered in twos and threes, rather than as small accents.
  it('sizes flowers close to the main balloons around them', () => {
    for (const spec of SEEDED_SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((item) => item.kind === 'flower').map((item) => item.size);
      const mainBalloons = items
        .filter((item) => item.kind === 'balloon' && item.size > 0.6 * spec.sizeRange[1])
        .map((item) => item.size);
      expect(flowers.length).toBeGreaterThan(0);
      expect(mainBalloons.length).toBeGreaterThan(0);
      const ratio = median(flowers) / median(mainBalloons);
      expect(ratio).toBeGreaterThanOrEqual(0.8);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it('clusters flowers in twos or threes in both outer quarters of the crown', () => {
    for (const spec of SEEDED_SPECS) {
      const flowers = buildArch(spec).items.filter((item) => item.kind === 'flower');
      const left = flowers.filter((item) => item.x < spec.width * 0.25);
      const right = flowers.filter((item) => item.x > spec.width * 0.75);
      expect(hasCluster(left)).toBe(true);
      expect(hasCluster(right)).toBe(true);
    }
  });

  it('gives the landscape crown center a flower cluster as a focal point', () => {
    for (const spec of SEEDED_SPECS.filter((s) => s.width === ARCH_SPECS.landscape.width)) {
      const flowers = buildArch(spec).items.filter((item) => item.kind === 'flower');
      const center = flowers.filter((item) => Math.abs(item.x - spec.width / 2) < spec.width * 0.1);
      expect(hasCluster(center)).toBe(true);
    }
  });

  it('keeps every flower wholly inside the canvas, never cut at an edge', () => {
    for (const spec of SEEDED_SPECS) {
      const flowers = buildArch(spec).items.filter((item) => item.kind === 'flower');
      expect(flowers.length).toBeGreaterThan(0);
      for (const flower of flowers) {
        const r = flower.size / 2;
        expect(flower.x - r).toBeGreaterThanOrEqual(0);
        expect(flower.x + r).toBeLessThanOrEqual(spec.width);
        expect(flower.y - r).toBeGreaterThanOrEqual(0);
        expect(flower.y + r).toBeLessThanOrEqual(spec.height);
      }
    }
  });
});

describe('mirror balance', () => {
  // The two sides of the arch carry the same visual weight: the right half is the left half
  // mirrored across the vertical axis, with only small jitter and swapped colour/symbol variants.
  function sides(spec: ArchSpec): { left: ArchItem[]; right: ArchItem[] } {
    const { items } = buildArch(spec);
    const axis = spec.width / 2;
    return { left: items.filter((item) => item.x < axis), right: items.filter((item) => item.x > axis) };
  }

  function meanSize(items: ArchItem[]): number {
    return items.reduce((sum, item) => sum + item.size, 0) / items.length;
  }

  function withinRatio(a: number, b: number, tolerance: number): boolean {
    return Math.abs(a - b) / Math.max(a, b) <= tolerance;
  }

  it('puts the same number of balloons on each side, give or take one', () => {
    for (const spec of SEEDED_SPECS) {
      const { left, right } = sides(spec);
      const leftBalloons = left.filter((item) => item.kind === 'balloon').length;
      const rightBalloons = right.filter((item) => item.kind === 'balloon').length;
      expect(leftBalloons).toBeGreaterThan(0);
      expect(Math.abs(leftBalloons - rightBalloons)).toBeLessThanOrEqual(1);
    }
  });

  it('gives each side the same total item area, within 10%', () => {
    for (const spec of SEEDED_SPECS) {
      const { left, right } = sides(spec);
      expect(left.length).toBeGreaterThan(0);
      expect(withinRatio(balloonArea(left), balloonArea(right), 0.1)).toBe(true);
    }
  });

  it('gives each side the same mean item size, within 10%', () => {
    for (const spec of SEEDED_SPECS) {
      const { left, right } = sides(spec);
      expect(left.length).toBeGreaterThan(0);
      expect(right.length).toBeGreaterThan(0);
      expect(withinRatio(meanSize(left), meanSize(right), 0.1)).toBe(true);
    }
  });

  it('mirrors every left item with a right item of the same kind', () => {
    for (const spec of SEEDED_SPECS) {
      const { left, right } = sides(spec);
      const tolerance = 0.06 * spec.width;
      expect(left.length).toBeGreaterThan(0);
      for (const item of left) {
        const mirrored = right.some(
          (other) =>
            other.kind === item.kind &&
            Math.abs(spec.width - other.x - item.x) <= tolerance &&
            Math.abs(other.y - item.y) <= tolerance,
        );
        expect(mirrored, `${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`).toBe(true);
      }
    }
  });

  it('crowns the arch with a flower cluster centered on the axis', () => {
    for (const spec of SEEDED_SPECS) {
      const flowers = buildArch(spec).items.filter((item) => item.kind === 'flower');
      const axis = spec.width / 2;
      const center = flowers.filter((item) => Math.abs(item.x - axis) < spec.width * 0.1);
      expect(hasCluster(center)).toBe(true);
      const meanX = center.reduce((sum, item) => sum + item.x, 0) / center.length;
      expect(Math.abs(meanX - axis)).toBeLessThanOrEqual(spec.width * 0.02);
    }
  });

  it('varies the mirrored side rather than copying it exactly', () => {
    for (const spec of SEEDED_SPECS) {
      const { left, right } = sides(spec);
      const signature = (items: ArchItem[]): string[] =>
        items.map((item) => `${item.kind}:${item.symbol}:${item.tone ?? ''}`).sort();
      expect(left.length).toBeGreaterThan(0);
      expect(signature(right)).not.toEqual(signature(left));
    }
  });
});

describe('ARCH_SPECS restraint', () => {
  // Fewer, better-spaced items than the earlier packed garland (30+12 / 46+16 balloons, 74 / 109
  // items in all), so the arch's shape can breathe.
  it('keeps both specs lighter than the earlier packed garland', () => {
    const total = (spec: ArchSpec): number =>
      spec.counts.balloons + spec.counts.fillers + spec.counts.flowers + spec.counts.leaves;
    expect(ARCH_SPECS.portrait.counts.balloons).toBeLessThan(30);
    expect(ARCH_SPECS.portrait.counts.fillers).toBeLessThan(12);
    expect(total(ARCH_SPECS.portrait)).toBeLessThan(74);
    expect(ARCH_SPECS.landscape.counts.balloons).toBeLessThan(46);
    expect(ARCH_SPECS.landscape.counts.fillers).toBeLessThan(16);
    expect(total(ARCH_SPECS.landscape)).toBeLessThan(109);
  });

  it('still leaves both specs enough items for a full arch', () => {
    expect(ARCH_SPECS.portrait.counts.balloons).toBeGreaterThanOrEqual(18);
    expect(ARCH_SPECS.portrait.counts.flowers).toBeGreaterThanOrEqual(6);
    expect(ARCH_SPECS.landscape.counts.balloons).toBeGreaterThanOrEqual(28);
    expect(ARCH_SPECS.landscape.counts.flowers).toBeGreaterThanOrEqual(10);
  });
});

describe('archClearanceVars', () => {
  it('derives the portrait and landscape band ratios from the specs', () => {
    const vars = archClearanceVars(ARCH_SPECS);
    const portraitRatio = ARCH_SPECS.portrait.band / ARCH_SPECS.portrait.width;
    const landscapeRatio = ARCH_SPECS.landscape.band / ARCH_SPECS.landscape.width;
    expect(vars).toBe(`--arch-band-portrait:${portraitRatio};--arch-band-landscape:${landscapeRatio}`);
  });
});

describe('archFadeMask', () => {
  it('keeps fadeStart between the band and the height, for both specs', () => {
    for (const spec of SPECS) {
      expect(spec.fadeStart).toBeGreaterThanOrEqual(spec.band);
      expect(spec.fadeStart).toBeLessThan(spec.height);
    }
  });

  it('derives the opaque stop percentage from the spec and fades fully by the bottom', () => {
    for (const spec of SPECS) {
      const stopPercent = (spec.fadeStart / spec.height) * 100;
      const mask = archFadeMask(spec);
      expect(mask).toContain(`var(--c-white) ${stopPercent}%`);
      expect(mask.endsWith('transparent 100%)')).toBe(true);
    }
  });
});

function isVisibleGarland(spec: ArchSpec, point: { x: number; y: number }): boolean {
  return (
    point.x >= 0 &&
    point.x <= spec.width &&
    point.y >= 0 &&
    point.y <= spec.fadeStart &&
    !(point.y > spec.band && point.x > spec.gutter && point.x < spec.width - spec.gutter)
  );
}

/**
 * Walks the spine's visible stretch and reports how many samples fall inside some item, plus the
 * longest uncovered run along it (in viewBox units).
 */
function spineCoverage(
  spec: ArchSpec,
  solids: ArchItem[],
): { samples: number; covered: number; maxGap: number } {
  const steps = 1200;
  let samples = 0;
  let covered = 0;
  let gap = 0;
  let maxGap = 0;
  let previous = archSpinePoint(spec, 0);
  for (let i = 0; i < steps; i++) {
    const point = archSpinePoint(spec, i / (steps - 1));
    const stepLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
    if (!isVisibleGarland(spec, point)) {
      gap = 0;
      continue;
    }
    samples += 1;
    if (solids.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= item.size / 2)) {
      covered += 1;
      gap = 0;
    } else {
      gap += stepLength;
      maxGap = Math.max(maxGap, gap);
    }
  }
  return { samples, covered, maxGap };
}

/** Fraction of `item`'s disc that lies under at least one of `others`, by grid sampling. */
function coveredFraction(item: ArchItem, others: ArchItem[]): number {
  const n = 16;
  const r = item.size / 2;
  let inside = 0;
  let covered = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = item.x + r * ((2 * (i + 0.5)) / n - 1);
      const y = item.y + r * ((2 * (j + 0.5)) / n - 1);
      if (Math.hypot(x - item.x, y - item.y) > r) continue;
      inside += 1;
      if (others.some((other) => Math.hypot(x - other.x, y - other.y) <= other.size / 2)) {
        covered += 1;
      }
    }
  }
  return covered / inside;
}

function balloonArea(items: ArchItem[]): number {
  return items.reduce((sum, item) => sum + item.size * item.size, 0);
}

/** True when at least two of `flowers` sit within 1.2x their mean size of each other. */
function hasCluster(flowers: ArchItem[]): boolean {
  return flowers.some((a) =>
    flowers.some((b) => a !== b && Math.hypot(a.x - b.x, a.y - b.y) <= 1.2 * ((a.size + b.size) / 2)),
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
