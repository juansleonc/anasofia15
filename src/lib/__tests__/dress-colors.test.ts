import { describe, it, expect } from 'vitest';
import { dressColors } from '../../data/dress-colors';

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
});
