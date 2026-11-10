import { test, expect } from '@playwright/test';
import { OPEN_INVITATION_EVENT } from '../src/lib/events';

// Confetti-burst fidelity: opening the invitation ("Abrir invitación") fires a one-shot silver
// paper burst on a dedicated overlay canvas. The canvas flags its state on `data-confetti`
// (fired/skipped) so the burst is observable without sampling pixels. The overlay must never
// intercept the open click itself, and reduced-motion guests get no burst at all.

test.describe('Confetti burst on open', () => {
  test('the overlay canvas is mounted idle before the invitation is opened', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/lu15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const confetti = page.getByTestId('confetti');
    await expect(confetti).toBeAttached();
    await expect(confetti).not.toHaveAttribute('data-confetti', 'fired');
  });

  test('clicking "Abrir invitación" fires the burst exactly once', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const confetti = page.getByTestId('confetti');
    await expect(confetti).toHaveAttribute('data-confetti', 'fired');
    // The one-shot guard: re-dispatching the open event must not rearm the burst. The canvas
    // reports how many bursts it has fired; a second open event must leave it at 1.
    await page.evaluate(
      (eventName) => window.dispatchEvent(new CustomEvent(eventName)),
      OPEN_INVITATION_EVENT,
    );
    await expect(confetti).toHaveAttribute('data-confetti-bursts', '1');
  });

  test('reduced-motion guests get no burst when opening', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const confetti = page.getByTestId('confetti');
    await expect(confetti).toHaveAttribute('data-confetti', 'skipped');
    await expect(confetti).not.toHaveAttribute('data-confetti', 'fired');
  });
});
