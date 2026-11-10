import { test, expect } from '@playwright/test';

// Idle decorative sparkles/bokeh scattered across the whole cover (including behind the text),
// bounded by the cover itself (no frame to clip to). Purely decorative — aria-hidden and
// pointer-events: none — so they carry no accessible content and never intercept clicks on the
// title/button.

test.describe('Cover sparkles', () => {
  test('the sparkle layer is decorative and stays bounded by the cover', async ({ page }) => {
    await page.goto('./');

    const sparkles = page.getByTestId('cover-sparkles');
    await expect(sparkles).toHaveAttribute('aria-hidden', 'true');

    const pointerEvents = await sparkles.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');

    const coverBox = await page.getByTestId('cover').boundingBox();
    const sparklesBox = await sparkles.boundingBox();
    expect(coverBox).not.toBeNull();
    expect(sparklesBox).not.toBeNull();
    const EDGE_TOLERANCE_PX = 1;
    expect(sparklesBox!.x).toBeGreaterThanOrEqual(coverBox!.x - EDGE_TOLERANCE_PX);
    expect(sparklesBox!.x + sparklesBox!.width).toBeLessThanOrEqual(
      coverBox!.x + coverBox!.width + EDGE_TOLERANCE_PX,
    );

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });

  test('scatters all three sparkle kinds', async ({ page }) => {
    await page.goto('./');

    for (const kind of ['glow', 'star', 'bokeh']) {
      const count = await page.locator(`[data-sparkle="${kind}"]`).count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('never renders a hard-edged square chip — glow and bokeh are round discs', async ({
    page,
  }) => {
    await page.goto('./');

    // Stars are a 4-point SVG silhouette (shape comes from the path, not the box), so only the
    // plain-box kinds — glow and bokeh — need to be round themselves.
    const items = await page
      .locator('[data-sparkle="glow"], [data-sparkle="bokeh"]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).borderRadius));
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const borderRadius of items) {
      expect(borderRadius).not.toBe('0px');
    }
  });

  test('every glow dot renders as a radial-gradient light, never a flat chip', async ({ page }) => {
    await page.goto('./');

    const glowBackgrounds = await page
      .locator('[data-sparkle="glow"]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundImage));
    expect(glowBackgrounds.length).toBeGreaterThanOrEqual(1);
    for (const backgroundImage of glowBackgrounds) {
      expect(backgroundImage).toContain('radial-gradient');
    }
  });

  test('every star has a soft blurred halo behind it', async ({ page }) => {
    await page.goto('./');

    const stars = page.locator('[data-sparkle="star"]');
    const starCount = await stars.count();
    expect(starCount).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < starCount; i++) {
      const halo = stars.nth(i).locator('.cover-sparkles__halo');
      await expect(halo).toHaveCount(1);
      const haloBackground = await halo.evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(haloBackground).toContain('radial-gradient');
    }
  });

  test('keeps the idle scatter at or under 28 particles for a calmer, organized look', async ({
    page,
  }) => {
    await page.goto('./');

    const count = await page.locator('[data-sparkle]').count();
    expect(count).toBeLessThanOrEqual(28);
  });

  test('sparkles twinkle by default and freeze under prefers-reduced-motion', async ({ page }) => {
    await page.goto('./');

    const runningByDefault = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-sparkle]');
      return [...items].filter((el) => getComputedStyle(el).animationName !== 'none').length;
    });
    expect(runningByDefault).toBeGreaterThanOrEqual(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const stillAnimated = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-sparkle]');
      return [...items].filter((el) => getComputedStyle(el).animationName !== 'none').length;
    });
    expect(stillAnimated).toBe(0);
  });

  test('does not cause horizontal overflow at 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });
});
