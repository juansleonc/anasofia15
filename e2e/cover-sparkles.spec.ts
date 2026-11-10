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

// Nov 2026 north-star pass: static gold confetti slivers — thin foil ribbons, a
// distinct kind from the round glow/star/bokeh glints above, never animated and never over text.
test.describe('Cover confetti slivers', () => {
  test('renders at most 8 slivers', async ({ page }) => {
    await page.goto('./');

    const count = await page.locator('[data-confetti="sliver"]').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
  });

  test('every sliver is static — animation-name is none', async ({ page }) => {
    await page.goto('./');

    const animationNames = await page
      .locator('[data-confetti="sliver"]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
    expect(animationNames.length).toBeGreaterThan(0);
    for (const name of animationNames) {
      expect(name).toBe('none');
    }
  });

  test('every sliver is a thin rotated span with an aspect ratio of at least 3:1', async ({
    page,
  }) => {
    await page.goto('./');

    const boxes = await page
      .locator('[data-confetti="sliver"]')
      .evaluateAll((elements) =>
        elements.map((el) => {
          const style = getComputedStyle(el);
          return { width: parseFloat(style.width), height: parseFloat(style.height) };
        }),
      );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      const [short, long] = [box.width, box.height].sort((a, b) => a - b);
      expect(long / short).toBeGreaterThanOrEqual(3);
    }
  });

  test('every sliver is painted as a champagne-gold foil gradient, not a flat fill', async ({
    page,
  }) => {
    await page.goto('./');

    const backgrounds = await page
      .locator('[data-confetti="sliver"]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).backgroundImage));
    expect(backgrounds.length).toBeGreaterThan(0);
    for (const backgroundImage of backgrounds) {
      expect(backgroundImage).toContain('gradient');
      // champagne-300 and champagne-500, from tokens.css.
      expect(backgroundImage).toMatch(/rgb\(230, 201, 154\)/);
      expect(backgroundImage).toMatch(/rgb\(205, 168, 105\)/);
    }
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1440, height: 800 },
  ]) {
    test(`no sliver intersects the lead, name or button box at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const leadBox = await page.getByTestId('cover-title-lead').boundingBox();
      const nameBox = await page.getByTestId('cover-celebrant-name').boundingBox();
      const buttonBox = await page.getByTestId('open-invitation-button').boundingBox();
      expect(leadBox).not.toBeNull();
      expect(nameBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();

      function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
        return (
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        );
      }

      const slivers = page.locator('[data-confetti="sliver"]');
      const count = await slivers.count();
      expect(count).toBeGreaterThan(0);

      let intersecting = 0;
      for (let i = 0; i < count; i++) {
        const box = await slivers.nth(i).boundingBox();
        if (
          box &&
          (intersects(box, leadBox!) || intersects(box, nameBox!) || intersects(box, buttonBox!))
        ) {
          intersecting++;
        }
      }
      expect(intersecting).toBe(0);
    });
  }
});
