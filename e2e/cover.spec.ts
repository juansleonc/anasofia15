import { test, expect } from '@playwright/test';

// Cover-fidelity smoke test for the balloon-arch cover (see Cover.astro for the scroll-lock
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
    // countdown stays unreachable until "Abrir invitación" is clicked.
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId('countdown')).not.toBeInViewport();
  });

  test('clicking "Abrir invitación" unlocks scroll so the page can move past the cover', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The click itself already scrolls to the countdown (covered below); reset to the top and
    // prove a FRESH scroll now actually moves the page — i.e. the lock was lifted, not just
    // bypassed once.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('before opening, the countdown is below the fold', async ({ page }) => {
    await page.goto('./');

    // Sanity: before opening, the guest is at the top and the countdown is below the fold.
    await expect(page.getByTestId('countdown')).not.toBeInViewport();
  });

  test('clicking "Abrir invitación" scrolls the guest down to the countdown section', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The open gesture must visibly "open" the invitation by bringing the countdown into view
    // (in addition to starting the music, covered by music.spec.ts).
    await expect(page.getByTestId('countdown')).toBeInViewport({ ratio: 0.5 });
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

  test('the open button is a wine pill with a champagne-gold border', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const styles = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundImage: computed.backgroundImage,
        borderTopColor: computed.borderTopColor,
        borderRightColor: computed.borderRightColor,
        borderBottomColor: computed.borderBottomColor,
        borderLeftColor: computed.borderLeftColor,
        borderTopWidth: computed.borderTopWidth,
        color: computed.color,
        boxShadow: computed.boxShadow,
      };
    });

    expect(styles.backgroundImage).toContain('rgb(154, 68, 98)');
    expect(styles.backgroundImage).toContain('rgb(110, 36, 64)');
    expect(styles.borderTopColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderRightColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderBottomColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderLeftColor).toBe('rgb(205, 168, 105)');
    expect(parseFloat(styles.borderTopWidth)).toBeGreaterThan(0);
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(styles.boxShadow).not.toBe('none');
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
