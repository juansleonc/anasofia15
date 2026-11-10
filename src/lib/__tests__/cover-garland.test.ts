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
