/**
 * === THE ONE PLACE THE FAMILY EDITS: event details ===
 * All celebrant/venue/date/dress-code copy for the invitation lives here, typed, so no section
 * component authors this content inline. Edit the `event` object below to update the site.
 */

export interface Venue {
  /** Venue name, e.g. "El Edén Country Hotel y Club Residencial". */
  name: string;
  /** Street/route address, shown alongside the locality in the "Dónde" timeline item. */
  address: string;
  /** City/department shown alongside the venue address. */
  locality: string;
  /** Country shown as the final line of the venue address. */
  country: string;
  /**
   * Google's own short link to the exact place, used verbatim by `buildGoogleMapsUrl` — a
   * hand-built query from the address alone can't reproduce the precise pin a short link resolves
   * to. `null` would fall back to the (less precise) address query.
   */
  googleMapsUrl: string | null;
  /** Latitude, or `null` while coordinates are pending — the maps builder falls back to the address query. */
  lat: number | null;
  /** Longitude, or `null` while coordinates are pending — the maps builder falls back to the address query. */
  lng: number | null;
}

export interface DressCode {
  /** Exact dress-code line shown verbatim in the "Detalles" timeline. */
  summary: string;
  /** Dress-code wording for men. */
  men: string;
  /** Dress-code wording for women. */
  women: string;
}

/** One entry in the "Detalles" vertical timeline (Cuándo / Dónde / Código de vestimenta / Regalos). */
export interface TimelineItem {
  /** Short uppercase label shown above the item, e.g. "Cuándo". */
  tag: string;
  /** Bold headline of the item. */
  title: string;
  /** Supporting one/two-sentence description. Omitted when the title stands on its own. */
  description?: string;
}

export interface EventDetails {
  /** Short display name of the celebrant, as shown in cursive in the Hero section. */
  celebrantName: string;
  /**
   * ISO-8601 datetime of the event WITH the America/Bogotá UTC offset (`-05:00`, no DST) baked
   * in, so the countdown resolves to the correct instant regardless of the visitor's timezone.
   */
  eventDateTimeIso: string;
  /** Human-readable Spanish day string (no time of day), shown as part of `eventDateDisplay`. */
  eventDayDisplay: string;
  /** Human-readable Spanish time-of-day string, e.g. "6:00 p. m.". */
  eventTimeDisplay: string;
  /** Derived `${eventDayDisplay} · ${eventTimeDisplay}` for display (not used for countdown math). */
  eventDateDisplay: string;
  venue: Venue;
  dressCode: DressCode;
  /** Supporting line shown in "Confirma tu lugar", reminding guests the invitation is single-admission only. */
  admissionNote: string;
  /** Short footer line shown at the bottom of the page. */
  footerText: string;
  /**
   * The "Detalles" section's vertical timeline, in display order. Built from the fields above
   * (never duplicated as separate literals) so there is a single source of truth per fact.
   */
  timeline: TimelineItem[];
}

const celebrantName = 'Ana Sofía';
const eventDateTimeIso = '2026-12-19T18:00:00-05:00';
const eventDayDisplay = 'Sábado 19 de diciembre de 2026';
const eventTimeDisplay = '6:00 p. m.';
const eventDateDisplay = `${eventDayDisplay} · ${eventTimeDisplay}`;
const venue: Venue = {
  name: 'El Edén Country Hotel y Club Residencial',
  address: 'Autopista del Café Armenia–Circasia Km 4',
  locality: 'Circasia, Quindío',
  country: 'Colombia',
  googleMapsUrl: 'https://maps.app.goo.gl/uNsRheFMkyxTr9rP9',
  lat: null,
  lng: null,
};
const dressCode: DressCode = {
  summary: 'Formal, elegante',
  men: 'Tonos beige, café y similares. Camisa blanca manga larga y pantalón de vestir.',
  women: 'Vestido largo, colores planos.',
};
const footerText = 'Ana Sofía · 19.12.2026';
const admissionNote = `${celebrantName} reservó un lugar especial para ti: esta invitación es válida para una sola persona.`;

export const event: EventDetails = {
  celebrantName,
  eventDateTimeIso,
  eventDayDisplay,
  eventTimeDisplay,
  eventDateDisplay,
  venue,
  dressCode,
  admissionNote,
  footerText,
  timeline: [
    {
      tag: 'Cuándo',
      title: eventDayDisplay,
      description: `A las ${eventTimeDisplay}`,
    },
    {
      tag: 'Dónde',
      title: venue.name,
      description: `${venue.address}, ${venue.locality}.`,
    },
    {
      tag: 'Código de vestimenta',
      title: dressCode.summary,
      description: `Hombres: ${dressCode.men}\nMujeres: ${dressCode.women}`,
    },
    {
      tag: 'Regalos',
      title: 'Lluvia de sobres',
    },
  ],
};
