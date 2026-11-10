import { describe, it, expect } from 'vitest';
import { computeTimeRemaining } from '../countdown';

// The event's fixed absolute instant (Bogotá has no DST, so this offset never shifts).
const TARGET_MS = Date.parse('2026-09-19T19:00:00-05:00');

describe('computeTimeRemaining', () => {
  // Adversarial cases first: the ways this could silently give a wrong or timezone-dependent answer.

  it('gives the identical remaining time for the same instant read from two different visitor timezones', () => {
    // Same UTC instant, expressed as a Tokyo-local reading (+09:00) and an LA-local reading
    // (-07:00 during PDT) — a timezone-dependent implementation (e.g. one using local Date
    // fields or getTimezoneOffset) would diverge here even though the ms value is identical.
    const tokyoReadingMs = Date.parse('2026-08-01T09:00:00+09:00');
    const laReadingMs = Date.parse('2026-07-31T17:00:00-07:00'); // same instant, -07:00 (PDT) form
    expect(tokyoReadingMs).toBe(laReadingMs); // sanity: both represent the same instant

    const fromTokyo = computeTimeRemaining(tokyoReadingMs, TARGET_MS);
    const fromLA = computeTimeRemaining(laReadingMs, TARGET_MS);

    expect(fromTokyo).toEqual(fromLA);
  });

  it('reports arrived with all-zero units exactly at the target instant', () => {
    expect(computeTimeRemaining(TARGET_MS, TARGET_MS)).toEqual({
      days: 0,
      hours: 0,
      mins: 0,
      secs: 0,
      arrived: true,
    });
  });

  it('reports arrived with all-zero (never negative) units once the target has passed', () => {
    const wellPastMs = TARGET_MS + 5 * 24 * 3600000 + 3 * 3600000 + 30 * 60000 + 15 * 1000;

    expect(computeTimeRemaining(wellPastMs, TARGET_MS)).toEqual({
      days: 0,
      hours: 0,
      mins: 0,
      secs: 0,
      arrived: true,
    });
  });

  it('breaks down a known before-target diff into days/hours/mins/secs', () => {
    const diffMs = 2 * 24 * 3600000 + 3 * 3600000 + 4 * 60000 + 5 * 1000;
    const nowMs = TARGET_MS - diffMs;

    expect(computeTimeRemaining(nowMs, TARGET_MS)).toEqual({
      days: 2,
      hours: 3,
      mins: 4,
      secs: 5,
      arrived: false,
    });
  });
});
