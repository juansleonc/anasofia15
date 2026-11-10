import { test, expect } from '@playwright/test';
import { event } from '../src/data/event';

// The footer is the last section on the page: a small metallic monogram plus the footer line
// from event.ts (`footerText`), never hardcoded in the section itself.

test.describe('Footer section', () => {
  test('renders the footer text from event.ts at the bottom of the page', async ({ page }) => {
    await page.goto('./');

    const footer = page.getByTestId('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(event.footerText);

    const rsvp = page.getByTestId('rsvp');
    const [footerBox, rsvpBox] = await Promise.all([footer.boundingBox(), rsvp.boundingBox()]);
    expect(footerBox).not.toBeNull();
    expect(rsvpBox).not.toBeNull();
    expect(footerBox!.y).toBeGreaterThan(rsvpBox!.y);
  });
});
