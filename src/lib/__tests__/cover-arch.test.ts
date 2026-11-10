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

  it('descends to the north-star depth on both sides', () => {
    const floors = new Map([
      [ARCH_SPECS.portrait, { height: 540, fadeStart: 360 }],
      [ARCH_SPECS.landscape, { height: 600, fadeStart: 420 }],
    ]);
    for (const spec of SPECS) {
      const floor = floors.get(spec)!;
      expect(spec.height).toBeGreaterThanOrEqual(floor.height);
      expect(spec.fadeStart).toBeGreaterThanOrEqual(floor.fadeStart);
      const sideItems = buildArch(spec).items.filter((item) => item.y + item.size / 2 > spec.band);
      const reachesFade = (items: ArchItem[]): boolean =>
        items.some((item) => item.y + item.size / 2 >= spec.fadeStart);
      expect(reachesFade(sideItems.filter((item) => item.x < spec.width / 2))).toBe(true);
      expect(reachesFade(sideItems.filter((item) => item.x > spec.width / 2))).toBe(true);
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

  // The legs hold a share that follows their length, so the crown keeps a large but not total share.
  it('fills the crown with a large share of the balloons', () => {
    const extraSeeds = [2, 100, 4242, 777777, 9];
    const specs = [...SPECS, ...SPECS.flatMap((spec) => extraSeeds.map((seed) => ({ ...spec, seed })))];
    for (const spec of specs) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      const inCrown = balloons.filter((item) => item.y < spec.band).length;
      expect(inCrown / balloons.length).toBeGreaterThanOrEqual(0.45);
      expect(inCrown / balloons.length).toBeLessThanOrEqual(0.75);
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
  // Below `fadeStart` the side columns are masked out, so only the opaque part is checked. Side
  // balloons may run off the outer edge by up to 30% of their size and leaves by 40%; the top
  // edge and flowers are never cut, and nothing in the crown leaves the canvas.
  it('never cuts the top edge or a flower; side items bleed past the outer edge within limits', () => {
    const bleedLimit = { balloon: 0.3, leaf: 0.4, flower: 0 };
    for (const spec of SEEDED_SPECS) {
      const visible = buildArch(spec).items.filter((item) => item.y <= spec.fadeStart);
      expect(visible.length).toBeGreaterThan(0);
      for (const item of visible) {
        const r = item.size / 2;
        const where = `${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)}) size ${item.size.toFixed(1)}`;
        const inSideColumn = item.y + r > spec.band;
        const allowed = inSideColumn ? bleedLimit[item.kind] * item.size : 0;
        expect(item.x - r, where).toBeGreaterThanOrEqual(-allowed - 1e-9);
        expect(item.x + r, where).toBeLessThanOrEqual(spec.width + allowed + 1e-9);
        expect(item.y - r, where).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('lets some portrait side balloon bleed past each outer edge', () => {
    const spec = ARCH_SPECS.portrait;
    const sideBalloons = buildArch(spec).items.filter(
      (item) => item.kind === 'balloon' && item.y <= spec.fadeStart && item.y + item.size / 2 > spec.band,
    );
    expect(sideBalloons.some((b) => b.x - b.size / 2 < 0)).toBe(true);
    expect(sideBalloons.some((b) => b.x + b.size / 2 > spec.width)).toBe(true);
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
  // wider than half the biggest balloon, so the ∩ still reads as one band.
  it('covers the visible spine with soft gaps but no big holes', () => {
    for (const spec of SEEDED_SPECS) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      const runs = spineCoverage(spec, solids);
      expect(runs.samples).toBeGreaterThan(300);
      expect(runs.covered / runs.samples).toBeGreaterThanOrEqual(0.65);
      const maxBalloon = Math.max(...solids.filter((item) => item.kind === 'balloon').map((item) => item.size));
      expect(runs.maxGap).toBeLessThanOrEqual(0.5 * maxBalloon);
    }
  });

  // Measured in a tube one biggest-balloon wide around the visible spine, so the empty canvas
  // outside the rounded corners doesn't count as air: heavy shoulders, a lighter crown center, and
  // side columns that stay full without packing solid.
  it('weights the shoulders over the crown center and keeps the sides full', () => {
    for (const spec of SEEDED_SPECS) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      const zones = spineTubeCoverage(spec, solids);
      const where = `seed ${spec.seed} ${spec.width}x${spec.height}`;
      expect(zones.shoulders, where).toBeGreaterThanOrEqual(0.55);
      expect(zones.shoulders, where).toBeLessThanOrEqual(0.85);
      expect(zones.crownCenter, where).toBeGreaterThanOrEqual(0.3);
      expect(zones.crownCenter, where).toBeLessThanOrEqual(0.65);
      expect(zones.crownCenter, where).toBeLessThanOrEqual(zones.shoulders - 0.1);
      expect(zones.sides, where).toBeGreaterThanOrEqual(0.4);
      expect(zones.sides, where).toBeLessThanOrEqual(0.85);
    }
  });
});

describe('smooth arch curve', () => {
  // The crown flows into the side columns along one continuous rounded curve rather than turning
  // a sharp corner, so balloons and flowers drop gradually toward the sides.
  const SPINE_STEPS = 400;

  it('never turns more than 3° between consecutive spine samples', () => {
    for (const spec of SPECS) {
      const points = spineSamples(spec, SPINE_STEPS);
      let maxTurn = 0;
      for (let i = 2; i < points.length; i++) {
        const before = Math.atan2(points[i - 1].y - points[i - 2].y, points[i - 1].x - points[i - 2].x);
        const after = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
        maxTurn = Math.max(maxTurn, Math.abs(wrapRadians(after - before)));
      }
      expect((maxTurn * 180) / Math.PI).toBeLessThanOrEqual(3);
    }
  });

  it('rounds the portrait corners wider, relative to the width, than the landscape ones', () => {
    const portrait = ARCH_SPECS.portrait.cornerRadius / ARCH_SPECS.portrait.width;
    const landscape = ARCH_SPECS.landscape.cornerRadius / ARCH_SPECS.landscape.width;
    expect(portrait).toBeGreaterThanOrEqual(0.28);
    expect(portrait).toBeLessThanOrEqual(0.38);
    expect(landscape).toBeGreaterThanOrEqual(0.15);
    expect(landscape).toBeLessThanOrEqual(0.25);
  });

  it('rounds each top corner over a long stretch of the spine', () => {
    const minFraction = new Map([
      [ARCH_SPECS.portrait, 0.35],
      [ARCH_SPECS.landscape, 0.2],
    ]);
    for (const spec of SPECS) {
      const points = spineSamples(spec, SPINE_STEPS);
      const span = cornerSpan(points.slice(0, SPINE_STEPS / 2 + 1), 75, 15);
      expect(span / spec.width).toBeGreaterThanOrEqual(minFraction.get(spec)!);
    }
  });

  it('keeps every visible item centered close to the spine', () => {
    for (const spec of SEEDED_SPECS) {
      const points = spineSamples(spec, 1200);
      const visible = buildArch(spec).items.filter((item) => item.y <= spec.fadeStart);
      expect(visible.length).toBeGreaterThan(0);
      for (const item of visible) {
        const distance = Math.min(...points.map((p) => Math.hypot(p.x - item.x, p.y - item.y)));
        const where = `${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`;
        expect(distance, where).toBeLessThanOrEqual(0.6 * spec.sizeRange[1]);
      }
    }
  });

  it('tilts flowers and leaves down the left curve counter-clockwise, and the right clockwise', () => {
    for (const spec of SEEDED_SPECS) {
      const items = buildArch(spec).items.filter((item) => item.kind !== 'balloon');
      const outerLeft = items.filter((item) => item.x < spec.width * 0.15);
      const outerRight = items.filter((item) => item.x > spec.width * 0.85);
      expect(outerLeft.length).toBeGreaterThan(0);
      expect(outerRight.length).toBeGreaterThan(0);
      expect(meanRotate(outerLeft)).toBeLessThan(-8);
      expect(meanRotate(outerRight)).toBeGreaterThan(8);
    }
  });
});

describe('flower prominence', () => {
  // The reference's roses and peonies read a little smaller than the large balloons beside them,
  // sitting in front and clustered in twos and threes, rather than as small accents.
  it('sizes flowers a little smaller than the large balloons', () => {
    for (const spec of SEEDED_SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((item) => item.kind === 'flower').map((item) => item.size);
      const largeBalloons = items
        .filter((item) => item.kind === 'balloon' && item.size >= 0.75 * spec.sizeRange[1])
        .map((item) => item.size);
      expect(flowers.length).toBeGreaterThan(0);
      expect(largeBalloons.length).toBeGreaterThan(0);
      const ratio = median(flowers) / median(largeBalloons);
      expect(ratio).toBeGreaterThanOrEqual(0.6);
      expect(ratio).toBeLessThanOrEqual(0.9);
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

  // In the reference every rose is pressed into the garland: never floating, never resting only on other roses.
  it('tucks every flower into a balloon and at least one more balloon or flower', () => {
    for (const spec of SEEDED_SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((item) => item.kind === 'flower');
      const balloons = items.filter((item) => item.kind === 'balloon');
      expect(flowers.length).toBeGreaterThan(0);
      for (const flower of flowers) {
        const balloonContacts = balloons.filter((balloon) => overlapsBy(flower, balloon, 0.1)).length;
        const flowerContacts = flowers.filter((other) => other !== flower && overlapsBy(flower, other, 0.1)).length;
        const where = `seed ${spec.seed} ${spec.width}x${spec.height}: flower at (${flower.x.toFixed(1)}, ${flower.y.toFixed(1)})`;
        expect(balloonContacts, where).toBeGreaterThanOrEqual(1);
        expect(balloonContacts + flowerContacts, where).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('carries flowers down both side columns, above the fade', () => {
    for (const spec of SEEDED_SPECS) {
      const minPerSide = spec.width === ARCH_SPECS.landscape.width ? 2 : 1;
      const sideFlowers = buildArch(spec).items.filter(
        (item) => item.kind === 'flower' && item.y >= spec.band && item.y <= spec.fadeStart,
      );
      const where = `seed ${spec.seed} ${spec.width}x${spec.height}`;
      expect(sideFlowers.filter((item) => item.x < spec.width / 2).length, where).toBeGreaterThanOrEqual(minPerSide);
      expect(sideFlowers.filter((item) => item.x > spec.width / 2).length, where).toBeGreaterThanOrEqual(minPerSide);
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

describe('foliage', () => {
  // In the reference the eucalyptus and gold sprigs grow out of the balloon-and-flower mass: each
  // is pressed into it, fans away from the arch's inside and trails below the garland's end.
  function leavesAndSolids(spec: ArchSpec): { leaves: ArchItem[]; solids: ArchItem[] } {
    const { items } = buildArch(spec);
    return { leaves: items.filter((item) => item.kind === 'leaf'), solids: items.filter((item) => item.kind !== 'leaf') };
  }

  it('presses every leaf into a balloon or flower by at least 15% of its own size', () => {
    for (const spec of SEEDED_SPECS) {
      const { leaves, solids } = leavesAndSolids(spec);
      expect(leaves).toHaveLength(spec.counts.leaves);
      for (const leaf of leaves) {
        const depth = Math.max(
          ...solids.map((solid) => (leaf.size + solid.size) / 2 - Math.hypot(leaf.x - solid.x, leaf.y - solid.y)),
        );
        const where = `seed ${spec.seed} ${spec.width}x${spec.height}: leaf at (${leaf.x.toFixed(1)}, ${leaf.y.toFixed(1)})`;
        expect(depth / leaf.size, where).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('fans at least 70% of the leaves out of the arch, on the outer side of the spine', () => {
    for (const spec of SEEDED_SPECS) {
      const { leaves } = leavesAndSolids(spec);
      const spine = spineSamples(spec, 1200);
      expect(leaves.length).toBeGreaterThan(0);
      const outward = leaves.filter((leaf) => inwardOffset(spine, leaf) <= 0);
      expect(outward.length / leaves.length, `seed ${spec.seed} ${spec.width}x${spec.height}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('trails leaves down each side column and past the lowest balloon or flower', () => {
    for (const spec of SEEDED_SPECS) {
      const { leaves, solids } = leavesAndSolids(spec);
      for (const onSide of [(x: number) => x < spec.width / 2, (x: number) => x > spec.width / 2]) {
        const sideLeaves = leaves.filter((leaf) => onSide(leaf.x));
        const lowestSolid = Math.max(...solids.filter((solid) => onSide(solid.x)).map((solid) => solid.y));
        const lowestLeaf = Math.max(...sideLeaves.map((leaf) => leaf.y));
        const where = `seed ${spec.seed} ${spec.width}x${spec.height}`;
        expect(sideLeaves.filter((leaf) => leaf.y > spec.band).length, where).toBeGreaterThanOrEqual(4);
        expect(lowestLeaf - lowestSolid, where).toBeGreaterThanOrEqual(0.3 * spec.sizeRange[1]);
      }
    }
  });

  it('grows an odd leaf out on the axis, still pressed into a balloon or flower', () => {
    for (const spec of SPECS.map((s) => ({ ...s, counts: { ...s.counts, leaves: s.counts.leaves + 1 } }))) {
      const { leaves, solids } = leavesAndSolids(spec);
      const onAxis = leaves.filter((leaf) => leaf.x === spec.width / 2);
      expect(leaves).toHaveLength(spec.counts.leaves);
      expect(onAxis).toHaveLength(1);
      const [leaf] = onAxis;
      const depth = Math.max(
        ...solids.map((solid) => (leaf.size + solid.size) / 2 - Math.hypot(leaf.x - solid.x, leaf.y - solid.y)),
      );
      expect(depth / leaf.size).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('places no leaf when there is no balloon or flower to grow from', () => {
    for (const base of SPECS) {
      const spec: ArchSpec = { ...base, counts: { balloons: 0, fillers: 0, flowers: 0, leaves: base.counts.leaves + 1 } };
      expect(buildArch(spec).items).toEqual([]);
    }
  });

  it('sizes the median leaf at least 0.6 times the median large balloon', () => {
    for (const spec of SEEDED_SPECS) {
      const { items } = buildArch(spec);
      const leaves = items.filter((item) => item.kind === 'leaf').map((item) => item.size);
      const largeBalloons = items
        .filter((item) => item.kind === 'balloon' && item.size >= 0.75 * spec.sizeRange[1])
        .map((item) => item.size);
      expect(leaves.length).toBeGreaterThan(0);
      expect(largeBalloons.length).toBeGreaterThan(0);
      expect(median(leaves) / median(largeBalloons), `seed ${spec.seed} ${spec.width}x${spec.height}`).toBeGreaterThanOrEqual(0.6);
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

describe('balloon size variety', () => {
  // The reference mixes big, medium and small balloons in roughly equal parts, the biggest about
  // four times the smallest, with the big ones gathered on the shoulders.
  it('mixes large, medium and small balloons, the biggest at least three times the smallest', () => {
    for (const spec of SEEDED_SPECS) {
      const sizes = buildArch(spec)
        .items.filter((item) => item.kind === 'balloon')
        .map((item) => item.size / spec.sizeRange[1]);
      const share = (keep: (size: number) => boolean): number => sizes.filter(keep).length / sizes.length;
      const where = `seed ${spec.seed} ${spec.width}x${spec.height}`;
      expect(sizes.length, where).toBeGreaterThan(0);
      expect(Math.max(...sizes) / Math.min(...sizes), where).toBeGreaterThanOrEqual(3);
      expect(share((size) => size >= 0.75), where).toBeGreaterThanOrEqual(0.2);
      expect(share((size) => size >= 0.45 && size < 0.75), where).toBeGreaterThanOrEqual(0.3);
      expect(share((size) => size < 0.45), where).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('gathers the bigger balloons on the shoulders rather than the crown center', () => {
    for (const spec of SEEDED_SPECS) {
      const crown = buildArch(spec).items.filter((item) => item.kind === 'balloon' && item.y < spec.band);
      const onShoulder = (item: ArchItem): boolean => item.x < 0.3 * spec.width || item.x > 0.7 * spec.width;
      const shoulders = crown.filter(onShoulder).map((item) => item.size);
      const center = crown.filter((item) => !onShoulder(item)).map((item) => item.size);
      const where = `seed ${spec.seed} ${spec.width}x${spec.height}`;
      expect(shoulders.length, where).toBeGreaterThan(0);
      expect(center.length, where).toBeGreaterThan(0);
      expect(median(shoulders), where).toBeGreaterThanOrEqual(1.2 * median(center));
    }
  });

  // Portrait side columns are only a gutter wide, so only landscape is held to keeping them big.
  it('keeps landscape side balloons at least half the size of the shoulder ones', () => {
    for (const spec of SEEDED_SPECS.filter((s) => s.width === ARCH_SPECS.landscape.width)) {
      const balloons = buildArch(spec).items.filter((item) => item.kind === 'balloon');
      const shoulders = balloons
        .filter((item) => item.y < spec.band && (item.x < 0.3 * spec.width || item.x > 0.7 * spec.width))
        .map((item) => item.size);
      const sides = balloons.filter((item) => item.y >= spec.band).map((item) => item.size);
      expect(shoulders.length).toBeGreaterThan(0);
      expect(sides.length).toBeGreaterThan(0);
      expect(median(sides)).toBeGreaterThanOrEqual(0.5 * median(shoulders));
    }
  });
});

// Specs asking for more than the canvas holds: placement must skip what doesn't fit rather than
// stack it on top of what is already there.
describe('crowded specs', () => {
  const crowdedPortrait: ArchSpec = {
    ...ARCH_SPECS.portrait,
    width: 400,
    height: 560,
    gutter: 48,
    sideDepth: 545,
    fadeStart: 380,
    counts: { balloons: 22, fillers: 6, flowers: 12, leaves: 30 },
    sizeRange: [26, 92],
  };
  const crowdedLandscape: ArchSpec = {
    ...ARCH_SPECS.landscape,
    width: 1440,
    height: 620,
    band: 200,
    gutter: 300,
    sideDepth: 600,
    fadeStart: 430,
    counts: { balloons: 34, fillers: 8, flowers: 18, leaves: 40 },
    sizeRange: [48, 170],
  };
  const crowded: ArchSpec[] = [crowdedPortrait, crowdedLandscape].flatMap((spec) => [
    spec,
    ...EXTRA_SEEDS.map((seed) => ({ ...spec, seed })),
  ]);

  it('never buries a balloon or flower more than 40% under the items in front of it', () => {
    for (const spec of crowded) {
      const solids = buildArch(spec).items.filter((item) => item.kind !== 'leaf');
      expect(solids.length).toBeGreaterThan(0);
      solids.forEach((item, index) => {
        const where = `${spec.width}x${spec.height} seed ${spec.seed}: ${item.kind} at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`;
        expect(coveredFraction(item, solids.slice(index + 1)), where).toBeLessThanOrEqual(0.4);
      });
    }
  });

  it('never places more balloons or flowers than the spec requests', () => {
    for (const spec of crowded) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon').length;
      const flowers = items.filter((item) => item.kind === 'flower').length;
      expect(balloons).toBeGreaterThan(0);
      expect(balloons).toBeLessThanOrEqual(spec.counts.balloons + spec.counts.fillers);
      expect(flowers).toBeGreaterThan(0);
      expect(flowers).toBeLessThanOrEqual(spec.counts.flowers);
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
    expect(ARCH_SPECS.portrait.counts.balloons).toBeGreaterThanOrEqual(20);
    expect(ARCH_SPECS.portrait.counts.flowers).toBeGreaterThanOrEqual(11);
    expect(ARCH_SPECS.landscape.counts.balloons).toBeGreaterThanOrEqual(32);
    expect(ARCH_SPECS.landscape.counts.flowers).toBeGreaterThanOrEqual(21);
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

/**
 * Union coverage of `solids` over the visible garland within one biggest-balloon width of the
 * spine, split into shoulders (crown, outer 30% each side), crown center and side columns.
 */
function spineTubeCoverage(
  spec: ArchSpec,
  solids: ArchItem[],
): { shoulders: number; crownCenter: number; sides: number } {
  const step = 3;
  const radius = spec.sizeRange[1];
  const cols = Math.ceil(spec.width / step);
  const rows = Math.ceil(spec.fadeStart / step);
  const inTube = new Uint8Array(cols * rows);
  for (const point of spineSamples(spec, 1600)) {
    const c0 = Math.max(0, Math.floor((point.x - radius) / step));
    const c1 = Math.min(cols - 1, Math.ceil((point.x + radius) / step));
    const r0 = Math.max(0, Math.floor((point.y - radius) / step));
    const r1 = Math.min(rows - 1, Math.ceil((point.y + radius) / step));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = (c + 0.5) * step;
        const y = (r + 0.5) * step;
        if (Math.hypot(x - point.x, y - point.y) <= radius) inTube[r * cols + c] = 1;
      }
    }
  }
  const counts = { shoulders: [0, 0], crownCenter: [0, 0], sides: [0, 0] };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const point = { x: (c + 0.5) * step, y: (r + 0.5) * step };
      if (!inTube[r * cols + c] || !isVisibleGarland(spec, point)) continue;
      const zone =
        point.y >= spec.band
          ? counts.sides
          : point.x < 0.3 * spec.width || point.x > 0.7 * spec.width
            ? counts.shoulders
            : counts.crownCenter;
      zone[0] += 1;
      if (solids.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= item.size / 2)) zone[1] += 1;
    }
  }
  return {
    shoulders: counts.shoulders[1] / counts.shoulders[0],
    crownCenter: counts.crownCenter[1] / counts.crownCenter[0],
    sides: counts.sides[1] / counts.sides[0],
  };
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

/** True when the discs of `a` and `b` overlap by at least `depth` times the smaller one's size. */
function overlapsBy(a: ArchItem, b: ArchItem, depth: number): boolean {
  return (a.size + b.size) / 2 - Math.hypot(a.x - b.x, a.y - b.y) >= depth * Math.min(a.size, b.size);
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

function spineSamples(spec: ArchSpec, steps: number): { x: number; y: number }[] {
  return Array.from({ length: steps + 1 }, (_, i) => archSpinePoint(spec, i / steps));
}

/**
 * Signed distance of `point` from its nearest spine sample along the spine's inward normal:
 * positive toward the arch's inside, zero or negative on its outer side.
 */
function inwardOffset(spine: { x: number; y: number }[], point: { x: number; y: number }): number {
  let nearest = 0;
  for (let i = 1; i < spine.length; i++) {
    if (Math.hypot(spine[i].x - point.x, spine[i].y - point.y) < Math.hypot(spine[nearest].x - point.x, spine[nearest].y - point.y)) {
      nearest = i;
    }
  }
  const before = spine[Math.max(nearest - 1, 0)];
  const after = spine[Math.min(nearest + 1, spine.length - 1)];
  // Travelling up the left side, over the crown and down the right, the inward side is on the right.
  const nx = -(after.y - before.y);
  const ny = after.x - before.x;
  return ((point.x - spine[nearest].x) * nx + (point.y - spine[nearest].y) * ny) / Math.hypot(nx, ny);
}

function wrapRadians(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Arc length along `points` (bottom-left up toward the crown) from where the spine's tilt from
 * horizontal first drops to `fromDeg` until it first drops to `toDeg`.
 */
function cornerSpan(points: { x: number; y: number }[], fromDeg: number, toDeg: number): number {
  let length = 0;
  let started = false;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const tilt = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
    if (!started && tilt <= fromDeg) started = true;
    if (started && tilt <= toDeg) return length;
    if (started) length += Math.hypot(dx, dy);
  }
  return length;
}

function meanRotate(items: ArchItem[]): number {
  return items.reduce((sum, item) => sum + item.rotate, 0) / items.length;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
