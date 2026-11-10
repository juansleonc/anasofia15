import { describe, it, expect } from 'vitest';
import { buildGoogleMapsUrl, buildWazeUrl } from '../maps';

// A minimal venue-shaped fixture — deliberately containing a space, an en-dash, AND an accented
// character so a naive template-string builder (no encodeURIComponent) would leak all three into
// the URL.
const ADDRESS_VENUE = {
  name: 'El Edén Country Hotel y Club Residencial',
  address: 'Autopista del Café Armenia–Circasia Km 4',
  locality: 'Circasia, Quindío',
  lat: null,
  lng: null,
};

const COORD_VENUE = {
  name: 'El Edén Country Hotel y Club Residencial',
  address: 'Autopista del Café Armenia–Circasia Km 4',
  locality: 'Circasia, Quindío',
  lat: 4.5981,
  lng: -75.6844,
};

const LINKED_VENUE = {
  ...COORD_VENUE,
  googleMapsUrl: 'https://maps.app.goo.gl/uNsRheFMkyxTr9rP9',
};

describe('buildGoogleMapsUrl', () => {
  it('returns the verbatim googleMapsUrl when present, even if coords are also present', () => {
    expect(buildGoogleMapsUrl(LINKED_VENUE)).toBe('https://maps.app.goo.gl/uNsRheFMkyxTr9rP9');
  });

  it('emits the coordinate query form when lat/lng are present and no googleMapsUrl is set', () => {
    const url = buildGoogleMapsUrl(COORD_VENUE);

    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=4.5981,-75.6844');
  });

  it('URL-encodes the name/address/locality address query (no raw spaces, en-dash, or accents)', () => {
    const url = buildGoogleMapsUrl(ADDRESS_VENUE);
    const expectedQuery = encodeURIComponent(
      'El Edén Country Hotel y Club Residencial, Autopista del Café Armenia–Circasia Km 4, Circasia, Quindío',
    );

    expect(url.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(url).not.toMatch(/ /);
    expect(url).not.toMatch(/é/);
    expect(url).not.toMatch(/–/);
    expect(url).toContain(expectedQuery);
  });

  it('falls back to the address query when coords are missing (no NaN)', () => {
    expect(buildGoogleMapsUrl(ADDRESS_VENUE)).not.toMatch(/NaN/);
  });
});

describe('buildWazeUrl', () => {
  it('emits the ll= coordinate form when lat/lng are present', () => {
    const url = buildWazeUrl(COORD_VENUE);

    expect(url).toBe('https://waze.com/ul?ll=4.5981,-75.6844&navigate=yes');
  });

  it('ignores googleMapsUrl (Waze has no verbatim-link field) and still prefers coords', () => {
    const url = buildWazeUrl(LINKED_VENUE);

    expect(url).toBe('https://waze.com/ul?ll=4.5981,-75.6844&navigate=yes');
  });

  it('URL-encodes a name/address/locality query (no raw spaces, en-dash, or accents)', () => {
    const url = buildWazeUrl(ADDRESS_VENUE);
    const expectedQuery = encodeURIComponent(
      'El Edén Country Hotel y Club Residencial, Autopista del Café Armenia–Circasia Km 4, Circasia, Quindío',
    );

    expect(url.startsWith('https://waze.com/ul?q=')).toBe(true);
    expect(url).not.toMatch(/ /);
    expect(url).not.toMatch(/é/);
    expect(url).not.toMatch(/–/);
    expect(url).toContain(expectedQuery);
    expect(url).toContain('navigate=yes');
  });

  it('falls back to the address q= form when coords are missing (no NaN, no empty ll=)', () => {
    const url = buildWazeUrl(ADDRESS_VENUE);

    expect(url).not.toMatch(/NaN/);
    expect(url).not.toMatch(/ll=/);
  });
});
