import { test, expect } from '@playwright/test';

// Theme-fidelity smoke test: asserts the design tokens defined in src/styles/tokens.css resolve
// as real computed CSS custom properties on a rendered page, and that the self-hosted cursive
// font is actually applied to the representative name element (not just imported and unused).

test.describe('design tokens + fonts', () => {
  test('black/silver/gold custom properties resolve on the rendered page', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/lu15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        black: styles.getPropertyValue('--c-black').trim(),
        silver: styles.getPropertyValue('--c-silver').trim(),
        gold: styles.getPropertyValue('--c-gold').trim(),
      };
    });

    expect(tokens.black).toBe('#0a0a0f');
    expect(tokens.silver).toBe('#c9ccd1');
    expect(tokens.gold).toBe('#d4af37');
  });

  test('cursive font-family applies to the representative name element', async ({ page }) => {
    await page.goto('./');

    const name = page.getByTestId('cursive-name');
    await expect(name).toBeVisible();

    const fontFamily = await name.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Great Vibes');
  });
});
