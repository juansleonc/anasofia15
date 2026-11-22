import { describe, expect, it } from 'vitest';
import { siteConfig } from '../../data/site.config';
import { isWeb3FormsKeyConfigured } from '../web3forms';

describe('siteConfig.web3formsAccessKey', () => {
  const key = siteConfig.web3formsAccessKey;

  it('is configured with a real-looking Web3Forms key for production delivery', () => {
    expect(isWeb3FormsKeyConfigured(key)).toBe(true);
  });

  it('is not the old placeholder literal', () => {
    expect(key).not.toBe('REEMPLAZAR-CON-LLAVE-WEB3FORMS');
  });

  it('contains no email address', () => {
    expect(key).not.toContain('@');
  });
});
