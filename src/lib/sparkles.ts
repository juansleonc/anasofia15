// Pure, seeded scatter for the idle decorative sparkles on the cover (see
// components/CoverSparkles.astro, which owns the DOM/CSS rendering). The scatter covers the
// whole cover — including the band behind the title/button, not just the arch — so the cover
// reads as lightly dusted with sparkle rather than framed by it. Framework-free and seeded so the
// layout is unit-testable without a DOM.
//
// Nov 2026 user-feedback pass: the old hard-edged gold "fleck" chip read as noise ("desordenado").
// Replaced with three soft kinds only — `glow` (small round light dots), `star` (soft 4-point
// stars with a blurred halo) and `bokeh` (large, very faint out-of-focus discs) — at a lower,
// Poisson-spaced count so the scatter reads as calm, organized light rather than scattered grit.

export type SparkleKind = 'glow' | 'star' | 'bokeh';

export interface Sparkle {
  kind: SparkleKind;
  /** 0..100 — horizontal position as a percentage of the cover width. */
  xPct: number;
  /** 0..100 — vertical position as a percentage of the cover height. */
  yPct: number;
  sizePx: number;
  /** 0..360deg — starting rotation (only the star shape renders it). */
  rotateDeg: number;
  /** 0..4000ms — staggers each sparkle's twinkle start. */
  delayMs: number;
  /** 3600..6400ms — one gentle, opacity-only twinkle cycle. */
  durationMs: number;
}

/** Hard cap so the idle scatter reads as calm, organized light rather than visual noise. */
export const MAX_SPARKLES = 28;

/** Minimum allowed distance between any two sparkles, in cover-percentage units (Poisson-like
 *  spacing so sparkles never clump into the "noise" the gold flecks used to read as). */
export const MIN_DISTANCE_PCT = 9;

/** How many candidate positions a sparkle may try before settling for its best (furthest-spaced)
 *  attempt — keeps placement a finite, deterministic loop even in a crowded late scatter. */
const PLACEMENT_ATTEMPTS = 60;

export interface ScatterSparklesOptions {
  count: number;
  seed: number;
}

/** Deterministic LCG, local to this module (the curated garland in cover-garland.ts needs none). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Round-robin pattern giving an exact 4:2:1 glow:star:bokeh ratio every 7 sparkles — glow light
 *  dominates, stars are occasional accents, bokeh discs are the rarest (and largest/faintest). */
const KIND_PATTERN: readonly SparkleKind[] = ['glow', 'glow', 'glow', 'glow', 'star', 'star', 'bokeh'];

const SIZE_RANGES: Record<SparkleKind, [number, number]> = {
  glow: [3, 7],
  star: [8, 14],
  bokeh: [26, 58],
};

interface Position {
  xPct: number;
  yPct: number;
}

/** Skews y toward the top of the cover — denser near the arch and the name, sparse at the
 *  bottom — without ever leaving the 0..100 range. */
function biasedYPct(random: () => number): number {
  return 100 * Math.pow(random(), 1.6);
}

function distancePct(a: Position, b: Position): number {
  return Math.hypot(a.xPct - b.xPct, a.yPct - b.yPct);
}

function minDistanceTo(point: Position, placed: readonly Position[]): number {
  let min = Infinity;
  for (const other of placed) {
    const distance = distancePct(point, other);
    if (distance < min) min = distance;
  }
  return min;
}

/** Rejection-samples a position at least MIN_DISTANCE_PCT away from every sparkle placed so far,
 *  falling back to the best (furthest-spaced) candidate tried if the budget runs out. */
function placePosition(random: () => number, placed: readonly Position[]): Position {
  let best: Position = { xPct: random() * 100, yPct: biasedYPct(random) };
  let bestDistance = placed.length === 0 ? Infinity : minDistanceTo(best, placed);

  for (let attempt = 1; attempt < PLACEMENT_ATTEMPTS && bestDistance < MIN_DISTANCE_PCT; attempt++) {
    const candidate: Position = { xPct: random() * 100, yPct: biasedYPct(random) };
    const candidateDistance = minDistanceTo(candidate, placed);
    if (candidateDistance > bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

export interface RingSparklesOptions {
  count: number;
  seed: number;
}

/** Only glow and star — bokeh's large, very-faint disc would just read as a blur smeared over the
 *  letters at this tight a radius, so it's left out of the ring on purpose. */
const RING_KIND_PATTERN: readonly SparkleKind[] = ['glow', 'star', 'glow'];

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * A small, tightly clustered ring of extra glow/star sparkles meant to sit layered directly
 * around the title block (see Cover.astro, which positions this absolutely over the celebrant's
 * name/lead) — distinct from `scatterSparkles`'s calm whole-cover dusting. Nov 2026 user-feedback
 * pass: "mucho espacio vacío en el centro" — the arch is getting airier in a parallel task, so the
 * centre needed its own subtle concentration of light to stay balanced, not just a bigger scatter.
 */
export function ringSparkles(options: RingSparklesOptions): Sparkle[] {
  const random = seededRandom(options.seed);
  const count = Math.max(0, Math.floor(options.count));
  const sparkles: Sparkle[] = [];

  for (let i = 0; i < count; i++) {
    const kind = RING_KIND_PATTERN[i % RING_KIND_PATTERN.length];
    const [min, max] = SIZE_RANGES[kind];
    // Evenly spaced around the ring with a seeded wobble (angle) and a varying radius so it reads
    // as organic sparkle rather than a mechanical, perfectly circular necklace.
    const angle = (i / count) * Math.PI * 2 + random() * 0.8;
    const radius = 36 + random() * 14;

    sparkles.push({
      kind,
      xPct: clampPct(50 + Math.cos(angle) * radius),
      // Flattened vertically — the title block reads wider than it is tall.
      yPct: clampPct(50 + Math.sin(angle) * radius * 0.55),
      sizePx: min + random() * (max - min) * 0.6,
      rotateDeg: random() * 360,
      delayMs: random() * 4000,
      durationMs: 3600 + random() * 2800,
    });
  }

  return sparkles;
}

/** A rectangle, in cover-percentage units, that particles must never land inside — used to carve
 *  the name/button out of the widened lower band. */
export interface KeepOutRect {
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

export interface LowerGlitterOptions {
  flakeCount: number;
  bokehCount: number;
  seed: number;
  /** Rects (name, button, …) particles must never land inside — see CoverLowerGlitter.astro for
   *  the actual percentages, tuned against the rendered layout. Defaults to none. */
  keepOutRects?: readonly KeepOutRect[];
}

/** Where the lower glitter band starts, as a percentage of the cover's own height. Widened
 *  from 80 (which only covered the strip under the button) to around the cover's own midpoint,
 *  so the whole lower half reads alive — the name/button are now kept clear by `keepOutRects`
 *  instead of by starting the band below them. */
export const LOWER_REGION_START_PCT = 58;

/** Minimum spacing between any two lower-glitter particles, in cover-percentage units — tighter
 *  than MIN_DISTANCE_PCT since the band only has the bottom ~40% of the cover to work with. */
export const LOWER_MIN_DISTANCE_PCT = 5;

const LOWER_PLACEMENT_ATTEMPTS = 60;

/** Skews y toward the bottom edge of the lower region (closer to 100) so the band reads denser
 *  toward the bottom — the mirror image of biasedYPct's top-heavy skew. */
function biasedLowerYPct(random: () => number): number {
  const span = 100 - LOWER_REGION_START_PCT;
  return LOWER_REGION_START_PCT + span * Math.pow(random(), 0.5);
}

function isInsideKeepOut(point: Position, rects: readonly KeepOutRect[]): boolean {
  return rects.some(
    (rect) =>
      point.xPct >= rect.xPct &&
      point.xPct <= rect.xPct + rect.widthPct &&
      point.yPct >= rect.yPct &&
      point.yPct <= rect.yPct + rect.heightPct,
  );
}

/** A handful of fixed, far-corner anchors that are never inside a realistic (partial-canvas)
 *  keep-out rect — the last-resort fallback if every sampled candidate below happened to land
 *  inside one. */
function fallbackOutsideKeepOut(rects: readonly KeepOutRect[]): Position {
  const anchors: Position[] = [
    { xPct: 2, yPct: LOWER_REGION_START_PCT },
    { xPct: 98, yPct: LOWER_REGION_START_PCT },
    { xPct: 2, yPct: 100 },
    { xPct: 98, yPct: 100 },
    { xPct: 50, yPct: 100 },
  ];
  return anchors.find((anchor) => !isInsideKeepOut(anchor, rects)) ?? anchors[anchors.length - 1];
}

/** Same rejection-sampling as placePosition, but confined to the lower band, its own (tighter)
 *  minimum spacing, and — unlike the whole-cover scatter — a hard constraint that a candidate
 *  landing inside a keep-out rect is never an acceptable placement, best-effort or not. */
function placeLowerPosition(
  random: () => number,
  placed: readonly Position[],
  keepOutRects: readonly KeepOutRect[],
): Position {
  let best: Position | null = null;
  let bestDistance = -Infinity;

  for (let attempt = 0; attempt < LOWER_PLACEMENT_ATTEMPTS; attempt++) {
    const candidate: Position = { xPct: random() * 100, yPct: biasedLowerYPct(random) };
    if (isInsideKeepOut(candidate, keepOutRects)) continue;

    const candidateDistance = placed.length === 0 ? Infinity : minDistanceTo(candidate, placed);
    if (best === null || candidateDistance > bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
    if (bestDistance >= LOWER_MIN_DISTANCE_PCT) break;
  }

  return best ?? fallbackOutsideKeepOut(keepOutRects);
}

/**
 * The lower-half glitter band (see components/CoverLowerGlitter.astro): tiny twinkling light
 * flecks (`glow`, 2-5px) growing denser toward the bottom edge, plus a handful of larger, static,
 * blurred golden `bokeh` discs. Nov 2026 user-feedback pass: "la mitad inferior se siente
 * desaprovechada" — the empty lower half (below the button) gets its own calm dynamism instead of
 * staying a flat, unused gradient.
 */
export function lowerGlitter(options: LowerGlitterOptions): Sparkle[] {
  const random = seededRandom(options.seed);
  const flakeCount = Math.max(0, Math.floor(options.flakeCount));
  const bokehCount = Math.max(0, Math.floor(options.bokehCount));
  const keepOutRects = options.keepOutRects ?? [];

  const placed: Position[] = [];
  const sparkles: Sparkle[] = [];

  for (let i = 0; i < flakeCount; i++) {
    const position = placeLowerPosition(random, placed, keepOutRects);
    placed.push(position);

    sparkles.push({
      kind: 'glow',
      xPct: position.xPct,
      yPct: position.yPct,
      sizePx: 2 + random() * 3,
      rotateDeg: 0,
      delayMs: random() * 4000,
      durationMs: 3600 + random() * 2800,
    });
  }

  for (let i = 0; i < bokehCount; i++) {
    const position = placeLowerPosition(random, placed, keepOutRects);
    placed.push(position);
    const [min, max] = SIZE_RANGES.bokeh;

    // Static — no delay/duration needed; CoverLowerGlitter.astro never animates bokeh discs (kept
    // out of the twinkling-element budget, see the e2e render-budget test).
    sparkles.push({
      kind: 'bokeh',
      xPct: position.xPct,
      yPct: position.yPct,
      sizePx: min + random() * (max - min),
      rotateDeg: 0,
      delayMs: 0,
      durationMs: 0,
    });
  }

  return sparkles;
}

export function scatterSparkles(options: ScatterSparklesOptions): Sparkle[] {
  const random = seededRandom(options.seed);
  const count = Math.min(MAX_SPARKLES, Math.max(0, Math.floor(options.count)));

  const placed: Position[] = [];
  const sparkles: Sparkle[] = [];

  for (let i = 0; i < count; i++) {
    const kind = KIND_PATTERN[i % KIND_PATTERN.length];
    const [min, max] = SIZE_RANGES[kind];
    const position = placePosition(random, placed);
    placed.push(position);

    sparkles.push({
      kind,
      xPct: position.xPct,
      yPct: position.yPct,
      sizePx: min + random() * (max - min),
      rotateDeg: random() * 360,
      delayMs: random() * 4000,
      durationMs: 3600 + random() * 2800,
    });
  }

  return sparkles;
}

/** Fixed width of every falling foil ribbon, in px — only its length varies. */
export const RIBBON_WIDTH_PX = 3;

export type ConfettiKind = 'ribbon';

export interface ConfettiPiece {
  kind: ConfettiKind;
  /** 6..94 — horizontal spawn position as a percentage of the cover width. */
  xPct: number;
  /** A ribbon's length, ≥ 3× RIBBON_WIDTH_PX. */
  lengthPx: number;
  /** 9000..15000ms — one slow fall from the garland's lower edge to the bottom of the cover. */
  durationMs: number;
  /** -durationMs..0 — negative, so the shower is already mid-fall when the page loads. */
  delayMs: number;
  /** -30..30px — horizontal drift over one fall. */
  driftPx: number;
  /** 180..540deg — total spin over one fall. */
  spinDeg: number;
  /** 30..90 — where the piece rests, as a percentage of the cover height, under reduced motion. */
  restYPct: number;
}

export interface FallingConfettiOptions {
  ribbons: number;
  seed: number;
}

/**
 * Gold foil ribbons falling gently from the garland (see components/CoverConfettiFall.astro,
 * which owns the DOM and the single shared keyframe), each with its own seeded spawn, timing,
 * drift and spin. The falling glitter speck kind moved into the garland-to-centre drift set (see
 * `driftingSparkles`), so this layer is ribbons-only.
 */
export function fallingConfetti(options: FallingConfettiOptions): ConfettiPiece[] {
  const random = seededRandom(options.seed);
  const ribbons = Math.max(0, Math.floor(options.ribbons));
  const pieces: ConfettiPiece[] = [];

  for (let i = 0; i < ribbons; i++) {
    const durationMs = 9000 + random() * 6000;
    pieces.push({
      kind: 'ribbon',
      xPct: 6 + random() * 88,
      lengthPx: RIBBON_WIDTH_PX * (3 + random() * 2),
      durationMs,
      delayMs: -random() * durationMs,
      driftPx: (random() - 0.5) * 60,
      spinDeg: 180 + random() * 360,
      restYPct: 30 + random() * 60,
    });
  }

  return pieces;
}

export type DriftKind = 'glitter' | 'star' | 'bokeh';

export interface DriftSparkle {
  kind: DriftKind;
  /** 0..100 — spawn position on the garland arc, as a percentage of the cover width. */
  xPct: number;
  /** 0..100 — spawn position on the garland arc, as a percentage of the cover height. */
  yPct: number;
  /** The horizontal share of the drift toward the text block's centre, in cover-percent units. */
  dxPct: number;
  /** The vertical share of the drift toward the text block's centre, in cover-percent units. */
  dyPct: number;
  sizePx: number;
  /** 0..1 — the opacity reached partway through the drift, before fading back out. */
  peakOpacity: number;
  /** 8000..13000ms — one slow drift from the garland toward the centre. */
  durationMs: number;
  /** -durationMs..0 — negative, so the drift is already mid-flight when the page loads. */
  delayMs: number;
}

export interface DriftingSparklesOptions {
  glitter: number;
  stars: number;
  bokeh: number;
  seed: number;
}

const DRIFT_SIZE_RANGES: Record<DriftKind, [number, number]> = {
  glitter: [3, 6],
  star: [14, 22],
  bokeh: [16, 30],
};

/** A fixed peak opacity per kind (not a range) — the star (4-point flare) reads brightest, glitter
 *  close behind, bokeh stays faint by design. */
const DRIFT_PEAK_OPACITY: Record<DriftKind, number> = {
  glitter: 0.9,
  star: 0.95,
  bokeh: 0.32,
};

/** The point the drift travels toward, in cover percent — the centre of the text block, lowered
 *  from 55 to 57 so pieces reach the name rather than dying above it. */
const DRIFT_TARGET = { xPct: 50, yPct: 57 };

/** Tracks the arch pocket's crown curve: high (29%) at the centre, rising toward the walls
 *  (up to 38%) — a constant in cover-percent space, not an import from the garland data, so the
 *  two lanes stay decoupled. */
function driftSpawnYPct(xPct: number): number {
  return 29 + 9 * Math.pow((xPct - 50) / 30, 2);
}

/**
 * A seeded set of particles that spawn along the garland's arc and drift toward the centre of the
 * text block, fading out as they go (see components/CoverConfettiFall.astro, which renders them
 * with the shared `cover-sparkle-drift` keyframe). Distinct from `fallingConfetti` (straight down)
 * and the twinkle-in-place layers (`scatterSparkles`, `lowerGlitter`).
 */
export function driftingSparkles(options: DriftingSparklesOptions): DriftSparkle[] {
  const random = seededRandom(options.seed);
  const counts: [DriftKind, number][] = [
    ['glitter', Math.max(0, Math.floor(options.glitter))],
    ['star', Math.max(0, Math.floor(options.stars))],
    ['bokeh', Math.max(0, Math.floor(options.bokeh))],
  ];

  const sparkles: DriftSparkle[] = [];

  for (const [kind, count] of counts) {
    for (let i = 0; i < count; i++) {
      const xPct = 20 + random() * 60;
      const yPct = driftSpawnYPct(xPct) + (random() - 0.5) * 3;

      const travel = 0.75 + random() * 0.25;
      const dxPct = (DRIFT_TARGET.xPct - xPct) * travel;
      const dyPct = (DRIFT_TARGET.yPct - yPct) * travel;

      const [min, max] = DRIFT_SIZE_RANGES[kind];
      const durationMs = 9000 + random() * 5000;

      sparkles.push({
        kind,
        xPct,
        yPct,
        dxPct,
        dyPct,
        sizePx: min + random() * (max - min),
        peakOpacity: DRIFT_PEAK_OPACITY[kind],
        durationMs,
        delayMs: -random() * durationMs,
      });
    }
  }

  return sparkles;
}
