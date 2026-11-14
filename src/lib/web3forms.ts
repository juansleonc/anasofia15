/**
 * Web3Forms transport helpers shared by the site's forms: endpoint, key check, honeypot check,
 * and the POST itself.
 */

export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

/** Honeypot convention: a hidden field that only a bot fills in. Non-empty ⇒ block the send. */
export function isHoneypotTripped(rawForm: { botcheck?: unknown }): boolean {
  return typeof rawForm.botcheck === 'string' && rawForm.botcheck.trim().length > 0;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a real-looking Web3Forms access key (a UUID) — false for the shipped empty
 * string, any other non-UUID string, or a non-string. Drives whether a form submits at all:
 * while false, the RSVP and trivia-send islands show a "not configured" notice and never call
 * `fetch`.
 */
export function isWeb3FormsKeyConfigured(key: unknown): boolean {
  return typeof key === 'string' && UUID_PATTERN.test(key);
}

/**
 * POSTs a payload to Web3Forms. Resolves true only when the HTTP status is OK and the JSON body
 * confirms `success: true`; any other outcome (non-2xx, `success:false`, unparseable body, network
 * failure) resolves false. Never throws.
 */
export async function postToWeb3Forms(
  payload: { access_key: string; subject: string; botcheck: string } & Record<string, string>,
): Promise<boolean> {
  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    return (
      response.ok &&
      typeof body === 'object' &&
      body !== null &&
      (body as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}
