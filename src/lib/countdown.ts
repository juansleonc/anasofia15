/**
 * Pure countdown math: given two absolute instants (epoch milliseconds), returns the remaining
 * time broken into days/hours/mins/secs. Takes both instants as explicit `number` params (no
 * internal `Date`/`getTimezoneOffset` reads) so the result depends only on the ms values, not on
 * the visitor's local timezone — the caller resolves `nowMs` once (e.g. `Date.now()`) and passes
 * a fixed-offset target (see `src/data/event.ts`'s `eventDateTimeIso`).
 *
 * Units are returned as plain numbers, not zero-padded strings — display formatting (e.g.
 * `padStart(2, '0')`) is left to the consuming island/section.
 */

export interface TimeRemaining {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  arrived: boolean;
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function computeTimeRemaining(nowMs: number, targetMs: number): TimeRemaining {
  const diffMs = targetMs - nowMs;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, arrived: true };
  }

  return {
    days: Math.floor(diffMs / MS_PER_DAY),
    hours: Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR),
    mins: Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE),
    secs: Math.floor((diffMs % MS_PER_MINUTE) / MS_PER_SECOND),
    arrived: false,
  };
}
