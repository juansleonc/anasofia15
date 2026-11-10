// Pure, deterministic layout generator for the decorative balloon-and-flower arch that frames
// the cover (see components/BalloonArch.astro, which owns the DOM/SVG rendering). Given a spec
// it always returns the same positioned items, so the geometry is unit-testable without a DOM.
//
// Items are placed along a single ∩-shaped "spine" polyline: up the left side column, over the
// crown, down the right side column. This module spreads balloons, flowers and leaves along it;
// a clear-zone clamp for the title/button joins in later work.

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
const FLOWER_SYMBOLS: readonly ArchSymbol[] = ['rose-bloom', 'rose-cream', 'blossom'];
const LEAF_SYMBOLS: readonly ArchSymbol[] = ['leaf-eucalyptus', 'leaf-gold'];

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
 * Round-robin tones across `count` slots, then seeded-shuffle the slots so the mix is guaranteed
 * (each tone gets floor(count/3) or ceil(count/3)) rather than left to an independent random pick.
 */
function shuffledTones(count: number, rng: () => number): ArchSymbol[] {
  const tones: ArchSymbol[] = [];
  for (let i = 0; i < count; i++) {
    tones.push(BALLOON_SYMBOLS[i % BALLOON_SYMBOLS.length]);
  }
  for (let i = tones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tones[i], tones[j]] = [tones[j], tones[i]];
  }
  return tones;
}

/**
 * Spreads balloons evenly along the spine (with seeded jitter), tapering their size down the
 * sides, in two paint layers (big back balloons, smaller front accents).
 */
function placeBalloons(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.balloons;
  const maxSize = spec.sizeRange[1];
  const sizeSpan = spec.sizeRange[1] - spec.sizeRange[0];
  const tones = shuffledTones(count, rng);
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

    items.push({
      symbol: tones[i],
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

/** The balloon size the taper would give at `t`, before any per-item scaling. */
function taperedBalloonSize(spec: ArchSpec, t: number): number {
  return spec.sizeRange[0] + (spec.sizeRange[1] - spec.sizeRange[0]) * taper(t);
}

/**
 * Scatters flowers along the spine, nestled between the balloons (round-robin over the three
 * flower symbols, so a spec with at least 3 flowers uses all of them), each a fraction of the
 * local balloon size.
 */
function placeFlowers(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.flowers;
  const maxSize = spec.sizeRange[1];
  const items: ArchItem[] = [];

  for (let i = 0; i < count; i++) {
    const base = count <= 1 ? 0.5 : i / (count - 1);
    // Half-step phase shift so flowers land between balloon slots, not on top of them.
    const phase = 0.5 / Math.max(count, 1);
    const jitter = (rng() - 0.5) * (0.4 / Math.max(count, 1));
    const t = clamp(base + phase + jitter, 0, 1);

    const sample = sampleSpine(points, t);
    const size = taperedBalloonSize(spec, t) * (0.5 + rng() * 0.3);
    const side = rng() < 0.5 ? -1 : 1;
    const offset = side * 0.2 * size;

    items.push({
      symbol: FLOWER_SYMBOLS[i % FLOWER_SYMBOLS.length],
      kind: 'flower',
      x: clamp(sample.x + sample.nx * offset, -maxSize, spec.width + maxSize),
      y: clamp(sample.y + sample.ny * offset, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 20,
      layer: 2,
    });
  }

  return items;
}

/**
 * Scatters leaves behind the balloons, offset further outward from the spine than any other
 * item so they fan out past the arch's edge (round-robin over the two leaf symbols, so a spec
 * with at least 2 leaves uses both).
 */
function placeLeaves(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.leaves;
  const maxSize = spec.sizeRange[1];
  const items: ArchItem[] = [];

  for (let i = 0; i < count; i++) {
    const base = count <= 1 ? 0.5 : i / (count - 1);
    const jitter = (rng() - 0.5) * (0.5 / Math.max(count, 1));
    const t = clamp(base + jitter, 0, 1);

    const sample = sampleSpine(points, t);
    const size = taperedBalloonSize(spec, t) * (0.4 + rng() * 0.3);
    // Outward = away from the arch's interior: left half of the spine fans left, right half
    // fans right, so the leaves read as sprigs trailing past the balloons, not tucked inside.
    const outwardSide = t < 0.5 ? -1 : 1;
    const offset = outwardSide * (0.5 + rng() * 0.3) * size;

    items.push({
      symbol: LEAF_SYMBOLS[i % LEAF_SYMBOLS.length],
      kind: 'leaf',
      x: clamp(sample.x + sample.nx * offset, -maxSize, spec.width + maxSize),
      y: clamp(sample.y + sample.ny * offset, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 30,
      layer: 0,
    });
  }

  return items;
}

/**
 * Pulls an item's circle back out of the text clear zone — the full-width rectangle below the
 * crown, between the two side columns — rather than rejecting it, so counts stay exact. Items
 * whose circle doesn't intersect the clear zone pass through untouched.
 */
function clampOutOfClearZone(item: ArchItem, spec: ArchSpec): ArchItem {
  const left = spec.gutter;
  const right = spec.width - spec.gutter;
  const top = spec.band;
  const bottom = spec.height;
  const r = item.size / 2;

  const nearestX = clamp(item.x, left, right);
  const nearestY = clamp(item.y, top, bottom);
  const distance = Math.hypot(item.x - nearestX, item.y - nearestY);
  if (distance >= r) {
    return item;
  }

  // Pull back whichever way is the shortest move: up above the band, or sideways out past a
  // gutter — the three edges of the clear rectangle an item could be straddling. A tiny margin
  // keeps the result strictly clear of the boundary despite floating-point rounding.
  const margin = r * 1e-6;
  const candidates: Point[] = [
    { x: item.x, y: top - r - margin },
    { x: left - r - margin, y: item.y },
    { x: right + r + margin, y: item.y },
  ];
  let best = candidates[0];
  let bestDistance = Math.hypot(item.x - best.x, item.y - best.y);
  for (const candidate of candidates.slice(1)) {
    const candidateDistance = Math.hypot(item.x - candidate.x, item.y - candidate.y);
    if (candidateDistance < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }

  const maxSize = spec.sizeRange[1];
  return {
    ...item,
    x: clamp(best.x, -maxSize, spec.width + maxSize),
    y: clamp(best.y, -maxSize, spec.height),
  };
}

/** Inline-style string tying the text clear-zone padding to the same band/width ratio as the geometry. */
export function archClearanceVars(specs: typeof ARCH_SPECS): string {
  const portraitRatio = specs.portrait.band / specs.portrait.width;
  const landscapeRatio = specs.landscape.band / specs.landscape.width;
  return `--arch-band-portrait:${portraitRatio};--arch-band-landscape:${landscapeRatio}`;
}

export function buildArch(spec: ArchSpec): ArchLayout {
  const rng = seededRandom(spec.seed);
  const points = spinePoints(spec);
  const items = [
    ...placeLeaves(spec, points, rng),
    ...placeBalloons(spec, points, rng),
    ...placeFlowers(spec, points, rng),
  ]
    .map((item) => clampOutOfClearZone(item, spec))
    .sort((a, b) => a.layer - b.layer || a.y - b.y);

  return { width: spec.width, height: spec.height, items };
}
