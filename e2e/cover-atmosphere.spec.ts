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

  test('holds 12 foil ribbons and no falling glitter specks', async ({ page }) => {
    await page.goto('./');

    await expect(page.locator('[data-confetti="ribbon"]')).toHaveCount(12);
    await expect(page.locator('[data-confetti="glitter"]')).toHaveCount(0);
  });

  test('ribbons are champagne foil at least 3:1', async ({ page }) => {
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
    expect(pieces).toHaveLength(12);
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

type Box = { x: number; y: number; width: number; height: number };

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function textBoxes(page: import('@playwright/test').Page): Promise<Box[]> {
  const boxes = await Promise.all(
    ['cover-title-lead', 'cover-celebrant-name', 'open-invitation-button'].map((id) =>
      page.getByTestId(id).boundingBox(),
    ),
  );
  for (const box of boxes) expect(box).not.toBeNull();
  return boxes as Box[];
}

const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 1440, height: 800 },
];

test.describe('Cover bokeh', () => {
  test('at least 6 static round radial discs of 30-70px', async ({ page }) => {
    await page.goto('./');

    const discs = await page.locator('[data-bokeh]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return {
          width: parseFloat(style.width),
          height: parseFloat(style.height),
          borderRadius: style.borderRadius,
          backgroundImage: style.backgroundImage,
          animationName: style.animationName,
        };
      }),
    );
    expect(discs.length).toBeGreaterThanOrEqual(6);
    for (const disc of discs) {
      expect(disc.width).toBeGreaterThanOrEqual(30);
      expect(disc.width).toBeLessThanOrEqual(70);
      expect(disc.height).toBe(disc.width);
      expect(disc.borderRadius).toBe('50%');
      expect(disc.backgroundImage).toContain('radial-gradient');
      expect(disc.animationName).toBe('none');
    }
  });

  for (const viewport of VIEWPORTS) {
    test(`no bokeh disc covers the lead, name or button at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);

      const text = await textBoxes(page);
      const discs = await page
        .locator('[data-bokeh]')
        .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
      expect(discs.length).toBeGreaterThanOrEqual(6);
      const overlapping = discs.filter((disc) => text.some((box) => intersects(disc, box)));
      expect(overlapping).toEqual([]);
    });
  }
});

test.describe('Cover light flares', () => {
  test('three static, hidden 4-point flares of 44-70px', async ({ page }) => {
    await page.goto('./');

    const flares = await page.locator('[data-flare]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return {
          hidden: el.closest('[aria-hidden="true"]') !== null,
          width: parseFloat(style.width),
          animationName: style.animationName,
          gradients: style.backgroundImage.match(/[a-z-]+-gradient\(/g) ?? [],
        };
      }),
    );
    expect(flares).toHaveLength(3);
    for (const flare of flares) {
      expect(flare.hidden).toBe(true);
      expect(flare.animationName).toBe('none');
      expect(flare.width).toBeGreaterThanOrEqual(44);
      expect(flare.width).toBeLessThanOrEqual(70);
      expect(flare.gradients).toEqual(['radial-gradient(', 'linear-gradient(', 'linear-gradient(']);
    }
  });

  for (const viewport of VIEWPORTS) {
    test(`flares sit on the garland, clear of the text, at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);

      const text = await textBoxes(page);
      const coverBox = await page.getByTestId('cover').boundingBox();
      expect(coverBox).not.toBeNull();
      const flares = await page
        .locator('[data-flare]')
        .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().toJSON()));
      expect(flares).toHaveLength(3);
      for (const flare of flares) {
        const centerY = flare.y + flare.height / 2 - coverBox!.y;
        expect(centerY).toBeLessThanOrEqual(0.3 * coverBox!.height);
        expect(text.some((box) => intersects(flare, box))).toBe(false);
      }
    });
  }
});

test.describe('Cover drifting light', () => {
  test('holds 6 glitter, 3 star and 3 bokeh drift particles, hidden via the layer', async ({
    page,
  }) => {
    await page.goto('./');

    await expect(page.locator('[data-drift="glitter"]')).toHaveCount(6);
    await expect(page.locator('[data-drift="star"]')).toHaveCount(3);
    await expect(page.locator('[data-drift="bokeh"]')).toHaveCount(3);

    const hidden = await page
      .locator('[data-drift]')
      .evaluateAll((elements) => elements.map((el) => el.closest('[aria-hidden="true"]') !== null));
    expect(hidden.every(Boolean)).toBe(true);
  });

  test('drifts by default, animating only transform and opacity', async ({ page }) => {
    await page.goto('./');

    const result = await page.locator('[data-drift]').evaluateAll((elements) => {
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

  for (const viewport of VIEWPORTS) {
    test(`spawns along the garland arc, centred at y in [26%, 40%] of the cover at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const spawnYs = await page
        .locator('[data-drift]')
        .evaluateAll((elements) =>
          elements.map((el) =>
            parseFloat(getComputedStyle(el).getPropertyValue('--drift-y')),
          ),
        );
      expect(spawnYs).toHaveLength(12);
      for (const yPct of spawnYs) {
        expect(yPct).toBeGreaterThanOrEqual(26);
        expect(yPct).toBeLessThanOrEqual(40);
      }
    });
  }

  test('each drift vector points toward the centre of the text block', async ({ page }) => {
    await page.goto('./');

    const vectors = await page.locator('[data-drift]').evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return {
          xPct: parseFloat(style.getPropertyValue('--drift-x')),
          dx: parseFloat(style.getPropertyValue('--drift-dx')),
          dy: parseFloat(style.getPropertyValue('--drift-dy')),
        };
      }),
    );
    expect(vectors).toHaveLength(12);
    for (const vector of vectors) {
      expect(vector.dy).toBeGreaterThan(0);
      if (vector.dx !== 0) {
        expect(Math.sign(vector.dx)).toBe(Math.sign(50 - vector.xPct));
      }
    }
  });

  test('never uses a CSS filter', async ({ page }) => {
    await page.goto('./');

    const filters = await page
      .locator('[data-drift]')
      .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).filter));
    expect(filters).toHaveLength(12);
    for (const filter of filters) {
      expect(filter).toBe('none');
    }
  });

  test('does not cause horizontal overflow at 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    await expect(page.locator('[data-drift]').first()).toBeAttached();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });
});

test.describe('Cover page edge', () => {
  test('the cover reaches the screen edges at 1440x800', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('./');

    const coverBox = await page.getByTestId('cover').boundingBox();
    expect(coverBox).not.toBeNull();
    expect(coverBox!.x).toBe(0);
    expect(coverBox!.y).toBe(0);
    expect(coverBox!.width).toBe(1440);
  });
});
