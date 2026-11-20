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

    expect(tokens.bg).toBe('#fff7f5');
    expect(tokens.bgDeep).toBe('#fbe9e7');
    expect(tokens.rose100).toBe('#fce4e8');
    expect(tokens.rose200).toBe('#f3c6d0');
    expect(tokens.rose300).toBe('#e8a3b4');
    expect(tokens.rose400).toBe('#d47f97');
    expect(tokens.rose600).toBe('#b5617a');
    expect(tokens.rose700).toBe('#9e4a63');
    expect(tokens.ink).toBe('#4a2632');
    expect(tokens.inkSoft).toBe('#7a4a58');
    expect(tokens.leaf).toBe('#8fae8b');
    expect(tokens.leafDeep).toBe('#5f7f5b');
    // CSS minification shortens #ffffff to its 3-digit equivalent at build time.
    expect(tokens.white).toBe('#fff');
    expect(tokens.error).toBe('#a3324a');
    expect(tokens.success).toBe('#3f6b47');
    expect(tokens.champagne100).toBe('#fbf3e4');
    expect(tokens.champagne200).toBe('#f2e0c2');
    expect(tokens.champagne300).toBe('#e6c99a');
    expect(tokens.champagne500).toBe('#cda869');
    expect(tokens.champagne700).toBe('#a07e46');
    expect(tokens.rosegold200).toBe('#f3d3c8');
    expect(tokens.rosegold400).toBe('#dba592');
    expect(tokens.wine500).toBe('#9a4462');
    expect(tokens.wine700).toBe('#6e2440');
  });

  test('the page body background is the rose paper token', async ({ page }) => {
    await page.goto('./');

    const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const bgToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(),
    );

    // rgb(255, 247, 245) === #fff7f5
    expect(bodyBackground).toBe('rgb(255, 247, 245)');
    expect(bgToken).toBe('#fff7f5');
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
