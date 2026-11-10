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
  | 'balloon-rosegold-satin'
  | 'balloon-champagne'
  | 'balloon-champagne-satin'
  | 'rose-pink'
  | 'rose-cream'
  | 'peony-blush'
  | 'blossom'
  | 'leaf-eucalyptus'
  | 'leaf-olive'
  | 'leaf-gold';

/** A balloon's metallic/pearl tone, independent of which chrome-vs-satin finish it renders as. */
export type ArchTone = 'pink' | 'rosegold' | 'champagne';

export interface ArchItem {
  symbol: ArchSymbol;
  kind: ArchItemKind;
  /** Set on balloons only — the tone before chrome/satin finish is applied. */
  tone?: ArchTone;
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
  /** viewBox y where the soft fade-out of the side columns starts; it always ends at `height`. */
  fadeStart: number;
  /** 0 = uniform along the spine; >0 concentrates items on the crown (t≈0.15-0.85). */
  crownBias: number;
  /** 0 = no extra weight; >0 packs balloons, and bigger ones, into the two top corners. */
  cornerBias: number;
  seed: number;
  /** `fillers` are extra small balloons tucked into the gaps the main balloons leave. */
  counts: { balloons: number; fillers: number; flowers: number; leaves: number };
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
    height: 470,
    band: 190,
    gutter: 42,
    sideDepth: 455,
    fadeStart: 250,
    crownBias: 8,
    cornerBias: 20,
    seed: 15,
    counts: { balloons: 30, fillers: 12, flowers: 16, leaves: 24 },
    sizeRange: [38, 84],
  },
  landscape: {
    width: 1440,
    height: 540,
    band: 190,
    gutter: 230,
    sideDepth: 525,
    fadeStart: 300,
    crownBias: 8,
    cornerBias: 26,
    seed: 1219,
    counts: { balloons: 46, fillers: 16, flowers: 22, leaves: 34 },
    sizeRange: [54, 124],
  },
};

const BALLOON_TONES: readonly ArchTone[] = ['pink', 'rosegold', 'champagne'];
const FLOWER_SYMBOLS: readonly ArchSymbol[] = ['rose-pink', 'rose-cream', 'peony-blush', 'blossom'];
const LEAF_SYMBOLS: readonly ArchSymbol[] = ['leaf-eucalyptus', 'leaf-olive', 'leaf-gold'];

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
    { x: width * 0.18, y: band * 0.4 },
    { x: width / 2, y: band * 0.4 },
    { x: width * 0.82, y: band * 0.4 },
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

/** A point on the spec's ∩ spine at arc-length fraction t ∈ [0,1] (0 = bottom-left, 1 = bottom-right). */
export function archSpinePoint(spec: ArchSpec, t: number): { x: number; y: number } {
  const { x, y } = sampleSpine(spinePoints(spec), t);
  return { x, y };
}

/** Big across the crown (t≈0.5), shrinking down the sides (t≈0 / t≈1). */
function taper(t: number): number {
  return 0.45 + 0.55 * Math.sin(Math.PI * clamp(t, 0, 1));
}

/** Spine fraction where each side column turns into the crown — the arch's two top corners. */
function cornerTs(points: Point[]): [number, number] {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  const knee = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / total;
  return [knee, 1 - knee];
}

/** 1 at either top corner, falling off smoothly along the spine. */
function cornerBump(t: number, corners: [number, number]): number {
  const width = 0.12;
  const left = (t - corners[0]) / width;
  const right = (t - corners[1]) / width;
  return Math.max(Math.exp(-left * left), Math.exp(-right * right));
}

/** Balloon size profile: biggest at the corners, still generous mid-crown, smallest down the sides. */
function balloonTaper(t: number, corners: [number, number]): number {
  return 0.45 + 0.55 * Math.max(0.7 * Math.sin(Math.PI * clamp(t, 0, 1)), cornerBump(t, corners));
}

const WARP_STEPS = 64;

/**
 * Warps a uniform slot position `u` ∈ [0,1] through the inverse CDF of the crown-weighting
 * density `1 + crownBias·sin(πt)^0.5`, built as a fixed 64-step numeric table (no closed form
 * needed). `crownBias` 0 leaves `u` unchanged; a higher bias packs more of the evenly spaced
 * slots into the high-density region around the crown (t≈0.5), while the endpoints (t=0, t=1)
 * stay exactly fixed so the sides still reach `sideDepth` and the crown still spans both gutters.
 */
function warp(u: number, crownBias: number): number {
  if (crownBias === 0) {
    return clamp(u, 0, 1);
  }
  return warpByDensity(u, (t) => 1 + crownBias * Math.sqrt(Math.sin(Math.PI * t)));
}

/** Inverse-CDF warp of `u` ∈ [0,1] through an arbitrary positive density over t ∈ [0,1]. */
function warpByDensity(u: number, density: (t: number) => number): number {
  const target = clamp(u, 0, 1);
  const cdf = new Array<number>(WARP_STEPS + 1).fill(0);
  for (let i = 1; i <= WARP_STEPS; i++) {
    const t0 = (i - 1) / WARP_STEPS;
    const t1 = i / WARP_STEPS;
    cdf[i] = cdf[i - 1] + density((t0 + t1) / 2) * (t1 - t0);
  }
  const total = cdf[WARP_STEPS];
  for (let i = 0; i <= WARP_STEPS; i++) {
    cdf[i] /= total;
  }

  let i = 0;
  while (i < WARP_STEPS && cdf[i + 1] < target) {
    i++;
  }
  const c0 = cdf[i];
  const c1 = cdf[Math.min(i + 1, WARP_STEPS)];
  const span = c1 - c0;
  const frac = span === 0 ? 0 : (target - c0) / span;
  return (i + frac) / WARP_STEPS;
}

/**
 * Round-robin tones across `count` slots, then seeded-shuffle the slots so the mix is guaranteed
 * (each tone gets floor(count/3) or ceil(count/3)) rather than left to an independent random pick.
 */
function shuffledTones(count: number, rng: () => number): ArchTone[] {
  const tones: ArchTone[] = [];
  for (let i = 0; i < count; i++) {
    tones.push(BALLOON_TONES[i % BALLOON_TONES.length]);
  }
  for (let i = tones.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tones[i], tones[j]] = [tones[j], tones[i]];
  }
  return tones;
}

/**
 * Each metallic tone's finish alternates chrome/satin as it recurs (1st chrome, 2nd satin, 3rd
 * chrome, …) so any spec with ≥ 2 balloons of a given metallic tone shows both finishes; pink has
 * no satin counterpart and is always pearl.
 */
function toneSymbol(tone: ArchTone, occurrence: number): ArchSymbol {
  const isChrome = occurrence % 2 === 0;
  switch (tone) {
    case 'pink':
      return 'balloon-pink';
    case 'rosegold':
      return isChrome ? 'balloon-rosegold' : 'balloon-rosegold-satin';
    case 'champagne':
      return isChrome ? 'balloon-champagne' : 'balloon-champagne-satin';
  }
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
  const toneOccurrences: Record<ArchTone, number> = { pink: 0, rosegold: 0, champagne: 0 };
  const items: ArchItem[] = [];
  const corners = cornerTs(points);
  const density = (t: number): number =>
    1 + spec.crownBias * Math.sqrt(Math.sin(Math.PI * t)) + spec.cornerBias * cornerBump(t, corners);

  for (let i = 0; i < count; i++) {
    const base = count <= 1 ? 0.5 : warpByDensity(i / (count - 1), density);
    const jitter = (rng() - 0.5) * (0.6 / Math.max(count, 1));
    const t = clamp(base + jitter, 0, 1);

    const sample = sampleSpine(points, t);
    const isBack = i % 2 === 0;
    const layer: 1 | 3 = isBack ? 1 : 3;
    const size = (spec.sizeRange[0] + sizeSpan * balloonTaper(t, corners)) * (isBack ? 1 : 0.75);

    const side = rng() < 0.5 ? -1 : 1;
    const offset = side * (0.15 + 0.45 * rng()) * (1 + 0.6 * cornerBump(t, corners)) * size;
    const rawX = sample.x + sample.nx * offset;
    const rawY = sample.y + sample.ny * offset;

    const tone = tones[i];
    const occurrence = toneOccurrences[tone]++;

    items.push({
      symbol: toneSymbol(tone, occurrence),
      kind: 'balloon',
      tone,
      x: clamp(rawX, -maxSize, spec.width + maxSize),
      y: clamp(rawY, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 20,
      layer,
    });
  }

  return items;
}

const FILLER_SPINE_STEPS = 120;

/** How far `point` sits from the edge of the nearest solid: negative inside one, positive in a gap. */
function clearance(point: Point, solids: ArchItem[]): number {
  let gap = Infinity;
  for (const solid of solids) {
    gap = Math.min(gap, Math.hypot(point.x - solid.x, point.y - solid.y) - solid.size / 2);
  }
  return gap;
}

function inClearZone(point: Point, spec: ArchSpec): boolean {
  return point.y > spec.band && point.x > spec.gutter && point.x < spec.width - spec.gutter;
}

/**
 * Spots across the visible garland band where a filler may go: along the spine and on lines a
 * third of the biggest balloon to either side, skipping the masked-out bottom, the text clear
 * zone and anything off-canvas.
 */
function fillerSpots(spec: ArchSpec, points: Point[]): Point[] {
  const halfWidth = spec.sizeRange[1] / 3;
  const spots: Point[] = [];
  for (let i = 0; i <= FILLER_SPINE_STEPS; i++) {
    const sample = sampleSpine(points, i / FILLER_SPINE_STEPS);
    for (const offset of [0, -halfWidth, halfWidth]) {
      spots.push({ x: sample.x + sample.nx * offset, y: sample.y + sample.ny * offset });
    }
  }
  return spots.filter(
    (spot) =>
      spot.x >= 0 && spot.x <= spec.width && spot.y >= 0 && spot.y <= spec.fadeStart && !inClearZone(spot, spec),
  );
}

/**
 * Second pass of small balloons tucked into the garland's gaps, greedily: each filler goes to the
 * band spot furthest from any balloon or flower edge (the biggest visible hole), sized to just
 * overlap that edge so it plugs the hole while touching the garland rather than floating free.
 */
function placeFillers(spec: ArchSpec, points: Point[], solids: ArchItem[], rng: () => number): ArchItem[] {
  const count = spec.counts.fillers;
  const maxSize = spec.sizeRange[1];
  const minSize = 0.3 * maxSize;
  const fillerMax = 0.6 * maxSize;
  const tones = shuffledTones(count, rng);
  const toneOccurrences: Record<ArchTone, number> = { pink: 0, rosegold: 0, champagne: 0 };
  const spots = fillerSpots(spec, points);
  const placed = [...solids];
  const items: ArchItem[] = [];

  for (let i = 0; i < count && spots.length > 0; i++) {
    let best = { spot: spots[0], gap: clearance(spots[0], placed) };
    for (const spot of spots.slice(1)) {
      const gap = clearance(spot, placed);
      if (gap > best.gap) {
        best = { spot, gap };
      }
    }

    const size = clamp(2.2 * best.gap, minSize, fillerMax);
    const { x, y } = best.spot;

    const tone = tones[i];
    const filler: ArchItem = {
      symbol: toneSymbol(tone, toneOccurrences[tone]++),
      kind: 'balloon',
      tone,
      x: clamp(x, -maxSize, spec.width + maxSize),
      y: clamp(y, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 20,
      layer: 3,
    };
    items.push(filler);
    placed.push(filler);
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
    const base = count <= 1 ? 0.5 : warp(i / (count - 1), spec.crownBias);
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

/**
 * CSS `mask-image` value that keeps a layout's side columns opaque down to `fadeStart`, then fades
 * them out so they vanish by `height` (the `overflow:hidden` clip line) instead of ending in a
 * hard-cut edge.
 */
export function archFadeMask(spec: ArchSpec): string {
  const stopPercent = (spec.fadeStart / spec.height) * 100;
  return `linear-gradient(to bottom, var(--c-white) ${stopPercent}%, transparent 100%)`;
}

export function buildArch(spec: ArchSpec): ArchLayout {
  const rng = seededRandom(spec.seed);
  const points = spinePoints(spec);
  const leaves = placeLeaves(spec, points, rng);
  const solids = [...placeBalloons(spec, points, rng), ...placeFlowers(spec, points, rng)].map((item) =>
    clampOutOfClearZone(item, spec),
  );
  const fillers = placeFillers(spec, points, solids, rng).map((item) => clampOutOfClearZone(item, spec));
  const items = [...leaves.map((item) => clampOutOfClearZone(item, spec)), ...solids, ...fillers].sort(
    (a, b) => a.layer - b.layer || a.y - b.y,
  );

  return { width: spec.width, height: spec.height, items };
}
