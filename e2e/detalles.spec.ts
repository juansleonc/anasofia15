import { test, expect } from '@playwright/test';
import { event } from '../src/data/event';

// Detalles-fidelity smoke test: the vertical timeline renders its four items in order (Cuándo /
// Dónde / Código de vestimenta / Regalos) and the dress-code line is reproduced exactly as
// authored in `src/data/event.ts` — nothing paraphrased or hardcoded in the markup.

test.describe('Detalles section', () => {
  test('renders the section header', async ({ page }) => {
    await page.goto('./');

    const section = page.getByTestId('detalles');
    await expect(section).toBeVisible();
    await expect(section).toContainText('Los detalles');
    await expect(section).toContainText('La celebración');
  });

  test('renders the four timeline items with their tags, in order', async ({ page }) => {
    await page.goto('./');

    const items = page.getByTestId('detalles-item');
    await expect(items).toHaveCount(4);

    await expect(items.nth(0)).toContainText('Cuándo');
    await expect(items.nth(1)).toContainText('Dónde');
    await expect(items.nth(1)).toContainText('Edén Country');
    await expect(items.nth(2)).toContainText('Código de vestimenta');
    await expect(items.nth(3)).toContainText('Regalos');
    await expect(items.nth(3)).toContainText('Lluvia de sobres');
  });

  test('reproduces the dress-code summary and renders men and women on separate lines', async ({
    page,
  }) => {
    await page.goto('./');

    await expect(page.getByText(event.dressCode.summary, { exact: true })).toBeVisible();

    const desc = page.getByTestId('detalles-item').nth(2).locator('.detalles__item-desc');
    await expect(desc).toBeVisible();
    await expect(desc).toContainText(`Hombres: ${event.dressCode.men}`);
    await expect(desc).toContainText(`Mujeres: ${event.dressCode.women}`);
    await expect(desc).toHaveCSS('white-space', 'pre-line');

    const lines = await desc.evaluate((el) => (el as HTMLElement).innerText.split('\n'));
    expect(lines).toEqual([`Hombres: ${event.dressCode.men}`, `Mujeres: ${event.dressCode.women}`]);
  });

  test('renders the envelope-shower item without an empty description paragraph', async ({
    page,
  }) => {
    await page.goto('./');

    const items = page.getByTestId('detalles-item');
    const lastItem = items.nth(3);
    await expect(lastItem.locator('.detalles__item-desc')).toHaveCount(0);

    const descriptions = page.locator('.detalles__item-desc');
    await expect(descriptions).toHaveCount(3);
  });

  test('sources every string from event.ts (no hardcoded duplicate copy)', async ({ page }) => {
    await page.goto('./');

    const items = page.getByTestId('detalles-item');
    await expect(items).toHaveCount(event.timeline.length);
    for (const [i, timelineItem] of event.timeline.entries()) {
      await expect(items.nth(i)).toContainText(timelineItem.tag);
      await expect(items.nth(i)).toContainText(timelineItem.title);
    }
  });
});
