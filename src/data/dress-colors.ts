/** One slice of the color wheel the "Para ellas" section uses to suggest a dress palette. */
export interface DressColor {
  name: string;
  hex: string;
}

export const dressColors: DressColor[] = [
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
];

/** Colors the quinceañera wears, so guests should not. */
export const reservedColors = ['blanco', 'marfil', 'champagne', 'dorado rosado', 'negro'] as const;

export const reservedColorsNote = `Para tu vestido, evita los colores ${new Intl.ListFormat('es', { type: 'conjunction' }).format(reservedColors)}: están reservados para la quinceañera.`;
