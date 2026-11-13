import { test, expect } from '@playwright/test';
import { event } from '../src/data/event';

// Countdown-fidelity smoke test: the four day/hour/minute/second cards render with their Spanish
// labels, and once the target instant has passed the section switches to an "arrived" state.
//
// Testable seam: the island resolves its target instant from a `?countdownTarget=<ISO>` query
// param when present (falling back to `src/data/event.ts`'s real event date otherwise), so a
// past-target run doesn't require mocking the data module or waiting for the real event date.
//
// Time-independent by design: the real event date keeps moving forward in time, so assertions
// here never depend on "today" vs. the real target being past/future — the grid's own
// `data-target-iso` attribute is checked against the data module instead, and arrived/counting
// states are driven entirely by explicit `countdownTarget` overrides.

test.describe('Countdown section', () => {
  test('renders the four cards with their Días/Horas/Min/Seg labels', async ({ page }) => {
    await page.goto('./');

    const grid = page.getByTestId('countdown-grid');
    await expect(grid).toBeVisible();

    await expect(page.getByTestId('countdown-card-days')).toContainText('Días');
    await expect(page.getByTestId('countdown-card-hours')).toContainText('Horas');
    await expect(page.getByTestId('countdown-card-mins')).toContainText('Min');
    await expect(page.getByTestId('countdown-card-secs')).toContainText('Seg');
  });

  test('targets the exact instant published in event.ts', async ({ page }) => {
    await page.goto('./');

    const grid = page.getByTestId('countdown-grid');
    await expect(grid).toHaveAttribute('data-target-iso', event.eventDateTimeIso);
  });

  test('shows the display date beneath the cards, including the confirmed time', async ({
    page,
  }) => {
    await page.goto('./');

    const dateLine = page.getByTestId('countdown').getByText('19 de diciembre de 2026', {
      exact: false,
    });
    await expect(dateLine).toBeVisible();
    await expect(dateLine).toContainText('6:00 p. m.');
    await expect(page.getByTestId('countdown')).not.toHaveText(/por confirmar/i);
    expect(await page.locator('body').innerText()).not.toMatch(/por confirmar/i);
  });

  test('shows the "llegó el día" arrived state once the target is in the past', async ({
    page,
  }) => {
    await page.goto('./?countdownTarget=2000-01-01T00:00:00-05:00');

    const arrived = page.getByTestId('countdown-arrived');
    await expect(arrived).toBeVisible();
    await expect(arrived).toContainText('Llegó el día');

    await expect(page.getByTestId('countdown-grid')).toBeHidden();
  });

  test('counts down (does not show arrived state) for an explicit future target', async ({
    page,
  }) => {
    await page.goto('./?countdownTarget=2099-01-01T00:00:00-05:00');

    await expect(page.getByTestId('countdown-grid')).toBeVisible();
    await expect(page.getByTestId('countdown-arrived')).toBeHidden();
  });

  test('falls back to the real event target (no NaN) when countdownTarget is garbage', async ({
    page,
  }) => {
    await page.goto('./?countdownTarget=garbage');

    const grid = page.getByTestId('countdown-grid');
    await expect(grid).toBeVisible();

    const gridText = await grid.innerText();
    expect(gridText).not.toContain('NaN');
  });
});
