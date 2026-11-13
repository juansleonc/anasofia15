import { test, expect } from '@playwright/test';
import { triviaQuestions, resultMessages } from '../src/data/trivia';
import { event } from '../src/data/event';

// Plays through every question, always tapping the correct option, and asserts the progress
// indicator advances question by question, then that the final result state renders (score,
// a result message from the data module, and a "Jugar otra vez" restart button).
//
// The reveal choreography holds ~900ms per question (see TriviaIsland's REVEAL_DELAY_MS), so a
// full playthrough of the real question set takes several seconds longer than Playwright's
// default per-test timeout budget — raise it here rather than shortening the reveal animation.

test.describe('Trivia section', () => {
  test('titles the section from the celebrant\'s name in event.ts', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByText(`¿Cuánto conoces a ${event.celebrantName}?`)).toBeVisible();
  });

  test('plays through all questions to the final result', async ({ page }) => {
    test.setTimeout(60_000);
    // The quiz is specified as exactly ten questions; fail loudly if the data drifts from that.
    expect(triviaQuestions).toHaveLength(10);
    await page.goto('./');
    // The cover gates scroll until opened — unlock it before reaching the trivia section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    const section = page.getByTestId('trivia');
    await expect(section).toBeVisible();

    for (let i = 0; i < triviaQuestions.length; i += 1) {
      await expect(page.getByTestId('trivia-counter')).toContainText(
        `Pregunta ${i + 1} de ${triviaQuestions.length}`,
      );
      await expect(page.getByTestId('trivia-counter')).toContainText('de 10');
      await expect(page.getByTestId('trivia-prompt')).toContainText(triviaQuestions[i].prompt);

      // Progress advances: exactly i+1 segments are marked active for the current question.
      const activeSegments = page.locator(
        '[data-testid^="trivia-progress-segment-"].trivia-progress__segment--active',
      );
      await expect(activeSegments).toHaveCount(i + 1);

      const correctIndex = triviaQuestions[i].correctIndex;
      await page.getByTestId(`trivia-option-${correctIndex}`).click();
    }

    const result = page.getByTestId('trivia-result');
    await expect(result).toBeVisible();
    await expect(page.getByTestId('trivia-score')).toContainText(
      `${triviaQuestions.length}/${triviaQuestions.length}`,
    );
    await expect(page.getByTestId('trivia-score')).toContainText('10/10');
    await expect(page.getByTestId('trivia-message')).toContainText(
      resultMessages[triviaQuestions.length],
    );

    const restart = page.getByTestId('trivia-restart');
    await expect(restart).toBeVisible();
    await restart.click();

    await expect(page.getByTestId('trivia-result')).toBeHidden();
    await expect(page.getByTestId('trivia-counter')).toContainText(`Pregunta 1 de ${triviaQuestions.length}`);
  });

  test('option buttons keep the translucent glass styling on re-rendered questions', async ({ page }) => {
    await page.goto('./');
    // The cover gates scroll until opened — unlock it before reaching the trivia section below.
    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The island re-creates the option buttons in JS on every question change (and on restart),
    // so this guards against dynamically created buttons losing the styled glass treatment and
    // falling back to the UA's default white <button> — SSR'd question 1 alone can't catch that.
    await page
      .getByTestId(`trivia-option-${triviaQuestions[0].correctIndex}`)
      .click();
    await expect(page.getByTestId('trivia-counter')).toContainText('Pregunta 2');

    const option = page.getByTestId('trivia-option-0');
    const styles = await option.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { backgroundColor: computed.backgroundColor, color: computed.color };
    });

    // The background is `color-mix(in srgb, var(--c-white) 4%, transparent)`; WebKit serializes
    // that resolved value as `oklab(… / alpha)` rather than `rgba(255, 255, 255, alpha)`, so the
    // alpha is read off whichever trailing component the engine used (the slash form for
    // oklab/lab/lch, the final comma for rgba) instead of matching one fixed literal shape.
    const alphaMatch = styles.backgroundColor.match(/[/,]\s*([\d.]+)\s*\)$/);
    expect(alphaMatch).not.toBeNull();
    expect(Number(alphaMatch![1])).toBeLessThanOrEqual(0.1);
    // Ink label (--c-ink, #4a2632), not the UA's dark default button text.
    expect(styles.color).toBe('rgb(74, 38, 50)');
  });
});
