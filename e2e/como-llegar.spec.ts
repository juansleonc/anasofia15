import { test, expect } from '@playwright/test';
import { buildWazeUrl } from '../src/lib/maps';
import { event } from '../src/data/event';

// "Cómo llegar" is buttons-ONLY per the locked scope decision: no embedded/iframe map, just the
// two keyless deep-links (Google Maps + Waze) built at build time from the venue in event.ts.
// The Google Maps link is the venue's verbatim short link (not a hand-built query); the Waze link
// is still built from the address, so it's compared against the library builder rather than
// hardcoded here.

test.describe('Cómo llegar section', () => {
  test('renders exactly two link buttons with correct hrefs', async ({ page }) => {
    await page.goto('./');

    const section = page.getByTestId('como-llegar');
    await expect(section).toBeVisible();

    const links = section.getByRole('link');
    await expect(links).toHaveCount(2);

    const googleMapsLink = section.getByRole('link', { name: 'Google Maps' });
    const wazeLink = section.getByRole('link', { name: 'Waze' });

    await expect(googleMapsLink).toHaveAttribute(
      'href',
      'https://maps.app.goo.gl/uNsRheFMkyxTr9rP9',
    );
    await expect(wazeLink).toHaveAttribute('href', buildWazeUrl(event.venue));

    await expect(googleMapsLink).toHaveAttribute('target', '_blank');
    await expect(googleMapsLink).toHaveAttribute('rel', 'noopener');
    await expect(wazeLink).toHaveAttribute('target', '_blank');
    await expect(wazeLink).toHaveAttribute('rel', 'noopener');
  });

  test('shows the venue name and full address from event.ts', async ({ page }) => {
    await page.goto('./');

    const section = page.getByTestId('como-llegar');
    await expect(section).toContainText(event.venue.name);
    await expect(section).toContainText(event.venue.address);
    await expect(section).toContainText(event.venue.locality);
    await expect(section).toContainText(event.venue.country);
  });

  test('has zero embedded maps (no iframe)', async ({ page }) => {
    await page.goto('./');

    const section = page.getByTestId('como-llegar');
    await expect(section.locator('iframe')).toHaveCount(0);
  });
});
