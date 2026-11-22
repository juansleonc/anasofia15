import { reservedColors } from './dress-colors';

/**
 * Server-only: kept out of `dress-colors.ts` so the client bundle for the color wheel (which only
 * needs `dressColors`) never pulls in this `Intl.ListFormat` call at module load.
 */
export const reservedColorsNote = `Para tu vestido, evita los colores ${new Intl.ListFormat('es', { type: 'conjunction' }).format(reservedColors)}: están reservados para la quinceañera.`;
