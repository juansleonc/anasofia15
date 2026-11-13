import { describe, it, expect } from 'vitest';
import { event } from '../../data/event';

describe('event data', () => {
  // Adversarial first: the ways the event constants could silently drift or be timezone-wrong.
  it('resolves the event datetime to the correct UTC instant regardless of the ISO string\'s literal text', () => {
    // 2026-12-19 18:00 America/Bogota (-05:00, no DST) must be 2026-12-19 23:00 UTC.
    expect(new Date(event.eventDateTimeIso).getTime()).toBe(Date.UTC(2026, 11, 19, 23, 0, 0));
  });

  it('carries the -05:00 offset explicitly in the stored ISO string (not a bare UTC/Z string)', () => {
    expect(event.eventDateTimeIso).toBe('2026-12-19T18:00:00-05:00');
  });

  it('exposes the celebrant\'s full name, used whole everywhere (no first-name-only derivation)', () => {
    expect(event.celebrantName).toBe('Ana Sofía');
  });

  it('exposes the confirmed 6 PM time', () => {
    expect(event.eventTimeDisplay).toBe('6:00 p. m.');
  });

  it('exposes the exact human-readable day string', () => {
    expect(event.eventDayDisplay).toBe('Sábado 19 de diciembre de 2026');
  });

  it('derives the date display from the day + time strings rather than a duplicate literal', () => {
    expect(event.eventDateDisplay).toBe(`${event.eventDayDisplay} · ${event.eventTimeDisplay}`);
    expect(event.eventDateDisplay).toBe('Sábado 19 de diciembre de 2026 · 6:00 p. m.');
  });

  it('exposes the exact dress-code summary string, character for character', () => {
    expect(event.dressCode.summary).toBe('Formal, elegante');
  });

  it('exposes the exact men and women dress-code wording and no description key', () => {
    expect(event.dressCode.men).toBe(
      'Tonos beige, café y similares. Camisa blanca manga larga y pantalón de vestir.',
    );
    expect(event.dressCode.women).toBe('Colores planos. Vestido largo de color plano.');
    expect('description' in event.dressCode).toBe(false);
  });

  it('derives the dress timeline description from men and women on separate lines', () => {
    const item = event.timeline.find((i) => i.tag === 'Código de vestimenta');
    expect(item?.description).toBe(`Hombres: ${event.dressCode.men}\nMujeres: ${event.dressCode.women}`);
    expect(item?.description).not.toContain('pantalón beige');
    expect(item?.description).not.toContain('rueda de colores');
  });

  it('labels the dress-code timeline entry in Spanish, matching the rest of the timeline', () => {
    const dressCodeItem = event.timeline.find((item) => item.title === event.dressCode.summary);
    expect(dressCodeItem?.tag).toBe('Código de vestimenta');
  });

  it('exposes the exact venue name, address, locality, and country', () => {
    expect(event.venue.name).toBe('El Edén Country Hotel y Club Residencial');
    expect(event.venue.address).toBe('Autopista del Café Armenia–Circasia Km 4');
    expect(event.venue.locality).toBe('Circasia, Quindío');
    expect(event.venue.country).toBe('Colombia');
  });

  it('exposes the verbatim Google Maps short link for the venue', () => {
    expect(event.venue.googleMapsUrl).toBe('https://maps.app.goo.gl/uNsRheFMkyxTr9rP9');
  });

  it('leaves venue coordinates unset (address known, coords pending) rather than faking a value', () => {
    expect(event.venue.lat).toBeNull();
    expect(event.venue.lng).toBeNull();
  });

  it('does not carry the retired reception/party fields', () => {
    expect('laFiesta' in event).toBe(false);
    expect('receptionNote' in event).toBe(false);
  });

  it('exposes the exact footer string', () => {
    expect(event.footerText).toBe('Ana Sofía · 19.12.2026');
  });

  it('exposes the RSVP admission note, using the celebrant\'s full name (not a split first name)', () => {
    expect(event.admissionNote).toBe(
      'Ana Sofía reservó un lugar especial para ti: esta invitación es válida para una sola persona.',
    );
  });

  it('has exactly 4 timeline items, in Cuándo / Dónde / Código de vestimenta / Regalos order', () => {
    expect(event.timeline).toHaveLength(4);
    expect(event.timeline.map((item) => item.tag)).toEqual([
      'Cuándo',
      'Dónde',
      'Código de vestimenta',
      'Regalos',
    ]);
  });

  it('derives the Cuándo item from the day/time display strings, not a duplicate literal', () => {
    const cuando = event.timeline[0];
    expect(cuando.title).toBe(event.eventDayDisplay);
    expect(cuando.description).toBe(`A las ${event.eventTimeDisplay}`);
    expect(cuando.description).not.toMatch(/\.\.$/);
  });

  it('appends the envelope-shower entry as the fourth and final timeline item, with no description', () => {
    const lastItem = event.timeline[event.timeline.length - 1];
    expect(lastItem.tag).toBe('Regalos');
    expect(lastItem.title).toBe('Lluvia de sobres');
    expect(lastItem.description).toBeUndefined();
  });

  it('keeps the first three timeline items descriptive (optional description did not drop them)', () => {
    const descriptiveItems = event.timeline.slice(0, 3);
    for (const item of descriptiveItems) {
      expect(item.description).toBeTruthy();
    }
  });
});
