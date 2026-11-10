// Pure particle-init logic for the falling shower fired when the guest opens the invitation (see
// islands/PetalFall.astro, which owns the DOM/CSS rendering). Framework-free and
// randomness-injected so the shower's shape — count cap, full-width spread, drift, palette — is
// unit-testable without a DOM. Two kinds share the same particle shape and generator: rose
// `createPetals` and gold-confetti `createFlecks`.

export interface Particle {
  /** 0..100 — horizontal start position as a percentage of the container width. */
  xPct: number;
  /** staggers each particle's fall start (range depends on kind). */
  delayMs: number;
  /** a readable fall (range depends on kind). */
  durationMs: number;
  /** particle size in px (range depends on kind). */
  sizePx: number;
  /** side-to-side sway amplitude while falling (range depends on kind). */
  swayPx: number;
  /** 0..360deg — starting rotation. */
  rotateDeg: number;
  color: string;
}

/** Hard cap so a shower never overwhelms a phone's frame budget. */
export const MAX_PETALS = 40;
/** Hard cap on gold flecks so the open shower never overwhelms a phone's frame budget. */
export const MAX_FLECKS = 30;

export interface PetalOptions {
  count: number;
  palette: string[];
  random?: () => number;
}

interface ParticleRanges {
  cap: number;
  delayMs: [number, number];
  durationMs: [number, number];
  sizePx: [number, number];
  swayPx: [number, number];
}

const PETAL_RANGES: ParticleRanges = {
  cap: MAX_PETALS,
  delayMs: [0, 1500],
  durationMs: [5000, 8000],
  sizePx: [10, 20],
  swayPx: [20, 60],
};

/** Gold-confetti ranges for the open shower's flecks — quicker and smaller than a petal. */
export const FLECK_RANGES: ParticleRanges = {
  cap: MAX_FLECKS,
  delayMs: [0, 1200],
  durationMs: [3500, 6000],
  sizePx: [4, 9],
  swayPx: [10, 40],
};

function pick(colors: string[], random: () => number): string {
  return colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))];
}

function between([min, max]: [number, number], random: () => number): number {
  return min + random() * (max - min);
}

function createParticles(ranges: ParticleRanges, options: PetalOptions): Particle[] {
  const { palette } = options;
  const random = options.random ?? Math.random;
  const count = Math.min(ranges.cap, Math.max(0, Math.floor(options.count)));

  return Array.from({ length: count }, () => ({
    xPct: random() * 100,
    delayMs: between(ranges.delayMs, random),
    durationMs: between(ranges.durationMs, random),
    sizePx: between(ranges.sizePx, random),
    swayPx: between(ranges.swayPx, random),
    rotateDeg: random() * 360,
    color: pick(palette, random),
  }));
}

export function createPetals(options: PetalOptions): Particle[] {
  return createParticles(PETAL_RANGES, options);
}

export function createFlecks(options: PetalOptions): Particle[] {
  return createParticles(FLECK_RANGES, options);
}

export function showerDurationMs(particles: Particle[]): number {
  return particles.reduce((max, particle) => Math.max(max, particle.delayMs + particle.durationMs), 0);
}
