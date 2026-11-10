import { test, expect } from '@playwright/test';
import { OPEN_INVITATION_EVENT } from '../src/lib/events';

// Petal-fall shower on open replaces the old confetti burst. The overlay reports its state on
// `data-petals` (fired/skipped) and `data-petal-showers` for test observability, and must never
// intercept pointer input.

test.describe('Petal fall on open', () => {
  test('the overlay is mounted idle before the invitation is opened', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/anasofia15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const petalFall = page.getByTestId('petal-fall');
    await expect(petalFall).toBeAttached();
    await expect(petalFall).not.toHaveAttribute('data-petals', /.+/);
    await expect(petalFall.locator('> *')).toHaveCount(0);
  });

  test('the overlay never intercepts pointer input', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByTestId('petal-fall')).toHaveCSS('pointer-events', 'none');
  });

  test('clicking "Abrir invitación" fires a petal shower exactly once', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const petalFall = page.getByTestId('petal-fall');
    await expect(petalFall).toHaveAttribute('data-petals', 'fired');
    const count = await petalFall.locator('> *').count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(petalFall).toHaveAttribute('data-petal-showers', '1');

    // The one-shot guard: re-dispatching the open event must not rearm the shower.
    await page.evaluate(
      (eventName) => window.dispatchEvent(new CustomEvent(eventName)),
      OPEN_INVITATION_EVENT,
    );
    await expect(petalFall).toHaveAttribute('data-petal-showers', '1');
  });

  test('reduced-motion guests get no shower when opening', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const petalFall = page.getByTestId('petal-fall');
    await expect(petalFall).toHaveAttribute('data-petals', 'skipped');
    await expect(petalFall.locator('> *')).toHaveCount(0);
    await expect(petalFall.locator('.petal-fall__petal')).toHaveCount(0);
    await expect(petalFall.locator('.petal-fall__fleck')).toHaveCount(0);
  });

  test('the shower mixes rose petals with gold flecks colored from the champagne palette', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const petalFall = page.getByTestId('petal-fall');
    const petals = petalFall.locator('.petal-fall__petal');
    const flecks = petalFall.locator('.petal-fall__fleck');
    expect(await petals.count()).toBeGreaterThanOrEqual(1);
    expect(await flecks.count()).toBeGreaterThanOrEqual(1);

    const champagneTokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return ['--c-champagne-300', '--c-champagne-500', '--c-champagne-700'].map((name) =>
        styles.getPropertyValue(name).trim(),
      );
    });

    const fleckColors = await flecks.evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).getPropertyValue('--petal-color').trim()),
    );
    expect(fleckColors.length).toBeGreaterThanOrEqual(1);
    for (const color of fleckColors) {
      expect(champagneTokens).toContain(color);
    }
  });

  test('petals are cleared from the DOM once the shower settles', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const petalFall = page.getByTestId('petal-fall');
    await expect(petalFall.locator('> *').first()).toBeAttached();

    await expect
      .poll(async () => petalFall.locator('> *').count(), { timeout: 12000 })
      .toBe(0);
  });
});
