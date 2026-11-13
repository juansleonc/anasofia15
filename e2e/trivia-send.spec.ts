import { test, expect, type Page } from '@playwright/test';
import { triviaQuestions } from '../src/data/trivia';
import { RSVP_GUARD_STORAGE_KEY } from '../src/lib/rsvp';
import { withConfiguredAccessKey } from './web3forms-seam';

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
});
