import { describe, it, expect } from 'vitest';
import { isHoneypotTripped, isWeb3FormsKeyConfigured } from '../web3forms';

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
