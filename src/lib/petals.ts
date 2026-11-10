// Pure particle-init logic for the falling-petals shower fired when the guest opens the
// invitation (see islands/PetalFall.astro, which owns the DOM/CSS rendering). Framework-free and
// randomness-injected so the shower's shape — count cap, full-width spread, slow drift, palette —
// is unit-testable without a DOM.

export interface Petal {
  /** 0..100 — horizontal start position as a percentage of the container width. */
  xPct: number;
  /** 0..1500ms — staggers each petal's fall start. */
  delayMs: number;
  /** 5000..8000ms — a slow, readable fall. */
  durationMs: number;
  /** 10..20px */
  sizePx: number;
  /** 20..60px — side-to-side sway amplitude while falling. */
  swayPx: number;
  /** 0..360deg — starting rotation. */
  rotateDeg: number;
  color: string;
}

/** Hard cap so a shower never overwhelms a phone's frame budget. */
export const MAX_PETALS = 40;

export interface PetalOptions {
  count: number;
  palette: string[];
  random?: () => number;
}

function pick(colors: string[], random: () => number): string {
  return colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))];
}

export function createPetals(options: PetalOptions): Petal[] {
  const { palette } = options;
  const random = options.random ?? Math.random;
  const count = Math.min(MAX_PETALS, Math.max(0, Math.floor(options.count)));

  return Array.from({ length: count }, () => ({
    xPct: random() * 100,
    delayMs: random() * 1500,
    durationMs: 5000 + random() * 3000,
    sizePx: 10 + random() * 10,
    swayPx: 20 + random() * 40,
    rotateDeg: random() * 360,
    color: pick(palette, random),
  }));
}

export function showerDurationMs(petals: Petal[]): number {
  return petals.reduce((max, petal) => Math.max(max, petal.delayMs + petal.durationMs), 0);
}
