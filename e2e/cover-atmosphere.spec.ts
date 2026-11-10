import { test, expect } from '@playwright/test';

// Festive atmosphere over the cover: gold foil ribbons and glitter falling gently from the
// garland, purely decorative and cheap to animate.

test.describe('Cover falling confetti', () => {
  test('is decorative and bounded by the cover', async ({ page }) => {
    await page.goto('./');

    const confetti = page.getByTestId('cover-confetti');
    await expect(confetti).toHaveAttribute('aria-hidden', 'true');
    const styles = await confetti.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { pointerEvents: computed.pointerEvents, overflow: computed.overflow };
    });
    expect(styles.pointerEvents).toBe('none');
    expect(styles.overflow).toBe('hidden');

    const coverBox = await page.getByTestId('cover').boundingBox();
    const confettiBox = await confetti.boundingBox();
    expect(coverBox).not.toBeNull();
    expect(confettiBox).not.toBeNull();
    expect(Math.abs(confettiBox!.x - coverBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(confettiBox!.width - coverBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(confettiBox!.height - coverBox!.height)).toBeLessThanOrEqual(1);
  });

  test('holds 12 foil ribbons and 6 glitter specks', async ({ page }) => {
    await page.goto('./');

    await expect(page.locator('[data-confetti="ribbon"]')).toHaveCount(12);
    await expect(page.locator('[data-confetti="glitter"]')).toHaveCount(6);
  });

  test('ribbons are champagne foil at least 3:1, glitter is a soft round radial', async ({
    page,
  }) => {
    await page.goto('./');

    const ribbons = await page.locator('[data-confetti="ribbon"]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return {
          width: parseFloat(style.width),
          height: parseFloat(style.height),
          backgroundImage: style.backgroundImage,
        };
      }),
    );
    expect(ribbons).toHaveLength(12);
    for (const ribbon of ribbons) {
      expect(ribbon.height / ribbon.width).toBeGreaterThanOrEqual(3);
      expect(ribbon.backgroundImage).toContain('linear-gradient');
      // champagne-300, champagne-500 and champagne-700, from tokens.css.
      expect(ribbon.backgroundImage).toContain('rgb(230, 201, 154)');
      expect(ribbon.backgroundImage).toContain('rgb(205, 168, 105)');
    }

    const glitter = await page.locator('[data-confetti="glitter"]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return { borderRadius: style.borderRadius, backgroundImage: style.backgroundImage };
      }),
    );
    expect(glitter).toHaveLength(6);
    for (const speck of glitter) {
      expect(speck.borderRadius).toBe('50%');
      expect(speck.backgroundImage).toContain('radial-gradient');
    }
  });

  test('falls by default, animating only transform and opacity', async ({ page }) => {
    await page.goto('./');

    const result = await page.locator('[data-confetti]').evaluateAll((elements) => {
      const running = elements.filter((el) => getComputedStyle(el).animationName !== 'none');
      const properties = new Set<string>();
      for (const el of running) {
        for (const animation of el.getAnimations()) {
          const effect = animation.effect as KeyframeEffect;
          for (const keyframe of effect.getKeyframes()) {
            for (const key of Object.keys(keyframe)) {
              if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) {
                properties.add(key);
              }
            }
          }
        }
      }
      return { running: running.length, properties: [...properties].sort() };
    });

    expect(result.running).toBeGreaterThanOrEqual(1);
    expect(result.properties.length).toBeGreaterThan(0);
    for (const property of result.properties) {
      expect(['opacity', 'transform']).toContain(property);
    }
  });

  test('stops falling under reduced motion but stays visible', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const pieces = await page.locator('[data-confetti]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return { animationName: style.animationName, opacity: parseFloat(style.opacity) };
      }),
    );
    expect(pieces).toHaveLength(18);
    for (const piece of pieces) {
      expect(piece.animationName).toBe('none');
      expect(piece.opacity).toBeGreaterThan(0);
    }
  });

  test('does not cause horizontal overflow at 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    await expect(page.locator('[data-confetti]').first()).toBeAttached();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });
});
