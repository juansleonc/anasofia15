/** One slice of the color wheel the "Para ellas" section uses to suggest a dress palette. */
export interface DressColor {
  name: string;
  hex: string;
  note: string | null;
}

export const dressColors: DressColor[] = [
  { name: 'Verde salvia', hex: '#C7D9C4', note: 'Mi favorito.' },
  { name: 'Azul cielo', hex: '#BFD4E8', note: 'Delicado y elegante.' },
  { name: 'Lavanda', hex: '#C8B6DC', note: 'Romántico.' },
  { name: 'Malva', hex: '#DBB6C6', note: 'Sofisticado.' },
  { name: 'Verde pistacho suave', hex: '#D6DDB0', note: null },
  { name: 'Verde agua', hex: '#B8DBD5', note: 'Muy delicado.' },
];
