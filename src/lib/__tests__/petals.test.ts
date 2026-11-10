import { describe, it, expect } from 'vitest';
import { createPetals, showerDurationMs, MAX_PETALS, type Petal } from '../petals';

// Deterministic LCG so every run exercises the same sequence of generated petals.
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const PALETTE = ['#FCE4E8', '#F3C6D0', '#E8A3B4'];

function shower(count: number, seed = 11): Petal[] {
  return createPetals({ count, palette: PALETTE, random: seededRandom(seed) });
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
});
