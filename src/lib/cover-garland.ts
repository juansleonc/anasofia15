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
  | 'rosebud'
  | 'blossom'
  | 'leaf-eucalyptus'
  | 'leaf-olive'
  | 'leaf-gold'
  | 'leaf-laurel-cluster'
  | 'leaf-eucalyptus-cluster';

export type GarlandKind = 'balloon' | 'flower' | 'leaf';

/** 0 back foliage · 1 back balloons · 2 main balloons · 3 flowers · 4 front accents (balloons and rosebuds). */
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
  /**
   * The text zone, kept free of every item. Below `top` it is the rectangle x in [x0, x1]; above
   * `top` it narrows to the arch pocket, whose floor rises from `top` at the walls to `crown` at
   * the centre (crown < top), so the crown of the garland can dip down toward the text at the
   * sides while staying high above it in the middle.
   */
  clear: { x0: number; x1: number; top: number; crown: number };
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
    clear: { x0: 38, x1: 362, top: 264, crown: 208 },
    items: [
      // laurel/eucalyptus clusters rooted inside the corner balloons (behind them, depth 0),
      // cascading outward and down. Positions are chosen (not just mirrored) around where the
      // existing balloon/flower mass actually leaves a gap, since a cluster is only on-screen
      // where nothing painted later covers it — see the visible-foliage measurement in
      // cover-garland.test.ts.
      { symbol: 'leaf-laurel-cluster', x: 24, y: 72, size: 120, rotate: -40, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 76, y: 136, size: 80, rotate: -110, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 84, y: 196, size: 56, rotate: -130, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: -40, y: 52, size: 64, rotate: -55, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 340, y: 24, size: 110, rotate: 60, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 316, y: 196, size: 56, rotate: 130, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 344, y: 128, size: 120, rotate: 50, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 316, y: 132, size: 56, rotate: 100, depth: 0 },
      { symbol: 'balloon-pink', x: 70, y: 28, size: 120, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 178, y: 6, size: 112, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 292, y: 22, size: 126, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 386, y: 50, size: 112, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold-satin', x: 4, y: 90, size: 100, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 42, y: 150, size: 128, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 152, y: 116, size: 132, rotate: -4, depth: 2 },
      { symbol: 'balloon-rosegold', x: 258, y: 128, size: 118, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 356, y: 162, size: 128, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold-satin', x: 103, y: 179, size: 80, rotate: 0, depth: 2 },
      // crown's centre row lifted & split into smaller balloons nested higher, so the pocket above
      // the text stays clear instead of the old flat band
      { symbol: 'balloon-champagne', x: 170, y: 160, size: 54, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 230, y: 154, size: 50, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 200, y: 182, size: 40, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne', x: 156, y: 182, size: 52, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 244, y: 182, size: 52, rotate: 0, depth: 2 },
      // additional shoulder balloons so the lower envelope keeps hugging the arc out to the walls
      // and corners, instead of leaving a gap between the crown's lift and the shoulder
      { symbol: 'balloon-rosegold', x: 54, y: 210, size: 60, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne', x: 346, y: 210, size: 60, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 297, y: 179, size: 80, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: -2, y: 218, size: 88, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 402, y: 218, size: 88, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 4, y: 284, size: 60, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 396, y: 284, size: 60, rotate: 0, depth: 2 },
      // two main roses lead; the once-oversized peony shrinks into the peony band and a second
      // (ivory) peony joins it, with small rosebuds filling the seams and both corner zones
      { symbol: 'peony-blush', x: 100, y: 92, size: 70, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 212, y: 86, size: 90, rotate: 8, depth: 3 },
      { symbol: 'rose-cream', x: 318, y: 98, size: 96, rotate: 0, depth: 3 },
      { symbol: 'peony-ivory', x: 260, y: 110, size: 60, rotate: 0, depth: 3 },
      { symbol: 'rosebud', x: 52, y: 204, size: 36, rotate: -10, depth: 3 },
      { symbol: 'rose-cream', x: 378, y: 214, size: 70, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 22, y: 214, size: 70, rotate: 0, depth: 3 },
      { symbol: 'rosebud', x: 390, y: 258, size: 32, rotate: 0, depth: 3 },
      { symbol: 'rosebud', x: 50, y: 216, size: 24, rotate: -40, depth: 3 },
      { symbol: 'rosebud', x: 350, y: 216, size: 24, rotate: 40, depth: 3 },
      // front accents re-seated to press against the enlarged roses, veiling part of each bloom;
      // each main rose's veiling balloon sits just past its heart so it never covers the centre,
      // and two of the corner rosebuds move to the front, pressed against a back balloon
      { symbol: 'balloon-rosegold-satin', x: 124, y: 112, size: 50, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 198, y: 117, size: 54, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 344, y: 117, size: 50, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 258, y: 186, size: 52, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 60, y: 216, size: 46, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 340, y: 216, size: 46, rotate: 0, depth: 4 },
      { symbol: 'rosebud', x: 90, y: 170, size: 28, rotate: -20, depth: 4 },
      { symbol: 'rosebud', x: 310, y: 170, size: 29, rotate: 20, depth: 4 },
    ],
  },
  landscape: {
    width: 1440,
    height: 640,
    fadeStart: 560,
    clear: { x0: 360, x1: 1080, top: 324, crown: 230 },
    items: [
      // laurel/eucalyptus clusters rooted inside the corner balloons (behind them, depth 0),
      // cascading outward and down, placed on-canvas (unlike the old off-canvas corner sprigs) so
      // they actually paint inside the viewBox
      { symbol: 'leaf-laurel-cluster', x: 68, y: 96, size: 260, rotate: -60, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 212, y: 60, size: 260, rotate: -60, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 188, y: 348, size: 260, rotate: -130, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 56, y: 480, size: 260, rotate: -140, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 68, y: 264, size: 260, rotate: -140, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 1372, y: 96, size: 260, rotate: 60, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 1228, y: 60, size: 260, rotate: 60, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 1252, y: 348, size: 260, rotate: 130, depth: 0 },
      { symbol: 'leaf-eucalyptus-cluster', x: 1384, y: 480, size: 260, rotate: 140, depth: 0 },
      { symbol: 'leaf-laurel-cluster', x: 1372, y: 264, size: 260, rotate: 140, depth: 0 },
      { symbol: 'balloon-pink', x: 402.6, y: 12, size: 187, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 596.6, y: 0, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1025.1, y: 48, size: 220, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 757.4, y: 60, size: 236.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 166, y: 128, size: 198, rotate: 0, depth: 1 },
      { symbol: 'balloon-champagne', x: 1260.6, y: 100, size: 181.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 18.7, y: 292, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold', x: 1400.6, y: 284, size: 165, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold', x: 412.9, y: 246, size: 66, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1040.6, y: 260, size: 60.5, rotate: 0, depth: 1 },
      { symbol: 'balloon-rosegold-satin', x: 41.5, y: 96, size: 132, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 1431.8, y: 112, size: 143, rotate: 0, depth: 1 },
      { symbol: 'balloon-pink', x: 361.1, y: 153.6, size: 247.5, rotate: -4, depth: 2 },
      // centre-bottom balloons lifted & split into smaller ones nested higher, so the pocket above
      // the text stays clear instead of the old flat band
      { symbol: 'balloon-champagne', x: 500, y: 190, size: 120, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 600, y: 180, size: 108, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 560, y: 195, size: 90, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 790, y: 174, size: 120, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne', x: 860, y: 192, size: 96, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 712, y: 188, size: 86, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 1162, y: 188, size: 214.5, rotate: 0, depth: 2 },
      { symbol: 'balloon-rosegold', x: 256.3, y: 289.6, size: 181.5, rotate: 0, depth: 2 },
      { symbol: 'balloon-champagne-satin', x: 116.2, y: 404, size: 187, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 1258.5, y: 404, size: 187, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 1156.8, y: 308, size: 154, rotate: 0, depth: 2 },
      { symbol: 'balloon-pink', x: 36.3, y: 462.4, size: 132, rotate: 0, depth: 2 },
      // two main roses lead; both peonies shrink into the peony band, the secondary roses and
      // blossoms shrink to stay under the main roses, and small rosebuds fill both corner zones
      { symbol: 'peony-blush', x: 508.4, y: 98, size: 130, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 617.3, y: 100, size: 182, rotate: 10, depth: 3 },
      { symbol: 'rose-cream', x: 897.4, y: 120, size: 220, rotate: 0, depth: 3 },
      { symbol: 'peony-blush', x: 1021.9, y: 156, size: 115, rotate: 15, depth: 3 },
      { symbol: 'blossom', x: 155.6, y: 256, size: 135, rotate: -10, depth: 3 },
      { symbol: 'blossom', x: 1281.3, y: 264, size: 135, rotate: 20, depth: 3 },
      { symbol: 'rose-cream', x: 1385.1, y: 360, size: 135, rotate: 0, depth: 3 },
      { symbol: 'rose-pink', x: 311.3, y: 75, size: 135, rotate: 0, depth: 3 },
      { symbol: 'rosebud', x: 70, y: 350, size: 50, rotate: -140, depth: 3 },
      { symbol: 'rosebud', x: 1340, y: 135, size: 50, rotate: 140, depth: 3 },
      { symbol: 'balloon-rosegold-satin', x: 223.1, y: 209.6, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 658.8, y: 172, size: 121, rotate: 0, depth: 4 },
      // re-seated closer to the walls so the lower envelope keeps dropping toward them (R5-2);
      // moved a touch further from the second peony's heart so it veils rather than covers it
      { symbol: 'balloon-champagne', x: 957, y: 194, size: 120, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 1208.7, y: 324, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne-satin', x: 1348.8, y: 432, size: 104.5, rotate: 0, depth: 4 },
      { symbol: 'balloon-champagne', x: 150.4, y: 486.4, size: 68.2, rotate: 0, depth: 4 },
      { symbol: 'balloon-rosegold-satin', x: 1302.1, y: 172, size: 115.5, rotate: 0, depth: 4 },
      // two corner rosebuds move to the front, pressed against a back balloon
      { symbol: 'rosebud', x: 100, y: 110, size: 55, rotate: -20, depth: 4 },
      { symbol: 'rosebud', x: 1300, y: 120, size: 55, rotate: 20, depth: 4 },
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
