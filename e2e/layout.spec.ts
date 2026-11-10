import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../src/data/site.config';

// Layout-fidelity smoke test: asserts that BaseLayout's <head> carries real Open Graph / meta
// tags sourced from site.config.ts (not hardcoded literals that could drift from the config the
// family edits). `og:image` is emitted only once the real file has been dropped into
// `public/images/og-image.jpg` — this file picks the matching branch from what `pnpm build`
// actually emitted into `dist/`.

const DIST_OG_IMAGE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'images',
  'og-image.jpg',
);
const ogImagePresent = existsSync(DIST_OG_IMAGE_FILE);

test.describe('BaseLayout: Open Graph / meta tags', () => {
  test('head carries OG/meta tags sourced from site.config.ts', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle(siteConfig.og.title);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', siteConfig.og.description);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', siteConfig.og.title);

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute('content', siteConfig.og.description);

    const ogUrl = page.locator('meta[property="og:url"]');
    await expect(ogUrl).toHaveAttribute('content', 'https://juansleonc.github.io/anasofia15/');
  });

  test('omits og:image entirely while no preview image has been supplied', async ({ page }) => {
    test.skip(ogImagePresent, 'this build has a real og-image file — see the "present" test below');

    await page.goto('./');

    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });

  test('emits the correct og:image URL once the preview image file exists', async ({ page }) => {
    test.skip(!ogImagePresent, 'no public/images/og-image.jpg in this build — "absent" test above applies');

    await page.goto('./');

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute(
      'content',
      'https://juansleonc.github.io/anasofia15/images/og-image.jpg',
    );
  });
});
