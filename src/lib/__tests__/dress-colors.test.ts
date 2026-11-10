import { describe, it, expect } from 'vitest';
import { dressColors } from '../../data/dress-colors';

describe('dressColors', () => {
  it('has exactly six colors', () => {
    expect(dressColors).toHaveLength(6);
  });

  it('lists the colors in the required order with their exact names, hexes and notes', () => {
    expect(dressColors).toEqual([
      { name: 'Verde salvia', hex: '#C7D9C4', note: 'Mi favorito.' },
      { name: 'Azul cielo', hex: '#BFD4E8', note: 'Delicado y elegante.' },
      { name: 'Lavanda', hex: '#C8B6DC', note: 'Romántico.' },
      { name: 'Malva', hex: '#DBB6C6', note: 'Sofisticado.' },
      { name: 'Verde pistacho suave', hex: '#D6DDB0', note: null },
      { name: 'Verde agua', hex: '#B8DBD5', note: 'Muy delicado.' },
    ]);
  });

  it('gives the pistacho slice no note', () => {
    const pistacho = dressColors.find((color) => color.name === 'Verde pistacho suave');
    expect(pistacho?.note).toBeNull();
  });

  it('never reuses a hex across the six colors', () => {
    const hexes = dressColors.map((color) => color.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});
