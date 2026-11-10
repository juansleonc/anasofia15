// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateRsvp,
  buildWeb3FormsPayload,
  hasSubmitted,
  markSubmitted,
  isHoneypotTripped,
  RSVP_GUARD_STORAGE_KEY,
  readSubmission,
  isWeb3FormsKeyConfigured,
} from '../rsvp';

// A minimal Storage-shaped fake so the guard tests never touch real jsdom localStorage state
// across tests (isolation) and so the module's storage param is genuinely exercised, not just
// defaulted.
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('validateRsvp', () => {
  // Adversarial cases first: the ways an invalid submission could silently be accepted.

  it('rejects an empty name', () => {
    const result = validateRsvp({ name: '', attending: 'yes' });

    expect(result.ok).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });

  it('rejects a whitespace-only name', () => {
    const result = validateRsvp({ name: '   ', attending: 'yes' });

    expect(result.ok).toBe(false);
    expect(result.errors.name).toBeTruthy();
  });

  it('rejects a missing attending value', () => {
    const result = validateRsvp({ name: 'Ana' });

    expect(result.ok).toBe(false);
    expect(result.errors.attending).toBeTruthy();
  });

  it('rejects an invalid attending value', () => {
    const result = validateRsvp({ name: 'Ana', attending: 'maybe' });

    expect(result.ok).toBe(false);
    expect(result.errors.attending).toBeTruthy();
  });

  it('accepts a valid submission without a song (song is optional)', () => {
    const result = validateRsvp({ name: 'Ana Gómez', attending: 'no' });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('accepts a valid submission with a song', () => {
    const result = validateRsvp({ name: 'Ana Gómez', attending: 'yes', song: 'Dancing Queen' });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe('isHoneypotTripped', () => {
  it('blocks submission when the honeypot field is non-empty', () => {
    expect(isHoneypotTripped({ botcheck: 'spammer filled this in' })).toBe(true);
  });

  it('allows submission when the honeypot field is empty', () => {
    expect(isHoneypotTripped({ botcheck: '' })).toBe(false);
  });

  it('allows submission when the honeypot field is absent', () => {
    expect(isHoneypotTripped({})).toBe(false);
  });
});

describe('buildWeb3FormsPayload', () => {
  it('builds the exact shape posted to Web3Forms, with the passed access key', () => {
    const payload = buildWeb3FormsPayload(
      { name: 'Ana Gómez', attending: 'yes', song: 'Dancing Queen' },
      'test-access-key-123',
    );

    expect(payload.access_key).toBe('test-access-key-123');
    expect(payload.name).toBe('Ana Gómez');
    expect(payload.from_name).toBe('Ana Gómez');
    expect(payload.attending).toBe('Sí, allí estaré');
    expect(payload.song).toBe('Dancing Queen');
    expect(payload.botcheck).toBe('');
    expect(typeof payload.subject).toBe('string');
    expect(payload.subject.length).toBeGreaterThan(0);
  });

  it('renders the human-readable "no" answer', () => {
    const payload = buildWeb3FormsPayload({ name: 'Ana', attending: 'no' }, 'key');

    expect(payload.attending).toBe('No podré ir');
  });

  it('defaults song to an empty string when omitted', () => {
    const payload = buildWeb3FormsPayload({ name: 'Ana', attending: 'yes' }, 'key');

    expect(payload.song).toBe('');
  });

  it('defaults to a neutral subject carrying no celebrant/event identity', () => {
    const payload = buildWeb3FormsPayload({ name: 'Ana', attending: 'yes' }, 'key');

    expect(payload.subject).toBe('Nueva confirmación RSVP');
  });

  it('lets a caller-supplied subject win over the default', () => {
    const payload = buildWeb3FormsPayload(
      { name: 'Ana', attending: 'yes' },
      'key',
      { subject: 'Nueva confirmación RSVP · XV años · Ana Sofía' },
    );

    expect(payload.subject).toBe('Nueva confirmación RSVP · XV años · Ana Sofía');
  });
});

describe('RSVP submit guard (localStorage)', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('reports no submission before markSubmitted is ever called', () => {
    expect(hasSubmitted(storage)).toBe(false);
  });

  it('reports a submission after markSubmitted, and persists the record', () => {
    markSubmitted({ name: 'Ana Gómez', attending: 'yes', song: 'Dancing Queen' }, storage);

    expect(hasSubmitted(storage)).toBe(true);
    const raw = storage.getItem(RSVP_GUARD_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.name).toBe('Ana Gómez');
    expect(parsed.attending).toBe('yes');
  });

  it('does not leak the guard across independent storage instances', () => {
    const otherStorage = fakeStorage();
    markSubmitted({ name: 'Ana', attending: 'yes' }, storage);

    expect(hasSubmitted(otherStorage)).toBe(false);
  });
});

describe('RSVP_GUARD_STORAGE_KEY', () => {
  it('is namespaced to this site, distinct from another site sharing the same origin', () => {
    expect(RSVP_GUARD_STORAGE_KEY).toBe('anasofia15_rsvp_v1');
  });
});

describe('readSubmission', () => {
  // Adversarial cases first: the ways a corrupted or foreign record could be read as valid.

  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('returns null when nothing has been stored', () => {
    expect(readSubmission(storage)).toBeNull();
  });

  it('returns null for corrupt (non-JSON) stored data', () => {
    storage.setItem(RSVP_GUARD_STORAGE_KEY, 'not json{');

    expect(readSubmission(storage)).toBeNull();
  });

  it('returns null when the stored attending value is not yes/no', () => {
    storage.setItem(
      RSVP_GUARD_STORAGE_KEY,
      JSON.stringify({ name: 'Ana', attending: 'maybe' }),
    );

    expect(readSubmission(storage)).toBeNull();
  });

  it('returns the name and attending from a valid stored record', () => {
    markSubmitted({ name: 'Ana Gómez', attending: 'yes', song: 'Dancing Queen' }, storage);

    expect(readSubmission(storage)).toEqual({ name: 'Ana Gómez', attending: 'yes' });
  });
});

describe('isWeb3FormsKeyConfigured', () => {
  // Adversarial cases first: the ways an unconfigured site could be mistaken for a configured one.

  it('is true for a real-looking UUID access key', () => {
    expect(isWeb3FormsKeyConfigured('3f9a2c71-5b44-4e2f-9c3d-7a1e5f082b6d')).toBe(true);
  });

  it('is false for the shipped placeholder literal', () => {
    expect(isWeb3FormsKeyConfigured('REEMPLAZAR-CON-LLAVE-WEB3FORMS')).toBe(false);
  });

  it('is false for an empty string', () => {
    expect(isWeb3FormsKeyConfigured('')).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isWeb3FormsKeyConfigured(undefined)).toBe(false);
  });

  it('is false for a non-string value', () => {
    expect(isWeb3FormsKeyConfigured(12345)).toBe(false);
  });
});
