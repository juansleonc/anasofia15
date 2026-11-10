import { test, expect } from '@playwright/test';

// Every section eyebrow gets a leading color emoji as a decorative flourish. The emoji must:
// - render as the visible first glyph, with the eyebrow's original wording unchanged after it;
// - stay OUT of the accessible name (screen readers must still announce just the wording, not
//   an emoji name mixed in) — the emoji is purely decorative and adds no information;
// - render at full, undesaturated color (no grayscale/opacity treatment);
// - not visually detach from its text under the eyebrow's own wide letter-spacing;
// - never force the eyebrow onto two lines or push the page into horizontal overflow at 375px.

const EYEBROWS = [
  { section: 'hero', selector: '.hero__eyebrow', text: 'Te invito a celebrar', emoji: '🌹' },
  {
    section: 'countdown',
    selector: '.countdown__eyebrow',
    text: 'La cuenta regresiva',
    emoji: '⏳',
  },
  { section: 'detalles', selector: '.detalles__eyebrow', text: 'Los detalles', emoji: '🌸' },
  {
    section: 'rueda-colores',
    selector: '.color-wheel-section__eyebrow',
    text: 'Para ellas',
    emoji: '👗',
  },
  {
    section: 'como-llegar',
    selector: '.como-llegar__eyebrow',
    text: 'Cómo llegar',
    emoji: '📍',
  },
  { section: 'trivia', selector: '.trivia__eyebrow', text: 'Juguemos', emoji: '🌷' },
  { section: 'rsvp', selector: '.rsvp__eyebrow', text: 'Confirma tu lugar', emoji: '💌' },
];

test.describe('Section eyebrow emojis', () => {
  for (const { section, selector, text, emoji } of EYEBROWS) {
    test(`${section} eyebrow shows its emoji decoratively without changing the announced text`, async ({
      page,
    }) => {
      await page.goto('./');

      const eyebrow = page.locator(selector);
      await expect(eyebrow).toBeVisible();
      await expect(eyebrow).toContainText(emoji);
      await expect(eyebrow).toContainText(text);

      const result = await eyebrow.evaluate((el) => {
        // Mimic the accessible-name computation's aria-hidden exclusion rule (WAI-ARIA
        // accname spec, rule 2A): anything under aria-hidden="true" contributes nothing.
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
        const announced = clone.textContent?.trim() ?? '';

        const emojiSpan = el.querySelector('[aria-hidden="true"]');
        const emojiStyle = emojiSpan ? getComputedStyle(emojiSpan) : null;
        const eyebrowStyle = getComputedStyle(el);

        return {
          announced,
          hasAriaHiddenEmoji: emojiSpan !== null,
          emojiFilter: emojiStyle?.filter ?? null,
          emojiOpacity: emojiStyle?.opacity ?? null,
          emojiLetterSpacing: emojiStyle?.letterSpacing ?? null,
          eyebrowLetterSpacing: eyebrowStyle.letterSpacing,
          lineCount: el.getClientRects().length,
        };
      });

      // The announced text is exactly the original wording — no emoji name leaks in.
      expect(result.announced).toBe(text);
      expect(result.hasAriaHiddenEmoji).toBe(true);

      // Full color: no desaturating filter, no reduced opacity.
      expect(result.emojiFilter).toBe('none');
      expect(result.emojiOpacity).toBe('1');

      // The emoji must not inherit the eyebrow's own ultra-wide tracking verbatim — it needs a
      // deliberately smaller/reset value so it doesn't read as visually detached from the text.
      expect(result.emojiLetterSpacing).not.toBe(result.eyebrowLetterSpacing);

      // Still a single line — the emoji doesn't push the wording onto a second line.
      expect(result.lineCount).toBe(1);
    });
  }

  test('no section overflows horizontally at 375px after the emoji change', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('./');

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});
