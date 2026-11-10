// Pure, deterministic layout generator for the decorative balloon-and-flower arch that frames
// the cover (see components/BalloonArch.astro, which owns the DOM/SVG rendering). Given a spec
// it always returns the same positioned items, so the geometry is unit-testable without a DOM.
//
// Items are placed along a single ∩-shaped "spine" polyline: up the left side column, over the
// crown, down the right side column. Only the left half is generated; the right half is its mirror
// across the vertical axis (with small seeded jitter and swapped colour/symbol variants), and any
// odd item out sits on the axis itself, so both sides always carry the same visual weight.

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
  /** Paint order, back to front: 0 leaves, 1 back balloons, 2 front accent and filler balloons, 3 flowers. */
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
    counts: { balloons: 30, fillers: 12, flowers: 8, leaves: 24 },
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
    cornerBias: 34,
    seed: 1219,
    counts: { balloons: 46, fillers: 16, flowers: 13, leaves: 34 },
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
 * Round-robin tones across `count` slots, starting at the `start`-th tone, then seeded-shuffle the
 * slots so the mix is guaranteed (each tone gets floor(count/3) or ceil(count/3)) rather than left
 * to an independent random pick. Consecutive blocks with chained `start`s split one round-robin.
 */
function shuffledTones(count: number, rng: () => number, start = 0): ArchTone[] {
  const tones: ArchTone[] = [];
  for (let i = 0; i < count; i++) {
    tones.push(BALLOON_TONES[(start + i) % BALLOON_TONES.length]);
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

/** Gives each balloon its finish in order, so every metallic tone alternates chrome and satin. */
function withFinishes(balloons: ArchItem[]): ArchItem[] {
  const occurrences: Record<ArchTone, number> = { pink: 0, rosegold: 0, champagne: 0 };
  return balloons.map((item) =>
    item.tone === undefined ? item : { ...item, symbol: toneSymbol(item.tone, occurrences[item.tone]++) },
  );
}

/** How far a mirrored item may drift from the exact mirror spot, as a fraction of its size. */
const MIRROR_POSITION_JITTER = 0.04;
/** How much a mirrored item's size may differ from its left twin's, as a fraction. */
const MIRROR_SIZE_JITTER = 0.08;
/** Spine fraction the left half stops short of, so no left item lands on or past the axis. */
const LEFT_HALF_END = 0.49;

/** The symbol `shift` steps along `symbols` from `symbol` — the right side's variant of a left item. */
function shiftedSymbol(symbols: readonly ArchSymbol[], symbol: ArchSymbol, shift: number): ArchSymbol {
  return symbols[(symbols.indexOf(symbol) + shift) % symbols.length];
}

/**
 * The right-side twin of a left item: reflected across the vertical axis (x → width − x, rotation
 * negated), nudged by a little seeded jitter in position and size.
 */
function mirrorItem(item: ArchItem, spec: ArchSpec, rng: () => number): ArchItem {
  const nudge = (): number => (rng() - 0.5) * 2 * MIRROR_POSITION_JITTER * item.size;
  const x = spec.width - item.x + nudge();
  const y = item.y + nudge();
  return {
    ...item,
    x: Math.max(x, spec.width / 2 + 1e-6),
    y,
    size: item.size * (1 + (rng() - 0.5) * 2 * MIRROR_SIZE_JITTER),
    rotate: -item.rotate,
  };
}

/**
 * Spreads balloons evenly along the left half of the spine (with seeded jitter), tapering their
 * size down the side, in two paint layers (big back balloons, smaller front accents); mirrors each
 * to the right, and puts an odd one out at the crown's center.
 */
function placeBalloons(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.balloons;
  const half = Math.floor(count / 2);
  const maxSize = spec.sizeRange[1];
  const sizeSpan = spec.sizeRange[1] - spec.sizeRange[0];
  const leftTones = shuffledTones(half, rng);
  const rightTones = shuffledTones(half, rng, half);
  const corners = cornerTs(points);
  const density = (t: number): number =>
    1 + spec.crownBias * Math.sqrt(Math.sin(Math.PI * t)) + spec.cornerBias * cornerBump(t, corners);

  const balloonAt = (t: number, isBack: boolean, tone: ArchTone): ArchItem => {
    const sample = sampleSpine(points, t);
    const size = (spec.sizeRange[0] + sizeSpan * balloonTaper(t, corners)) * (isBack ? 1 : 0.75);
    const side = rng() < 0.5 ? -1 : 1;
    const offset = side * (0.15 + 0.45 * rng()) * (1 + 0.6 * cornerBump(t, corners)) * size;
    return {
      symbol: toneSymbol(tone, 0),
      kind: 'balloon',
      tone,
      x: clamp(sample.x + sample.nx * offset, -maxSize, spec.width + maxSize),
      y: clamp(sample.y + sample.ny * offset, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 20,
      layer: isBack ? 1 : 2,
    };
  };

  const items: ArchItem[] = [];
  for (let i = 0; i < half; i++) {
    const base = half <= 1 ? 0 : 0.5 * warpByDensity(i / (half - 0.5), (u) => density(u / 2));
    const jitter = (rng() - 0.5) * (0.6 / count);
    const left = clampOutOfClearZone(balloonAt(clamp(base + jitter, 0, LEFT_HALF_END), i % 2 === 0, leftTones[i]), spec);
    const right = clampOutOfClearZone(mirrorItem(left, spec, rng), spec);
    items.push(left, { ...right, tone: rightTones[i] });
  }
  if (count % 2 === 1) {
    const tone = BALLOON_TONES[(2 * half) % BALLOON_TONES.length];
    items.push(clampOutOfClearZone({ ...balloonAt(0.5, true, tone), x: spec.width / 2 }, spec));
  }

  return withFinishes(items);
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
 * left-half or on-axis band spot furthest from any balloon or flower edge (the biggest visible
 * hole), sized to just overlap that edge so it plugs the hole while touching the garland rather
 * than floating free. Every left filler gets a mirrored twin, re-sized to the hole it lands in.
 */
function placeFillers(spec: ArchSpec, points: Point[], solids: ArchItem[], rng: () => number): ArchItem[] {
  const maxSize = spec.sizeRange[1];
  const minSize = 0.3 * maxSize;
  const fillerMax = 0.6 * maxSize;
  const axis = spec.width / 2;
  const isOnAxis = (spot: Point): boolean => Math.abs(spot.x - axis) < 1e-6;
  const leftTones = shuffledTones(spec.counts.fillers, rng);
  const rightTones = shuffledTones(spec.counts.fillers, rng, 1);
  const spots = fillerSpots(spec, points)
    .filter((spot) => spot.x < axis || isOnAxis(spot))
    .map((spot) => (isOnAxis(spot) ? { x: axis, y: spot.y } : spot));
  const placed = [...solids];
  const items: ArchItem[] = [];
  let remaining = spec.counts.fillers;
  let leftCount = 0;
  let rightCount = 0;

  const fillerAt = (spot: Point, gap: number, tone: ArchTone): ArchItem => ({
    symbol: toneSymbol(tone, 0),
    kind: 'balloon',
    tone,
    x: clamp(spot.x, -maxSize, spec.width + maxSize),
    y: clamp(spot.y, -maxSize, spec.height),
    size: clamp(2.2 * gap, minSize, fillerMax),
    rotate: (rng() - 0.5) * 20,
    layer: 2,
  });

  while (remaining > 0) {
    const candidates = remaining >= 2 ? spots : spots.filter(isOnAxis);
    let best: { spot: Point; gap: number } | null = null;
    for (const spot of candidates) {
      const gap = clearance(spot, placed);
      if (best === null || gap > best.gap) {
        best = { spot, gap };
      }
    }
    if (best === null) {
      break;
    }

    const filler = clampOutOfClearZone(fillerAt(best.spot, best.gap, leftTones[leftCount++]), spec);
    items.push(filler);
    placed.push(filler);
    remaining -= 1;
    if (isOnAxis(best.spot)) {
      continue;
    }

    const mirrored = mirrorItem(filler, spec, rng);
    const twin = clampOutOfClearZone(
      { ...mirrored, tone: rightTones[rightCount], size: clamp(2.2 * clearance(mirrored, placed), minSize, fillerMax) },
      spec,
    );
    rightCount += 1;
    items.push(twin);
    placed.push(twin);
    remaining -= 1;
  }

  return withFinishes(items);
}

/** The balloon size the taper would give at `t`, before any per-item scaling. */
function taperedBalloonSize(spec: ArchSpec, t: number): number {
  return spec.sizeRange[0] + (spec.sizeRange[1] - spec.sizeRange[0]) * taper(t);
}

/**
 * How many flowers each left cluster (and so its mirrored twin) gets, plus the center cluster on
 * the axis: an even split, with spare pairs going to the corner clusters first, then inward, so
 * the corners always carry the fullest bunches. The center cluster takes whatever is left.
 */
function clusterSizes(count: number, clusters: number): { sides: number[]; center: number } {
  const perCluster = Math.floor(count / clusters);
  const sides = new Array<number>(Math.floor(clusters / 2)).fill(perCluster);
  const hasCenter = clusters % 2 === 1;
  let spare = count - 2 * perCluster * sides.length - (hasCenter ? perCluster : 0);
  for (let i = 0; spare >= 2 && sides.length > 0; i = (i + 1) % sides.length) {
    sides[i] += 1;
    spare -= 2;
  }
  return { sides, center: hasCenter ? perCluster + spare : 0 };
}

/** Candidate spots across the garland around spine position `t`, clamped so a flower of `size` stays on canvas above the band. */
function flowerSpots(spec: ArchSpec, points: Point[], t: number, size: number): Point[] {
  const r = size / 2;
  const spots: Point[] = [];
  for (let step = -4; step <= 4; step++) {
    const sample = sampleSpine(points, clamp(t + step * 0.012, 0, 1));
    for (const offset of [-0.4, -0.2, 0, 0.2, 0.4]) {
      spots.push({
        x: clamp(sample.x + sample.nx * offset * size, r, spec.width - r),
        y: clamp(sample.y + sample.ny * offset * size, r, spec.band - r * (1 + 1e-6)),
      });
    }
  }
  return spots;
}

/**
 * Bunches the flowers into clusters of two or three — one at each top corner, the rest spread
 * evenly across the crown between them, and one centered on the axis — sized close to the local
 * balloons. Each flower goes to the nearby spot with the most clearance from the balloons and
 * flowers already placed (nestled into a gap), and every flower after a cluster's first stays
 * within touching distance of it. Left flowers are mirrored to the right as a shifted symbol, and
 * the center cluster is built from on-axis flowers and mirrored pairs straddling the axis.
 * Round-robin over the four flower symbols, so a spec with at least 4 flowers uses all of them.
 */
function placeFlowers(spec: ArchSpec, points: Point[], balloons: ArchItem[], rng: () => number): ArchItem[] {
  const corners = cornerTs(points);
  const count = spec.counts.flowers;
  const minClusters = Math.max(2, Math.ceil(count / 3));
  // An odd flower count needs a center cluster to hold the one flower that has no mirror twin.
  const clusters = count % 2 === 1 && minClusters % 2 === 0 ? minClusters + 1 : minClusters;
  const { sides, center } = clusterSizes(count, clusters);
  const axis = spec.width / 2;
  const symbolShift = 1 + Math.floor(rng() * (FLOWER_SYMBOLS.length - 1));
  const placed = [...balloons];
  const items: ArchItem[] = [];
  let symbolIndex = 0;

  const insideCanvas = (flower: ArchItem): ArchItem => {
    const r = flower.size / 2;
    return {
      ...flower,
      x: clamp(flower.x, r, spec.width - r),
      y: clamp(flower.y, r, spec.band - r * (1 + 1e-6)),
    };
  };

  const placeCluster = (t: number, pairs: number, onAxis: number): void => {
    const isCenter = t === 0.5;
    const localBalloon = spec.sizeRange[0] + (spec.sizeRange[1] - spec.sizeRange[0]) * balloonTaper(t, corners);
    const members: ArchItem[] = [];
    for (let m = 0; m < onAxis + pairs; m++) {
      const axial = m < onAxis;
      const size = localBalloon * (0.63 + 0.2 * rng());
      const spread = (spot: Point): boolean => {
        const group = isCenter && !axial ? [...members, { x: spec.width - spot.x, y: spot.y }] : members;
        return (
          group.every((other) => Math.hypot(spot.x - other.x, spot.y - other.y) >= 0.6 * size) &&
          (group.length === 0 || group.some((other) => Math.hypot(spot.x - other.x, spot.y - other.y) <= 1.1 * size))
        );
      };
      const allSpots = flowerSpots(spec, points, t, size).map((spot) => (axial ? { x: axis, y: spot.y } : spot));
      const spots = allSpots.filter((spot) => (axial || spot.x < axis) && spread(spot));
      const best = spots.reduce<{ spot: Point; gap: number } | null>((acc, spot) => {
        const gap = clearance(spot, placed);
        return acc === null || gap > acc.gap ? { spot, gap } : acc;
      }, null);
      const spot = best?.spot ?? allSpots[0];

      const flower: ArchItem = {
        symbol: FLOWER_SYMBOLS[symbolIndex++ % FLOWER_SYMBOLS.length],
        kind: 'flower',
        x: spot.x,
        y: spot.y,
        size,
        rotate: (rng() - 0.5) * 20,
        layer: 3,
      };
      const placedNow = axial
        ? [flower]
        : [
            flower,
            insideCanvas({
              ...mirrorItem(flower, spec, rng),
              symbol: shiftedSymbol(FLOWER_SYMBOLS, flower.symbol, symbolShift),
            }),
          ];
      members.push(...placedNow);
      items.push(...placedNow);
      placed.push(...placedNow);
    }
  };

  sides.forEach((size, c) => {
    placeCluster(corners[0] + ((corners[1] - corners[0]) * c) / (clusters - 1), size, 0);
  });
  if (center > 0) {
    placeCluster(0.5, Math.floor(center / 2), center % 2);
  }

  return items;
}

/**
 * Scatters leaves behind the balloons along the left half of the spine, offset further outward
 * than any other item so they fan out past the arch's edge, then mirrors each to the right as a
 * shifted leaf symbol; an odd one out sits on the axis. Round-robin over the leaf symbols, so a
 * spec with at least 3 leaves uses all of them.
 */
function placeLeaves(spec: ArchSpec, points: Point[], rng: () => number): ArchItem[] {
  const count = spec.counts.leaves;
  const half = Math.floor(count / 2);
  const maxSize = spec.sizeRange[1];
  const symbolShift = 1 + Math.floor(rng() * (LEAF_SYMBOLS.length - 1));

  const leafAt = (t: number, symbol: ArchSymbol): ArchItem => {
    const sample = sampleSpine(points, t);
    const size = taperedBalloonSize(spec, t) * (0.4 + rng() * 0.3);
    // Outward = away from the arch's interior (the left side column fans left, the crown fans
    // up), so the leaves read as sprigs trailing past the balloons, not tucked inside.
    const offset = -(0.5 + rng() * 0.3) * size;
    return {
      symbol,
      kind: 'leaf',
      x: clamp(sample.x + sample.nx * offset, -maxSize, spec.width + maxSize),
      y: clamp(sample.y + sample.ny * offset, -maxSize, spec.height),
      size,
      rotate: (rng() - 0.5) * 30,
      layer: 0,
    };
  };

  const items: ArchItem[] = [];
  for (let i = 0; i < half; i++) {
    const base = half <= 1 ? 0 : (0.5 * i) / (half - 0.5);
    const jitter = (rng() - 0.5) * (0.5 / count);
    const left = clampOutOfClearZone(leafAt(clamp(base + jitter, 0, LEFT_HALF_END), LEAF_SYMBOLS[i % LEAF_SYMBOLS.length]), spec);
    const right = clampOutOfClearZone(mirrorItem(left, spec, rng), spec);
    items.push(left, { ...right, symbol: shiftedSymbol(LEAF_SYMBOLS, left.symbol, symbolShift) });
  }
  if (count % 2 === 1) {
    items.push({ ...leafAt(0.5, LEAF_SYMBOLS[half % LEAF_SYMBOLS.length]), x: spec.width / 2 });
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
  const balloons = placeBalloons(spec, points, rng);
  const solids = [...balloons, ...placeFlowers(spec, points, balloons, rng)];
  const fillers = placeFillers(spec, points, solids, rng);
  const items = [...leaves, ...solids, ...fillers].sort((a, b) => a.layer - b.layer || a.y - b.y);

  return { width: spec.width, height: spec.height, items };
}
