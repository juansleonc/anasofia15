import { test, expect } from '@playwright/test';

// Durable mobile/overflow sweep (T21): the whole-page version of the per-section overflow checks
// earlier sections added ad hoc (e.g. album.spec.ts). Asserts a hard 375px viewport never
// produces horizontal scroll, both for the page as shipped AND when it's stress-tested with
// unusually long user-supplied content (a long RSVP name + a long suggested song), since those
// are the two free-text fields a real guest controls.

const LONG_NAME =
  'Maria Fernanda Alejandra Gutierrez Rodriguez de la Santisima Trinidad y Montenegro';
const LONG_SONG =
  'Un tema con un titulo extremadamente largo que en teoria podria romper el layout en un telefono muy angosto de 375 pixeles de ancho';

test.describe('Mobile / overflow sweep (375px)', () => {
  test('the whole page has no horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('./');

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('stays overflow-free with a long RSVP name and long suggested song', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // The cover gates scroll until opened — unlock it before reaching the RSVP fields below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await page.getByTestId('rsvp-name-input').fill(LONG_NAME);
    await page.getByTestId('rsvp-song-input').fill(LONG_SONG);
    await page.getByTestId('rsvp-attending-yes').click();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
