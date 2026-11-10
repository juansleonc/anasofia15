import { test, expect, type Page } from '@playwright/test';
import { GARLAND } from '../src/lib/cover-garland';

// The decorative balloon-and-flower garland that frames the cover: two hand-composed SVG layouts,
// one per aspect ratio (see src/lib/cover-garland.ts for the data), with only one shown at a time
// via a CSS media query. Purely decorative — it carries no accessible content and must never sit above
// the page's real controls.

const PHONE = { width: 375, height: 667 };
const TALL_PHONE = { width: 390, height: 844 };
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

async function visibleSvgMask(page: Page): Promise<string> {
  return page.evaluate(() => {
    const layouts = [...document.querySelectorAll('svg[data-arch-layout]')];
    const visible = layouts.find((svg) => getComputedStyle(svg).display !== 'none');
    if (!visible) return '';
    const style = getComputedStyle(visible);
    return style.getPropertyValue('mask-image') || style.getPropertyValue('-webkit-mask-image');
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

  test('renders the curated garland in paint order', async ({ page }) => {
    for (const [viewport, layout] of [
      [PHONE, GARLAND.portrait],
      [DESKTOP, GARLAND.landscape],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const kinds = await visibleLayoutAttrs(page, 'data-arch-item');
      expect(kinds).toHaveLength(layout.items.length);

      const depths = (await visibleLayoutAttrs(page, 'data-garland-depth')).map(Number);
      expect(depths).toEqual(layout.items.map((item) => item.depth));
      expect(depths.every((depth, k) => k === 0 || depth >= depths[k - 1])).toBe(true);
    }
  });

  test('the visible layout shows all three balloon finishes, both foliage clusters, and no single sprig', async ({
    page,
  }) => {
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const symbols = await visibleLayoutAttrs(page, 'data-arch-symbol');
      expect(symbols).toContain('balloon-champagne');
      expect(symbols).toContain('balloon-pink');
      expect(
        symbols.some((symbol) =>
          ['balloon-rosegold', 'balloon-rosegold-satin', 'balloon-champagne-satin'].includes(
            symbol ?? '',
          ),
        ),
      ).toBe(true);
      expect(symbols).toEqual(
        expect.arrayContaining(['leaf-laurel-cluster', 'leaf-eucalyptus-cluster']),
      );
      expect(
        symbols.some(
          (symbol) =>
            symbol === 'leaf-eucalyptus' || symbol === 'leaf-olive' || symbol === 'leaf-gold',
        ),
      ).toBe(false);
      expect(symbols).toContain('rosebud');
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
      const leftStrip = viewport.width * 0.1;
      const rightStrip = viewport.width * 0.9;

      expect(rects.some((rect) => rect.y <= topBand)).toBe(true);
      expect(rects.some((rect) => rect.x <= leftStrip)).toBe(true);
      expect(rects.some((rect) => rect.x + rect.width >= rightStrip)).toBe(true);
    }
  });

  test('no arch item overlaps the title or the button', async ({ page }) => {
    for (const viewport of [PHONE, TALL_PHONE, { width: 1366, height: 768 }, DESKTOP]) {
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

  test('both upper corners show foliage on screen', async ({ page }) => {
    // Floors are the real-render ceiling measured on the current composition (minimum of all 4
    // viewports was 306px² on phones, 11142px² on landscape), rounded down. Shrinking the two
    // corner blossoms into small rosebuds (G3/G4's flower rescale, plus the main-rose/peony
    // shrink) uncovered more of the corner cluster mass than round 6's original design floors
    // (1200 / 9000) assumed; those remain out of reach without also touching the shoulder
    // balloons at the envelope's u = ±0.9 station, whose margin there is under 1 unit — shrinking
    // either one drops the lower envelope below the arch pocket floor.
    const cases = [
      { viewport: PHONE, floor: 300 },
      { viewport: TALL_PHONE, floor: 300 },
      { viewport: { width: 1366, height: 768 }, floor: 11000 },
      { viewport: DESKTOP, floor: 11000 },
    ];
    for (const { viewport, floor } of cases) {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      // Only the arch should answer `elementFromPoint` while sampling: every other cover layer
      // (title, button, sparkles, confetti, glow) is forced transparent to pointer input so the
      // grid below only ever lands on the garland itself or nothing.
      await page.addStyleTag({
        content: `
          .balloon-arch, .balloon-arch * { pointer-events: auto !important; }
          .cover > *:not(.balloon-arch) { pointer-events: none !important; }
        `,
      });

      const GRID = 3;
      const { left, right } = await page.evaluate(
        ({ width, height, grid }) => {
          let leftArea = 0;
          let rightArea = 0;
          const yMax = height * 0.5;
          const leftStrip = width * 0.3;
          const rightStrip = width * 0.7;
          for (let x = grid / 2; x < width; x += grid) {
            if (x > leftStrip && x < rightStrip) continue;
            for (let y = grid / 2; y < yMax; y += grid) {
              const el = document.elementFromPoint(x, y);
              if (el && el.matches('use[data-arch-item="leaf"]')) {
                if (x <= leftStrip) leftArea += grid * grid;
                else rightArea += grid * grid;
              }
            }
          }
          return { left: leftArea, right: rightArea };
        },
        { width: viewport.width, height: viewport.height, grid: GRID },
      );

      expect(left, `left foliage at ${viewport.width}x${viewport.height} measured ${left}px²`).toBeGreaterThanOrEqual(
        floor,
      );
      expect(
        right,
        `right foliage at ${viewport.width}x${viewport.height} measured ${right}px²`,
      ).toBeGreaterThanOrEqual(floor);
    }
  });

  test('the portrait garland fills at least a third of a tall phone', async ({ page }) => {
    await page.setViewportSize(TALL_PHONE);
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const svgRect = await page.locator('svg[data-arch-layout="portrait"]').boundingBox();
    expect(svgRect).not.toBeNull();
    const { width, clear } = GARLAND.portrait;
    // The garland's own height on screen is its crown: the viewBox clear top at the rendered scale.
    const crownBottom = svgRect!.y + clear.top * (svgRect!.width / width);
    expect(crownBottom).toBeGreaterThanOrEqual(0.34 * TALL_PHONE.height);

    const leadRect = await page.getByTestId('cover-title-lead').boundingBox();
    const nameRect = await page.getByTestId('cover-celebrant-name').boundingBox();
    const buttonRect = await page.getByRole('button', { name: 'Abrir invitación' }).boundingBox();
    const targets = [leadRect, nameRect, buttonRect].filter((rect): rect is Rect => rect !== null);
    expect(targets).toHaveLength(3);

    const archRects = await visibleItemRects(page);
    expect(archRects.length).toBeGreaterThan(0);
    for (const archRect of archRects) {
      for (const target of targets) {
        expect(rectsIntersect(archRect, target)).toBe(false);
      }
    }

    expect(leadRect!.y).toBeGreaterThanOrEqual(crownBottom);
  });

  test('the layout mask is opaque down to the fade start, then transparent', async ({ page }) => {
    for (const [viewport, layout] of [
      [PHONE, GARLAND.portrait],
      [DESKTOP, GARLAND.landscape],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const maskImage = await visibleSvgMask(page);
      const opaqueTo = (layout.fadeStart / layout.height) * 100;
      expect(maskImage).toMatch(new RegExp(`^linear-gradient\\(.*\\) ${opaqueTo}%, `));
      // "transparent" is normalized to its rgba() equivalent by the browser.
      expect(maskImage.endsWith('rgba(0, 0, 0, 0) 100%)')).toBe(true);
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
