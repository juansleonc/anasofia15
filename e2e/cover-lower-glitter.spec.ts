import { test, expect } from '@playwright/test';

// Lower-half atmosphere: a soft glitter band (twinkling light flecks + a few static bokeh
// discs), a faint static dust texture, and a warm light pool — all below the button, purely
// decorative.

test.describe('Cover lower glitter', () => {
  test('is decorative and never intercepts clicks', async ({ page }) => {
    await page.goto('./');

    const atmosphere = page.getByTestId('cover-lower-atmosphere');
    await expect(atmosphere).toHaveAttribute('aria-hidden', 'true');

    const pointerEvents = await atmosphere.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1440, height: 800 },
  ]) {
    test(`renders at least 10 particles with centers in the lower half of the cover at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const coverBox = await page.getByTestId('cover').boundingBox();
      expect(coverBox).not.toBeNull();
      const midY = coverBox!.y + coverBox!.height / 2;

      const particles = page.locator('[data-lower-sparkle]');
      const count = await particles.count();
      expect(count).toBeGreaterThanOrEqual(10);

      let lowerHalfCount = 0;
      for (let i = 0; i < count; i++) {
        const box = await particles.nth(i).boundingBox();
        if (box && box.y + box.height / 2 >= midY) lowerHalfCount++;
      }
      expect(lowerHalfCount).toBeGreaterThanOrEqual(10);
    });
  }

  test('keeps running flakes at or under budget for the twinkling-element cap', async ({
    page,
  }) => {
    await page.goto('./');

    const flakeAnimations = await page
      .locator('[data-lower-sparkle="flake"]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).animationName));
    expect(flakeAnimations.length).toBeGreaterThan(0);
    const running = flakeAnimations.filter((name) => name !== 'none').length;
    expect(running).toBeLessThanOrEqual(6);
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1440, height: 800 },
  ]) {
    test(`leaves the name and button boxes entirely clear of particles at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const nameBox = await page.getByTestId('cover-celebrant-name').boundingBox();
      const buttonBox = await page.getByTestId('open-invitation-button').boundingBox();
      expect(nameBox).not.toBeNull();
      expect(buttonBox).not.toBeNull();

      // Button is padded by 12px on every side, per the contract.
      const buttonPad = 12;
      const paddedButtonBox = {
        x: buttonBox!.x - buttonPad,
        y: buttonBox!.y - buttonPad,
        width: buttonBox!.width + buttonPad * 2,
        height: buttonBox!.height + buttonPad * 2,
      };

      function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
        return (
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        );
      }

      const particles = page.locator('[data-lower-sparkle]');
      const count = await particles.count();
      let intersecting = 0;
      for (let i = 0; i < count; i++) {
        const box = await particles.nth(i).boundingBox();
        if (box && (intersects(box, nameBox!) || intersects(box, paddedButtonBox))) intersecting++;
      }
      expect(intersecting).toBe(0);
    });
  }

  test('never renders a hard-edged square chip — every particle is a round radial-gradient glow', async ({
    page,
  }) => {
    await page.goto('./');

    const particles = await page
      .locator('[data-lower-sparkle]')
      .evaluateAll((elements) =>
        elements.map((el) => ({
          borderRadius: getComputedStyle(el).borderRadius,
          backgroundImage: getComputedStyle(el).backgroundImage,
        })),
      );
    expect(particles.length).toBeGreaterThanOrEqual(1);
    for (const particle of particles) {
      expect(particle.borderRadius).not.toBe('0px');
      expect(particle.backgroundImage).toContain('radial-gradient');
    }
  });

  test('a faint static dust texture exists over the lower cover, at or under 8% opacity', async ({
    page,
  }) => {
    await page.goto('./');

    const texture = page.getByTestId('cover-lower-texture');
    await expect(texture).toHaveCount(1);

    const opacity = await texture.evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(0.08);

    const animationName = await texture.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe('none');
  });

  test('a warm light pool sits at the bottom centre of the cover', async ({ page }) => {
    await page.goto('./');

    const pool = page.getByTestId('cover-lower-light-pool');
    await expect(pool).toHaveCount(1);

    const backgroundImage = await pool.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(backgroundImage).toContain('radial-gradient');

    const coverBox = await page.getByTestId('cover').boundingBox();
    const poolBox = await pool.boundingBox();
    expect(coverBox).not.toBeNull();
    expect(poolBox).not.toBeNull();
    // Anchored toward the bottom of the cover, not floating near the top.
    expect(poolBox!.y + poolBox!.height).toBeGreaterThan(coverBox!.y + coverBox!.height * 0.6);
  });

  test('twinkling flecks freeze under prefers-reduced-motion, bokeh/texture stay static either way', async ({
    page,
  }) => {
    await page.goto('./');

    const runningByDefault = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-lower-sparkle="flake"]');
      return [...items].filter((el) => getComputedStyle(el).animationName !== 'none').length;
    });
    expect(runningByDefault).toBeGreaterThanOrEqual(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const stillAnimated = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-lower-sparkle]');
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
