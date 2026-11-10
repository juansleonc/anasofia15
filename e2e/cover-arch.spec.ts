import { test, expect, type Page } from '@playwright/test';
import { ARCH_SPECS } from '../src/lib/cover-arch';

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

async function visibleSvgMask(page: Page): Promise<{ rect: Rect; maskImage: string }> {
  return page.evaluate(() => {
    const layouts = [...document.querySelectorAll('svg[data-arch-layout]')];
    const visible = layouts.find((svg) => getComputedStyle(svg).display !== 'none');
    if (!visible) return { rect: { x: 0, y: 0, width: 0, height: 0 }, maskImage: '' };
    const style = getComputedStyle(visible);
    const rect = visible.getBoundingClientRect();
    const maskImage =
      style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image');
    return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, maskImage };
  });
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

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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

  test('the visible layout includes every balloon, flower and leaf symbol', async ({ page }) => {
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const symbols = await visibleLayoutAttrs(page, 'data-arch-symbol');
      expect(symbols).toEqual(
        expect.arrayContaining([
          'balloon-pink',
          'balloon-rosegold',
          'balloon-rosegold-satin',
          'balloon-champagne',
          'balloon-champagne-satin',
          'rose-pink',
          'rose-cream',
          'peony-blush',
          'blossom',
          'leaf-eucalyptus',
          'leaf-olive',
          'leaf-gold',
        ]),
      );
    }
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

  test('no arch item overlaps the title or the button', async ({ page }) => {
    for (const viewport of [PHONE, { width: 390, height: 844 }, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const leadRect = await page.getByTestId('cover-title-lead').boundingBox();
      const nameRect = await page.getByTestId('cover-celebrant-name').boundingBox();
      const buttonRect = await page.getByRole('button', { name: 'Abrir invitación' }).boundingBox();
      expect(leadRect).not.toBeNull();
      expect(nameRect).not.toBeNull();
      expect(buttonRect).not.toBeNull();

      const targets = [leadRect, nameRect, buttonRect].filter((rect): rect is Rect => rect !== null);
      const archRects = await visibleItemRects(page);

      for (const archRect of archRects) {
        for (const target of targets) {
          expect(rectsIntersect(archRect, target)).toBe(false);
        }
      }
    }
  });

  test('side columns fade out instead of being cut', async ({ page }) => {
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const { rect: svgRect, maskImage } = await visibleSvgMask(page);
      expect(maskImage).toContain('linear-gradient');
      // "transparent" is normalized to its rgba() equivalent by the browser; the gradient must
      // still end fully transparent at the 100% stop (the old hard-clip line).
      expect(maskImage.endsWith('rgba(0, 0, 0, 0) 100%)')).toBe(true);

      const spec = viewport === PHONE ? ARCH_SPECS.portrait : ARCH_SPECS.landscape;
      const fadeStartPx = svgRect.y + svgRect.height * (spec.fadeStart / spec.height);

      const rects = await visibleItemRects(page);
      const leftStrip = viewport.width * 0.15;
      const rightStrip = viewport.width * 0.85;
      const outerItems = rects.filter((rect) => {
        const centerX = rect.x + rect.width / 2;
        return centerX <= leftStrip || centerX >= rightStrip;
      });

      expect(outerItems.some((rect) => rect.y + rect.height > fadeStartPx)).toBe(true);
    }
  });

  test('the arch stays bounded by the cover, with no horizontal overflow', async ({ page }) => {
    await page.goto('./');

    // With no frame to clip to, the arch is bounded by the cover itself instead.
    const coverBox = await page.getByTestId('cover').boundingBox();
    const archBox = await page.getByTestId('balloon-arch').boundingBox();
    expect(coverBox).not.toBeNull();
    expect(archBox).not.toBeNull();
    const EDGE_TOLERANCE_PX = 1;
    expect(archBox!.x).toBeGreaterThanOrEqual(coverBox!.x - EDGE_TOLERANCE_PX);
    expect(archBox!.x + archBox!.width).toBeLessThanOrEqual(
      coverBox!.x + coverBox!.width + EDGE_TOLERANCE_PX,
    );

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });

  test('the arch stays bounded by the cover bottom, with a soft end', async ({ page }) => {
    for (const viewport of [
      { width: 900, height: 1000 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const coverBox = await page.getByTestId('cover').boundingBox();
      const archBox = await page.getByTestId('balloon-arch').boundingBox();
      expect(coverBox).not.toBeNull();
      expect(archBox).not.toBeNull();

      const EDGE_TOLERANCE_PX = 1;
      expect(archBox!.y + archBox!.height).toBeLessThanOrEqual(
        coverBox!.y + coverBox!.height + EDGE_TOLERANCE_PX,
      );

      // Unlock the page (bypassing the click/animation) and scroll so the first viewport row below
      // the cover is on screen, then probe a point just under the cover's bottom edge: with no clip,
      // the tall arch still paints there and resolves to an arch descendant instead of whatever
      // section follows the cover in the document.
      const belowCoverHit = await page.evaluate((coverBottom) => {
        document.body.classList.remove('scroll-locked');
        window.scrollTo(0, coverBottom);
        const probeX = window.innerWidth / 2;
        const probeY = 5;
        const el = document.elementFromPoint(probeX, probeY);
        return el ? el.closest('[data-testid="balloon-arch"]') !== null : false;
      }, coverBox!.y + coverBox!.height);
      expect(belowCoverHit).toBe(false);

      const archMask = await page.getByTestId('balloon-arch').evaluate((el) => {
        const style = getComputedStyle(el);
        return style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image');
      });
      expect(archMask).toContain('linear-gradient');
    }
  });

  test('the arch casts one shadow, items cast none', async ({ page }) => {
    await page.goto('./');

    const containerFilter = await page
      .getByTestId('balloon-arch-shadow')
      .evaluate((el) => getComputedStyle(el).filter);
    expect(containerFilter).toContain('drop-shadow');

    const itemAndSvgFilters = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll('[data-arch-item], svg[data-arch-layout]'),
      ];
      return nodes.map((el) => getComputedStyle(el).filter);
    });
    expect(itemAndSvgFilters.length).toBeGreaterThan(0);
    expect(itemAndSvgFilters.every((value) => value === 'none')).toBe(true);

    const svgFilterElementCount = await page.evaluate(
      () => document.querySelectorAll('filter').length,
    );
    expect(svgFilterElementCount).toBe(0);
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
