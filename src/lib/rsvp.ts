/**
 * Pure RSVP logic: validate the form input, build the payload posted to Web3Forms, and a
 * localStorage-backed one-submission-per-device guard. No DOM/fetch here — `islands/RsvpForm`
 * wires this to the real form + `fetch('https://api.web3forms.com/submit')`.
 */

export type Attending = 'yes' | 'no';

export interface RsvpInput {
  name: string;
  attending: Attending;
  song?: string;
}

export interface RsvpValidationResult {
  ok: boolean;
  errors: {
    name?: string;
    attending?: string;
  };
}

const ATTENDING_LABELS: Record<Attending, string> = {
  yes: 'Sí, allí estaré',
  no: 'No podré ir',
};

function isAttending(value: unknown): value is Attending {
  return value === 'yes' || value === 'no';
}

export function validateRsvp(input: {
  name?: unknown;
  attending?: unknown;
  song?: unknown;
}): RsvpValidationResult {
  const errors: RsvpValidationResult['errors'] = {};

  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (!isAttending(input.attending)) {
    errors.attending = 'Indica si asistirás.';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Honeypot convention: a hidden field that only a bot fills in. Non-empty ⇒ block the send. */
export function isHoneypotTripped(rawForm: { botcheck?: unknown }): boolean {
  return typeof rawForm.botcheck === 'string' && rawForm.botcheck.trim().length > 0;
}

export interface Web3FormsPayload {
  access_key: string;
  subject: string;
  name: string;
  from_name: string;
  attending: string;
  song: string;
  botcheck: string;
}

export interface BuildWeb3FormsPayloadOptions {
  subject?: string;
}

export function buildWeb3FormsPayload(
  input: RsvpInput,
  accessKey: string,
  opts: BuildWeb3FormsPayloadOptions = {},
): Web3FormsPayload {
  return {
    access_key: accessKey,
    subject: opts.subject ?? 'Nueva confirmación RSVP',
    name: input.name,
    from_name: input.name,
    attending: ATTENDING_LABELS[input.attending],
    song: input.song ?? '',
    // Honeypot field: always sent empty by a real submitter; Web3Forms/us can flag it non-empty.
    botcheck: '',
  };
}

/**
 * Namespaced with this site's own prefix so it can never collide with the sibling `lu15` site,
 * which shares the same GitHub Pages origin (and therefore the same localStorage).
 */
export const RSVP_GUARD_STORAGE_KEY = 'anasofia15_rsvp_v1';

interface RsvpGuardRecord {
  name: string;
  attending: Attending;
  song: string;
  submittedAt: string;
}

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  return typeof localStorage !== 'undefined' ? localStorage : undefined;
}

export function hasSubmitted(storage?: Storage): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  return store.getItem(RSVP_GUARD_STORAGE_KEY) !== null;
}

export function markSubmitted(input: RsvpInput, storage?: Storage): void {
  const store = resolveStorage(storage);
  if (!store) return;

  const record: RsvpGuardRecord = {
    name: input.name,
    attending: input.attending,
    song: input.song ?? '',
    submittedAt: new Date().toISOString(),
  };
  store.setItem(RSVP_GUARD_STORAGE_KEY, JSON.stringify(record));
}

/**
 * Single reader for the guard record's shape — replaces RsvpForm's former private duplicate
 * (`readGuardRecord`) so there is exactly one place that parses it. Returns `null` on a missing
 * key, corrupt JSON, or an invalid `attending` value (fail closed: never surface a half-trusted
 * record as if it were confirmed).
 */
export function readSubmission(storage?: Storage): { name: string; attending: Attending } | null {
  const store = resolveStorage(storage);
  if (!store) return null;

  const raw = store.getItem(RSVP_GUARD_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { name?: unknown }).name === 'string' &&
      isAttending((parsed as { attending?: unknown }).attending)
    ) {
      return {
        name: (parsed as { name: string }).name,
        attending: (parsed as { attending: Attending }).attending,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a real-looking Web3Forms access key (a UUID) — false for the shipped placeholder
 * literal, an empty value, or anything non-string. Drives whether the RSVP form submits at all:
 * while false, the island shows a "not configured" notice and never calls `fetch`.
 */
export function isWeb3FormsKeyConfigured(key: unknown): boolean {
  return typeof key === 'string' && UUID_PATTERN.test(key);
}
