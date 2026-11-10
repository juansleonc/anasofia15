import { test, expect } from '@playwright/test';

// Page-composition fidelity: asserts the sections appear in the documented reading order (Cover
// -> Countdown -> Hero -> Detalles -> ColorWheel -> ComoLlegar -> Trivia -> Rsvp -> Footer; Album
// is retired), and that the scroll-reveal polish added on top of that composition is a true
// progressive enhancement: a below-the-fold section stays hidden-then-fades-in on scroll by
// default, is shown immediately (no motion) under `prefers-reduced-motion: reduce`, and — most
// importantly — is never permanently hidden if JavaScript fails to run at all.

const SECTION_ORDER = [
  'cover',
  'countdown',
  'hero',
  'detalles',
  'rueda-colores',
  'como-llegar',
  'trivia',
  'rsvp',
  'footer',
];

test.describe('Page composition', () => {
  test('renders every section in the documented order', async ({ page }) => {
    await page.goto('./');

    const order = await page.evaluate((ids) => {
      const found: string[] = [];
      document.querySelectorAll('[data-testid]').forEach((el) => {
        const id = el.getAttribute('data-testid');
        if (id && ids.includes(id)) found.push(id);
      });
      return found;
    }, SECTION_ORDER);

    expect(order).toEqual(SECTION_ORDER);
  });

  test('no longer renders the retired gallery section', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByTestId('galeria')).toHaveCount(0);
  });

  test('no longer renders the retired album section', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByTestId('album')).toHaveCount(0);
  });
});

test.describe('Scroll-reveal polish', () => {
  test('a below-the-fold section fades in as it enters the viewport', async ({ page }) => {
    await page.goto('./');
    // The cover gates scroll until opened — unlock it before scrolling further down the page.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const target = page.getByTestId('trivia');

    // The scroll-reveal wrapper is the closest `[data-reveal]` ancestor of the section (`opacity`
    // is not an inherited CSS property, so it must be read from the element it's actually set on).
    function revealOpacity(el: Element): number {
      const wrapper = el.closest('[data-reveal]') ?? el;
      return Number(getComputedStyle(wrapper).opacity);
    }

    // Not yet scrolled to: still below the fold, so the reveal should not have fired yet.
    const initialOpacity = await target.evaluate(revealOpacity);
    expect(initialOpacity).toBeLessThan(1);

    await target.scrollIntoViewIfNeeded();

    await expect.poll(async () => target.evaluate(revealOpacity)).toBe(1);
  });

  test('shows content immediately with no motion under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const target = page.getByTestId('trivia');
    const { opacity, transform } = await target.evaluate((el) => {
      const wrapper = el.closest('[data-reveal]') ?? el;
      const style = getComputedStyle(wrapper);
      return { opacity: Number(style.opacity), transform: style.transform };
    });

    expect(opacity).toBe(1);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });

  test('content stays visible even if JavaScript never runs', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('./');

    const target = page.getByTestId('trivia');
    await expect(target).toBeVisible();
    const opacity = await target.evaluate((el) => {
      const wrapper = el.closest('[data-reveal]') ?? el;
      return Number(getComputedStyle(wrapper).opacity);
    });
    expect(opacity).toBe(1);

    await context.close();
  });
});
