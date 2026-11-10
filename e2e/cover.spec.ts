import { test, expect } from '@playwright/test';

// Cover-fidelity smoke test: the landing/intro screen stacks, top to bottom, a cluster of three
// mirror balls of different sizes, the handwritten "Let's disco party" script line, the
// "MIS 15 AÑOS" monogram, and the "Abrir invitación" button — and stays scroll-gated behind
// that button.

test.describe('Cover section', () => {
  test('renders three disco balls in three visibly distinct sizes', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/lu15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const balls = page.getByTestId('disco-ball');
    await expect(balls).toHaveCount(3);

    const widths: number[] = [];
    for (const ball of await balls.all()) {
      await expect(ball).toBeVisible();
      const box = await ball.boundingBox();
      widths.push(box?.width ?? 0);
    }

    // Large / medium / small — each tier clearly bigger than the next, not three near-equals.
    const [large, medium, small] = [...widths].sort((a, b) => b - a);
    expect(large).toBeGreaterThan(medium * 1.15);
    expect(medium).toBeGreaterThan(small * 1.15);
  });

  test('every disco ball stays individually recognizable on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const balls = page.getByTestId('disco-ball');
    await expect(balls).toHaveCount(3);
    for (const ball of await balls.all()) {
      await expect(ball).toBeVisible();
      const box = await ball.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(48);
    }
  });

  test('the three balls carry different facet patterns, not clones', async ({ page }) => {
    await page.goto('./');

    const facetSvgs = page.getByTestId('disco-ball-facets');
    await expect(facetSvgs).toHaveCount(3);

    const patterns = await facetSvgs.evaluateAll((els) => els.map((el) => el.innerHTML));
    expect(new Set(patterns).size).toBe(3);
  });

  test('never renders duplicate element ids', async ({ page }) => {
    await page.goto('./');

    const duplicateIds = await page.evaluate(() => {
      const counts = new Map<string, number>();
      document.querySelectorAll('[id]').forEach((el) => {
        counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
      });
      return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    });

    expect(duplicateIds).toEqual([]);
  });

  test('shows the "Let\'s disco party" script line in the cursive font, on two lines', async ({
    page,
  }) => {
    await page.goto('./');

    const script = page.getByText("Let's disco party");
    await expect(script).toBeVisible();

    const rendered = await script.evaluate((el) => {
      const spans = el.querySelectorAll('span');
      const first = spans[0]?.getBoundingClientRect();
      const last = spans[spans.length - 1]?.getBoundingClientRect();
      return {
        fontFamily: getComputedStyle(el).fontFamily,
        hiddenFromAssistiveTech: el.closest('[aria-hidden="true"]') !== null,
        // Two lines: the last segment starts clearly below the first one, not beside it.
        breaksIntoTwoLines:
          !!first && !!last && last.top >= first.top + first.height * 0.5,
      };
    });

    expect(rendered.fontFamily).toContain('Great Vibes');
    expect(rendered.hiddenFromAssistiveTech).toBe(false);
    expect(rendered.breaksIntoTwoLines).toBe(true);
  });

  test('the monogram reads as one "MIS 15 AÑOS" heading, with no hairline rules', async ({
    page,
  }) => {
    await page.goto('./');

    const heading = page.getByRole('heading', { level: 1, name: 'MIS 15 AÑOS' });
    await expect(heading).toBeVisible();

    // The redesigned monogram carries no decorative pseudo-element strokes (the old gold
    // hairlines flanking MIS/AÑOS): nothing inside the heading may render generated content.
    const decoratedElements = await heading.evaluate((h1) => {
      const els = [h1, ...h1.querySelectorAll('*')];
      return els.filter((el) =>
        ['::before', '::after'].some((pseudo) => getComputedStyle(el, pseudo).content !== 'none'),
      ).length;
    });
    expect(decoratedElements).toBe(0);
  });

  test('stacks cluster, script, monogram, and button top to bottom', async ({ page }) => {
    await page.goto('./');

    const ballBoxes = [];
    for (const ball of await page.getByTestId('disco-ball').all()) {
      ballBoxes.push(await ball.boundingBox());
    }
    const clusterBottom = Math.max(...ballBoxes.map((b) => (b?.y ?? 0) + (b?.height ?? 0)));

    const scriptBox = await page.getByText("Let's disco party").boundingBox();
    const headingBox = await page
      .getByRole('heading', { level: 1, name: 'MIS 15 AÑOS' })
      .boundingBox();
    const buttonBox = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .boundingBox();

    // Reading order flows downward; adjacent blocks may kiss but never swap places.
    expect(scriptBox!.y + scriptBox!.height / 2).toBeGreaterThan(clusterBottom * 0.5);
    expect(scriptBox!.y).toBeGreaterThan(ballBoxes[0]!.y);
    expect(headingBox!.y).toBeGreaterThan(scriptBox!.y);
    expect(buttonBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height / 2);
  });

  test('renders the cover copy: monogram heading and open-invitation button', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('heading', { level: 1, name: 'MIS 15 AÑOS' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir invitación' })).toBeVisible();
  });

  test('the whole composition fits a short phone screen without cropping', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    for (const ball of await page.getByTestId('disco-ball').all()) {
      await expect(ball).toBeInViewport({ ratio: 0.9 });
    }
    await expect(page.getByText("Let's disco party")).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'MIS 15 AÑOS' }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('the whole composition fits a wide desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('./');

    for (const ball of await page.getByTestId('disco-ball').all()) {
      await expect(ball).toBeInViewport({ ratio: 0.9 });
    }
    await expect(page.getByText("Let's disco party")).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('heading', { level: 1, name: 'MIS 15 AÑOS' }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });
  });

  test('scroll is locked on load: the guest cannot scroll past the cover before opening', async ({
    page,
  }) => {
    await page.goto('./');

    // A guest attempting to scroll programmatically before opening must not move at all — the
    // hero stays unreachable until "Abrir invitación" is clicked.
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId('hero')).not.toBeInViewport();
  });

  test('clicking "Abrir invitación" unlocks scroll so the page can move past the cover', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The click itself already scrolls to the hero (covered below); reset to the top and prove a
    // FRESH scroll now actually moves the page — i.e. the lock was lifted, not just bypassed once.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('clicking "Abrir invitación" scrolls the guest down to the hero section', async ({
    page,
  }) => {
    await page.goto('./');

    // Sanity: before opening, the guest is at the top and the hero is below the fold.
    await expect(page.getByTestId('hero')).not.toBeInViewport();

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The open gesture must visibly "open" the invitation by bringing the hero into view
    // (in addition to starting the music, covered by music.spec.ts).
    await expect(page.getByTestId('hero')).toBeInViewport({ ratio: 0.5 });
  });

  test('disco-ball spin runs by default and freezes under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.goto('./');

    const spinningFacets = page.getByTestId('disco-ball-facets').first();
    await expect(spinningFacets).toBeAttached();
    const runningAnimationName = await spinningFacets.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(runningAnimationName).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const frozenFacets = page.getByTestId('disco-ball-facets').first();
    await expect(frozenFacets).toBeAttached();
    const frozenAnimationName = await frozenFacets.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(frozenAnimationName).toBe('none');

    // The balls themselves must still render while the spin is frozen.
    await expect(page.getByTestId('disco-ball').first()).toBeVisible();
  });

  test('the "Let\'s disco party" script reads noticeably larger on a narrow phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const fontSizePx = await page
      .getByTestId('disco-script')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    // Baseline computed size at this exact viewport before this pass (commit ebce714): 41.25px.
    // The owner asked for a clearly bigger script, not a timid bump — require at least +25%.
    const PREVIOUS_SCRIPT_FONT_SIZE_PX = 41.25;
    expect(fontSizePx).toBeGreaterThanOrEqual(PREVIOUS_SCRIPT_FONT_SIZE_PX * 1.25);

    // Still two lines of real, accessible cursive text — growing the type must not regress that.
    const rendered = await page.getByTestId('disco-script').evaluate((el) => ({
      fontFamily: getComputedStyle(el).fontFamily,
      hiddenFromAssistiveTech: el.closest('[aria-hidden="true"]') !== null,
    }));
    expect(rendered.fontFamily).toContain('Great Vibes');
    expect(rendered.hiddenFromAssistiveTech).toBe(false);
  });

  test('the "15" numeral renders in a self-hosted serif face, keeping its gold shimmer', async ({
    page,
  }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(woff2?|ttf|otf)(\?.*)?$/i.test(request.url())) {
        fontRequests.push(request.url());
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    const numeral = page.locator('.cover__title-xv');
    const style = await numeral.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        color: computed.color,
        animationName: computed.animationName,
        filter: computed.filter,
      };
    });

    expect(style.fontFamily).toContain('Playfair Display');
    // Gradient-clipped text paints transparent so the background gradient shows through.
    expect(style.color).toBe('rgba(0, 0, 0, 0)');
    expect(style.animationName).not.toBe('none');
    expect(style.filter).toContain('drop-shadow');

    // Every font file this page fetched must come from our own origin — no external font CDN.
    expect(fontRequests.length).toBeGreaterThan(0);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of fontRequests) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }
  });

  test('every cover animation freezes under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    // Sweep the whole cover: no element may keep a named CSS animation while the guest prefers
    // reduced motion — freezing must be an explicit `animation: none`, not a zeroed duration.
    const stillAnimated = await page.evaluate(() => {
      const cover = document.querySelector('[data-testid="cover"]');
      if (!cover) return ['missing-cover'];
      return [cover, ...cover.querySelectorAll('*')]
        .filter((el) => getComputedStyle(el).animationName !== 'none')
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    });

    expect(stillAnimated).toEqual([]);
  });
});
