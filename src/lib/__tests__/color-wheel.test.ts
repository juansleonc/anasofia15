import { describe, it, expect } from 'vitest';
import { slicePath, nextRotation } from '../color-wheel';

const COUNT = 6;
const RADIUS = 80;
const CENTER = 100;

function toPoint(token: string): [number, number] {
  const [x, y] = token.replace(/^[A-Z]/, '').split(',').map(Number);
  return [x, y];
}

// Parses the two line-endpoint coordinates out of a `slicePath` string: the arc start (the `L`
// command right after the initial move-to-center) and the arc end (the coordinate pair right
// before the closing `Z`).
function endpoints(path: string): { start: [number, number]; end: [number, number] } {
  const tokens = path.trim().split(/\s+/);
  const lineToken = tokens.find((token) => token.startsWith('L'));
  const zIndex = tokens.indexOf('Z');
  if (!lineToken || zIndex < 1) throw new Error(`unparsable slice path: ${path}`);
  return {
    start: toPoint(lineToken),
    end: toPoint(tokens[zIndex - 1]),
  };
}

describe('slicePath', () => {
  it('starts slice 0 at twelve o\'clock, directly above center', () => {
    const { start } = endpoints(slicePath(0, COUNT, RADIUS, CENTER));
    expect(start[0]).toBeCloseTo(CENTER);
    expect(start[1]).toBeCloseTo(CENTER - RADIUS);
  });

  it('sweeps clockwise: slice 0 ends to the right of its start, at the 2 o\'clock mark', () => {
    const { start, end } = endpoints(slicePath(0, COUNT, RADIUS, CENTER));
    expect(end[0]).toBeGreaterThan(start[0]);
    expect(end[1]).toBeGreaterThan(start[1]);
  });

  it('tiles the full circle: each slice end matches the next slice start', () => {
    for (let i = 0; i < COUNT; i += 1) {
      const current = endpoints(slicePath(i, COUNT, RADIUS, CENTER));
      const next = endpoints(slicePath((i + 1) % COUNT, COUNT, RADIUS, CENTER));
      expect(current.end[0]).toBeCloseTo(next.start[0]);
      expect(current.end[1]).toBeCloseTo(next.start[1]);
    }
  });

  it('closes the path with Z', () => {
    expect(slicePath(2, COUNT, RADIUS, CENTER).trim().endsWith('Z')).toBe(true);
  });
});

describe('nextRotation', () => {
  function expectedTarget(index: number, count: number): number {
    const raw = -(index + 0.5) * (360 / count);
    return ((raw % 360) + 360) % 360;
  }

  it('centers the chosen slice under the top pointer (mod 360)', () => {
    const result = nextRotation(0, 2, COUNT);
    expect(((result % 360) + 360) % 360).toBeCloseTo(expectedTarget(2, COUNT));
  });

  it('never rotates backward relative to the current position', () => {
    const result = nextRotation(400, 4, COUNT);
    expect(result).toBeGreaterThanOrEqual(400);
  });

  it('leaves the rotation unchanged when the slice is already centered', () => {
    const alreadyCentered = expectedTarget(0, COUNT);
    expect(nextRotation(alreadyCentered, 0, COUNT)).toBe(alreadyCentered);
  });

  it('keeps consecutive selections monotonic (never spins back)', () => {
    let rotation = 0;
    const picks = [3, 1, 4, 4, 0, 5];
    for (const index of picks) {
      const next = nextRotation(rotation, index, COUNT);
      expect(next).toBeGreaterThanOrEqual(rotation);
      rotation = next;
    }
  });
});
