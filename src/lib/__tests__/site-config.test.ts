import { describe, expect, it } from 'vitest';
import { siteConfig } from '../../data/site.config';
import { isWeb3FormsKeyConfigured } from '../web3forms';

describe('siteConfig.web3formsAccessKey', () => {
  const key = siteConfig.web3formsAccessKey;

  it('is either empty (not configured yet) or a real UUID key', () => {
    expect(key === '' || isWeb3FormsKeyConfigured(key)).toBe(true);
  });

  it('is not the old placeholder literal', () => {
    expect(key).not.toBe('REEMPLAZAR-CON-LLAVE-WEB3FORMS');
  });

  it('contains no email address', () => {
    expect(key).not.toContain('@');
  });
});
