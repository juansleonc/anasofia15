import { describe, it, expect } from 'vitest';
import { createPetals, createFlecks, showerDurationMs, MAX_PETALS, MAX_FLECKS, type Particle } from '../petals';

// Deterministic LCG so every run exercises the same sequence of generated petals.
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const PALETTE = ['#FCE4E8', '#F3C6D0', '#E8A3B4'];
const FLECK_PALETTE = ['#E6C99A', '#CDA869', '#A07E46'];

function shower(count: number, seed = 11): Particle[] {
  return createPetals({ count, palette: PALETTE, random: seededRandom(seed) });
}

function flecks(count: number, seed = 11): Particle[] {
  return createFlecks({ count, palette: FLECK_PALETTE, random: seededRandom(seed) });
}

describe('createPetals', () => {
  it('returns exactly the requested number of petals when under the cap', () => {
    expect(shower(20)).toHaveLength(20);
  });

  it('caps the petal count for mobile performance', () => {
    expect(shower(500)).toHaveLength(MAX_PETALS);
  });

  it('returns no petals for a non-positive count', () => {
    expect(shower(0)).toHaveLength(0);
    expect(shower(-3)).toHaveLength(0);
  });

  it('spreads petals across the full horizontal width', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.xPct).toBeGreaterThanOrEqual(0);
      expect(petal.xPct).toBeLessThanOrEqual(100);
    }
  });

  it('staggers petal start times within the first 1.5s', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.delayMs).toBeGreaterThanOrEqual(0);
      expect(petal.delayMs).toBeLessThanOrEqual(1500);
    }
  });

  it('gives every petal a slow multi-second fall', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.durationMs).toBeGreaterThanOrEqual(5000);
      expect(petal.durationMs).toBeLessThanOrEqual(8000);
    }
  });

  it('varies petal size within a small readable range', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.sizePx).toBeGreaterThanOrEqual(10);
      expect(petal.sizePx).toBeLessThanOrEqual(20);
    }
  });

  it('gives every petal a side-to-side sway amplitude', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.swayPx).toBeGreaterThanOrEqual(20);
      expect(petal.swayPx).toBeLessThanOrEqual(60);
    }
  });

  it('gives every petal a full-turn starting rotation', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(petal.rotateDeg).toBeGreaterThanOrEqual(0);
      expect(petal.rotateDeg).toBeLessThanOrEqual(360);
    }
  });

  it('colors every petal from the given palette, never a color outside it', () => {
    const petals = shower(30);
    expect(petals).not.toHaveLength(0);
    for (const petal of petals) {
      expect(PALETTE).toContain(petal.color);
    }
  });

  it('is deterministic for a given injected random source', () => {
    const first = createPetals({ count: 15, palette: PALETTE, random: seededRandom(42) });
    const second = createPetals({ count: 15, palette: PALETTE, random: seededRandom(42) });
    expect(first).toEqual(second);
  });

  it('defaults to built-in randomness when no random source is injected', () => {
    const petals = createPetals({ count: 10, palette: PALETTE });
    expect(petals).toHaveLength(10);
    for (const petal of petals) {
      expect(PALETTE).toContain(petal.color);
    }
  });
});

describe('showerDurationMs', () => {
  it('is zero for an empty shower', () => {
    expect(showerDurationMs([])).toBe(0);
  });

  it('is the latest delay-plus-duration across every petal', () => {
    const petals = shower(25);
    const expected = petals.reduce((max, p) => Math.max(max, p.delayMs + p.durationMs), 0);
    expect(showerDurationMs(petals)).toBe(expected);
    expect(showerDurationMs(petals)).toBeGreaterThan(0);
  });

  it('is the latest delay-plus-duration across a mixed petals-and-flecks array', () => {
    const mixed = [...shower(25), ...flecks(22)];
    const expected = mixed.reduce((max, p) => Math.max(max, p.delayMs + p.durationMs), 0);
    expect(showerDurationMs(mixed)).toBe(expected);
    expect(showerDurationMs(mixed)).toBeGreaterThan(0);
  });
});

describe('createFlecks', () => {
  it('returns exactly the requested number of flecks when under the cap', () => {
    expect(flecks(20)).toHaveLength(20);
  });

  it('caps the fleck count for mobile performance', () => {
    expect(flecks(500)).toHaveLength(MAX_FLECKS);
  });

  it('returns no flecks for a non-positive count', () => {
    expect(flecks(0)).toHaveLength(0);
    expect(flecks(-3)).toHaveLength(0);
  });

  it('staggers fleck start times within the first 1.2s', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(fleck.delayMs).toBeGreaterThanOrEqual(0);
      expect(fleck.delayMs).toBeLessThanOrEqual(1200);
    }
  });

  it('gives every fleck a quick fall duration', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(fleck.durationMs).toBeGreaterThanOrEqual(3500);
      expect(fleck.durationMs).toBeLessThanOrEqual(6000);
    }
  });

  it('varies fleck size within a small confetti-like range', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(fleck.sizePx).toBeGreaterThanOrEqual(4);
      expect(fleck.sizePx).toBeLessThanOrEqual(9);
    }
  });

  it('gives every fleck a side-to-side sway amplitude', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(fleck.swayPx).toBeGreaterThanOrEqual(10);
      expect(fleck.swayPx).toBeLessThanOrEqual(40);
    }
  });

  it('gives every fleck a full-turn starting rotation', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(fleck.rotateDeg).toBeGreaterThanOrEqual(0);
      expect(fleck.rotateDeg).toBeLessThanOrEqual(360);
    }
  });

  it('colors every fleck from the given palette, never a color outside it', () => {
    const all = flecks(25);
    expect(all).not.toHaveLength(0);
    for (const fleck of all) {
      expect(FLECK_PALETTE).toContain(fleck.color);
    }
  });

  it('is deterministic for a given injected random source', () => {
    const first = createFlecks({ count: 15, palette: FLECK_PALETTE, random: seededRandom(42) });
    const second = createFlecks({ count: 15, palette: FLECK_PALETTE, random: seededRandom(42) });
    expect(first).toEqual(second);
  });

  it('defaults to built-in randomness when no random source is injected', () => {
    const all = createFlecks({ count: 10, palette: FLECK_PALETTE });
    expect(all).toHaveLength(10);
    for (const fleck of all) {
      expect(FLECK_PALETTE).toContain(fleck.color);
    }
  });
});
