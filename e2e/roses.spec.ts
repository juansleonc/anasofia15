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
        'blossom',
        'leaf-eucalyptus',
        'leaf-gold',
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
      blossom: 1,
      'leaf-eucalyptus': 1,
      'leaf-gold': 1,
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
