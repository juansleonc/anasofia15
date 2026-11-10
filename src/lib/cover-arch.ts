// Pure, deterministic layout generator for the decorative balloon-and-flower arch that frames
// the cover (see components/BalloonArch.astro, which owns the DOM/SVG rendering). Given a spec
// it always returns the same positioned items, so the geometry is unit-testable without a DOM.
//
// Items are placed along a single ∩-shaped "spine" polyline: up the left side column, over the
// crown, down the right side column. This module spreads balloons along it; flowers, leaves, and
// a clear-zone clamp for the title/button join in later work.

export type ArchItemKind = 'balloon' | 'flower' | 'leaf';

export type ArchSymbol =
  | 'balloon-pink'
  | 'balloon-rosegold'
  | 'balloon-champagne'
  | 'rose-bloom'
  | 'rose-cream'
  | 'blossom'
  | 'leaf-eucalyptus'
  | 'leaf-gold';

export interface ArchItem {
  symbol: ArchSymbol;
  kind: ArchItemKind;
  x: number;
  y: number;
  size: number;
  rotate: number;
  /** Paint order, back to front: 0 leaves, 1 back balloons, 2 flowers, 3 front accent balloons. */
  layer: 0 | 1 | 2 | 3;
}

export interface ArchSpec {
  /** SVG viewBox the layout is generated for. */
  width: number;
  height: number;
  /** viewBox y: the full-width crown ends here; below it, in [gutter, width-gutter], is clear. */
  band: number;
  /** viewBox x: side columns live in [0, gutter] and [width-gutter, width] below the band. */
  gutter: number;
  /** viewBox y the side columns reach down to (<= height). */
  sideDepth: number;
  seed: number;
  counts: { balloons: number; flowers: number; leaves: number };
  /** Balloon diameter range in viewBox units, before taper. */
  sizeRange: [number, number];
}

export interface ArchLayout {
  width: number;
  height: number;
  items: ArchItem[];
}

export const ARCH_SPECS: { portrait: ArchSpec; landscape: ArchSpec } = {
  portrait: {
    width: 400,
    height: 300,
    band: 150,
    gutter: 34,
    sideDepth: 290,
    seed: 15,
    counts: { balloons: 22, flowers: 10, leaves: 16 },
    sizeRange: [44, 78],
  },
  landscape: {
    width: 1440,
    height: 360,
    band: 180,
    gutter: 220,
    sideDepth: 350,
    seed: 1219,
    counts: { balloons: 34, flowers: 14, leaves: 24 },
    sizeRange: [60, 110],
  },
};

const BALLOON_SYMBOLS: readonly ArchSymbol[] = ['balloon-pink', 'balloon-rosegold', 'balloon-champagne'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic LCG — same shape as the one already used in petals.test.ts, local to this module. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

interface Point {
  x: number;
  y: number;
}

interface SpineSample extends Point {
  /** Unit normal, perpendicular to the spine's local direction of travel. */
  nx: number;
  ny: number;
}

/**
 * The ∩ spine: up the left side column, over the crown, down the right side column. Balloons,
 * and later flowers/leaves, are placed by sampling along it.
 */
function spinePoints(spec: ArchSpec): Point[] {
  const { width, band, gutter, sideDepth } = spec;
  return [
    { x: gutter / 2, y: sideDepth },
    { x: gutter / 2, y: band * 0.6 },
    { x: width * 0.18, y: band * 0.35 },
    { x: width / 2, y: band * 0.3 },
    { x: width * 0.82, y: band * 0.35 },
    { x: width - gutter / 2, y: band * 0.6 },
    { x: width - gutter / 2, y: sideDepth },
  ];
}

/** Sample the polyline by arc length at t ∈ [0,1], with the local unit normal. */
function sampleSpine(points: Point[], t: number): SpineSample {
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }

  const target = clamp(t, 0, 1) * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const isLast = i === segLengths.length - 1;
    if (target <= acc + segLengths[i] || isLast) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const segLen = segLengths[i];
      const segT = segLen === 0 ? 0 : clamp((target - acc) / segLen, 0, 1);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: p0.x + dx * segT,
        y: p0.y + dy * segT,
        nx: -dy / len,
        ny: dx / len,
      };
    }
    acc += segLengths[i];
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, nx: 0, ny: 1 };
}

/** Big across the crown (t≈0.5), shrinking down the sides (t≈0 / t≈1). */
function taper(t: number): number {
  return 0.45 + 0.55 * Math.sin(Math.PI * clamp(t, 0, 1));
}

/**
 * Spreads balloons evenly along the spine (with seeded jitter), tapering their size down the
 * sides, in two paint layers (big back balloons, smaller front accents). Tone assignment here is
 * a plain seeded pick — later work replaces it with a round-robin shuffle that guarantees the mix.
 */
function placeBalloons(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.balloons;
  const maxSize = spec.sizeRange[1];
  const sizeSpan = spec.sizeRange[1] - spec.sizeRange[0];
  const items: ArchItem[] = [];

  for (let i = 0; i < count; i++) {
    const base = count <= 1 ? 0.5 : i / (count - 1);
    const jitter = (rng() - 0.5) * (0.6 / Math.max(count, 1));
    const t = clamp(base + jitter, 0, 1);

    const sample = sampleSpine(points, t);
    const isBack = i % 2 === 0;
    const layer: 1 | 3 = isBack ? 1 : 3;
    const size = (spec.sizeRange[0] + sizeSpan * taper(t)) * (isBack ? 1 : 0.75);

    const side = rng() < 0.5 ? -1 : 1;
    const offset = side * 0.35 * size;
    const rawX = sample.x + sample.nx * offset;
    const rawY = sample.y + sample.ny * offset;

    const toneIndex = Math.min(BALLOON_SYMBOLS.length - 1, Math.floor(rng() * BALLOON_SYMBOLS.length));

    items.push({
      symbol: BALLOON_SYMBOLS[toneIndex],
      kind: 'balloon',
      x: clamp(rawX, -maxSize, spec.width + maxSize),
      y: clamp(rawY, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 20,
      layer,
    });
  }

  return items;
}

export function buildArch(spec: ArchSpec): ArchLayout {
  const rng = seededRandom(spec.seed);
  const points = spinePoints(spec);
  const items = placeBalloons(spec, points, rng).sort((a, b) => a.layer - b.layer || a.y - b.y);

  return { width: spec.width, height: spec.height, items };
}
