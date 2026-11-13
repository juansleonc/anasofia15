import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  WEB3FORMS_ENDPOINT,
  isHoneypotTripped,
  isWeb3FormsKeyConfigured,
  postToWeb3Forms,
} from '../web3forms';

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

describe('postToWeb3Forms', () => {
  const payload = { access_key: 'k', subject: 's', botcheck: '', name: 'Ana' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(impl: () => Promise<unknown>) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it('makes one JSON POST to the Web3Forms endpoint and returns true on a confirmed success', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ success: true }));

    await expect(postToWeb3Forms(payload)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEB3FORMS_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it('is false for an HTTP 500 even when the body claims success', async () => {
    stubFetch(async () => jsonResponse({ success: true }, 500));
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });

  it('is false for an HTTP 200 whose body says success:false', async () => {
    stubFetch(async () => jsonResponse({ success: false }));
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });

  it('is false when the success flag is truthy but not literally true', async () => {
    stubFetch(async () => jsonResponse({ success: 'true' }));
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });

  it('is false for a body that is not valid JSON', async () => {
    stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });

  it('is false for a JSON null body', async () => {
    stubFetch(async () => jsonResponse(null));
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });

  it('resolves false instead of throwing when fetch rejects', async () => {
    stubFetch(async () => {
      throw new TypeError('network down');
    });
    await expect(postToWeb3Forms(payload)).resolves.toBe(false);
  });
});
