/** One slice of the color wheel the "Para ellas" section uses to suggest a dress palette. */
export interface DressColor {
  name: string;
  hex: string;
}

export const dressColors: DressColor[] = [
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
];

/** Colors the quinceañera wears, so guests should not. */
export const reservedColors = ['blanco', 'marfil', 'champagne', 'dorado rosado', 'negro'] as const;

export const reservedColorsNote = `Para tu vestido, evita los colores ${new Intl.ListFormat('es', { type: 'conjunction' }).format(reservedColors)}: están reservados para la quinceañera.`;
