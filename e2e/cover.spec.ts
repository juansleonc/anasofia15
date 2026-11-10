import { test, expect } from '@playwright/test';

// Cover-fidelity smoke test for the rose-garland cover (see Cover.astro for the scroll-lock
// script these tests exercise).

test.describe('Cover section', () => {
  test('the heading reads as one invitation sentence naming the celebrant', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/anasofia15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeVisible();
  });

  test('the celebrant name renders in the cursive display font', async ({ page }) => {
    await page.goto('./');

    const fontFamily = await page
      .getByTestId('cover-celebrant-name')
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(fontFamily).toContain('Great Vibes');
  });

  test('frames the cover with at least three rose shapes, all hidden from assistive tech', async ({
    page,
  }) => {
    await page.goto('./');

    const cover = page.getByTestId('cover');
    const roses = cover.getByTestId('rose');
    const count = await roses.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (const rose of await roses.all()) {
      await expect(rose).toHaveAttribute('aria-hidden', 'true');
    }
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

  test('the whole composition fits a short phone screen without cropping', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });

    // Measure both locked (the guest's first view) and, since the fixed scroll-lock itself clips
    // to the viewport and would hide a rose garland that bleeds past the edge, again right after
    // unlocking — the state where any such overflow actually becomes scrollable.
    const lockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(lockedOverflow.scrollWidth).toBeLessThanOrEqual(lockedOverflow.innerWidth);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();
    const unlockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(unlockedOverflow.scrollWidth).toBeLessThanOrEqual(unlockedOverflow.innerWidth);
  });

  test('the whole composition fits a wide desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });

    const lockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(lockedOverflow.scrollWidth).toBeLessThanOrEqual(lockedOverflow.innerWidth);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();
    const unlockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(unlockedOverflow.scrollWidth).toBeLessThanOrEqual(unlockedOverflow.innerWidth);
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

  test('the open button pulses softly by default and freezes under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const runningAnimationName = await button.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(runningAnimationName).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const frozenAnimationName = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(frozenAnimationName).toBe('none');

    // The button must still render while the pulse is frozen.
    await expect(page.getByRole('button', { name: 'Abrir invitación' })).toBeVisible();
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

  test('every font the cover requests is self-hosted on our own origin', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(woff2?|ttf|otf)(\?.*)?$/i.test(request.url())) {
        fontRequests.push(request.url());
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    expect(fontRequests.length).toBeGreaterThan(0);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of fontRequests) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }
  });
});
