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

/** Conservative visible box: a disc for balloons and flowers, the rotated sprig rectangle's AABB for leaves. */
function visBox(item: GarlandItem): Box {
  const kind = kindOf(item.symbol);
  if (kind !== 'leaf') {
    const r = (kind === 'balloon' ? 0.45 : 0.5) * item.size;
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

  it('the portrait clear zone spans the middle 76% below at most 0.68 of the width', () => {
    const { width, clear } = GARLAND.portrait;
    expect(clear.x0).toBeCloseTo(0.12 * width, 6);
    expect(clear.x1).toBeCloseTo(0.88 * width, 6);
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
    expect(garlandCoverVars()).toContain('--arch-clear-portrait:0.76;');
    expect(garlandCoverVars()).toContain('--arch-clear-landscape:0.5;');
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

describe('north-star composition', () => {
  it.each(LAYOUTS)('%s: the crown and both upper corners are densely filled', (_name, layout) => {
    const { solids } = partsOf(layout);
    const { x0, x1, top } = layout.clear;
    expect(coverage(solids, x0, x1, 0, 0.8 * top)).toBeGreaterThanOrEqual(0.75);
    expect(coverage(solids, 0, x0, 0, top)).toBeGreaterThanOrEqual(0.6);
    expect(coverage(solids, x1, layout.width, 0, top)).toBeGreaterThanOrEqual(0.6);
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

  it.each(LAYOUTS)('%s: sprigs grow out of the mass and cascade at both corners', (_name, layout) => {
    const { leaves, solids } = partsOf(layout);
    const { x0, x1, top } = layout.clear;

    const floating = leaves.filter((leaf) => {
      const base = stemBase(leaf);
      return !solids.some((s) => Math.hypot(s.x - base.x, s.y - base.y) <= 1.05 * bodyRadius(s));
    });
    expect(floating.map(label)).toEqual([]);

    expect(leaves.filter((l) => l.y > top && l.x < x0).length).toBeGreaterThanOrEqual(3);
    expect(leaves.filter((l) => l.y > top && l.x > x1).length).toBeGreaterThanOrEqual(3);
    expect(leaves.filter((l) => l.symbol === 'leaf-gold').length / leaves.length).toBeGreaterThanOrEqual(0.25);
  });

  it.each(LAYOUTS)('%s: at least six back sprigs peek up out of the crown', (_name, layout) => {
    const { leaves } = partsOf(layout);
    const { x0, x1, top } = layout.clear;
    const peeking = leaves.filter((leaf) => {
      const base = stemBase(leaf);
      const pointsUp = Math.cos((leaf.rotate * Math.PI) / 180) > 0;
      return leaf.depth === 0 && pointsUp && base.x >= x0 && base.x <= x1 && base.y >= 0 && base.y <= top;
    });
    expect(peeking.length).toBeGreaterThanOrEqual(6);
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
