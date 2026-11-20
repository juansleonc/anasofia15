/**
 * Accessible-boundary rule for dress-color swatches: a swatch must stay visually distinguishable
 * from the page's own background. When a swatch's exact fill doesn't clear WCAG's 3:1 contrast
 * minimum against a page background on its own, it needs a thin outline/ring to carry that
 * boundary instead. This module derives which swatches need one purely from hex values — callers
 * supply the actual page background colors (owned by `src/data/dress-colors.ts`, the one place
 * besides `tokens.css` allowed to hold a raw hex), so this rule can never drift from the data.
 */

const LOW_CHANNEL = 0.03928;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(normalized.slice(i, i + 2), 16));
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= LOW_CHANNEL ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [r, g, b].map(channel);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG 2.x contrast ratio between two hex colors (order-independent). */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Minimum WCAG contrast a swatch's visible boundary must clear against a page background. */
export const MIN_SWATCH_CONTRAST = 3;

/**
 * True when `hex`'s own fill falls below `MIN_SWATCH_CONTRAST` against any of `backgrounds` —
 * meaning the swatch needs a ringed outline (rendered in a color that itself clears the ratio)
 * to stay distinguishable, rather than relying on the fill alone.
 */
export function needsOutline(hex: string, backgrounds: readonly string[]): boolean {
  return backgrounds.some((background) => contrastRatio(hex, background) < MIN_SWATCH_CONTRAST);
}
