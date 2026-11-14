import { describe, it, expect } from 'vitest';
import { dressColors, reservedColors } from '../../data/dress-colors';
import { reservedColorsNote } from '../../data/dress-colors-note';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('dressColors', () => {
  it('has exactly twelve colors', () => {
    expect(dressColors).toHaveLength(12);
  });

  it('lists the jewel tones in order with their exact names and hexes', () => {
    expect(dressColors).toEqual([
      { name: 'Vino tinto', hex: '#700119' },
      { name: 'Rojo carmesí', hex: '#B1021E' },
      { name: 'Ciruela', hex: '#5E1566' },
      { name: 'Berenjena', hex: '#38015F' },
      { name: 'Azul rey', hex: '#021B83' },
      { name: 'Azul zafiro', hex: '#183E85' },
      { name: 'Azul marino', hex: '#042155' },
      { name: 'Azul petróleo', hex: '#02647F' },
      { name: 'Verde azulado', hex: '#038D88' },
      { name: 'Verde esmeralda', hex: '#016648' },
      { name: 'Verde botella', hex: '#013A1C' },
      { name: 'Terracota', hex: '#812A0B' },
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

  it('keeps every hex dark enough to read as a jewel tone', () => {
    for (const { hex } of dressColors) {
      expect(luminance(hex)).toBeGreaterThanOrEqual(0.01);
      expect(luminance(hex)).toBeLessThanOrEqual(0.4);
    }
  });

  it('keeps every hex at 3:1 contrast or better on both page backgrounds', () => {
    for (const { name, hex } of dressColors) {
      for (const background of ['#fff7f5', '#ffffff']) {
        expect(contrast(hex, background), `${name} on ${background}`).toBeGreaterThanOrEqual(3);
      }
    }
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
