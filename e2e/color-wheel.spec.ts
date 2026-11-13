import { test, expect } from '@playwright/test';
import { dressColors } from '../src/data/dress-colors';

// Dress-color wheel fidelity: a visually-hidden native radio group is the single source of truth
// (tap on an SVG slice and keyboard navigation both resolve to the same radio `change`), paired
// with a purely decorative `aria-hidden` SVG view built from the colors in
// `src/data/dress-colors.ts`.

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function expectedRotationDeg(index: number, count: number): number {
  const raw = -(index + 0.5) * (360 / count);
  return ((raw % 360) + 360) % 360;
}

async function openInvitation(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Abrir invitación' }).click();
}

test.describe('Color wheel section', () => {
  test('sits between Detalles and Cómo llegar', async ({ page }) => {
    await openInvitation(page);

    const testids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid]')).map((el) => el.getAttribute('data-testid')),
    );

    const detallesIndex = testids.indexOf('detalles');
    const wheelIndex = testids.indexOf('rueda-colores');
    const comoLlegarIndex = testids.indexOf('como-llegar');

    expect(detallesIndex).toBeGreaterThanOrEqual(0);
    expect(wheelIndex).toBeGreaterThan(detallesIndex);
    expect(comoLlegarIndex).toBeGreaterThan(wheelIndex);
  });

  test('renders one slice per color colored from the dress-colors data', async ({ page }) => {
    await openInvitation(page);

    const slices = page.getByTestId('color-wheel-slice');
    await expect(slices).toHaveCount(dressColors.length);

    for (let i = 0; i < dressColors.length; i += 1) {
      await expect(slices.nth(i)).toHaveCSS('fill', hexToRgb(dressColors[i].hex));
    }
  });

  test('renders one radio option per color labelled with each color name', async ({ page }) => {
    await openInvitation(page);

    const options = page.getByTestId('color-wheel-option');
    await expect(options).toHaveCount(dressColors.length);

    for (const color of dressColors) {
      await expect(page.getByLabel(color.name)).toBeAttached();
    }
  });

  test('starts with the hint visible and nothing selected', async ({ page }) => {
    await openInvitation(page);

    await expect(page.getByTestId('color-wheel-hint')).toBeVisible();
    const options = page.getByTestId('color-wheel-option');
    for (let i = 0; i < dressColors.length; i += 1) {
      await expect(options.nth(i)).not.toBeChecked();
    }
  });

  test('fits a 375px viewport with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openInvitation(page);

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});

test.describe('Color wheel tap selection', () => {
  for (const [index, color] of dressColors.entries()) {
    test(`tapping the "${color.name}" slice selects it and shows its detail`, async ({ page }) => {
      await openInvitation(page);

      await page.getByTestId('color-wheel-slice').nth(index).click();

      await expect(page.getByTestId('color-wheel-option').nth(index)).toBeChecked();
      await expect(page.getByTestId('color-wheel-name')).toHaveText(color.name);

      await expect(page.getByTestId('color-wheel-note')).toHaveCount(0);

      await expect(page.getByTestId('color-wheel-hint')).toBeHidden();

      const rotation = await page
        .getByTestId('color-wheel-rotor')
        .getAttribute('data-rotation');
      const rotationMod = ((Number(rotation) % 360) + 360) % 360;
      expect(rotationMod).toBeCloseTo(expectedRotationDeg(index, dressColors.length), 1);
    });
  }

  test('reduced-motion guests get an instant (0s) rotor transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openInvitation(page);

    const duration = await page
      .getByTestId('color-wheel-rotor')
      .evaluate((el) => getComputedStyle(el).transitionDuration);

    expect(duration).toMatch(/^0s(,\s*0s)*$/);
  });
});

test.describe('Color wheel keyboard navigation', () => {
  test('Arrow keys move and select, wrapping at the ends; Space selects the focused option', async ({
    page,
  }) => {
    await openInvitation(page);

    const options = page.getByTestId('color-wheel-option');
    await options.nth(0).focus();

    await page.keyboard.press('ArrowRight');
    await expect(options.nth(1)).toBeChecked();
    await expect(page.getByTestId('color-wheel-name')).toHaveText(dressColors[1].name);
    await expect(page.getByTestId('color-wheel-slice').nth(1)).toHaveAttribute(
      'data-focused',
      'true',
    );

    await page.keyboard.press('ArrowDown');
    await expect(options.nth(2)).toBeChecked();

    await options.nth(0).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(options.nth(dressColors.length - 1)).toBeChecked();
    await expect(page.getByTestId('color-wheel-name')).toHaveText(dressColors[dressColors.length - 1].name);

    await options.nth(3).focus();
    await page.keyboard.press(' ');
    await expect(options.nth(3)).toBeChecked();
    await expect(page.getByTestId('color-wheel-name')).toHaveText(dressColors[3].name);
  });
});
