/**
 * Keyless deep-link builders for the "Cómo llegar" section: no API key, no embedded map, just a
 * Google Maps search URL and a Waze navigate URL pointing at the venue. `buildGoogleMapsUrl`
 * prefers a venue-supplied `googleMapsUrl` (returned verbatim — the short link resolves to the
 * actual place, which a hand-built query can't reproduce from an address alone), then exact
 * coordinates (`venue.lat`/`venue.lng`), then falls back to a URL-encoded "name, address, locality"
 * query. `buildWazeUrl` has no verbatim-link field (Waze doesn't expose one), so it only prefers
 * coordinates over the same address query.
 */

export interface MapsVenue {
  name: string;
  address?: string;
  locality: string;
  lat?: number | null;
  lng?: number | null;
  googleMapsUrl?: string | null;
}

function hasCoords(venue: MapsVenue): venue is MapsVenue & { lat: number; lng: number } {
  return typeof venue.lat === 'number' && typeof venue.lng === 'number';
}

function addressQuery(venue: MapsVenue): string {
  return [venue.name, venue.address, venue.locality].filter(Boolean).join(', ');
}

export function buildGoogleMapsUrl(venue: MapsVenue): string {
  if (venue.googleMapsUrl) {
    return venue.googleMapsUrl;
  }

  if (hasCoords(venue)) {
    // Coordinate pairs contain only digits/./-/, — none of which encodeURIComponent would alter
    // except the comma, which Google's query param expects literally (lat,lng).
    return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery(venue))}`;
}

export function buildWazeUrl(venue: MapsVenue): string {
  if (hasCoords(venue)) {
    return `https://waze.com/ul?ll=${venue.lat},${venue.lng}&navigate=yes`;
  }

  return `https://waze.com/ul?q=${encodeURIComponent(addressQuery(venue))}&navigate=yes`;
}
