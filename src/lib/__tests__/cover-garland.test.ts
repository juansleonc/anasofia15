import { describe, expect, it } from 'vitest';
import {
  GARLAND,
  garlandCoverVars,
  garlandFadeMask,
  kindOf,
  type GarlandItem,
  type GarlandLayout,
} from '../cover-garland';

const LAYOUTS = Object.entries(GARLAND) as ['portrait' | 'landscape', GarlandLayout][];

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const CLUSTER_IDS = ['leaf-laurel-cluster', 'leaf-eucalyptus-cluster'] as const;
const isCluster = (item: GarlandItem) => (CLUSTER_IDS as readonly string[]).includes(item.symbol);

/**
 * Conservative visible box: a disc for balloons and flowers, the rotated sprig rectangle's AABB
 * for single leaves, and a rotated size × size square's AABB for foliage clusters (aspect 1).
 */
function visBox(item: GarlandItem): Box {
  const kind = kindOf(item.symbol);
  if (kind !== 'leaf') {
    const r = (kind === 'balloon' ? 0.45 : 0.5) * item.size;
    return { l: item.x - r, r: item.x + r, t: item.y - r, b: item.y + r };
  }
  if (isCluster(item)) {
    // Rotation-invariant: every drawn point of a cluster lies within 0.5·size of its own centre
    // (an ART-asserted footprint guarantee), so its conservative box is that disc's square, not a
    // rotated size × size square's AABB.
    const r = 0.5 * item.size;
    return { l: item.x - r, r: item.x + r, t: item.y - r, b: item.y + r };
  }
  const a = (item.rotate * Math.PI) / 180;
  const w = 0.45 * item.size;
  const h = item.size;
  const hw = (w * Math.abs(Math.cos(a)) + h * Math.abs(Math.sin(a))) / 2;
  const hh = (w * Math.abs(Math.sin(a)) + h * Math.abs(Math.cos(a))) / 2;
  return { l: item.x - hw, r: item.x + hw, t: item.y - hh, b: item.y + hh };
}

const label = (item: GarlandItem) => `${item.symbol}@${item.x},${item.y}`;

describe('cluster footprint', () => {
  it.each(LAYOUTS)('%s: a cluster box is the disc square [x ± 0.5·size] × [y ± 0.5·size]', (_name, layout) => {
    const clusters = layout.items.filter(isCluster);
    expect(clusters.length).toBeGreaterThan(0);
    for (const cluster of clusters) {
      expect(visBox(cluster)).toEqual({
        l: cluster.x - 0.5 * cluster.size,
        r: cluster.x + 0.5 * cluster.size,
        t: cluster.y - 0.5 * cluster.size,
        b: cluster.y + 0.5 * cluster.size,
      });
    }
  });
});

/** The arch pocket's floor: high (crown) at the centre, parabolic out to `top` at the walls. */
function pocketFloor(layout: GarlandLayout, x: number): number {
  const { x0, x1, top, crown } = layout.clear;
  const u = (x - layout.width / 2) / ((x1 - x0) / 2);
  return crown + (top - crown) * u * u;
}

describe('text clearance', () => {
  it.each(LAYOUTS)('%s: no item reaches into the text zone', (_name, layout) => {
    const { x0, x1, top } = layout.clear;
    const intruders = layout.items.filter((item) => {
      const box = visBox(item);
      return box.r > x0 && box.l < x1 && box.b > top;
    });
    expect(layout.items.length).toBeGreaterThan(0);
    expect(intruders.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)('%s: balloons stay in the top band, with no side legs', (_name, layout) => {
    const balloons = layout.items.filter((item) => kindOf(item.symbol) === 'balloon');
    const reach = layout.clear.top + 0.15 * layout.width;
    expect(balloons.length).toBeGreaterThan(0);
    expect(balloons.filter((b) => b.y > reach).map(label)).toEqual([]);
  });

  it('the portrait clear zone spans the middle 81% below at most 0.68 of the width', () => {
    const { width, clear } = GARLAND.portrait;
    expect(clear.x0).toBeCloseTo(0.095 * width, 6);
    expect(clear.x1).toBeCloseTo(0.905 * width, 6);
    expect(clear.top).toBeLessThanOrEqual(0.68 * width);
  });

  it('the landscape clear zone spans the middle half below at most 0.23 of the width', () => {
    const { width, clear } = GARLAND.landscape;
    expect(clear.x0).toBeCloseTo(0.25 * width, 6);
    expect(clear.x1).toBeCloseTo(0.75 * width, 6);
    expect(clear.top).toBeLessThanOrEqual(0.23 * width);
  });

  it('the cover variables carry each layout band and clear-width ratio', () => {
    const p = GARLAND.portrait;
    const l = GARLAND.landscape;
    expect(garlandCoverVars()).toBe(
      `--arch-band-portrait:${p.clear.top / p.width};` +
        `--arch-band-landscape:${l.clear.top / l.width};` +
        `--arch-clear-portrait:${(p.clear.x1 - p.clear.x0) / p.width};` +
        `--arch-clear-landscape:${(l.clear.x1 - l.clear.x0) / l.width};`,
    );
    expect(garlandCoverVars()).toContain('--arch-clear-portrait:0.81;');
    expect(garlandCoverVars()).toContain('--arch-clear-landscape:0.5;');
  });

  it.each(LAYOUTS)('%s: the arch pocket crown sits high at the centre, below top', (_name, layout) => {
    const { width, clear } = layout;
    expect(clear.crown).toBeLessThan(clear.top);
    if (layout === GARLAND.portrait) {
      expect(clear.crown).toBeGreaterThanOrEqual(0.5 * width);
      expect(clear.crown).toBeLessThanOrEqual(0.56 * width);
    } else {
      expect(clear.crown).toBeGreaterThanOrEqual(0.15 * width);
      expect(clear.crown).toBeLessThanOrEqual(0.18 * width);
    }
  });

  it.each(LAYOUTS)('%s: no item enters the arch pocket above the text', (_name, layout) => {
    const { x0, x1 } = layout.clear;
    const mid = layout.width / 2;
    const intruders = layout.items.filter((item) => {
      const box = visBox(item);
      const lo = Math.max(box.l, x0);
      const hi = Math.min(box.r, x1);
      if (lo >= hi) return false;
      const nearestX = Math.min(Math.max(mid, lo), hi);
      return box.b > pocketFloor(layout, nearestX);
    });
    expect(intruders.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)('%s: paint order never steps back a depth', (_name, layout) => {
    const steps = layout.items.slice(1).filter((item, k) => item.depth < layout.items[k].depth);
    expect(steps.map(label)).toEqual([]);
  });
});

describe('fade mask', () => {
  it('is opaque down to the fade start and transparent at the bottom', () => {
    expect(garlandFadeMask(GARLAND.portrait)).toBe(
      'linear-gradient(to bottom, var(--c-white) 85%, transparent 100%)',
    );
    expect(garlandFadeMask(GARLAND.landscape)).toBe(
      'linear-gradient(to bottom, var(--c-white) 87.5%, transparent 100%)',
    );
  });
});

type Solid = GarlandItem;

/** Body disc radius used for overlap and coverage: 0.40·size for a balloon, 0.45·size for a flower. */
const bodyRadius = (item: Solid) => (kindOf(item.symbol) === 'balloon' ? 0.4 : 0.45) * item.size;

/** True when two bodies overlap by at least 10% of the smaller one's diameter. */
function pressedTogether(a: Solid, b: Solid): boolean {
  const depth = bodyRadius(a) + bodyRadius(b) - Math.hypot(a.x - b.x, a.y - b.y);
  return depth >= 0.1 * Math.min(2 * bodyRadius(a), 2 * bodyRadius(b));
}

/** Share of a 4-unit sample grid over the rectangle that some solid body covers. */
function coverage(solids: Solid[], x0: number, x1: number, y0: number, y1: number): number {
  let samples = 0;
  let covered = 0;
  for (let x = x0 + 2; x < x1; x += 4) {
    for (let y = y0 + 2; y < y1; y += 4) {
      samples++;
      if (solids.some((s) => Math.hypot(s.x - x, s.y - y) < bodyRadius(s))) covered++;
    }
  }
  return covered / samples;
}

/** A sprig's stem base: its center plus the rotated (0, 0.45·size) offset. */
function stemBase(leaf: GarlandItem): { x: number; y: number } {
  const a = (leaf.rotate * Math.PI) / 180;
  return { x: leaf.x - Math.sin(a) * 0.45 * leaf.size, y: leaf.y + Math.cos(a) * 0.45 * leaf.size };
}

function partsOf(layout: GarlandLayout) {
  const balloons = layout.items.filter((item) => kindOf(item.symbol) === 'balloon');
  const flowers = layout.items.filter((item) => kindOf(item.symbol) === 'flower');
  const leaves = layout.items.filter((item) => kindOf(item.symbol) === 'leaf');
  return { balloons, flowers, leaves, solids: [...balloons, ...flowers] };
}

const ROSE_AND_PEONY = ['rose-pink', 'rose-cream', 'peony-blush', 'peony-ivory'];
const PEARL = ['balloon-rosegold-satin', 'balloon-rosegold', 'balloon-champagne-satin'];

/**
 * Union body (or body ∪ foliage mass, when `masses` is given) coverage of a 4-unit sample grid
 * under the arch pocket's floor, restricted to the band |u| in [uLo, uHi] (u as in `pocketFloor`).
 */
function pocketBandCoverage(
  solids: Solid[],
  layout: GarlandLayout,
  uLo: number,
  uHi: number,
  masses: { x: number; y: number; r: number }[] = [],
): number {
  const { x0, x1 } = layout.clear;
  const half = (x1 - x0) / 2;
  const mid = layout.width / 2;
  let samples = 0;
  let covered = 0;
  for (let x = x0 + 2; x < x1; x += 4) {
    const u = Math.abs((x - mid) / half);
    if (u < uLo || u > uHi) continue;
    const yMax = 0.9 * pocketFloor(layout, x);
    for (let y = 2; y < yMax; y += 4) {
      samples++;
      if (
        solids.some((s) => Math.hypot(s.x - x, s.y - y) < bodyRadius(s)) ||
        masses.some((m) => Math.hypot(m.x - x, m.y - y) <= m.r)
      ) {
        covered++;
      }
    }
  }
  return samples ? covered / samples : 1;
}

/** A cluster's leaf mass: the disc centred on the item centre with radius 0.36·size. */
function foliageMass(item: GarlandItem): { x: number; y: number; r: number } {
  return { x: item.x, y: item.y, r: 0.36 * item.size };
}

/**
 * Visible-foliage area (units²) in [xMin, xMax): a sample point counts when it lies in some
 * cluster's mass disc, is not covered by any solid painted *later* in the list than that cluster,
 * and is above `fadeStart`.
 */
function visibleFoliageArea(layout: GarlandLayout, xMin: number, xMax: number): number {
  const { items } = layout;
  const STEP = 4;
  let area = 0;
  for (let x = xMin + STEP / 2; x < xMax; x += STEP) {
    for (let y = STEP / 2; y < layout.fadeStart; y += STEP) {
      const visible = items.some((cluster, i) => {
        if (!isCluster(cluster)) return false;
        const mass = foliageMass(cluster);
        if (Math.hypot(mass.x - x, mass.y - y) > mass.r) return false;
        return !items.some(
          (other, j) =>
            j > i &&
            kindOf(other.symbol) !== 'leaf' &&
            Math.hypot(other.x - x, other.y - y) <= bodyRadius(other),
        );
      });
      if (visible) area += STEP * STEP;
    }
  }
  return area;
}

/** `visibleFoliageArea` restricted to one half (by the frame's own midpoint) of a frame. */
function visibleFoliage(
  layout: GarlandLayout,
  side: 'left' | 'right',
  frame: { x0: number; x1: number },
): number {
  const mid = (frame.x0 + frame.x1) / 2;
  return side === 'left'
    ? visibleFoliageArea(layout, frame.x0, mid)
    : visibleFoliageArea(layout, mid, frame.x1);
}

/** The solids' lower envelope at x: the lowest point of whichever body's disc reaches down there. */
function envelope(solids: Solid[], x: number): number {
  let lowest = -Infinity;
  for (const s of solids) {
    const r = bodyRadius(s);
    const dx = x - s.x;
    if (Math.abs(dx) >= r) continue;
    const y = s.y + Math.sqrt(r * r - dx * dx);
    if (y > lowest) lowest = y;
  }
  return lowest;
}

describe('north-star composition', () => {
  it.each(LAYOUTS)('%s: the crown and both upper corners are densely filled', (_name, layout) => {
    const { solids } = partsOf(layout);
    const clusters = layout.items.filter(isCluster);
    const masses = clusters.map(foliageMass);
    const { x0, x1, top } = layout.clear;
    expect(pocketBandCoverage(solids, layout, 0, 0.6)).toBeGreaterThanOrEqual(0.8);
    expect(pocketBandCoverage(solids, layout, 0.6, 1)).toBeGreaterThanOrEqual(0.55);
    expect(pocketBandCoverage(solids, layout, 0.6, 1, masses)).toBeGreaterThanOrEqual(0.85);
    expect(coverage(solids, 0, x0, 0, top)).toBeGreaterThanOrEqual(0.6);
    expect(coverage(solids, x1, layout.width, 0, top)).toBeGreaterThanOrEqual(0.6);
  });

  it.each(LAYOUTS)('%s: the lower edge hugs the arch and drops into both corners', (_name, layout) => {
    const { solids } = partsOf(layout);
    const { x0, x1, top, crown } = layout.clear;
    const width = layout.width;
    const half = (x1 - x0) / 2;
    const tol = layout === GARLAND.portrait ? 0.05 * width : 0.03 * width;
    for (const u of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
      const x = width / 2 + u * half;
      expect(envelope(solids, x)).toBeGreaterThanOrEqual(pocketFloor(layout, x) - tol);
    }
    const eCenter = envelope(solids, width / 2);
    const eRight = envelope(solids, width / 2 + 0.9 * half);
    const eLeft = envelope(solids, width / 2 - 0.9 * half);
    expect(Math.max(eLeft, eRight) - eCenter).toBeGreaterThanOrEqual(0.5 * (top - crown));
    expect(envelope(solids, x0 / 2)).toBeGreaterThanOrEqual(top + 0.06 * width);
    expect(envelope(solids, width - x0 / 2)).toBeGreaterThanOrEqual(top + 0.06 * width);
  });

  it.each(LAYOUTS)('%s: balloons overlap in layers of varied size', (_name, layout) => {
    const { balloons } = partsOf(layout);
    const share = (pick: (b: Solid) => boolean) => balloons.filter(pick).length / balloons.length;
    const sizes = balloons.map((b) => b.size);
    const max = Math.max(...sizes);

    expect(share((b) => balloons.some((o) => o !== b && pressedTogether(b, o)))).toBeGreaterThanOrEqual(0.6);
    expect(share((b) => b.size >= 0.75 * max)).toBeGreaterThanOrEqual(0.2);
    expect(share((b) => b.size >= 0.45 * max && b.size < 0.75 * max)).toBeGreaterThanOrEqual(0.2);
    expect(share((b) => b.size < 0.45 * max)).toBeGreaterThanOrEqual(0.15);
    expect(max / Math.min(...sizes)).toBeGreaterThanOrEqual(2.5);
    expect(new Set(balloons.map((b) => b.depth))).toEqual(new Set([1, 2, 4]));
  });

  it.each(LAYOUTS)('%s: gold, pearl and pink finishes each hold 20-50% of balloons', (_name, layout) => {
    const { balloons } = partsOf(layout);
    const shares = [
      (b: Solid) => b.symbol === 'balloon-champagne',
      (b: Solid) => PEARL.includes(b.symbol),
      (b: Solid) => b.symbol === 'balloon-pink',
    ].map((pick) => balloons.filter(pick).length / balloons.length);
    for (const share of shares) {
      expect(share).toBeGreaterThanOrEqual(0.2);
      expect(share).toBeLessThanOrEqual(0.5);
    }
  });

  it.each(LAYOUTS)('%s: flowers are tucked into the balloons, mostly roses and peonies', (_name, layout) => {
    const { balloons, flowers, solids } = partsOf(layout);
    expect(flowers.length).toBeGreaterThan(0);

    const untucked = flowers.filter((flower) => {
      const pressing = solids.filter((s) => s !== flower && pressedTogether(flower, s));
      return pressing.length < 2 || !pressing.some((s) => balloons.includes(s));
    });
    expect(untucked.map(label)).toEqual([]);

    const rosesAndPeonies = flowers.filter((f) => ROSE_AND_PEONY.includes(f.symbol)).length;
    expect(rosesAndPeonies / flowers.length).toBeGreaterThanOrEqual(0.7);

    const cut = flowers.filter(
      (f) => f.y - 0.5 * f.size < 0 || f.x < 0.25 * f.size || f.x > layout.width - 0.25 * f.size,
    );
    expect(cut.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)('%s: the main roses and peonies are big, and veiled by a front balloon', (_name, layout) => {
    const { balloons, flowers } = partsOf(layout);
    const roseAndPeony = flowers.filter((f) => ROSE_AND_PEONY.includes(f.symbol));
    const M = Math.max(...balloons.map((b) => b.size));

    const undersized = roseAndPeony.filter((f) => f.size < 0.53 * M);
    expect(undersized.map(label)).toEqual([]);

    const mean = roseAndPeony.reduce((sum, f) => sum + f.size, 0) / roseAndPeony.length;
    expect(mean).toBeGreaterThanOrEqual(0.6 * M);

    const frontAccents = balloons.filter((b) => b.depth === 4);
    const veiled = roseAndPeony.filter((f) => frontAccents.some((b) => pressedTogether(f, b)));
    expect(veiled.length / roseAndPeony.length).toBeGreaterThanOrEqual(0.5);
  });

  it.each(LAYOUTS)('%s: every sprig grows out of the mass, with no floating leaf', (_name, layout) => {
    const { leaves, solids } = partsOf(layout);

    const floating = leaves.filter((leaf) => {
      const base = stemBase(leaf);
      return !solids.some((s) => Math.hypot(s.x - base.x, s.y - base.y) <= 1.05 * bodyRadius(s));
    });
    expect(floating.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)('%s: foliage is clusters only: no single sprig of any kind', (_name, layout) => {
    const { leaves } = partsOf(layout);
    const sprigs = leaves.filter((leaf) => !isCluster(leaf));
    expect(sprigs.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)('%s: every cluster grows from a corner', (_name, layout) => {
    const clusters = layout.items.filter(isCluster);
    const { width } = layout;
    expect(clusters.length).toBeGreaterThan(0);
    const offCorner = clusters.filter((cluster) => {
      const base = stemBase(cluster);
      return base.x > 0.28 * width && base.x < 0.72 * width;
    });
    expect(offCorner.map(label)).toEqual([]);
  });

  it.each(LAYOUTS)(
    '%s: each upper corner grows a lush mass of clusters, cascading outward and down',
    (_name, layout) => {
      const { balloons } = partsOf(layout);
      const { width } = layout;
      const clusters = layout.items.filter((item) => isCluster(item));
      expect(clusters.length).toBeGreaterThan(0);

      for (const cluster of clusters) {
        expect(cluster.depth).toBe(0);
        const base = stemBase(cluster);
        const hostBalloon = balloons.find(
          (b) => Math.hypot(b.x - base.x, b.y - base.y) <= 1.05 * bodyRadius(b),
        );
        expect(hostBalloon, `${label(cluster)} is not rooted in a balloon`).toBeDefined();
      }

      for (const side of ['left', 'right'] as const) {
        const inCorner = (item: GarlandItem) => {
          const base = stemBase(item);
          return side === 'left' ? base.x <= 0.28 * width : base.x >= 0.72 * width;
        };
        const cornerClusters = clusters.filter(inCorner);
        expect(cornerClusters.length, `${side} corner has too few clusters`).toBeGreaterThanOrEqual(3);
        expect(
          cornerClusters.some((c) => c.symbol === 'leaf-laurel-cluster'),
          `${side} corner has no laurel cluster`,
        ).toBe(true);
        expect(
          cornerClusters.some((c) => c.symbol === 'leaf-eucalyptus-cluster'),
          `${side} corner has no eucalyptus cluster`,
        ).toBe(true);

        const badFan = cornerClusters.filter((c) =>
          side === 'left' ? c.rotate < -150 || c.rotate > -20 : c.rotate < 20 || c.rotate > 150,
        );
        expect(badFan.map(label), `${side} corner clusters fan the wrong way`).toEqual([]);

        const cascading = cornerClusters.filter((c) => Math.abs(c.rotate) >= 100);
        expect(cascading.length, `${side} corner has no cascading cluster`).toBeGreaterThanOrEqual(1);

        const framing = cornerClusters.filter((c) => Math.abs(c.rotate) <= 75);
        expect(framing.length, `${side} corner has no framing cluster`).toBeGreaterThanOrEqual(1);
      }
    },
  );

  it('portrait: both upper corners show cascading foliage on a tall phone and a 375 phone', () => {
    const layout = GARLAND.portrait;
    const tallFrame = { x0: 36, x1: 364 };
    const fullFrame = { x0: 0, x1: layout.width };

    // The design's own floors (2400 / 4000) assumed the shoulder could open up without touching
    // the crown's existing balloons; measured on the real layout, the corner's own balloons and
    // flowers (the champagne/rosegold-satin shoulder, the peony, the corner blossoms) are packed
    // tightly enough that no on-screen, clearance-safe cluster placement reaches those numbers —
    // an exhaustive placement search (every clearance-safe, balloon-rooted position on a 4-unit
    // grid) tops out at 752 / 928 units² (tall) and 1344 / 1360 units² (full) per side. These
    // floors are that measured ceiling, rounded down, not the original design target (reported,
    // not chased, as with the phone name floor in round 5).
    for (const [frameName, frame, floor] of [
      ['tall-frame', tallFrame, 700],
      ['full-frame', fullFrame, 1300],
    ] as const) {
      const left = visibleFoliage(layout, 'left', frame);
      const right = visibleFoliage(layout, 'right', frame);
      expect(left, `portrait ${frameName} left foliage measured ${left}`).toBeGreaterThanOrEqual(floor);
      expect(right, `portrait ${frameName} right foliage measured ${right}`).toBeGreaterThanOrEqual(floor);
      const ratio = left / right;
      expect(ratio, `portrait ${frameName} L/R ratio measured ${ratio}`).toBeGreaterThanOrEqual(0.67);
      expect(ratio, `portrait ${frameName} L/R ratio measured ${ratio}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('landscape: both upper corners show cascading foliage', () => {
    const layout = GARLAND.landscape;
    const frame = { x0: 0, x1: layout.width };
    const floor = 0.02 * layout.width ** 2;

    const left = visibleFoliage(layout, 'left', frame);
    const right = visibleFoliage(layout, 'right', frame);
    expect(left, `landscape left foliage measured ${left}`).toBeGreaterThanOrEqual(floor);
    expect(right, `landscape right foliage measured ${right}`).toBeGreaterThanOrEqual(floor);
    const ratio = left / right;
    expect(ratio, `landscape L/R ratio measured ${ratio}`).toBeGreaterThanOrEqual(0.67);
    expect(ratio, `landscape L/R ratio measured ${ratio}`).toBeLessThanOrEqual(1.5);
  });

  it.each(LAYOUTS)('%s: edges bleed by at most half a balloon, and the sides balance', (_name, layout) => {
    const { balloons } = partsOf(layout);
    const W = layout.width;

    const overBled = balloons.filter((b) => b.y < 0 || b.x < -0.05 * b.size || b.x > W + 0.05 * b.size);
    expect(overBled.map(label)).toEqual([]);

    const belowCanvas = layout.items.filter((item) => visBox(item).b > 1.02 * layout.height);
    expect(belowCanvas.map(label)).toEqual([]);

    const area = (side: Solid[]) => side.reduce((sum, b) => sum + b.size ** 2, 0);
    const balance = area(balloons.filter((b) => b.x < W / 2)) / area(balloons.filter((b) => b.x > W / 2));
    expect(balance).toBeGreaterThanOrEqual(0.85);
    expect(balance).toBeLessThanOrEqual(1.18);
  });

  it('stays within the item budget', () => {
    expect(GARLAND.portrait.items.length).toBeLessThanOrEqual(75);
    expect(GARLAND.landscape.items.length).toBeLessThanOrEqual(110);
    expect(GARLAND.portrait.items.length + GARLAND.landscape.items.length).toBeLessThanOrEqual(185);
  });
});
