import { test, expect, type Page } from '@playwright/test';
import { triviaQuestions } from '../src/data/trivia';
import { RSVP_GUARD_STORAGE_KEY } from '../src/lib/rsvp';
import { TEST_ACCESS_KEY, withConfiguredAccessKey } from './web3forms-seam';

// The trivia result card carries a "send my result" form. It is revealed only when the Web3Forms
// key is configured (the shared seam swaps in a test key) and prefilled from a prior RSVP record.

async function playToEnd(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Abrir invitación' }).click();
  await expect(page.getByTestId('trivia')).toBeVisible();
  for (let i = 0; i < triviaQuestions.length; i += 1) {
    await expect(page.getByTestId('trivia-counter')).toContainText(`Pregunta ${i + 1} de`);
    await page.getByTestId(`trivia-option-${triviaQuestions[i].correctIndex}`).click();
  }
  await expect(page.getByTestId('trivia-result')).toBeVisible();
}

test.describe('Trivia send form', () => {
  test('is visible with an empty name when there is no RSVP record', async ({ page }) => {
    test.setTimeout(60_000);
    await withConfiguredAccessKey(page);
    await playToEnd(page);

    await expect(page.getByTestId('trivia-send-form')).toBeVisible();
    await expect(page.getByTestId('trivia-send-name')).toHaveValue('');
  });

  test('prefills the name from the RSVP record', async ({ page }) => {
    test.setTimeout(60_000);
    await withConfiguredAccessKey(page);
    await page.addInitScript(
      ([key, record]) => localStorage.setItem(key, record),
      [
        RSVP_GUARD_STORAGE_KEY,
        JSON.stringify({
          name: 'Camila Torres',
          attending: 'yes',
          song: '',
          submittedAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
    );
    await playToEnd(page);

    await expect(page.getByTestId('trivia-send-form')).toBeVisible();
    await expect(page.getByTestId('trivia-send-name')).toHaveValue('Camila Torres');
  });
  test('sends the result once, guarding rapid clicks, and shows the sent message', async ({ page }) => {
    test.setTimeout(60_000);
    await withConfiguredAccessKey(page);
    const posts: string[] = [];
    await page.route('https://api.web3forms.com/submit', async (route) => {
      posts.push(route.request().postData() ?? '');
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });
    await playToEnd(page);

    await page.getByTestId('trivia-send-name').fill('Camila Torres');
    const button = page.getByTestId('trivia-send-button');
    await button.click();
    await button.click({ force: true, noWaitAfter: true }).catch(() => undefined);
    await button.click({ force: true, noWaitAfter: true }).catch(() => undefined);

    await expect(page.getByTestId('trivia-send-status')).toHaveText('Enviando...');
    await expect(button).toBeDisabled();

    await expect(page.getByTestId('trivia-send-sent')).toBeVisible();
    await expect(page.getByTestId('trivia-send-form')).toBeHidden();
    expect(posts).toHaveLength(1);

    const payload = JSON.parse(posts[0]) as Record<string, string>;
    expect(payload.subject.startsWith('Resultado de trivia')).toBe(true);
    expect(payload.puntaje).toBe('10/10');
    const lines = payload.respuestas.split('\n');
    expect(lines).toHaveLength(10);
    for (const line of lines) expect(line.endsWith('✓')).toBe(true);
    expect(payload.name).toBe('Camila Torres');
    expect(payload.botcheck).toBe('');
    expect(payload.access_key).toBe(TEST_ACCESS_KEY);
  });

  for (const [label, response] of [
    ['an HTTP 500', { status: 500, body: '{}' }],
    ['a success:false body', { status: 200, body: JSON.stringify({ success: false }) }],
  ] as const) {
    test(`shows a retryable error on ${label}, then sends once the route recovers`, async ({ page }) => {
      test.setTimeout(60_000);
      await withConfiguredAccessKey(page);
      let posts = 0;
      let fail = true;
      await page.route('https://api.web3forms.com/submit', async (route) => {
        posts += 1;
        if (fail) {
          await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }
      });
      await playToEnd(page);

      await page.getByTestId('trivia-send-name').fill('Camila Torres');
      const button = page.getByTestId('trivia-send-button');
      await button.click();

      await expect(page.getByTestId('trivia-send-status')).toHaveText(
        'No pudimos enviar tu resultado. Intenta de nuevo.',
      );
      await expect(button).toBeEnabled();
      await expect(page.getByTestId('trivia-send-sent')).toBeHidden();
      await expect(page.getByTestId('trivia-send-form')).toBeVisible();
      expect(posts).toBe(1);

      fail = false;
      await button.click();
      await expect(page.getByTestId('trivia-send-sent')).toBeVisible();
      await expect(page.getByTestId('trivia-send-form')).toBeHidden();
      expect(posts).toBe(2);
    });
  }

  for (const [label, name] of [
    ['empty', ''],
    ['whitespace-only', '   '],
  ] as const) {
    test(`asks for a name and sends nothing when the name is ${label}`, async ({ page }) => {
      test.setTimeout(60_000);
      await withConfiguredAccessKey(page);
      let posts = 0;
      await page.route('https://api.web3forms.com/submit', async (route) => {
        posts += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
      });
      await playToEnd(page);

      await page.getByTestId('trivia-send-name').fill(name);
      await page.getByTestId('trivia-send-button').click();

      await expect(page.getByTestId('trivia-send-error')).toContainText('Escribe tu nombre');
      await expect(page.getByTestId('trivia-send-button')).toBeEnabled();
      await expect(page.getByTestId('trivia-send-sent')).toBeHidden();
      expect(posts).toBe(0);
    });
  }

  test('silently ignores a filled honeypot: no request and no sent state', async ({ page }) => {
    test.setTimeout(60_000);
    await withConfiguredAccessKey(page);
    let posts = 0;
    await page.route('https://api.web3forms.com/submit', async (route) => {
      posts += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await playToEnd(page);

    await page.getByTestId('trivia-send-honeypot').fill('bot', { force: true });
    await page.getByTestId('trivia-send-name').fill('Camila Torres');
    await page.getByTestId('trivia-send-button').click();

    await expect(page.getByTestId('trivia-send-button')).toBeEnabled();
    await expect(page.getByTestId('trivia-send-sent')).toBeHidden();
    await expect(page.getByTestId('trivia-send-status')).toHaveText('');
    expect(posts).toBe(0);
  });
});
