import { test, expect } from '@playwright/test';
import { event } from '../src/data/event';
import { RSVP_GUARD_STORAGE_KEY } from '../src/lib/rsvp';
import { withConfiguredAccessKey, TEST_ACCESS_KEY } from './web3forms-seam';

// RSVP: nombre + asistencia (sí/no) + canción sugerida, submitted to a mocked Web3Forms endpoint
// (never the real network). Covers the full state machine: idle -> submitting -> success | error,
// plus the already-confirmed state on revisit (localStorage guard) and the "not configured" state
// shipped while the access key is still empty.
//
// Success/error/revisit flows need the form to behave as "configured"; the shared seam in
// ./web3forms-seam swaps in a test key at the HTML level (no test hook in production code).

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

test.describe('RSVP section: not configured (shipped empty key)', () => {
  test('shows the notice, disables the submit button, and sends zero requests', async ({
    page,
  }) => {
    let requestCount = 0;
    await page.route(WEB3FORMS_URL, async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('./');
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const section = page.getByTestId('rsvp');
    await expect(section).toBeVisible();
    await expect(page.getByTestId('rsvp-not-configured')).toBeVisible();
    await expect(page.getByTestId('rsvp-submit-button')).toBeDisabled();

    await page.getByTestId('rsvp-name-input').fill('Camila Torres');
    await page.getByTestId('rsvp-attending-yes').click();
    // The button is disabled, but also assert a direct submit attempt sends nothing — defense
    // in depth, not just a disabled affordance.
    await page.getByTestId('rsvp-form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    expect(requestCount).toBe(0);
  });
});

test.describe('RSVP section', () => {
  test('shows the single-admission note between the title and the form', async ({ page }) => {
    await withConfiguredAccessKey(page);
    await page.goto('./');
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const section = page.getByTestId('rsvp');
    await expect(section).toBeVisible();

    const note = page.getByTestId('rsvp-admission-note');
    await expect(note).toHaveText(event.admissionNote);

    const order = await section.evaluate((el) => {
      const title = el.querySelector('.rsvp__title');
      const note = el.querySelector('[data-testid="rsvp-admission-note"]');
      const form = el.querySelector('[data-testid="rsvp-form"]');
      if (!title || !note || !form) return null;
      const titleBeforeNote =
        !!(title.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING);
      const noteBeforeForm =
        !!(note.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { titleBeforeNote, noteBeforeForm };
    });
    expect(order).toEqual({ titleBeforeNote: true, noteBeforeForm: true });
  });

  test('rejects an empty submission with inline validation and sends nothing', async ({ page }) => {
    let requestCount = 0;
    await page.route(WEB3FORMS_URL, async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await withConfiguredAccessKey(page);
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const section = page.getByTestId('rsvp');
    await expect(section).toBeVisible();

    await page.getByTestId('rsvp-submit-button').click();

    await expect(page.getByTestId('rsvp-error-name')).not.toBeEmpty();
    await expect(page.getByTestId('rsvp-error-attending')).not.toBeEmpty();
    await expect(page.getByTestId('rsvp-confirmed')).toBeHidden();
    expect(requestCount).toBe(0);
  });

  test('submits valid RSVP data and shows a personalized confirmation', async ({ page }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- captured mock request body, shape asserted below
    let capturedBody: any = null;
    await page.route(WEB3FORMS_URL, async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await withConfiguredAccessKey(page);
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await page.getByTestId('rsvp-name-input').fill('Camila Torres');
    await page.getByTestId('rsvp-attending-yes').click();
    await page.getByTestId('rsvp-song-input').fill('Dancing Queen');
    await page.getByTestId('rsvp-submit-button').click();

    const confirmed = page.getByTestId('rsvp-confirmed');
    await expect(confirmed).toBeVisible();
    await expect(page.getByTestId('rsvp-confirmed-message')).toContainText('Camila');
    await expect(page.getByTestId('rsvp-form')).toBeHidden();

    expect(capturedBody).toMatchObject({ name: 'Camila Torres', song: 'Dancing Queen' });
    expect(capturedBody?.attending).toContain('allí estaré');
    expect(capturedBody?.access_key).toBe(TEST_ACCESS_KEY);
  });

  test('shows the already-confirmed state and disables the form on revisit after reload', async ({
    page,
  }) => {
    let requestCount = 0;
    await page.route(WEB3FORMS_URL, async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await withConfiguredAccessKey(page);
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await page.getByTestId('rsvp-name-input').fill('Mateo Rios');
    await page.getByTestId('rsvp-attending-yes').click();
    await page.getByTestId('rsvp-submit-button').click();
    await expect(page.getByTestId('rsvp-confirmed')).toBeVisible();
    expect(requestCount).toBe(1);

    await page.reload();

    await expect(page.getByTestId('rsvp-confirmed')).toBeVisible();
    await expect(page.getByTestId('rsvp-confirmed-message')).toContainText('Mateo');
    await expect(page.getByTestId('rsvp-form')).toBeHidden();
    expect(requestCount).toBe(1);
  });

  test('shows an error state on a failed submission and never a false success', async ({ page }) => {
    await page.route(WEB3FORMS_URL, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false }),
      });
    });

    await withConfiguredAccessKey(page);
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await page.getByTestId('rsvp-name-input').fill('Ana Ruiz');
    await page.getByTestId('rsvp-attending-no').click();
    await page.getByTestId('rsvp-submit-button').click();

    await expect(page.getByTestId('rsvp-status')).not.toBeEmpty();
    await expect(page.getByTestId('rsvp-confirmed')).toBeHidden();
    await expect(page.getByTestId('rsvp-form')).toBeVisible();

    const stillNotSubmitted = await page.evaluate(
      (key) => localStorage.getItem(key),
      RSVP_GUARD_STORAGE_KEY,
    );
    expect(stillNotSubmitted).toBeNull();
  });

  test('shows an error state when the endpoint returns HTTP 200 with success:false', async ({
    page,
  }) => {
    await page.route(WEB3FORMS_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid access key.' }),
      });
    });

    await withConfiguredAccessKey(page);
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await page.getByTestId('rsvp-name-input').fill('Sofia Gomez');
    await page.getByTestId('rsvp-attending-yes').click();
    await page.getByTestId('rsvp-submit-button').click();

    await expect(page.getByTestId('rsvp-status')).not.toBeEmpty();
    await expect(page.getByTestId('rsvp-confirmed')).toBeHidden();
    await expect(page.getByTestId('rsvp-form')).toBeVisible();

    const stillNotSubmitted = await page.evaluate(
      (key) => localStorage.getItem(key),
      RSVP_GUARD_STORAGE_KEY,
    );
    expect(stillNotSubmitted).toBeNull();
  });
});
