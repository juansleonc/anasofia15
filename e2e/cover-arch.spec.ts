import { test, expect, type Page } from '@playwright/test';

// The decorative balloon-and-flower arch that frames the cover: two seeded SVG layouts, one per
// aspect ratio (see src/lib/cover-arch.ts for the geometry), with only one shown at a time via a
// CSS media query. Purely decorative — it carries no accessible content and must never sit above
// the page's real controls.

const PHONE = { width: 375, height: 667 };
const DESKTOP = { width: 1440, height: 800 };

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function visibleLayoutAttrs(page: Page, attr: string): Promise<(string | null)[]> {
  return page.evaluate((attribute) => {
    const layouts = [...document.querySelectorAll('svg[data-arch-layout]')];
    const visible = layouts.find((svg) => getComputedStyle(svg).display !== 'none');
    if (!visible) return [];
    return [...visible.querySelectorAll(`[${attribute}]`)].map((el) => el.getAttribute(attribute));
  }, attr);
}

async function visibleItemRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const layouts = [...document.querySelectorAll('svg[data-arch-layout]')];
    const visible = layouts.find((svg) => getComputedStyle(svg).display !== 'none');
    if (!visible) return [];
    return [...visible.querySelectorAll('[data-arch-item]')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
  });
}

test.describe('Balloon arch', () => {
  test('is hidden from assistive tech and never blocks pointer input', async ({ page }) => {
    await page.goto('./');

    const arch = page.getByTestId('balloon-arch');
    await expect(arch).toHaveAttribute('aria-hidden', 'true');
    await expect(arch).toHaveCSS('pointer-events', 'none');
  });

  test('shows only the portrait layout on a narrow phone', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('./');

    await expect(page.locator('[data-arch-layout="portrait"]')).toBeVisible();
    await expect(page.locator('[data-arch-layout="landscape"]')).toBeHidden();
  });

  test('shows only the landscape layout on a wide desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('./');

    await expect(page.locator('[data-arch-layout="landscape"]')).toBeVisible();
    await expect(page.locator('[data-arch-layout="portrait"]')).toBeHidden();
  });

  test('the visible layout includes all three balloon tones plus at least one flower and one leaf', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('./');

    const symbols = await visibleLayoutAttrs(page, 'data-arch-symbol');
    expect(symbols).toEqual(
      expect.arrayContaining(['balloon-pink', 'balloon-rosegold', 'balloon-champagne']),
    );

    const kinds = await visibleLayoutAttrs(page, 'data-arch-item');
    expect(kinds).toContain('flower');
    expect(kinds).toContain('leaf');
  });

  test('visible items touch the top strip and both outer side strips of the viewport', async ({
    page,
  }) => {
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const rects = await visibleItemRects(page);
      expect(rects.length).toBeGreaterThan(0);

      const topBand = viewport.height * 0.1;
      const leftStrip = viewport.width * 0.15;
      const rightStrip = viewport.width * 0.85;

      expect(rects.some((rect) => rect.y <= topBand)).toBe(true);
      expect(rects.some((rect) => rect.x <= leftStrip)).toBe(true);
      expect(rects.some((rect) => rect.x + rect.width >= rightStrip)).toBe(true);
    }
  });

  test('the cover loads with no raster image requests', async ({ page }) => {
    const imageRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(request.url())) {
        imageRequests.push(request.url());
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    expect(imageRequests).toEqual([]);
  });
});
