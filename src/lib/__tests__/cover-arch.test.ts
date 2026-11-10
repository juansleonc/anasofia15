import { describe, it, expect } from 'vitest';
import { ARCH_SPECS, archClearanceVars, archFadeMask, buildArch, type ArchSpec } from '../cover-arch';

const SPECS: ArchSpec[] = [ARCH_SPECS.portrait, ARCH_SPECS.landscape];

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

  it('places exactly the spec-requested number of balloons', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const balloons = items.filter((item) => item.kind === 'balloon');
      expect(balloons).toHaveLength(spec.counts.balloons);
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
    const spec: ArchSpec = { ...ARCH_SPECS.portrait, counts: { ...ARCH_SPECS.portrait.counts, balloons: 3 } };
    const { items } = buildArch(spec);
    const tones = items.filter((item) => item.kind === 'balloon').map((item) => item.symbol);
    expect(tones.sort()).toEqual(['balloon-champagne', 'balloon-pink', 'balloon-rosegold']);
  });

  it('places exactly the spec-requested number of flowers, using all three flower symbols', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const flowers = items.filter((item) => item.kind === 'flower');
      expect(flowers).toHaveLength(spec.counts.flowers);
      const symbols = new Set(flowers.map((item) => item.symbol));
      expect(symbols).toEqual(new Set(['rose-bloom', 'rose-cream', 'blossom']));
    }
  });

  it('places exactly the spec-requested number of leaves, using both leaf symbols', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      const leaves = items.filter((item) => item.kind === 'leaf');
      expect(leaves).toHaveLength(spec.counts.leaves);
      const symbols = new Set(leaves.map((item) => item.symbol));
      expect(symbols).toEqual(new Set(['leaf-eucalyptus', 'leaf-gold']));
    }
  });

  it('paints flowers on layer 2 and leaves on layer 0', () => {
    for (const spec of SPECS) {
      const { items } = buildArch(spec);
      for (const item of items.filter((i) => i.kind === 'flower')) {
        expect(item.layer).toBe(2);
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

describe('ARCH_SPECS fullness', () => {
  it('keeps both specs full enough for a dense, overlapping crown', () => {
    expect(ARCH_SPECS.portrait.counts.balloons).toBeGreaterThanOrEqual(30);
    expect(ARCH_SPECS.portrait.counts.flowers).toBeGreaterThanOrEqual(14);
    expect(ARCH_SPECS.portrait.counts.leaves).toBeGreaterThanOrEqual(22);
    expect(ARCH_SPECS.landscape.counts.balloons).toBeGreaterThanOrEqual(44);
    expect(ARCH_SPECS.landscape.counts.flowers).toBeGreaterThanOrEqual(20);
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
