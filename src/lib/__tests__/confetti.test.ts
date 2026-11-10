import { describe, it, expect } from 'vitest';
import { createBurstPieces, MAX_PIECES, type ConfettiPalette } from '../confetti';

// Deterministic LCG so every run exercises the same silver/gold branch sequence.
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const PALETTE: ConfettiPalette = {
  silver: ['#c9ccd1', '#eef0f3', '#ffffff'],
  gold: ['#d4af37', '#f0d987'],
};

function burst(count: number, seed = 7) {
  return createBurstPieces({
    count,
    originX: 195,
    originY: 700,
    palette: PALETTE,
    random: seededRandom(seed),
  });
}

describe('createBurstPieces', () => {
  it('returns exactly the requested number of pieces when under the cap', () => {
    expect(burst(120)).toHaveLength(120);
  });

  it('caps the particle count for mobile performance', () => {
    expect(burst(5000)).toHaveLength(MAX_PIECES);
  });

  it('returns no pieces for a non-positive count', () => {
    expect(burst(0)).toHaveLength(0);
    expect(burst(-5)).toHaveLength(0);
  });

  it('throws every piece upward (negative initial vertical velocity)', () => {
    const pieces = burst(140);
    expect(pieces).not.toHaveLength(0);
    for (const piece of pieces) {
      expect(piece.vy).toBeLessThan(0);
    }
  });

  it('launches pieces from around the given origin', () => {
    const pieces = burst(140);
    expect(pieces).not.toHaveLength(0);
    for (const piece of pieces) {
      expect(Math.abs(piece.x - 195)).toBeLessThanOrEqual(80);
      expect(Math.abs(piece.y - 700)).toBeLessThanOrEqual(30);
    }
  });

  it('colors every piece from the palette, silver dominant with a gold minority', () => {
    const pieces = burst(160);
    const goldCount = pieces.filter((p) => PALETTE.gold.includes(p.color)).length;
    const silverCount = pieces.filter((p) => PALETTE.silver.includes(p.color)).length;
    expect(goldCount + silverCount).toBe(pieces.length);
    expect(goldCount).toBeGreaterThan(0);
    expect(goldCount).toBeLessThan(silverCount);
  });

  it('defaults to built-in randomness when no random source is injected', () => {
    const pieces = createBurstPieces({
      count: 40,
      originX: 195,
      originY: 700,
      palette: PALETTE,
    });
    expect(pieces).toHaveLength(40);
    for (const piece of pieces) {
      expect(piece.vy).toBeLessThan(0);
    }
  });

  it('gives every paper piece a visible size and tumbling motion', () => {
    const pieces = burst(140);
    expect(pieces).not.toHaveLength(0);
    for (const piece of pieces) {
      expect(piece.width).toBeGreaterThan(0);
      expect(piece.height).toBeGreaterThan(0);
      expect(piece.rotationSpeed).not.toBe(0);
      expect(piece.wobbleSpeed).toBeGreaterThan(0);
    }
  });
});
