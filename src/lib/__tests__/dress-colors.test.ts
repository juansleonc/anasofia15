import { describe, it, expect } from 'vitest';
import { dressColors, reservedColors, reservedColorsNote } from '../../data/dress-colors';

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
