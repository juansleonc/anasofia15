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

    for (const kind of ['fleck', 'star', 'bokeh']) {
      const count = await page.locator(`[data-sparkle="${kind}"]`).count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
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
