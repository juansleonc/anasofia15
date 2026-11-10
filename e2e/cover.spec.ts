import { test, expect } from '@playwright/test';

// Cover-fidelity smoke test for the balloon-arch cover (see Cover.astro for the scroll-lock
// script these tests exercise).

test.describe('Cover section', () => {
  test('the heading reads as one invitation sentence naming the celebrant', async ({ page }) => {
    // Note: with a baseURL that has a path (GH Pages `base: '/anasofia15/'`), a leading-slash
    // `page.goto('/')` resolves to the origin root, not the base subpath. Use `'./'`.
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeVisible();
  });

  test('the celebrant name renders in the cursive display font', async ({ page }) => {
    await page.goto('./');

    const fontFamily = await page
      .getByTestId('cover-celebrant-name')
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(fontFamily).toContain('Great Vibes');
  });

  test('never renders duplicate element ids', async ({ page }) => {
    await page.goto('./');

    const duplicateIds = await page.evaluate(() => {
      const counts = new Map<string, number>();
      document.querySelectorAll('[id]').forEach((el) => {
        counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
      });
      return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    });

    expect(duplicateIds).toEqual([]);
  });

  test('the whole composition fits a short phone screen without cropping', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });

    // Measure both locked (the guest's first view) and, since the fixed scroll-lock itself clips
    // to the viewport and would hide a rose garland that bleeds past the edge, again right after
    // unlocking — the state where any such overflow actually becomes scrollable.
    const lockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(lockedOverflow.scrollWidth).toBeLessThanOrEqual(lockedOverflow.innerWidth);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();
    const unlockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(unlockedOverflow.scrollWidth).toBeLessThanOrEqual(unlockedOverflow.innerWidth);
  });

  test('the whole composition fits a wide desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('./');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Invitación para los quince años de Ana Sofía',
      }),
    ).toBeInViewport({ ratio: 0.9 });
    await expect(
      page.getByRole('button', { name: 'Abrir invitación' }),
    ).toBeInViewport({ ratio: 0.9 });

    const lockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(lockedOverflow.scrollWidth).toBeLessThanOrEqual(lockedOverflow.innerWidth);

    await page.getByRole('button', { name: 'Abrir invitación' }).click();
    const unlockedOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(unlockedOverflow.scrollWidth).toBeLessThanOrEqual(unlockedOverflow.innerWidth);
  });

  test('scroll is locked on load: the guest cannot scroll past the cover before opening', async ({
    page,
  }) => {
    await page.goto('./');

    // A guest attempting to scroll programmatically before opening must not move at all — the
    // countdown stays unreachable until "Abrir invitación" is clicked.
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId('countdown')).not.toBeInViewport();
  });

  test('clicking "Abrir invitación" unlocks scroll so the page can move past the cover', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The click itself already scrolls to the countdown (covered below); reset to the top and
    // prove a FRESH scroll now actually moves the page — i.e. the lock was lifted, not just
    // bypassed once.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, 2000));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('before opening, the countdown is below the fold', async ({ page }) => {
    await page.goto('./');

    // Sanity: before opening, the guest is at the top and the countdown is below the fold.
    await expect(page.getByTestId('countdown')).not.toBeInViewport();
  });

  test('clicking "Abrir invitación" scrolls the guest down to the countdown section', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByRole('button', { name: 'Abrir invitación' }).click();

    // The open gesture must visibly "open" the invitation by bringing the countdown into view
    // (in addition to starting the music, covered by music.spec.ts).
    await expect(page.getByTestId('countdown')).toBeInViewport({ ratio: 0.5 });
  });

  test('the open button pulses softly by default and freezes under prefers-reduced-motion', async ({
    page,
  }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const runningAnimationName = await button.evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(runningAnimationName).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();

    const frozenAnimationName = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(frozenAnimationName).toBe('none');

    // The button must still render while the pulse is frozen.
    await expect(page.getByRole('button', { name: 'Abrir invitación' })).toBeVisible();
  });

  test('the open button is a wine pill with a champagne-gold border', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const styles = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundImage: computed.backgroundImage,
        borderTopColor: computed.borderTopColor,
        borderRightColor: computed.borderRightColor,
        borderBottomColor: computed.borderBottomColor,
        borderLeftColor: computed.borderLeftColor,
        borderTopWidth: computed.borderTopWidth,
        color: computed.color,
        boxShadow: computed.boxShadow,
      };
    });

    // Anchored on the darker wine stop only (not the lighter one) so the white label clears
    // 7:1 contrast against it — see palette.test.ts for the measured ratio.
    expect(styles.backgroundImage).toContain('rgb(110, 36, 64)');
    expect(styles.backgroundImage).not.toContain('rgb(154, 68, 98)');
    expect(styles.borderTopColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderRightColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderBottomColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderLeftColor).toBe('rgb(205, 168, 105)');
    expect(parseFloat(styles.borderTopWidth)).toBeGreaterThan(0);
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(styles.boxShadow).not.toBe('none');
  });

  test('the open button has relief', async ({ page }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const styles = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        backgroundImage: computed.backgroundImage,
        boxShadow: computed.boxShadow,
        borderTopWidth: parseFloat(computed.borderTopWidth),
      };
    });

    const gradientCount = (styles.backgroundImage.match(/[a-z-]+-gradient\(/gi) ?? []).length;
    expect(gradientCount).toBeGreaterThanOrEqual(2);
    expect(styles.backgroundImage).toContain('rgb(110, 36, 64)');
    expect(styles.backgroundImage).not.toContain('rgb(154, 68, 98)');

    // Split the resolved `box-shadow` on top-level commas only — a layer's own colour may be an
    // `rgba(...)` with internal commas, so a naive `.split(',')` would cut a layer in half.
    const layers: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of styles.boxShadow) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        layers.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) layers.push(current.trim());

    // Computed `box-shadow` renders each layer as `<color> <offsets> [inset]` — the `inset`
    // keyword trails the layer rather than leading it.
    const insetLayers = layers.filter((layer) => layer.endsWith('inset'));
    const outerLayers = layers.filter((layer) => !layer.endsWith('inset'));
    expect(insetLayers.length).toBeGreaterThanOrEqual(2);
    expect(outerLayers.length).toBeGreaterThanOrEqual(2);

    expect(styles.borderTopWidth).toBeGreaterThanOrEqual(2);
  });

  test('the open button is large enough to read easily on a short phone screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(240);
    expect(box!.height).toBeGreaterThanOrEqual(56);

    const fontSize = await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(20);
  });

  test('the open button label grows larger on a wide desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const phoneFontSize = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await page.setViewportSize({ width: 1440, height: 800 });
    await page.reload();

    const desktopFontSize = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(desktopFontSize).toBeGreaterThan(phoneFontSize);
  });

  test('the open button label reads as premium serif with a visible keyboard focus', async ({
    page,
  }) => {
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const labelStyles = await button.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        fontWeight: Number(computed.fontWeight),
        letterSpacing: parseFloat(computed.letterSpacing),
        fontSize: parseFloat(computed.fontSize),
      };
    });

    // Different engines quote multi-word font names differently in computed style
    // (`"Playfair Display"` vs `Playfair Display`) — strip a leading quote before comparing.
    expect(labelStyles.fontFamily.replace(/^"/, '').startsWith('Playfair Display')).toBe(true);
    expect(labelStyles.fontWeight).toBeGreaterThanOrEqual(600);
    expect(labelStyles.letterSpacing).toBeGreaterThanOrEqual(0.05 * labelStyles.fontSize);

    // Tab is the button's natural keyboard path (it's the first focusable element in the DOM) —
    // real Tab navigation is what makes browsers apply `:focus-visible`, unlike a scripted
    // `.focus()` call.
    await page.keyboard.press('Tab');
    const focusedTestId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-testid') ?? null,
    );
    expect(focusedTestId).toBe('open-invitation-button');

    const outlineStyle = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe('none');
  });

  test('every cover animation freezes under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    // Sweep the whole cover: no element may keep a named CSS animation while the guest prefers
    // reduced motion — freezing must be an explicit `animation: none`, not a zeroed duration.
    const stillAnimated = await page.evaluate(() => {
      const cover = document.querySelector('[data-testid="cover"]');
      if (!cover) return ['missing-cover'];
      return [cover, ...cover.querySelectorAll('*')]
        .filter((el) => getComputedStyle(el).animationName !== 'none')
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    });

    expect(stillAnimated).toEqual([]);
  });

  test('every font the cover requests is self-hosted on our own origin', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (request) => {
      if (/\.(woff2?|ttf|otf)(\?.*)?$/i.test(request.url())) {
        fontRequests.push(request.url());
      }
    });

    await page.goto('./');
    await page.waitForLoadState('networkidle');

    expect(fontRequests.length).toBeGreaterThan(0);
    const pageOrigin = new URL(page.url()).origin;
    for (const url of fontRequests) {
      expect(new URL(url).origin).toBe(pageOrigin);
    }
  });

  test('does not render a gold frame around the cover', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByTestId('cover-frame')).toHaveCount(0);
  });

  test('the cover has depth and warm ambient light', async ({ page }) => {
    await page.goto('./');

    const coverBackground = await page
      .getByTestId('cover')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    const coverGradientCount = (coverBackground.match(/[a-z-]+-gradient\(/gi) ?? []).length;
    expect(coverGradientCount).toBeGreaterThanOrEqual(2);
    expect(coverBackground).toContain('radial-gradient');
    expect(coverBackground).toContain('linear-gradient');

    const light = page.getByTestId('cover-light');
    await expect(light).toHaveAttribute('aria-hidden', 'true');

    const lightStyles = await light.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        pointerEvents: computed.pointerEvents,
        backgroundImage: computed.backgroundImage,
      };
    });
    expect(lightStyles.pointerEvents).toBe('none');
    const lightGradientCount = (lightStyles.backgroundImage.match(/[a-z-]+-gradient\(/gi) ?? []).length;
    expect(lightGradientCount).toBeGreaterThanOrEqual(2);

    // With no frame to clip to, the light layer is bounded by the cover itself instead — no
    // inset rounding, just the cover's own box — and never spills past it horizontally.
    const coverBox = await page.getByTestId('cover').boundingBox();
    const lightBox = await light.boundingBox();
    expect(coverBox).not.toBeNull();
    expect(lightBox).not.toBeNull();
    const EDGE_TOLERANCE_PX = 1;
    expect(lightBox!.x).toBeGreaterThanOrEqual(coverBox!.x - EDGE_TOLERANCE_PX);
    expect(lightBox!.y).toBeGreaterThanOrEqual(coverBox!.y - EDGE_TOLERANCE_PX);
    expect(lightBox!.x + lightBox!.width).toBeLessThanOrEqual(
      coverBox!.x + coverBox!.width + EDGE_TOLERANCE_PX,
    );
    expect(lightBox!.y + lightBox!.height).toBeLessThanOrEqual(
      coverBox!.y + coverBox!.height + EDGE_TOLERANCE_PX,
    );

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);

    // Sits behind the arch: earlier in document order than the balloon-arch container (both are
    // absolutely positioned at the same stacking level, so paint order follows DOM order).
    const lightPrecedesArch = await page.evaluate(() => {
      const light = document.querySelector('[data-testid="cover-light"]');
      const arch = document.querySelector('[data-testid="balloon-arch"]');
      if (!light || !arch) return false;
      return !!(
        light.compareDocumentPosition(arch) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(lightPrecedesArch).toBe(true);
  });

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1440, height: 800 },
  ]) {
    test(`a warm glow sits behind the name at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');

      const glow = page.getByTestId('cover-glow');
      await expect(glow).toHaveAttribute('aria-hidden', 'true');

      const glowStyles = await glow.evaluate((el) => {
        const computed = getComputedStyle(el);
        return { pointerEvents: computed.pointerEvents };
      });
      expect(glowStyles.pointerEvents).toBe('none');

      const glowBox = await glow.boundingBox();
      expect(glowBox).not.toBeNull();
      const glowRect = glowBox!;

      for (const testId of ['cover-title-lead', 'cover-celebrant-name', 'open-invitation-button']) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box).not.toBeNull();
        const rect = box!;
        const centreX = rect.x + rect.width / 2;
        const centreY = rect.y + rect.height / 2;

        expect(centreX).toBeGreaterThanOrEqual(glowRect.x);
        expect(centreX).toBeLessThanOrEqual(glowRect.x + glowRect.width);
        expect(centreY).toBeGreaterThanOrEqual(glowRect.y);
        expect(centreY).toBeLessThanOrEqual(glowRect.y + glowRect.height);
      }

      const nameBox = await page.getByTestId('cover-celebrant-name').boundingBox();
      const nameCentre = {
        x: nameBox!.x + nameBox!.width / 2,
        y: nameBox!.y + nameBox!.height / 2,
      };
      const hitsName = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          const name = document.querySelector('[data-testid="cover-celebrant-name"]');
          return !!name && (el === name || name.contains(el));
        },
        nameCentre,
      );
      expect(hitsName).toBe(true);
    });
  }

  test('the cover stays within its render budget', async ({ page }) => {
    await page.goto('./');

    // All three figures are measured off the live cover, not the generator's planned inputs —
    // the arch is seeded/deterministic but the DOM/animation counts depend on everything actually
    // mounted under `.cover` (frame, light, glow, sparkles, button pulse, ...), so only a real
    // render proves the combined budget. Both arch layouts (portrait + landscape) are in the DOM
    // at once — only one is ever displayed — so the item-count budget covers both together.
    const budget = await page.evaluate(() => {
      const cover = document.querySelector('[data-testid="cover"]');
      if (!cover) return null;

      const coverElements = [cover, ...cover.querySelectorAll('*')];
      const runningAnimations = coverElements.filter(
        (el) => getComputedStyle(el).animationName !== 'none',
      );

      return {
        archItemCount: document.querySelectorAll('[data-arch-item]').length,
        coverElementCount: coverElements.length,
        runningAnimationCount: runningAnimations.length,
      };
    });

    expect(budget).not.toBeNull();
    expect(budget!.archItemCount).toBeLessThanOrEqual(200);
    expect(budget!.coverElementCount).toBeLessThanOrEqual(320);
    expect(budget!.runningAnimationCount).toBeLessThanOrEqual(50);
  });
});
