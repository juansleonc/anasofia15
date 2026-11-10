// The cover's decorative garland: two hand-composed layouts (portrait and landscape), rendered by
// components/BalloonArch.astro. Nothing here is random; each list is authored in paint order,
// back to front, so `depth` never decreases along it. Coordinates are viewBox units: `x`/`y` is
// an item's center, `size` its square box side, `rotate` a clockwise turn about the center (0 = a
// sprig pointing up with its stem base at the bottom center).

export type ArchSymbol =
  | 'balloon-pink'
  | 'balloon-rosegold'
  | 'balloon-rosegold-satin'
  | 'balloon-champagne'
  | 'balloon-champagne-satin'
  | 'rose-pink'
  | 'rose-cream'
  | 'peony-blush'
  | 'peony-ivory'
  | 'blossom'
  | 'leaf-eucalyptus'
  | 'leaf-olive'
  | 'leaf-gold';

export type GarlandKind = 'balloon' | 'flower' | 'leaf';

/** 0 back foliage · 1 back balloons · 2 main balloons · 3 flowers · 4 front accents. */
export type GarlandDepth = 0 | 1 | 2 | 3 | 4;

export interface GarlandItem {
  symbol: ArchSymbol;
  x: number;
  y: number;
  size: number;
  rotate: number;
  depth: GarlandDepth;
}

export interface GarlandLayout {
  width: number;
  height: number;
  /** viewBox y where the layout's soft fade-out starts; it is fully transparent at `height`. */
  fadeStart: number;
  /** The text zone, kept free of every item: x in [x0, x1] and y >= top. */
  clear: { x0: number; x1: number; top: number };
  items: readonly GarlandItem[];
}

export function kindOf(symbol: ArchSymbol): GarlandKind {
  if (symbol.startsWith('balloon-')) return 'balloon';
  if (symbol.startsWith('leaf-')) return 'leaf';
  return 'flower';
}

export const GARLAND: { portrait: GarlandLayout; landscape: GarlandLayout } = {
  portrait: {
    width: 400,
    height: 400,
    fadeStart: 340,
    clear: { x0: 48, x1: 352, top: 264 },
    items: [
      { symbol: 'leaf-gold', x: 100, y: 40, size: 70, rotate: -30, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 18, y: 120, size: 90, rotate: -60, depth: 0 },
      { symbol: 'leaf-olive', x: 22, y: 175, size: 80, rotate: -110, depth: 0 },
      { symbol: 'leaf-gold', x: 290, y: 10, size: 70, rotate: 25, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 384, y: 120, size: 90, rotate: 60, depth: 0 },
      { symbol: 'leaf-olive', x: 380, y: 180, size: 80, rotate: 110, depth: 0 },
      { symbol: 'leaf-olive', x: 145, y: 228, size: 60, rotate: 170, depth: 0 },
      { symbol: 'leaf-gold', x: 262, y: 230, size: 58, rotate: 190, depth: 0 },
      { symbol: 'leaf-olive', x: 12, y: 345, size: 120, rotate: 185, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 8, y: 320, size: 100, rotate: 200, depth: 0 },
      { symbol: 'leaf-gold', x: 16, y: 300, size: 80, rotate: 160, depth: 0 },
      { symbol: 'leaf-olive', x: 386, y: 345, size: 120, rotate: 175, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 394, y: 320, size: 100, rotate: 160, depth: 0 },
      { symbol: 'leaf-gold', x: 384, y: 300, size: 80, rotate: 200, depth: 0 },
      { symbol: 'leaf-gold', x: 160.7, y: 56.3, size: 70, rotate: -60, depth: 0 },
      { symbol: 'leaf-olive', x: 183.3, y: 64.3, size: 70, rotate: 60, depth: 0 },
      { symbol: 'leaf-olive', x: 239.8, y: 53.6, size: 70, rotate: -15, depth: 0 },
      { symbol: 'balloon-pink', x: 70, y: 28, size: 120, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 178, y: 6, size: 112, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 292, y: 22, size: 126, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 386, y: 50, size: 112, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold-satin', x: 4, y: 90, size: 100, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 42, y: 150, size: 128, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 152, y: 116, size: 132, rotate: -4, depth: 2 },
      { symbol: 'balloon-rosegold', x: 258, y: 128, size: 118, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 356, y: 162, size: 128, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold-satin', x: 112, y: 202, size: 88, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne', x: 208, y: 210, size: 76, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 298, y: 200, size: 88, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 4, y: 240, size: 96, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 396, y: 242, size: 96, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 16, y: 300, size: 64, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 386, y: 300, size: 64, rotate: 0, depth: 2 },
      { symbol: 'peony-blush', x: 100, y: 92, size: 74, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 212, y: 86, size: 66, rotate: 8, depth: 3 },
      { symbol: 'rose-cream', x: 318, y: 98, size: 74, rotate: 0, depth: 3 },
      { symbol: 'blossom', x: 52, y: 222, size: 58, rotate: -10, depth: 3 },
      { symbol: 'rose-cream', x: 352, y: 232, size: 58, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 24, y: 278, size: 44, rotate: 0, depth: 3 },
      { symbol: 'blossom', x: 380, y: 282, size: 44, rotate: 0, depth: 3 },
      { symbol: 'balloon-rosegold-satin', x: 196, y: 160, size: 58, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 258, y: 186, size: 52, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 80, y: 238, size: 46, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 324, y: 238, size: 46, rotate: 0, depth: 4 },
      { symbol: 'leaf-olive', x: 230, y: 230, size: 48, rotate: 200, depth: 4 },
    ],
  },
  landscape: {
    width: 1440,
    height: 640,
    fadeStart: 560,
    clear: { x0: 360, x1: 1080, top: 324 },
    items: [
      { symbol: 'leaf-gold', x: 254.2, y: 56, size: 132, rotate: -15, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 41.5, y: 188, size: 149.6, rotate: -65, depth: 0 },
      { symbol: 'leaf-olive', x: 57.1, y: 240, size: 132, rotate: -100, depth: 0 },
      { symbol: 'leaf-olive', x: 435.8, y: 32, size: 96.8, rotate: 30, depth: 0 },
      { symbol: 'leaf-gold', x: 1167.2, y: 56, size: 123.2, rotate: 25, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 1421.4, y: 208, size: 140.8, rotate: 65, depth: 0 },
      { symbol: 'leaf-olive', x: 1416.2, y: 256, size: 132, rotate: 100, depth: 0 },
      { symbol: 'leaf-olive', x: 352.8, y: 262.4, size: 105.6, rotate: 165, depth: 0 },
      { symbol: 'leaf-gold', x: 669.2, y: 244, size: 105.6, rotate: 175, depth: 0 },
      { symbol: 'leaf-olive', x: 928.6, y: 256, size: 123.2, rotate: 185, depth: 0 },
      { symbol: 'leaf-gold', x: 1141.3, y: 392, size: 132, rotate: 210, depth: 0 },
      { symbol: 'leaf-gold', x: 197.1, y: 448, size: 149.6, rotate: 160, depth: 0 },
      { symbol: 'leaf-olive', x: 72.6, y: 528, size: 211.2, rotate: 185, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 31.1, y: 520, size: 176, rotate: 200, depth: 0 },
      { symbol: 'leaf-olive', x: 1369.5, y: 520, size: 211.2, rotate: 172, depth: 0 },
      { symbol: 'leaf-gold', x: 1338.4, y: 520, size: 158.4, rotate: 160, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 1400.6, y: 480, size: 176, rotate: 190, depth: 0 },
      { symbol: 'leaf-olive', x: 534.3, y: 148, size: 79.2, rotate: 170, depth: 0 },
      { symbol: 'leaf-olive', x: 1073.8, y: 96, size: 88, rotate: 60, depth: 0 },
      { symbol: 'leaf-olive', x: 798.9, y: 140, size: 79.2, rotate: -60, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 197.1, y: 32, size: 114.4, rotate: -35, depth: 0 },
      { symbol: 'leaf-eucalyptus', x: 1338.4, y: 48, size: 105.6, rotate: 40, depth: 0 },
      { symbol: 'leaf-gold', x: 309.3, y: 40.7, size: 130, rotate: -60, depth: 0 },
      { symbol: 'leaf-olive', x: 862.9, y: 35.2, size: 110, rotate: 60, depth: 0 },
      { symbol: 'leaf-gold', x: 907.1, y: 35.2, size: 110, rotate: -60, depth: 0 },
      { symbol: 'leaf-olive', x: 1110.7, y: 100.8, size: 130, rotate: 60, depth: 0 },
      { symbol: 'balloon-pink', x: 402.6, y: 12, size: 187, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 596.6, y: 0, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1025.1, y: 48, size: 220, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 757.4, y: 60, size: 236.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 166, y: 128, size: 198, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 1260.6, y: 100, size: 181.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 18.7, y: 292, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold', x: 1400.6, y: 284, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold', x: 412.9, y: 264, size: 66, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1040.6, y: 260, size: 60.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold-satin', x: 41.5, y: 96, size: 132, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1431.8, y: 112, size: 143, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 361.1, y: 153.6, size: 247.5, rotate: -4, depth: 2 },
      { symbol: 'balloon-champagne', x: 529.1, y: 228, size: 209, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 790.6, y: 206.4, size: 192.5, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 1162, y: 188, size: 214.5, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 256.3, y: 289.6, size: 181.5, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 116.2, y: 404, size: 187, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 1258.5, y: 404, size: 187, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 1156.8, y: 308, size: 154, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 36.3, y: 462.4, size: 132, rotate: 0, depth: 2 },
      { symbol: 'peony-blush', x: 508.4, y: 84, size: 156, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 617.3, y: 96, size: 150, rotate: 10, depth: 3 },
      { symbol: 'rose-cream', x: 897.4, y: 128, size: 186, rotate: 0, depth: 3 },
      { symbol: 'peony-blush', x: 1021.9, y: 156, size: 114, rotate: 15, depth: 3 },
      { symbol: 'blossom', x: 155.6, y: 256, size: 144, rotate: -10, depth: 3 },
      { symbol: 'blossom', x: 1281.3, y: 264, size: 144, rotate: 20, depth: 3 },
      { symbol: 'rose-cream', x: 1385.1, y: 360, size: 126, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 311.3, y: 56, size: 96, rotate: 0, depth: 3 },
      { symbol: 'balloon-rosegold-satin', x: 223.1, y: 209.6, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 658.8, y: 172, size: 121, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 980.4, y: 216, size: 115.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 1208.7, y: 324, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne-satin', x: 1348.8, y: 432, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 150.4, y: 486.4, size: 68.2, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 1302.1, y: 172, size: 115.5, rotate: 0, depth: 4 },
      { symbol: 'leaf-olive', x: 487.6, y: 144, size: 70.4, rotate: 200, depth: 4 },
      { symbol: 'leaf-eucalyptus', x: 1343.6, y: 316, size: 79.2, rotate: 120, depth: 4 },
    ],
  },
};

/** Inline-style custom properties tying the cover's text block to each layout's clear zone. */
export function garlandCoverVars(): string {
  const band = (layout: GarlandLayout) => layout.clear.top / layout.width;
  const clearWidth = (layout: GarlandLayout) => (layout.clear.x1 - layout.clear.x0) / layout.width;
  return (
    `--arch-band-portrait:${band(GARLAND.portrait)};` +
    `--arch-band-landscape:${band(GARLAND.landscape)};` +
    `--arch-clear-portrait:${clearWidth(GARLAND.portrait)};` +
    `--arch-clear-landscape:${clearWidth(GARLAND.landscape)};`
  );
}

/** CSS mask value: opaque down to `fadeStart`, then fading to fully transparent at the bottom. */
export function garlandFadeMask(layout: GarlandLayout): string {
  const stopPercent = (layout.fadeStart / layout.height) * 100;
  return `linear-gradient(to bottom, var(--c-white) ${stopPercent}%, transparent 100%)`;
}
