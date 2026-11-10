// Pure particle-init logic for the one-shot silver-paper confetti burst fired when the guest
// opens the invitation (see islands/ConfettiBurst.astro, which owns the canvas rendering).
// Framework-free and randomness-injected so the burst's shape — count cap, upward launch,
// bottom-center origin, silver-dominant palette — is unit-testable without a canvas.

export interface ConfettiPalette {
  /** Dominant metallic-paper colors (the theme's silver ramp). */
  silver: string[];
  /** Minority accent colors (the theme's gold ramp). */
  gold: string[];
}

export interface ConfettiPiece {
  x: number;
  y: number;
  /** px/s. Horizontal drift, roughly symmetric around the origin. */
  vx: number;
  /** px/s. Always negative at launch: the paper is thrown UP, gravity brings it down. */
  vy: number;
  width: number;
  height: number;
  /** radians */
  rotation: number;
  /** radians/s — tumble around the piece's own center. */
  rotationSpeed: number;
  /** radians — starting point of the per-piece flutter oscillation. */
  wobblePhase: number;
  /** radians/s — how fast the piece flutters side to side while falling. */
  wobbleSpeed: number;
  color: string;
}

/** Hard cap so a burst never overwhelms a phone's frame budget. */
export const MAX_PIECES = 160;

/** Fraction of pieces drawn from the gold ramp — a minority accent over dominant silver. */
export const GOLD_RATIO = 0.22;

export interface BurstOptions {
  count: number;
  originX: number;
  originY: number;
  palette: ConfettiPalette;
  random?: () => number;
}

function pick(colors: string[], random: () => number): string {
  return colors[Math.min(colors.length - 1, Math.floor(random() * colors.length))];
}

export function createBurstPieces(options: BurstOptions): ConfettiPiece[] {
  const { originX, originY, palette } = options;
  const random = options.random ?? Math.random;
  const count = Math.min(MAX_PIECES, Math.max(0, Math.floor(options.count)));

  return Array.from({ length: count }, () => {
    const gold = random() < GOLD_RATIO;
    return {
      x: originX + (random() - 0.5) * 120,
      y: originY + (random() - 0.5) * 24,
      vx: (random() - 0.5) * 880,
      // Strictly negative: even the weakest piece gets a real upward toss.
      vy: -(340 + random() * 460),
      width: 5 + random() * 6,
      height: 9 + random() * 11,
      rotation: random() * Math.PI * 2,
      // Offset away from zero so every piece visibly tumbles (no frozen-flat paper).
      rotationSpeed: (random() < 0.5 ? -1 : 1) * (2 + random() * 8),
      wobblePhase: random() * Math.PI * 2,
      wobbleSpeed: 3 + random() * 6,
      color: gold ? pick(palette.gold, random) : pick(palette.silver, random),
    };
  });
}
