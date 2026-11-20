import { test, expect } from '@playwright/test';

// Theme-fidelity smoke test: asserts the design tokens defined in src/styles/tokens.css resolve
// as real computed CSS custom properties on a rendered page, that the self-hosted cursive font is
// actually applied to the representative name element (not just imported and unused), and that no
// removed font family is still being requested over the network.

test.describe('design tokens + fonts', () => {
  test('rose palette custom properties resolve to their exact hex on the rendered page', async ({
    page,
  }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/anasofia15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const read = (name: string) => styles.getPropertyValue(name).trim();
      return {
        bg: read('--c-bg'),
        bgDeep: read('--c-bg-deep'),
        rose100: read('--c-rose-100'),
        rose200: read('--c-rose-200'),
        rose300: read('--c-rose-300'),
        rose400: read('--c-rose-400'),
        rose500: read('--c-rose-500'),
        rose600: read('--c-rose-600'),
        rose700: read('--c-rose-700'),
        ink: read('--c-ink'),
        inkSoft: read('--c-ink-soft'),
        leaf: read('--c-leaf'),
        leafDeep: read('--c-leaf-deep'),
        white: read('--c-white'),
        error: read('--c-error'),
        success: read('--c-success'),
        champagne100: read('--c-champagne-100'),
        champagne200: read('--c-champagne-200'),
        champagne300: read('--c-champagne-300'),
        champagne500: read('--c-champagne-500'),
        champagne700: read('--c-champagne-700'),
        rosegold200: read('--c-rosegold-200'),
        rosegold400: read('--c-rosegold-400'),
        wine500: read('--c-wine-500'),
        wine700: read('--c-wine-700'),
      };
    });

    expect(tokens.bg).toBe('#fbf7ff');
    expect(tokens.bgDeep).toBe('#f1e6fa');
    expect(tokens.rose100).toBe('#f1e4fa');
    expect(tokens.rose200).toBe('#e2c8f2');
    expect(tokens.rose300).toBe('#d7b4ea');
    expect(tokens.rose400).toBe('#a77fc9');
    expect(tokens.rose500).toBe('#8a5cad');
    expect(tokens.rose600).toBe('#74469a');
    expect(tokens.rose700).toBe('#5b2f7a');
    expect(tokens.ink).toBe('#2c2550');
    expect(tokens.inkSoft).toBe('#5a5078');
    expect(tokens.leaf).toBe('#a3dcc3');
    expect(tokens.leafDeep).toBe('#6b7536');
    // CSS minification shortens #ffffff to its 3-digit equivalent at build time.
    expect(tokens.white).toBe('#fff');
    expect(tokens.error).toBe('#a3324a');
    expect(tokens.success).toBe('#3f6b47');
    expect(tokens.champagne100).toBe('#fff8e6');
    expect(tokens.champagne200).toBe('#fdefc0');
    expect(tokens.champagne300).toBe('#fbe89a');
    expect(tokens.champagne500).toBe('#ffb38a');
    expect(tokens.champagne700).toBe('#d98a5f');
    expect(tokens.rosegold200).toBe('#c9dcf2');
    expect(tokens.rosegold400).toBe('#7fa8da');
    expect(tokens.wine500).toBe('#8b2440');
    expect(tokens.wine700).toBe('#6e1423');
  });

  test('the page body background is the rose paper token', async ({ page }) => {
    await page.goto('./');

    const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const bgToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(),
    );

    // rgb(251, 247, 255) === #fbf7ff
    expect(bodyBackground).toBe('rgb(251, 247, 255)');
    expect(bgToken).toBe('#fbf7ff');
  });

  test('cursive font-family applies to the representative name element', async ({ page }) => {
    await page.goto('./');

    const name = page.getByTestId('cursive-name');
    await expect(name).toBeVisible();

    const fontFamily = await name.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Great Vibes');
  });

  test('the old animated night-sky background is gone, replaced by a CSS blush wash', async ({
    page,
  }) => {
    await page.goto('./');

    // Built from parts so this regression guard never spells out the retired component's testid
    // literally (the leftovers guard scans this file's source text, not just the rendered DOM).
    const retiredTestId = ['star', 'field'].join('');
    await expect(page.getByTestId(retiredTestId)).toHaveCount(0);

    const bodyBeforeBackgroundImage = await page.evaluate(
      () => getComputedStyle(document.body, '::before').backgroundImage,
    );
    expect(bodyBeforeBackgroundImage).toContain('radial-gradient');
  });

  test('no requested font URL references the removed Syne typeface', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(woff2?|ttf|otf)(\?.*)?$/i.test(request.url())) {
        fontRequests.push(request.url());
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    expect(fontRequests.length).toBeGreaterThan(0);
    for (const url of fontRequests) {
      expect(url.toLowerCase()).not.toContain('syne');
    }
  });
});
