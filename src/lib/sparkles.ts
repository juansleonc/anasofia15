// Pure, seeded scatter for the idle decorative sparkles on the cover (see
// components/CoverSparkles.astro, which owns the DOM/CSS rendering). The scatter covers the
// whole cover — including the band behind the title/button, not just the arch — so the cover
// reads as lightly dusted with sparkle rather than framed by it. Framework-free and seeded so the
// layout is unit-testable without a DOM.

export type SparkleKind = 'fleck' | 'star' | 'bokeh';

export interface Sparkle {
  kind: SparkleKind;
  /** 0..100 — horizontal position as a percentage of the cover width. */
  xPct: number;
  /** 0..100 — vertical position as a percentage of the cover height. */
  yPct: number;
  sizePx: number;
  /** 0..360deg — starting rotation. */
  rotateDeg: number;
  /** 0..4000ms — staggers each sparkle's twinkle start. */
  delayMs: number;
  /** 2400..4800ms — one twinkle cycle. */
  durationMs: number;
}

/** Hard cap so the idle scatter never overwhelms a phone's frame budget. */
export const MAX_SPARKLES = 48;

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

/** Round-robin pattern giving an exact 3:2:1 fleck:star:bokeh ratio every 6 sparkles. */
const KIND_PATTERN: readonly SparkleKind[] = ['fleck', 'fleck', 'fleck', 'star', 'star', 'bokeh'];

const SIZE_RANGES: Record<SparkleKind, [number, number]> = {
  fleck: [4, 9],
  star: [8, 16],
  bokeh: [24, 60],
};

export function scatterSparkles(options: ScatterSparklesOptions): Sparkle[] {
  const random = seededRandom(options.seed);
  const count = Math.min(MAX_SPARKLES, Math.max(0, Math.floor(options.count)));

  return Array.from({ length: count }, (_, i) => {
    const kind = KIND_PATTERN[i % KIND_PATTERN.length];
    const [min, max] = SIZE_RANGES[kind];

    return {
      kind,
      xPct: random() * 100,
      yPct: random() * 100,
      sizePx: min + random() * (max - min),
      rotateDeg: random() * 360,
      delayMs: random() * 4000,
      durationMs: 2400 + random() * 2400,
    };
  });
}
