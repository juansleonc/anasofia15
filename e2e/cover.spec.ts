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

  test('the open button is a wine/rose gradient pill with a champagne-gold border', async ({ page }) => {
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

    // Rose at the top deepening to wine at the bottom; palette.test.ts proves the white label's
    // contrast on every stop.
    expect(styles.backgroundImage).toContain('rgb(158, 74, 99)');
    expect(styles.backgroundImage).toContain('rgb(154, 68, 98)');
    expect(styles.backgroundImage).toContain('rgb(110, 36, 64)');
    expect(styles.borderTopColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderRightColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderBottomColor).toBe('rgb(205, 168, 105)');
    expect(styles.borderLeftColor).toBe('rgb(205, 168, 105)');
    expect(parseFloat(styles.borderTopWidth)).toBeGreaterThan(0);
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(styles.boxShadow).not.toBe('none');
  });

  test('the open button has relief', async ({ page }) => {
    // Read the resting relief: while the pulse runs, the computed shadow is an interpolated
    // animation value re-serialised in another colour space.
    await page.emulateMedia({ reducedMotion: 'reduce' });
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

    // The drop layers (those cast downward, as opposed to the flat gold ring) are deep wine.
    // Engines serialise a `color-mix()` either as `rgba(r, g, b, a)` or as
    // `color(srgb r g b / a)` with 0-1 channels, so both forms are read back to 0-255.
    const layerRgb = (layer: string): number[] | null => {
      const rgb = layer.match(/rgba?\((\d+), (\d+), (\d+)/);
      if (rgb) return rgb.slice(1, 4).map(Number);
      const srgb = layer.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
      return srgb ? srgb.slice(1, 4).map((channel) => Math.round(Number(channel) * 255)) : null;
    };
    const dropLayers = outerLayers.filter((layer) => {
      const offsets = layer.match(/(-?[\d.]+)px (-?[\d.]+)px/);
      return !!offsets && Number(offsets[2]) > 0;
    });
    expect(dropLayers.length).toBeGreaterThanOrEqual(2);
    for (const layer of dropLayers) {
      expect(layerRgb(layer)).toEqual([110, 36, 64]);
    }

    expect(styles.borderTopWidth).toBeGreaterThanOrEqual(2);
  });

  test('the open button is large enough to read easily on a short phone screen, without crowding it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(264);
    // Roomy, but never wider than 80% of a narrow viewport.
    expect(box!.width).toBeLessThanOrEqual(0.8 * 375);
    expect(box!.height).toBeGreaterThanOrEqual(56);

    const fontSize = await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(20);
  });

  test('the open button label grows larger and the pill wider and taller on a wide desktop viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const phoneFontSize = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await page.setViewportSize({ width: 1440, height: 800 });
    await page.reload();

    const button = page.getByRole('button', { name: 'Abrir invitación' });
    const desktopFontSize = await button.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(desktopFontSize).toBeGreaterThan(phoneFontSize);
    expect(desktopFontSize).toBeGreaterThanOrEqual(22);

    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(340);
    expect(box!.height).toBeGreaterThanOrEqual(60);
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
    // Round-3 feedback: the earlier >= 0.05em floor let tracking run wide enough to make the
    // label look smaller; it is now a band so the tracking stays roomy but never loose.
    const letterSpacingEm = labelStyles.letterSpacing / labelStyles.fontSize;
    expect(letterSpacingEm).toBeGreaterThanOrEqual(0.04);
    expect(letterSpacingEm).toBeLessThanOrEqual(0.06);

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
    const coverGradients = coverBackground.match(/[a-z-]+-gradient\(/gi) ?? [];
    expect(coverGradients.length).toBeGreaterThanOrEqual(4);
    expect(coverGradients.filter((g) => g === 'radial-gradient(').length).toBeGreaterThanOrEqual(3);
    expect(coverGradients.filter((g) => g === 'linear-gradient(')).toHaveLength(1);

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

  // Nov 2026 user-feedback pass: "mucho espacio vacío en el centro" — the arch is getting airier
  // in a parallel task, so the cover's own centre needed more presence: bigger type, a flourish,
  // and a tight ring of extra sparkles (below), rather than more clutter.
  test('the celebrant name is large enough to fill the centre at 375 and 390 and grows further on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('./');

    const nameFontSize375 = await page
      .getByTestId('cover-celebrant-name')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    // The name must fit the arch's clear zone on ONE line at every phone size (see the "single
    // line" test below), so its size is derived from the available width rather than a fixed
    // target; these floors are the measured render on the merged garland/type/atmosphere lanes.
    expect(nameFontSize375).toBeGreaterThanOrEqual(68);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();

    const nameFontSize390 = await page
      .getByTestId('cover-celebrant-name')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(nameFontSize390).toBeGreaterThanOrEqual(71);

    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1440, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();

      const nameFontSizeDesktop = await page
        .getByTestId('cover-celebrant-name')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(nameFontSizeDesktop).toBeGreaterThanOrEqual(145);
    }
  });

  test('at 1366x768 the button stays above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./');

    const buttonBox = await page
      .getByRole('button', { name: 'Abrir invitación' })
      .boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(0.95 * 768);
  });

  test('the name is deep wine', async ({ page }) => {
    await page.goto('./');

    const color = await page
      .getByTestId('cover-celebrant-name')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(110, 36, 64)');
  });

  test('the lead is deep wine', async ({ page }) => {
    await page.goto('./');

    const color = await page
      .getByTestId('cover-title-lead')
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(74, 21, 37)');
  });

  for (const { viewport, minLeadPx } of [
    { viewport: { width: 375, height: 667 }, minLeadPx: 23 },
    { viewport: { width: 1440, height: 800 }, minLeadPx: 34 },
  ]) {
    test(`the lead line is large and centred with the name at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const measured = await page.evaluate(() => {
        const centreX = (selector: string) => {
          const rect = document.querySelector(selector)!.getBoundingClientRect();
          return rect.left + rect.width / 2;
        };
        const lead = document.querySelector('[data-testid="cover-title-lead"]') as HTMLElement;
        return {
          leadFontSize: parseFloat(getComputedStyle(lead).fontSize),
          coverCentre: centreX('[data-testid="cover"]'),
          leadCentre: centreX('[data-testid="cover-title-lead"]'),
          nameCentre: centreX('[data-testid="cover-celebrant-name"]'),
        };
      });

      expect(measured.leadFontSize).toBeGreaterThanOrEqual(minLeadPx);
      expect(Math.abs(measured.leadCentre - measured.coverCentre)).toBeLessThanOrEqual(2);
      expect(Math.abs(measured.nameCentre - measured.coverCentre)).toBeLessThanOrEqual(2);
    });
  }

  // Nov 2026 fix-cover pass: the name used to wrap onto two lines ("Ana" / "Sofía") at narrow
  // viewports because its font-size clamp grew independently of the room it had to fit in.
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
    { width: 1440, height: 800 },
  ]) {
    test(`the celebrant name always renders on one line at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const measurements = await page.evaluate(() => {
        const name = document.querySelector('[data-testid="cover-celebrant-name"]') as HTMLElement;
        const title = document.querySelector('.cover__title') as HTMLElement;
        const cover = document.querySelector('[data-testid="cover"]') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(name);
        const clearVar =
          window.innerWidth >= window.innerHeight ? '--arch-clear-landscape' : '--arch-clear-portrait';
        return {
          lineTops: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size,
          nameWidth: name.getBoundingClientRect().width,
          titleWidth: title.getBoundingClientRect().width,
          clearWidthPx: parseFloat(getComputedStyle(cover).getPropertyValue(clearVar)) * window.innerWidth,
        };
      });

      // A wrapped inline-block still reports a single box for *itself*, so the line count has to
      // come from a Range over its text, which fragments per visual line; distinct tops rather
      // than a rect count, since one line can still yield several rects.
      expect(measurements.lineTops).toBe(1);
      expect(measurements.nameWidth).toBeLessThanOrEqual(measurements.titleWidth + 1);
      // Never sized past what the arch's clear zone can hold, so it can't grow into the balloons —
      // checked directly against the rendered box width rather than a font-size proxy.
      expect(measurements.nameWidth).toBeLessThanOrEqual(measurements.clearWidthPx + 1);
    });
  }

  // The lead used to leave an orphan last word ("de" alone) at 1440: it must fit one line there
  // and, on phones, split into at most two lines of comparable length.
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1440, height: 800 },
  ]) {
    test(`the lead line splits evenly with no orphan at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const lineWidths = await page.evaluate(() => {
        const lead = document.querySelector('[data-testid="cover-title-lead"]') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(lead);
        const widthByTop = new Map<number, number>();
        for (const rect of range.getClientRects()) {
          const top = Math.round(rect.top);
          widthByTop.set(top, (widthByTop.get(top) ?? 0) + rect.width);
        }
        return [...widthByTop.values()];
      });

      expect(lineWidths.length).toBeGreaterThanOrEqual(1);
      expect(lineWidths.length).toBeLessThanOrEqual(viewport.width >= 1440 ? 1 : 2);
      expect(Math.min(...lineWidths) / Math.max(...lineWidths)).toBeGreaterThanOrEqual(0.45);
    });
  }

  // Coordinator feedback: the lead and name used to read as two loosely related lines (a large
  // empty band between them) rather than one cohesive block.
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1440, height: 800 },
  ]) {
    test(`the lead sits close above the name as one cohesive block at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const { gap, nameFontSize } = await page.evaluate(() => {
        const lead = document.querySelector('[data-testid="cover-title-lead"]') as HTMLElement;
        const name = document.querySelector('[data-testid="cover-celebrant-name"]') as HTMLElement;
        const leadRange = document.createRange();
        leadRange.selectNodeContents(lead);
        const nameRange = document.createRange();
        nameRange.selectNodeContents(name);
        const leadRects = leadRange.getClientRects();
        const nameRects = nameRange.getClientRects();
        const leadLastLine = leadRects[leadRects.length - 1];
        const nameFirstLine = nameRects[0];
        return {
          gap: nameFirstLine.top - leadLastLine.bottom,
          nameFontSize: parseFloat(getComputedStyle(name).fontSize),
        };
      });

      // Measured off the actual text (Range), not the elements' own box edges — a box's
      // line-height adds leading inside its own edges, which would hide exactly the whitespace
      // this test is meant to catch.
      //
      // Nov 2026 user-feedback pass: widened from 0.2 to 0.25 for the slightly larger box-edge
      // gap added below (the "breathe further apart" tests) — still well inside the title-cohesion
      // ceiling of 0.35 × name font-size.
      expect(gap / nameFontSize).toBeLessThanOrEqual(0.25);
      expect(gap).toBeGreaterThanOrEqual(0);
    });
  }

  // Nov 2026 user-feedback pass: the block above reads as cohesive, but the user still wanted a
  // touch more breathing room between the lead and the name (+12-16px over the box edges, not the
  // glyph ink measured above).
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1366, height: 768 },
    { width: 1440, height: 800 },
  ]) {
    test(`the lead and the name breathe further apart at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const gap = await page.evaluate(() => {
        const lead = document.querySelector('[data-testid="cover-title-lead"]') as HTMLElement;
        const name = document.querySelector('[data-testid="cover-celebrant-name"]') as HTMLElement;
        const leadBox = lead.getBoundingClientRect();
        const nameBox = name.getBoundingClientRect();
        return nameBox.top - leadBox.bottom;
      });

      expect(gap).toBeGreaterThanOrEqual(14);
      expect(gap).toBeLessThanOrEqual(19);
    });
  }

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 1440, height: 800 },
  ]) {
    test(`the name clearly dominates the lead at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const fontSizeOf = (testId: string) =>
        page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      const nameFontSize = await fontSizeOf('cover-celebrant-name');
      const leadFontSize = await fontSizeOf('cover-title-lead');

      expect(nameFontSize / leadFontSize).toBeGreaterThanOrEqual(2.6);
    });
  }

  test('a champagne flourish divider sits between the name and the button', async ({ page }) => {
    await page.goto('./');

    const flourish = page.getByTestId('cover-flourish');
    await expect(flourish).toHaveAttribute('aria-hidden', 'true');

    const domOrder = await page.evaluate(() => {
      const name = document.querySelector('[data-testid="cover-celebrant-name"]');
      const flourishEl = document.querySelector('[data-testid="cover-flourish"]');
      const button = document.querySelector('[data-testid="open-invitation-button"]');
      if (!name || !flourishEl || !button) return null;
      return {
        nameBeforeFlourish: !!(
          name.compareDocumentPosition(flourishEl) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        flourishBeforeButton: !!(
          flourishEl.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
      };
    });
    expect(domOrder).toEqual({ nameBeforeFlourish: true, flourishBeforeButton: true });

    const nameBox = await page.getByTestId('cover-celebrant-name').boundingBox();
    const flourishBox = await flourish.boundingBox();
    const buttonBox = await page.getByRole('button', { name: 'Abrir invitación' }).boundingBox();
    expect(nameBox).not.toBeNull();
    expect(flourishBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();

    // Vertically between the two — the divider's own box starts at/after the name's bottom edge
    // and ends at/before the button's top edge.
    expect(flourishBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 1);
    expect(flourishBox!.y + flourishBox!.height).toBeLessThanOrEqual(buttonBox!.y + 1);
  });

  test('a few extra soft sparkles concentrate in a ring around the title block', async ({ page }) => {
    await page.goto('./');

    const ring = page.getByTestId('cover-title-sparkles');
    await expect(ring).toHaveAttribute('aria-hidden', 'true');

    const items = page.locator('[data-title-sparkle]');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThanOrEqual(3);

    const kinds = await items.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute('data-title-sparkle')),
    );
    for (const kind of kinds) {
      // Reuses the existing soft kinds only — no square chip, and bokeh would just blur over the
      // letters at this tight a radius.
      expect(['glow', 'star']).toContain(kind);
    }

    const h1Box = await page.locator('h1.cover__title').boundingBox();
    const ringBox = await ring.boundingBox();
    expect(h1Box).not.toBeNull();
    expect(ringBox).not.toBeNull();

    // Loosely centred on the title block, not drifted off into a corner of the page.
    const TOLERANCE_PX = 80;
    expect(ringBox!.x).toBeGreaterThanOrEqual(h1Box!.x - TOLERANCE_PX);
    expect(ringBox!.x + ringBox!.width).toBeLessThanOrEqual(h1Box!.x + h1Box!.width + TOLERANCE_PX);
    expect(ringBox!.y).toBeGreaterThanOrEqual(h1Box!.y - TOLERANCE_PX);
    expect(ringBox!.y + ringBox!.height).toBeLessThanOrEqual(h1Box!.y + h1Box!.height + TOLERANCE_PX);
  });

  test('the title sparkle ring freezes under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');

    const stillAnimated = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-title-sparkle]');
      return [...items].filter((el) => getComputedStyle(el).animationName !== 'none').length;
    });
    expect(stillAnimated).toBe(0);
  });

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
    expect(budget!.runningAnimationCount).toBeLessThanOrEqual(46);
  });
});
