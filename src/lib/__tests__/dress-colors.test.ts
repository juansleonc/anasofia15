import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dressColors, PAGE_BACKGROUNDS, reservedColors, reservedColorsNote } from '../../data/dress-colors';
import { contrastRatio, needsOutline } from '../swatch-contrast';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const TOKENS_PATH = join(TEST_DIR, '..', '..', 'styles', 'tokens.css');

// Reads a single `--token: #hex;` declaration straight out of tokens.css, the same way
// palette.test.ts does, so this test can't silently drift from the actual token value.
function readTokenHex(name: string): string {
  const tokensCss = readFileSync(TOKENS_PATH, 'utf8');
  const match = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  expect(match).not.toBeNull();
  return match![1];
}

// The ring token the color-wheel component uses to outline a pale swatch (proved to render it in
// e2e/color-wheel.spec.ts).
function ringColorToken(): string {
  return readTokenHex('--c-ink');
}

describe('dressColors', () => {
  it('has exactly ten colors', () => {
    expect(dressColors).toHaveLength(10);
  });

  it('lists the colors in order with their exact names and hexes', () => {
    expect(dressColors).toEqual([
      { name: 'Vino', hex: '#6E1423' },
      { name: 'Amarillo mantequilla', hex: '#FBE89A' },
      { name: 'Lila', hex: '#D7B4EA' },
      { name: 'Azul cielo', hex: '#7FA8DA' },
      { name: 'Azul marino', hex: '#22356B' },
      { name: 'Menta', hex: '#A3DCC3' },
      { name: 'Turquesa', hex: '#56C9C9' },
      { name: 'Verde oliva', hex: '#8C9550' },
      { name: 'Morado', hex: '#5B2F7A' },
      { name: 'Durazno', hex: '#FFB38A' },
    ]);
  });

  it('never reuses a hex across the colors', () => {
    const hexes = dressColors.map((color) => color.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('gives no color a note', () => {
    for (const color of dressColors) {
      expect(color).not.toHaveProperty('note');
    }
  });

  it('declares the real page backgrounds swatches are rendered against, read live from tokens.css', () => {
    expect(PAGE_BACKGROUNDS).toEqual([
      readTokenHex('--c-bg').toLowerCase(),
      readTokenHex('--c-white').toLowerCase(),
    ]);
  });

  it('keeps every swatch distinguishable: its fill clears 3:1 on both page backgrounds, or it is ringed with an outline color that does', () => {
    const ring = ringColorToken();

    for (const { name, hex } of dressColors) {
      const fillOk = PAGE_BACKGROUNDS.every(
        (background) => contrastRatio(hex, background) >= 3,
      );

      if (fillOk) {
        expect(needsOutline(hex, PAGE_BACKGROUNDS), `${name} should not need an outline`).toBe(
          false,
        );
        continue;
      }

      expect(needsOutline(hex, PAGE_BACKGROUNDS), `${name} should need an outline`).toBe(true);
      for (const background of PAGE_BACKGROUNDS) {
        expect(
          contrastRatio(ring, background),
          `ring color ${ring} on ${background}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('needs an outline for exactly the pale six, not the dark four', () => {
    const paleNames = dressColors
      .filter((color) => needsOutline(color.hex, PAGE_BACKGROUNDS))
      .map((color) => color.name);

    expect(paleNames).toEqual([
      'Amarillo mantequilla',
      'Lila',
      'Azul cielo',
      'Menta',
      'Turquesa',
      'Durazno',
    ]);
  });
});

describe('reservedColors', () => {
  it('words the note exactly', () => {
    expect(reservedColorsNote).toBe(
      'Para tu vestido, evita los colores blanco, marfil, champagne, dorado rosado y negro: están reservados para la quinceañera.',
    );
  });

  it('mentions every reserved color in the note', () => {
    for (const reserved of reservedColors) {
      expect(reservedColorsNote).toContain(reserved);
    }
  });

  it('never names a wheel color after a reserved one', () => {
    for (const { name } of dressColors) {
      for (const reserved of reservedColors) {
        expect(name.toLowerCase()).not.toContain(reserved);
      }
    }
  });
});
