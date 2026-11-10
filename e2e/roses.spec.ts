import { test, expect } from '@playwright/test';

// The rose sprite sheet (`RoseSprite.astro`) must be mounted exactly once per page so every
// `rose-bloom`/`rose-bud`/`rose-leaf` id it defines is unique in the document, and it must stay
// invisible to both sighted layout and assistive tech — it exists purely so `Rose.astro`
// instances elsewhere on the page can reference its shapes via `<use>`.

test.describe('Rose sprite', () => {
  test('defines each rose symbol id exactly once', async ({ page }) => {
    await page.goto('./');

    const idCounts = await page.evaluate(() => {
      const ids = ['rose-bloom', 'rose-bud', 'rose-leaf'];
      return Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`#${id}`).length]),
      );
    });

    expect(idCounts).toEqual({ 'rose-bloom': 1, 'rose-bud': 1, 'rose-leaf': 1 });
  });

  test('is hidden from layout and from assistive tech', async ({ page }) => {
    await page.goto('./');

    const sprite = page.getByTestId('rose-sprite');
    await expect(sprite).toHaveAttribute('aria-hidden', 'true');

    const box = await sprite.boundingBox();
    expect(box?.width ?? -1).toBe(0);
    expect(box?.height ?? -1).toBe(0);
  });
});

test.describe('Arch sprite', () => {
  test('defines each arch symbol id exactly once', async ({ page }) => {
    await page.goto('./');

    const idCounts = await page.evaluate(() => {
      const ids = [
        'balloon-pink',
        'balloon-rosegold',
        'balloon-rosegold-satin',
        'balloon-champagne',
        'balloon-champagne-satin',
        'balloon-gloss',
        'rose-pink',
        'rose-cream',
        'peony-blush',
        'peony-ivory',
        'blossom',
        'leaf-eucalyptus',
        'leaf-olive',
        'leaf-gold',
        'leaf-laurel-cluster',
        'sparkle-star',
      ];
      return Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`#${id}`).length]),
      );
    });

    expect(idCounts).toEqual({
      'balloon-pink': 1,
      'balloon-rosegold': 1,
      'balloon-rosegold-satin': 1,
      'balloon-champagne': 1,
      'balloon-champagne-satin': 1,
      'balloon-gloss': 1,
      'rose-pink': 1,
      'rose-cream': 1,
      'peony-blush': 1,
      'peony-ivory': 1,
      blossom: 1,
      'leaf-eucalyptus': 1,
      'leaf-olive': 1,
      'leaf-gold': 1,
      'leaf-laurel-cluster': 1,
      'sparkle-star': 1,
    });
  });

  test('is hidden from layout and from assistive tech', async ({ page }) => {
    await page.goto('./');

    const sprite = page.getByTestId('arch-sprite');
    await expect(sprite).toHaveAttribute('aria-hidden', 'true');

    const box = await sprite.boundingBox();
    expect(box?.width ?? -1).toBe(0);
    expect(box?.height ?? -1).toBe(0);
  });
});

// Real-geometry check of the arch roses, complementing the path-parsing unit tests: the symbol's
// shapes are cloned into a visible probe <svg> so the browser can measure them with their actual
// transforms and curves.
test.describe('Arch roses render as round blooms', () => {
  for (const id of ['rose-pink', 'rose-cream']) {
    test(`${id} has a near-circular outline`, async ({ page }) => {
      await page.goto('./');

      const result = await page.evaluate((symbolId) => {
        const NS = 'http://www.w3.org/2000/svg';
        const symbol = document.getElementById(symbolId)!;
        const probe = document.createElementNS(NS, 'svg');
        probe.setAttribute('viewBox', symbol.getAttribute('viewBox') ?? '0 0 64 64');
        probe.setAttribute('width', '256');
        probe.setAttribute('height', '256');
        probe.style.cssText = 'position:fixed;left:0;top:0';
        for (const child of Array.from(symbol.children)) probe.appendChild(child.cloneNode(true));
        document.body.appendChild(probe);

        const petals = Array.from(probe.querySelectorAll('path')).filter((path) => (path.getAttribute('fill') ?? '').startsWith(`url(#${symbolId}-`));
        const rects = petals.map((petal) => petal.getBoundingClientRect());
        const width = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
        const height = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
        probe.remove();
        return { petals: petals.length, aspect: width / height };
      }, id);

      expect(result.petals).toBeGreaterThanOrEqual(12);
      expect(result.aspect).toBeGreaterThanOrEqual(0.85);
      expect(result.aspect).toBeLessThanOrEqual(1.15);
    });
  }
});
