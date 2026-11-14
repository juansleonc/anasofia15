import type { Page } from '@playwright/test';

export const TEST_ACCESS_KEY = '11111111-1111-1111-1111-111111111111';

const MIN_REPLACEMENTS = 2;

/**
 * Test-only seam: intercepts the page document and swaps every `data-access-key` attribute for a
 * test UUID so forms behave as "configured" without any hook in production code. Astro renders an
 * empty value as a bare attribute, so both `data-access-key` and `data-access-key="…"` match.
 * Throws if the document carries fewer attributes than expected.
 */
export async function withConfiguredAccessKey(page: Page): Promise<void> {
  await page.route('**/anasofia15/', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    let replacements = 0;
    const patched = body.replace(/data-access-key(?:="[^"]*")?(?=[\s>])/g, () => {
      replacements += 1;
      return `data-access-key="${TEST_ACCESS_KEY}"`;
    });
    if (replacements < MIN_REPLACEMENTS) {
      throw new Error(
        `web3forms-seam: expected at least ${MIN_REPLACEMENTS} data-access-key attribute(s), replaced ${replacements}`,
      );
    }
    await route.fulfill({ response, body: patched });
  });
}
