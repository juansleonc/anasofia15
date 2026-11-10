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

/** Deterministic LCG — same shape as the one already used in cover-arch.ts, local to this module. */
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
