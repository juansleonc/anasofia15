import { describe, it, expect } from 'vitest';
import { ARCH_SPECS, buildArch, type ArchSpec } from '../cover-arch';

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
});
