import { test, expect } from '@playwright/test';

// Gala-searchlight fidelity: the cover's night sky carries two klieg-style beams that sweep
// continuously by default, freeze into a static crossed pose under prefers-reduced-motion (while
// staying visible), and never widen the page on narrow phones.

test.describe('Cover spotlights', () => {
  test('renders the searchlight beams on the cover', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/lu15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    const spotlights = page.getByTestId('spotlights');
    await expect(spotlights).toBeAttached();
    await expect(spotlights).toBeVisible();
    await expect(page.getByTestId('spotlight-beam')).toHaveCount(2);
  });

  test('beams sweep by default and freeze under prefers-reduced-motion', async ({ page }) => {
    await page.goto('./');

    const sweepingBeam = page.getByTestId('spotlight-beam').first();
    await expect(sweepingBeam).toBeAttached();
    const runningAnimationName = await sweepingBeam.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(runningAnimationName).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const frozenBeam = page.getByTestId('spotlight-beam').first();
    await expect(frozenBeam).toBeAttached();
    const frozenAnimationName = await frozenBeam.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(frozenAnimationName).toBe('none');

    // The beams must still light the sky while frozen.
    await expect(page.getByTestId('spotlights')).toBeVisible();
  });

  test('beams do not create horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
