import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Music-toggle-fidelity smoke test: the toggle button + <audio> element are rendered ONLY when
// the real track has been dropped into `public/music/song.mp3` (build-time `publicAssetExists`
// gate) — with no file, the toggle must be fully absent rather than present-but-broken, and
// opening the invitation must never throw. These two branches are mutually exclusive on any one
// build, so this file picks the matching suite from what `pnpm build` actually emitted into
// `dist/`.

const DIST_MUSIC_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'music',
  'song.mp3',
);
const musicFilePresent = existsSync(DIST_MUSIC_FILE);

test.describe('Background music toggle: absent (no file dropped yet)', () => {
  test.skip(musicFilePresent, 'this build has a real music file — see the "present" suite below');

  test('renders no toggle and no audio element, and opening raises no page error', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await page.goto('./');

    await expect(page.getByTestId('music-toggle')).toHaveCount(0);
    await expect(page.getByTestId('background-audio')).toHaveCount(0);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    expect(pageErrors).toEqual([]);
  });
});

test.describe('Background music toggle: present (real file dropped)', () => {
  test.skip(!musicFilePresent, 'no public/music/song.mp3 in this build — see the "absent" suite above');

  test('audio element has no autoplay and stays paused on load', async ({ page }) => {
    await page.goto('./');

    const audio = page.getByTestId('background-audio');
    await expect(audio).toBeAttached();

    const hasAutoplayAttribute = await audio.evaluate(
      (el) => (el as HTMLAudioElement).autoplay,
    );
    expect(hasAutoplayAttribute).toBe(false);

    // Give any accidental autoplay attempt a moment to fire before asserting it never did.
    await page.waitForTimeout(300);
    const pausedOnLoad = await audio.evaluate((el) => (el as HTMLAudioElement).paused);
    expect(pausedOnLoad).toBe(true);
  });

  test('audio element loops and never eagerly preloads the track', async ({ page }) => {
    await page.goto('./');

    const audio = page.getByTestId('background-audio');
    await expect(audio).toHaveAttribute('loop', '');
    await expect(audio).toHaveAttribute('preload', 'none');
  });

  test('clicking "Abrir invitación" unlocks and starts playback', async ({ page }) => {
    await page.goto('./');

    const audio = page.getByTestId('background-audio');
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(true);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(false);
  });

  test('the toggle button pauses and resumes the same audio element', async ({ page }) => {
    await page.goto('./');

    const audio = page.getByTestId('background-audio');
    const toggle = page.getByTestId('music-toggle');
    await expect(toggle).toBeVisible();

    await page.getByRole('button', { name: 'Abrir invitación' }).click();
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(false);

    await toggle.click();
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(true);

    await toggle.click();
    await expect
      .poll(async () => audio.evaluate((el) => (el as HTMLAudioElement).paused))
      .toBe(false);
  });
});
