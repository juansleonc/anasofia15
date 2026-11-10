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

describe('garland density', () => {
  // Samples the spine and two parallel lines either side of it, so a one-balloon-thin band fails
  // as well as a broken one. Only the opaque, on-canvas stretch counts: below `fadeStart` the side
  // columns are masked out, and the text clear zone is empty by design.
  it('fills the garland band solid, with no background gaps', () => {
    for (const spec of SEEDED_SPECS) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      const samples = garlandBandSamples(spec, 0.3 * spec.sizeRange[1]);
      expect(samples.length).toBeGreaterThan(300);
      const covered = samples.filter((point) =>
        solids.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= item.size / 2),
      );
      expect(covered.length / samples.length).toBeGreaterThanOrEqual(0.95);
    }
  });

  // The reference mockup's crown carries most of its balloon mass in the two top corners and
  // thins toward the middle; a crown spread evenly by area would put ~50% in the outer quarters.
  it('weights the crown toward its two top corners', () => {
    for (const spec of SEEDED_SPECS) {
      const crown = buildArch(spec).items.filter((item) => item.kind === 'balloon' && item.y < spec.band);
      const inCorners = crown.filter((item) => item.x < spec.width * 0.25 || item.x > spec.width * 0.75);
      expect(balloonArea(inCorners) / balloonArea(crown)).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('tucks small filler balloons into the garland, each touching a neighbor', () => {
    for (const spec of SEEDED_SPECS) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      const balloons = solids.filter((item) => item.kind === 'balloon');
      const fillers = balloons.filter((item) => item.size <= 0.6 * spec.sizeRange[1]);
      expect(fillers.length).toBeGreaterThanOrEqual(Math.ceil(balloons.length * 0.2));
      // Below `fadeStart` the side columns are masked out, so a stray small balloon there is never seen.
      const visibleFillers = fillers.filter((item) => item.y <= spec.fadeStart);
      expect(visibleFillers.length).toBeGreaterThan(0);
      for (const filler of visibleFillers) {
        const touches = solids.some(
          (other) =>
            other !== filler &&
            Math.hypot(filler.x - other.x, filler.y - other.y) <= (filler.size + other.size) / 2,
        );
        expect(touches).toBe(true);
      }
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

describe('ARCH_SPECS fullness', () => {
  it('keeps both specs full enough for a dense, overlapping crown', () => {
    expect(ARCH_SPECS.portrait.counts.balloons).toBeGreaterThanOrEqual(30);
    expect(ARCH_SPECS.portrait.counts.flowers).toBeGreaterThanOrEqual(8);
    expect(ARCH_SPECS.portrait.counts.leaves).toBeGreaterThanOrEqual(22);
    expect(ARCH_SPECS.landscape.counts.balloons).toBeGreaterThanOrEqual(44);
    expect(ARCH_SPECS.landscape.counts.flowers).toBeGreaterThanOrEqual(13);
    expect(ARCH_SPECS.landscape.counts.leaves).toBeGreaterThanOrEqual(30);
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

/** Points on the spine and on lines offset `halfWidth` to either side of it, kept to the visible garland. */
function garlandBandSamples(spec: ArchSpec, halfWidth: number): { x: number; y: number }[] {
  const steps = 400;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const p = archSpinePoint(spec, t);
    const ahead = archSpinePoint(spec, Math.min(1, t + 0.002));
    const behind = archSpinePoint(spec, Math.max(0, t - 0.002));
    const len = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
    const nx = -(ahead.y - behind.y) / len;
    const ny = (ahead.x - behind.x) / len;
    for (const offset of [0, -halfWidth, halfWidth]) {
      points.push({ x: p.x + nx * offset, y: p.y + ny * offset });
    }
  }
  return points.filter(
    (point) =>
      point.x >= 0 &&
      point.x <= spec.width &&
      point.y >= 0 &&
      point.y <= spec.fadeStart &&
      !(point.y > spec.band && point.x > spec.gutter && point.x < spec.width - spec.gutter),
  );
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
