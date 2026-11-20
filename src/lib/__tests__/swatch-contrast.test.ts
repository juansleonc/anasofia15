import { describe, it, expect } from 'vitest';
import { contrastRatio, needsOutline, MIN_SWATCH_CONTRAST } from '../swatch-contrast';

// Backgrounds here are arbitrary test fixtures, not the real page backgrounds — those live in
// `src/data/dress-colors.ts` and are exercised directly by `dress-colors.test.ts`.
const WHITE = '#ffffff';
const BLACK = '#000000';

describe('swatch-contrast', () => {
  it('computes WCAG contrast ratio symmetrically, maxing out at pure black vs white', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 0);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 0);
  });

  it('exposes the 3:1 threshold', () => {
    expect(MIN_SWATCH_CONTRAST).toBe(3);
  });

  it('flags the pale six dress colors as needing an outline on the real page backgrounds', () => {
    const backgrounds = ['#fbf7ff', '#ffffff'];
    const pale = {
      'Amarillo mantequilla': '#FBE89A',
      Lila: '#D7B4EA',
      'Azul cielo': '#7FA8DA',
      Menta: '#A3DCC3',
      Turquesa: '#56C9C9',
      Durazno: '#FFB38A',
    };
    for (const [name, hex] of Object.entries(pale)) {
      expect(needsOutline(hex, backgrounds), name).toBe(true);
    }
  });

  it('does not flag the dark four dress colors as needing an outline', () => {
    const backgrounds = ['#fbf7ff', '#ffffff'];
    const dark = {
      Vino: '#6E1423',
      'Azul marino': '#22356B',
      'Verde oliva': '#8C9550',
      Morado: '#5B2F7A',
    };
    for (const [name, hex] of Object.entries(dark)) {
      expect(needsOutline(hex, backgrounds), name).toBe(false);
    }
  });

  it('only checks the backgrounds it is given', () => {
    expect(needsOutline(WHITE, [WHITE])).toBe(true);
    expect(needsOutline(BLACK, [WHITE])).toBe(false);
  });
});
