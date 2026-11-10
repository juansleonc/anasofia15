// Pure, deterministic layout generator for the decorative balloon-and-flower arch that frames
// the cover (see components/BalloonArch.astro, which owns the DOM/SVG rendering). Given a spec
// it always returns the same positioned items, so the geometry is unit-testable without a DOM.
//
// Items are placed along a single ∩-shaped "spine": up the left side column, round a wide corner
// arc, over the crown, and back down the right side column. Only the left half is generated; the
// right half is its mirror across the vertical axis (with small seeded jitter and swapped
// colour/symbol variants), and any odd item out sits on the axis itself, so both sides always
// carry the same visual weight.

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
  /** Radius of the arc each top corner of the spine rounds, in viewBox units. */
  cornerRadius: number;
  /** viewBox y where the soft fade-out of the side columns starts; it always ends at `height`. */
  fadeStart: number;
  /** viewBox units every visible item keeps clear of the canvas edge, so the cover frame never clips it. */
  inset: number;
  /** 0 = balloons go wherever there is most room; >0 favours the crown, as a fraction of the biggest balloon. */
  crownBias: number;
  /** 0 = no extra weight; >0 favours the two top corners, as a fraction of the biggest balloon. */
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
    height: 560,
    band: 190,
    gutter: 48,
    sideDepth: 545,
    cornerRadius: 140,
    fadeStart: 380,
    inset: 12,
    crownBias: 0.1,
    cornerBias: 1,
    seed: 15,
    counts: { balloons: 20, fillers: 6, flowers: 9, leaves: 30 },
    sizeRange: [30, 80],
  },
  landscape: {
    width: 1440,
    height: 620,
    band: 200,
    gutter: 300,
    sideDepth: 600,
    cornerRadius: 300,
    fadeStart: 430,
    inset: 24,
    crownBias: 0.3,
    cornerBias: 0.3,
    seed: 1219,
    counts: { balloons: 32, fillers: 6, flowers: 17, leaves: 40 },
    sizeRange: [40, 116],
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
  /** Direction of travel in degrees: −90 up the left column, 0 across the crown, 90 down the right. */
  angle: number;
}

/** The spine as a dense polyline, with the cumulative arc length up to each of its points. */
interface Spine {
  points: Point[];
  lengths: number[];
  /** Spine fraction of each top corner's shoulder, where the garland is fullest. */
  corners: [number, number];
}

/** Points each corner arc is drawn with — fine enough that no step turns more than ~2°. */
const CORNER_ARC_STEPS = 48;
/** Tilt from horizontal, in degrees, of the spot on each corner arc treated as its shoulder. */
const SHOULDER_TILT = 40;

/**
 * The ∩ spine: up the left side column, round a quarter-circle corner of `cornerRadius`, across
 * the crown, then the mirror image down the right side column. Balloons, flowers and leaves are
 * placed by sampling along it.
 */
function buildSpine(spec: ArchSpec): Spine {
  const { width, band, gutter, sideDepth, cornerRadius: r } = spec;
  const legX = gutter / 2;
  const crownY = band * 0.5;
  const centerX = legX + r;
  const centerY = crownY + r;
  const left: Point[] = [{ x: legX, y: sideDepth }];
  for (let i = 0; i <= CORNER_ARC_STEPS; i++) {
    const phi = Math.PI * (1 + (0.5 * i) / CORNER_ARC_STEPS);
    left.push({ x: centerX + r * Math.cos(phi), y: centerY + r * Math.sin(phi) });
  }
  const right = left.map((p) => ({ x: width - p.x, y: p.y })).reverse();
  const points = [...left, ...right];

  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  const knee = lengths[1 + Math.round(CORNER_ARC_STEPS * (1 - SHOULDER_TILT / 90))] / total;
  return { points, lengths, corners: [knee, 1 - knee] };
}

/** Sample the spine by arc length at t ∈ [0,1], with the local unit normal and direction. */
function sampleSpine(spine: Spine, t: number): SpineSample {
  const { points, lengths } = spine;
  const target = clamp(t, 0, 1) * lengths[lengths.length - 1];
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const p0 = points[lo];
  const p1 = points[hi];
  const segLen = lengths[hi] - lengths[lo];
  const segT = segLen === 0 ? 0 : clamp((target - lengths[lo]) / segLen, 0, 1);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: p0.x + dx * segT,
    y: p0.y + dy * segT,
    nx: -dy / len,
    ny: dx / len,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/** Spine fraction where the left side first climbs up to viewBox height `y`. */
function spineFractionAtHeight(spine: Spine, y: number): number {
  const { points, lengths } = spine;
  const i = points.findIndex((p) => p.y <= y);
  return lengths[Math.max(i, 0)] / lengths[lengths.length - 1];
}

/** A point on the spec's ∩ spine at arc-length fraction t ∈ [0,1] (0 = bottom-left, 1 = bottom-right). */
export function archSpinePoint(spec: ArchSpec, t: number): { x: number; y: number } {
  const { x, y } = sampleSpine(buildSpine(spec), t);
  return { x, y };
}

/** How much of the spine's local direction a flower or leaf leans into, so it follows the curve. */
const TANGENT_TILT = 0.3;

/** Big across the crown (t≈0.5), shrinking down the sides (t≈0 / t≈1). */
function taper(t: number): number {
  return 0.45 + 0.55 * Math.sin(Math.PI * clamp(t, 0, 1));
}

/** Spine fraction over which the pull toward each corner's shoulder falls off. */
const CORNER_BUMP_WIDTH = 0.12;

/** 1 at either top corner, falling off smoothly along the spine over `width`. */
function cornerBump(t: number, corners: [number, number], width = CORNER_BUMP_WIDTH): number {
  const left = (t - corners[0]) / width;
  const right = (t - corners[1]) / width;
  return Math.max(Math.exp(-left * left), Math.exp(-right * right));
}

/** Spine fraction over which balloons swell to full size around each corner's shoulder. */
const SIZE_BUMP_WIDTH = 0.08;

/** Balloon size profile: biggest at the corners, still generous mid-crown, smallest down the sides. */
function balloonTaper(t: number, corners: [number, number]): number {
  return 0.45 + 0.55 * Math.max(0.35 * Math.sin(Math.PI * clamp(t, 0, 1)), cornerBump(t, corners, SIZE_BUMP_WIDTH));
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
 * Moves an item out of the text clear zone, then wholly inside the canvas's top and side edges
 * (inset by `spec.inset`), shrinking it if a side column is too narrow to hold it.
 */
function fitInside(item: ArchItem, spec: ArchSpec): ArchItem {
  const cleared = clampOutOfClearZone(item, spec);
  const margin = spec.inset;
  const inSideColumn = cleared.y + cleared.size / 2 > spec.band;
  const size = inSideColumn ? Math.min(cleared.size, spec.gutter - margin) : cleared.size;
  const r = size / 2;
  const onLeft = cleared.x < spec.width / 2;
  const [minX, maxX] = !inSideColumn
    ? [margin + r, spec.width - margin - r]
    : onLeft
      ? [margin + r, spec.gutter - r]
      : [spec.width - spec.gutter + r, spec.width - margin - r];
  return { ...cleared, size, x: clamp(cleared.x, minX, maxX), y: Math.max(cleared.y, margin + r) };
}

/** Most of an item's disc that may hide under the items painted in front of it. */
const BURY_LIMIT = 0.36;
const BURY_SAMPLES = 10;

/** Final paint order is by layer, then by y — so this is known as soon as both are placed. */
function paintsAbove(a: ArchItem, b: ArchItem): boolean {
  return a.layer > b.layer || (a.layer === b.layer && a.y > b.y);
}

function overlaps(a: ArchItem, b: ArchItem): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < (a.size + b.size) / 2;
}

/** Fraction of `item`'s disc hidden under those of `others` that paint above it, by grid sampling. */
function buriedFraction(item: ArchItem, others: ArchItem[]): number {
  const above = others.filter((other) => other !== item && paintsAbove(other, item) && overlaps(other, item));
  if (above.length === 0) {
    return 0;
  }
  const r = item.size / 2;
  let inside = 0;
  let hidden = 0;
  for (let i = 0; i < BURY_SAMPLES; i++) {
    for (let j = 0; j < BURY_SAMPLES; j++) {
      const x = item.x + r * ((2 * (i + 0.5)) / BURY_SAMPLES - 1);
      const y = item.y + r * ((2 * (j + 0.5)) / BURY_SAMPLES - 1);
      if (Math.hypot(x - item.x, y - item.y) > r) {
        continue;
      }
      inside += 1;
      if (above.some((other) => Math.hypot(x - other.x, y - other.y) <= other.size / 2)) {
        hidden += 1;
      }
    }
  }
  return hidden / inside;
}

/** True when adding `candidate` leaves neither it nor anything it overlaps buried past the limit. */
function fitsAmong(candidate: ArchItem, placed: ArchItem[]): boolean {
  const neighbors = placed.filter((other) => overlaps(other, candidate));
  if (buriedFraction(candidate, neighbors) > BURY_LIMIT) {
    return false;
  }
  return neighbors.every(
    (other) =>
      !paintsAbove(candidate, other) ||
      buriedFraction(other, [...placed.filter((p) => overlaps(p, other)), candidate]) <= BURY_LIMIT,
  );
}

/**
 * Takes the first candidate that fits among `placed` together with its mirrored twin (when it has
 * one), or nothing when none fits — so counts are exact only when the spec fits its canvas.
 */
function pickFitting(
  candidates: ArchItem[],
  placed: ArchItem[],
  twinOf: (item: ArchItem) => ArchItem | null,
): ArchItem[] {
  for (const candidate of candidates) {
    if (!fitsAmong(candidate, placed)) {
      continue;
    }
    const twin = twinOf(candidate);
    if (twin === null) {
      return [candidate];
    }
    if (fitsAmong(twin, [...placed, candidate])) {
      return [candidate, twin];
    }
  }
  return [];
}

/** Share of the crown's balloon area the two outer quarters aim for: a gentle corner emphasis. */
const CORNER_SHARE = 0.58;

function inCrownCorner(item: ArchItem, spec: ArchSpec): boolean {
  return item.x < spec.width * 0.25 || item.x > spec.width * 0.75;
}

/**
 * Reorders `candidates` (keeping their own order within each group) so the zone of the crown that
 * is behind its share of balloon area so far — the two outer quarters or the middle half — is tried
 * first, then the side columns below the crown (which count for neither), then the other zone.
 */
function steerCorners(candidates: ArchItem[], balloons: ArchItem[], spec: ArchSpec): ArchItem[] {
  const crown = balloons.filter((item) => item.y < spec.band);
  const area = (items: ArchItem[]): number => items.reduce((sum, item) => sum + item.size * item.size, 0);
  const total = area(crown);
  const wantCorner = total === 0 || area(crown.filter((item) => inCrownCorner(item, spec))) / total < CORNER_SHARE;
  const rank = (item: ArchItem): number =>
    item.y >= spec.band ? 1 : inCrownCorner(item, spec) === wantCorner ? 0 : 2;
  return [0, 1, 2].flatMap((group) => candidates.filter((item) => rank(item) === group));
}

/** Spine steps across the left half where a balloon may be centered. */
const BALLOON_SPINE_STEPS = 80;
/** Normal offsets (fractions of balloon size; negative = outward) a balloon may sit at. */
const SPINE_OFFSETS = [-0.45, 0.45];
/** The axis balloon may also ride further out, above a flower cluster sitting on the axis. */
const AXIS_OFFSETS = [...SPINE_OFFSETS, -0.9, -1.2];

/**
 * Spreads balloons along the left half of the spine one at a time, each into the open spot with
 * the most room around it (nudged toward the crown and the corners by the spec's biases), sized by
 * the taper: biggest at the corners, smaller down the sides. Every balloon must sit clear of being
 * buried by — or burying — what is already placed, flowers included. Alternate balloons go behind
 * (big) and in front (smaller accents); each is mirrored to the right, and an odd one out goes on
 * the axis. The side columns only reach a quarter of the way into the masked-out fade.
 */
function placeBalloons(spec: ArchSpec, spine: Spine, flowers: ArchItem[], rng: () => number): ArchItem[] {
  const count = spec.counts.balloons;
  const half = Math.floor(count / 2);
  const maxSize = spec.sizeRange[1];
  const sizeSpan = spec.sizeRange[1] - spec.sizeRange[0];
  const leftTones = shuffledTones(half, rng);
  const rightTones = shuffledTones(half, rng, half);
  const corners = spine.corners;
  const lowest = spec.fadeStart + 0.25 * (spec.sideDepth - spec.fadeStart);
  const preference = (t: number): number =>
    maxSize * (spec.crownBias * Math.sqrt(Math.sin(Math.PI * t)) + spec.cornerBias * cornerBump(t, corners));

  const balloonAt = (
    t: number,
    isBack: boolean,
    tone: ArchTone,
    offsetFrac: number,
    rotate: number,
    scale: number,
  ): ArchItem => {
    const sample = sampleSpine(spine, t);
    const size = (spec.sizeRange[0] + sizeSpan * balloonTaper(t, corners)) * (isBack ? 1 : 0.75) * scale;
    const offset = offsetFrac * size;
    return fitInside(
      {
        symbol: toneSymbol(tone, 0),
        kind: 'balloon',
        tone,
        x: clamp(sample.x + sample.nx * offset, -maxSize, spec.width + maxSize),
        y: clamp(sample.y + sample.ny * offset, -maxSize, spec.height),
        size,
        rotate,
        layer: isBack ? 1 : 2,
      },
      spec,
    );
  };

  /**
   * Every open spot for the next balloon, roomiest (plus preference) first — then the same again at
   * smaller sizes, so a balloon that no longer fits anywhere at full size still finds a gap.
   */
  const rankedCandidates = (isBack: boolean, tone: ArchTone, ts: number[], placed: ArchItem[]): ArchItem[] => {
    const rotate = (rng() - 0.5) * 20;
    return [1, 0.7, 0.5, 0.35].flatMap((scale) => {
      const scored: { item: ArchItem; score: number }[] = [];
      for (const t of ts) {
        if (sampleSpine(spine, t).y > lowest) {
          continue;
        }
        for (const offset of t === 0.5 ? AXIS_OFFSETS : SPINE_OFFSETS) {
          const item = balloonAt(t, isBack, tone, offset, rotate, scale);
          const room = clearance(item, placed) - item.size / 2;
          scored.push({ item, score: room + preference(t) + rng() * 0.05 * item.size });
        }
      }
      return scored.sort((a, b) => b.score - a.score).map(({ item }) => item);
    });
  };

  const leftTs = Array.from({ length: BALLOON_SPINE_STEPS + 1 }, (_, i) => (LEFT_HALF_END * i) / BALLOON_SPINE_STEPS);
  const isSide = (t: number): boolean => sampleSpine(spine, t).y >= spec.band;
  const reachable = leftTs.filter((t) => sampleSpine(spine, t).y <= lowest);
  // The side column gets its share of balloons by spine length; the crown gets the rest.
  const sideCount = Math.round((half * reachable.filter(isSide).length) / reachable.length);
  const items: ArchItem[] = [];
  for (let i = 0; i < half; i++) {
    const placed = [...flowers, ...items];
    const onSide = i >= half - sideCount;
    const ts = leftTs.filter((t) => isSide(t) === onSide);
    const twinOf = (left: ArchItem): ArchItem => fitInside({ ...mirrorItem(left, spec, rng), tone: rightTones[i] }, spec);
    const candidates = rankedCandidates(i % 2 === 0, leftTones[i], ts, placed);
    items.push(...pickFitting(onSide ? candidates : steerCorners(candidates, items, spec), placed, twinOf));
  }
  if (count % 2 === 1) {
    const tone = BALLOON_TONES[(2 * half) % BALLOON_TONES.length];
    const placed = [...flowers, ...items];
    const onAxis = rankedCandidates(true, tone, [0.5], placed).map((item) => fitInside({ ...item, x: spec.width / 2 }, spec));
    items.push(...pickFitting(onAxis, placed, () => null));
  }

  return withFinishes(items);
}

const FILLER_SPINE_STEPS = 120;
/** How many of the biggest holes a filler may try before giving up on fitting cleanly. */
const FILLER_CANDIDATES = 24;

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
 * Spots across the visible garland band where a filler may go: on lines a third of the biggest
 * balloon to either side of the spine (never on it, so the spine keeps its soft gaps), skipping the masked-out bottom, the text clear
 * zone and anything off-canvas.
 */
function fillerSpots(spec: ArchSpec, spine: Spine): Point[] {
  const halfWidth = spec.sizeRange[1] / 3;
  const spots: Point[] = [];
  for (let i = 0; i <= FILLER_SPINE_STEPS; i++) {
    const sample = sampleSpine(spine, i / FILLER_SPINE_STEPS);
    for (const offset of [-halfWidth, halfWidth]) {
      spots.push({ x: sample.x + sample.nx * offset, y: sample.y + sample.ny * offset });
    }
  }
  return spots.filter(
    (spot) =>
      spot.x >= 0 && spot.x <= spec.width && spot.y >= 0 && spot.y <= spec.fadeStart && !inClearZone(spot, spec),
  );
}

/**
 * Second pass of small balloons tucked into the garland's gaps, greedily: each filler goes to one
 * of the left-half band spots furthest from any balloon or flower edge (the biggest visible holes)
 * where it buries nothing, sized to just overlap that edge so it touches the garland rather than
 * floating free. Every left filler gets a mirrored twin, re-sized to the hole it lands in; an odd
 * count puts its odd one out on the axis.
 */
function placeFillers(spec: ArchSpec, spine: Spine, solids: ArchItem[], rng: () => number): ArchItem[] {
  const maxSize = spec.sizeRange[1];
  const minSize = 0.3 * maxSize;
  const fillerMax = 0.6 * maxSize;
  const axis = spec.width / 2;
  const isOnAxis = (spot: Point): boolean => Math.abs(spot.x - axis) < 1e-6;
  const leftTones = shuffledTones(spec.counts.fillers, rng);
  const rightTones = shuffledTones(spec.counts.fillers, rng, 1);
  const spots = fillerSpots(spec, spine)
    .filter((spot) => spot.x < axis || isOnAxis(spot))
    .map((spot) => (isOnAxis(spot) ? { x: axis, y: spot.y } : spot));
  const placed = [...solids];
  const items: ArchItem[] = [];
  let remaining = spec.counts.fillers;
  let leftCount = 0;
  let rightCount = 0;

  const fillerAt = (spot: Point, gap: number, tone: ArchTone): ArchItem =>
    fitInside(
      {
        symbol: toneSymbol(tone, 0),
        kind: 'balloon',
        tone,
        x: clamp(spot.x, -maxSize, spec.width + maxSize),
        y: clamp(spot.y, -maxSize, spec.height),
        size: clamp(2.2 * gap, minSize, fillerMax),
        rotate: (rng() - 0.5) * 20,
        layer: 2,
      },
      spec,
    );

  while (remaining > 0) {
    // An odd count puts its odd one out on the axis first; the rest go in mirrored pairs.
    const onAxis = remaining % 2 === 1;
    const ranked = spots
      .filter((spot) => isOnAxis(spot) === onAxis)
      .map((spot) => ({ spot, gap: clearance(spot, placed) }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, FILLER_CANDIDATES);
    if (ranked.length === 0) {
      break;
    }

    const tone = leftTones[leftCount];
    const candidates = ranked.map(({ spot, gap }) => fillerAt(spot, gap, tone));
    const twinOf = (filler: ArchItem): ArchItem | null => {
      if (onAxis) {
        return null;
      }
      const mirrored = mirrorItem(filler, spec, rng);
      const size = clamp(2.2 * clearance(mirrored, [...placed, filler]), minSize, fillerMax);
      return fitInside({ ...mirrored, tone: rightTones[rightCount], size }, spec);
    };
    const picked = pickFitting(candidates, placed, twinOf);
    leftCount += 1;
    if (picked.length === 0) {
      // Nothing fits this slot: drop it so the loop still ends.
      remaining -= onAxis ? 1 : 2;
      continue;
    }
    rightCount += picked.length - 1;
    remaining -= picked.length;
    items.push(...picked);
    placed.push(...picked);
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

/** How far above the band, in biggest-balloon widths, the spine passes where each corner flower cluster sits — low on the shoulder, yet still in the crown. */
const CORNER_CLUSTER_RISE = 0.5;
/** How far inside the spine, as a fraction of the local balloon size, a flower cluster nestles. */
const FLOWER_INSET = 0.4;

/** Candidate spots across the garland around spine position `t`, clamped so a flower of `size` stays on canvas above the band. */
function flowerSpots(spec: ArchSpec, spine: Spine, t: number, size: number): Point[] {
  const r = size / 2;
  const margin = spec.inset;
  const spots: Point[] = [];
  for (let step = -4; step <= 4; step++) {
    const sample = sampleSpine(spine, clamp(t + step * 0.012, 0, 1));
    for (const offset of [-0.4, -0.2, 0, 0.2, 0.4]) {
      spots.push({
        x: clamp(sample.x + sample.nx * offset * size, margin + r, spec.width - margin - r),
        y: clamp(sample.y + sample.ny * offset * size, margin + r, spec.band - r * (1 + 1e-6)),
      });
    }
  }
  return spots;
}

/**
 * Bunches the flowers into clusters of two or three — one just below each top corner, the rest
 * spread evenly across the crown between them, and one centered on the axis — each about two
 * thirds the biggest balloon. Flowers are placed before the balloons, which then fit around them.
 * Each flower goes to the spot nearest its cluster's anchor (just inside the spine) where it
 * buries nothing, and every flower after a cluster's first stays within touching distance of it. Left flowers are mirrored to the right as a shifted symbol, and
 * the center cluster is built from on-axis flowers and mirrored pairs straddling the axis.
 * Round-robin over the four flower symbols, so a spec with at least 4 flowers uses all of them.
 */
function placeFlowers(spec: ArchSpec, spine: Spine, rng: () => number): ArchItem[] {
  const corners = spine.corners;
  const count = spec.counts.flowers;
  const minClusters = Math.max(2, Math.ceil(count / 3));
  // An odd flower count needs a center cluster to hold the one flower that has no mirror twin.
  const clusters = count % 2 === 1 && minClusters % 2 === 0 ? minClusters + 1 : minClusters;
  const { sides, center } = clusterSizes(count, clusters);
  const axis = spec.width / 2;
  const symbolShift = 1 + Math.floor(rng() * (FLOWER_SYMBOLS.length - 1));
  const placed: ArchItem[] = [];
  const items: ArchItem[] = [];
  let symbolIndex = 0;

  const insideCanvas = (flower: ArchItem): ArchItem => {
    const r = flower.size / 2;
    const margin = spec.inset;
    return {
      ...flower,
      x: clamp(flower.x, margin + r, spec.width - margin - r),
      y: clamp(flower.y, margin + r, spec.band - r * (1 + 1e-6)),
    };
  };

  const placeCluster = (t: number, pairs: number, onAxis: number): void => {
    const isCenter = t === 0.5;
    const localBalloon = spec.sizeRange[0] + (spec.sizeRange[1] - spec.sizeRange[0]) * balloonTaper(t, corners);
    const sample = sampleSpine(spine, t);
    const inward = FLOWER_INSET * localBalloon;
    const anchor = { x: sample.x + sample.nx * inward, y: sample.y + sample.ny * inward };
    // The center cluster favors spots close to the axis over ones straight below it, so it stays centered.
    const across = isCenter ? 2 : 1;
    const members: ArchItem[] = [];
    for (let m = 0; m < onAxis + pairs; m++) {
      const axial = m < onAxis;
      const size = spec.sizeRange[1] * (0.6 + 0.06 * rng());
      const spread = (spot: Point): boolean => {
        const group = isCenter && !axial ? [...members, { x: spec.width - spot.x, y: spot.y }] : members;
        return (
          group.every((other) => Math.hypot(spot.x - other.x, spot.y - other.y) >= 0.75 * size) &&
          (group.length === 0 || group.some((other) => Math.hypot(spot.x - other.x, spot.y - other.y) <= 1.1 * size))
        );
      };
      const allSpots = flowerSpots(spec, spine, t, size).map((spot) => (axial ? { x: axis, y: spot.y } : spot));
      const spots = allSpots.filter((spot) => (axial || spot.x < axis) && spread(spot));
      const ranked = (spots.length > 0 ? spots : allSpots.slice(0, 1))
        .map((spot) => ({ spot, distance: Math.hypot(across * (spot.x - anchor.x), spot.y - anchor.y) }))
        .sort((a, b) => a.distance - b.distance);

      const symbol = FLOWER_SYMBOLS[symbolIndex++ % FLOWER_SYMBOLS.length];
      const rotate = TANGENT_TILT * sample.angle + (rng() - 0.5) * 20;
      const candidates = ranked.map(({ spot }): ArchItem => ({
        symbol,
        kind: 'flower',
        x: spot.x,
        y: spot.y,
        size,
        rotate,
        layer: 3,
      }));
      const twinOf = (flower: ArchItem): ArchItem | null =>
        axial
          ? null
          : insideCanvas({
              ...mirrorItem(flower, spec, rng),
              symbol: shiftedSymbol(FLOWER_SYMBOLS, flower.symbol, symbolShift),
            });
      const placedNow = pickFitting(candidates, placed, twinOf);
      members.push(...placedNow);
      items.push(...placedNow);
      placed.push(...placedNow);
    }
  };

  const first = spineFractionAtHeight(spine, spec.band - CORNER_CLUSTER_RISE * spec.sizeRange[1]);
  sides.forEach((size, c) => {
    placeCluster(first + ((1 - 2 * first) * c) / (clusters - 1), size, 0);
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
function placeLeaves(spec: ArchSpec, spine: Spine, rng: () => number): ArchItem[] {
  const count = spec.counts.leaves;
  const half = Math.floor(count / 2);
  const maxSize = spec.sizeRange[1];
  const symbolShift = 1 + Math.floor(rng() * (LEAF_SYMBOLS.length - 1));

  const leafAt = (t: number, symbol: ArchSymbol): ArchItem => {
    const sample = sampleSpine(spine, t);
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
      rotate: TANGENT_TILT * sample.angle + (rng() - 0.5) * 30,
      layer: 0,
    };
  };

  const items: ArchItem[] = [];
  for (let i = 0; i < half; i++) {
    const base = half <= 1 ? 0 : (0.5 * i) / (half - 0.5);
    const jitter = (rng() - 0.5) * (0.5 / count);
    const left = fitInside(leafAt(clamp(base + jitter, 0, LEFT_HALF_END), LEAF_SYMBOLS[i % LEAF_SYMBOLS.length]), spec);
    const right = fitInside(mirrorItem(left, spec, rng), spec);
    items.push(left, { ...right, symbol: shiftedSymbol(LEAF_SYMBOLS, left.symbol, symbolShift) });
  }
  if (count % 2 === 1) {
    items.push(fitInside({ ...leafAt(0.5, LEAF_SYMBOLS[half % LEAF_SYMBOLS.length]), x: spec.width / 2 }, spec));
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
  const spine = buildSpine(spec);
  const leaves = placeLeaves(spec, spine, rng);
  const flowers = placeFlowers(spec, spine, rng);
  const solids = [...placeBalloons(spec, spine, flowers, rng), ...flowers];
  const fillers = placeFillers(spec, spine, solids, rng);
  const items = [...leaves, ...solids, ...fillers].sort((a, b) => a.layer - b.layer || a.y - b.y);

  return { width: spec.width, height: spec.height, items };
}
