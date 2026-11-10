import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hero-fidelity smoke test: asserts the intro/name screen (eyebrow, cursive celebrant name,
// divider, tagline, portrait slot) renders real content pulled from src/data/event.ts, and that
// the celebrant name is actually rendered in the self-hosted cursive font (not just styled to
// look like it). The portrait slot has two mutually exclusive branches depending on whether
// `public/images/portrait.jpg` was dropped into this build — this file picks the matching one
// from what `pnpm build` actually emitted into `dist/`.

const DIST_PORTRAIT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'images',
  'portrait.jpg',
);
const portraitPresent = existsSync(DIST_PORTRAIT_FILE);

test.describe('Hero section', () => {
  test('renders the eyebrow, celebrant name, and tagline', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/anasofia15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    await expect(page.getByText('Te invito a celebrar')).toBeVisible();
    await expect(page.getByText('Mis XV años', { exact: true })).toBeVisible();

    const name = page.getByTestId('cursive-name');
    await expect(name).toBeVisible();
    await expect(name).toHaveText('Ana Sofía');
  });

  test('celebrant name renders in the self-hosted cursive font', async ({ page }) => {
    await page.goto('./');

    const name = page.getByTestId('cursive-name');
    const fontFamily = await name.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Great Vibes');
  });

  test('portrait slot keeps the same box size whether the photo exists or not (no layout shift)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('./');

    const testId = portraitPresent ? 'hero-portrait' : 'hero-portrait-fallback';
    const box = page.getByTestId(testId);
    await expect(box).toBeVisible();

    const dimensions = await box.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(dimensions.width).toBeGreaterThanOrEqual(160);
    expect(dimensions.height).toBeGreaterThanOrEqual(160);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('shows the "AS" medallion fallback with an accessible name when no photo is present', async ({
    page,
  }) => {
    test.skip(portraitPresent, 'this build has a real portrait file — fallback branch not active');

    await page.goto('./');

    const fallback = page.getByRole('img', { name: 'Ana Sofía' });
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('data-testid', 'hero-portrait-fallback');
    await expect(page.getByTestId('hero-portrait')).toHaveCount(0);
  });

  test('renders a real <img> with alt text when a portrait photo is present', async ({ page }) => {
    test.skip(!portraitPresent, 'no public/images/portrait.jpg in this build — fallback branch active');

    await page.goto('./');

    const img = page.getByTestId('hero-portrait');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', 'Ana Sofía');
    await expect(page.getByTestId('hero-portrait-fallback')).toHaveCount(0);
  });
});
