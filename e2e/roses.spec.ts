import { test, expect } from '@playwright/test';

// The rose sprite sheet (`RoseSprite.astro`) must be mounted exactly once per page so every
// `rose-bloom`/`rose-bud`/`rose-leaf` id it defines is unique in the document, and it must stay
// invisible to both sighted layout and assistive tech — it exists purely so `Rose.astro`
// instances elsewhere on the page can reference its shapes via `<use>`.

test.describe('Rose sprite', () => {
  test('defines each rose symbol id exactly once', async ({ page }) => {
    await page.goto('./');

    const idCounts = await page.evaluate(() => {
      const ids = ['rose-bloom', 'rose-bud', 'rose-leaf'];
      return Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`#${id}`).length]),
      );
    });

    expect(idCounts).toEqual({ 'rose-bloom': 1, 'rose-bud': 1, 'rose-leaf': 1 });
  });

  test('is hidden from layout and from assistive tech', async ({ page }) => {
    await page.goto('./');

    const sprite = page.getByTestId('rose-sprite');
    await expect(sprite).toHaveAttribute('aria-hidden', 'true');

    const box = await sprite.boundingBox();
    expect(box?.width ?? -1).toBe(0);
    expect(box?.height ?? -1).toBe(0);
  });
});

test.describe('Arch sprite', () => {
  test('defines each arch symbol id exactly once', async ({ page }) => {
    await page.goto('./');

    const idCounts = await page.evaluate(() => {
      const ids = [
        'balloon-pink',
        'balloon-rosegold',
        'balloon-rosegold-satin',
        'balloon-champagne',
        'balloon-champagne-satin',
        'balloon-gloss',
        'rose-pink',
        'rose-cream',
        'peony-blush',
        'peony-ivory',
        'rosebud',
        'blossom',
        'leaf-eucalyptus',
        'leaf-olive',
        'leaf-gold',
        'leaf-laurel-cluster',
        'leaf-eucalyptus-cluster',
        'sparkle-star',
      ];
      return Object.fromEntries(
        ids.map((id) => [id, document.querySelectorAll(`#${id}`).length]),
      );
    });

    expect(idCounts).toEqual({
      'balloon-pink': 1,
      'balloon-rosegold': 1,
      'balloon-rosegold-satin': 1,
      'balloon-champagne': 1,
      'balloon-champagne-satin': 1,
      'balloon-gloss': 1,
      'rose-pink': 1,
      'rose-cream': 1,
      'peony-blush': 1,
      'peony-ivory': 1,
      rosebud: 1,
      blossom: 1,
      'leaf-eucalyptus': 1,
      'leaf-olive': 1,
      'leaf-gold': 1,
      'leaf-laurel-cluster': 1,
      'leaf-eucalyptus-cluster': 1,
      'sparkle-star': 1,
    });
  });

  test('is hidden from layout and from assistive tech', async ({ page }) => {
    await page.goto('./');

    const sprite = page.getByTestId('arch-sprite');
    await expect(sprite).toHaveAttribute('aria-hidden', 'true');

    const box = await sprite.boundingBox();
    expect(box?.width ?? -1).toBe(0);
    expect(box?.height ?? -1).toBe(0);
  });
});

// Real-geometry check of the arch roses, complementing the path-parsing unit tests: the symbol's
// shapes are cloned into a visible probe <svg> so the browser can measure them with their actual
// transforms and curves.
test.describe('Arch roses render as round blooms', () => {
  for (const id of ['rose-pink', 'rose-cream']) {
    test(`${id} has a near-circular outline`, async ({ page }) => {
      await page.goto('./');

      const result = await page.evaluate((symbolId) => {
        const NS = 'http://www.w3.org/2000/svg';
        const symbol = document.getElementById(symbolId)!;
        const probe = document.createElementNS(NS, 'svg');
        probe.setAttribute('viewBox', symbol.getAttribute('viewBox') ?? '0 0 64 64');
        probe.setAttribute('width', '256');
        probe.setAttribute('height', '256');
        probe.style.cssText = 'position:fixed;left:0;top:0';
        for (const child of Array.from(symbol.children)) probe.appendChild(child.cloneNode(true));
        document.body.appendChild(probe);

        const petals = Array.from(probe.querySelectorAll('path')).filter((path) => (path.getAttribute('fill') ?? '').startsWith(`url(#${symbolId}-`));
        const rects = petals.map((petal) => petal.getBoundingClientRect());
        const width = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
        const height = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
        probe.remove();
        return { petals: petals.length, aspect: width / height };
      }, id);

      expect(result.petals).toBeGreaterThanOrEqual(12);
      expect(result.aspect).toBeGreaterThanOrEqual(0.85);
      expect(result.aspect).toBeLessThanOrEqual(1.15);
    });
  }
});

// Pixel-level proof that a flower paints nothing beyond its own petals: each symbol's live <defs>
// and one <use> of it are cloned into a standalone SVG (every `var(--c-*)` swapped for its
// computed value, since an offscreen canvas image can't see the page's stylesheet), drawn through
// a data-URL <img> onto a canvas, then read back with getImageData. R (the outermost petal radius,
// in the symbol's own units) is measured the same way the unit tests measure it — the farthest any
// petal-path point (anchors and control points, carried through every ancestor transform) lies from
// the bloom centre — so a stray ring of paint past the petals shows up as nonzero alpha outside it.
const FLOWER_PETAL_FILLS: Record<string, string[]> = {
  'rose-pink': ['rose-pink-outer', 'rose-pink-mid', 'rose-pink-inner'],
  'rose-cream': ['rose-cream-outer', 'rose-cream-mid', 'rose-cream-inner'],
  'peony-blush': ['peony-blush-outer', 'peony-blush-mid', 'peony-blush-inner'],
  'peony-ivory': ['peony-ivory-outer', 'peony-ivory-mid', 'peony-ivory-inner'],
  rosebud: ['rose-pink-outer', 'rose-pink-mid'],
};

test.describe('Arch flowers have no halo', () => {
  for (const [symbolId, petalFillIds] of Object.entries(FLOWER_PETAL_FILLS)) {
    test(`${symbolId} paints nothing beyond its own petals`, async ({ page }) => {
      await page.goto('./');

      const result = await page.evaluate(
        ({ symbolId, petalFillIds }) => {
          const NS = 'http://www.w3.org/2000/svg';
          const symbolEl = document.getElementById(symbolId)!;
          const [, , width] = (symbolEl.getAttribute('viewBox') ?? '0 0 64 64').split(/\s+/).map(Number);
          const center: [number, number] = [width / 2, width / 2];

          const rawPoints = (d: string): [number, number][] => {
            const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
            const points: [number, number][] = [];
            for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
            return points;
          };
          const applyTransform = (transform: string, [x, y]: [number, number]): [number, number] => {
            const ops = Array.from(transform.matchAll(/(translate|rotate)\(([^)]+)\)/g));
            let px = x;
            let py = y;
            for (let i = ops.length - 1; i >= 0; i--) {
              const args = ops[i][2].trim().split(/[\s,]+/).map(Number);
              if (ops[i][1] === 'translate') {
                const [tx, ty = 0] = args;
                px += tx;
                py += ty;
              } else {
                const [deg, cx = 0, cy = 0] = args;
                const rad = (deg * Math.PI) / 180;
                const dx = px - cx;
                const dy = py - cy;
                px = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
                py = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
              }
            }
            return [px, py];
          };

          let maxR = 0;
          const petals = Array.from(symbolEl.querySelectorAll('path')).filter((path) =>
            petalFillIds.some((fillId) => path.getAttribute('fill') === `url(#${fillId})`),
          );
          for (const petal of petals) {
            for (const point of rawPoints(petal.getAttribute('d') ?? '')) {
              let p = point;
              for (let el: Element | null = petal; el && el !== symbolEl; el = el.parentElement) {
                const t = el.getAttribute('transform');
                if (t) p = applyTransform(t, p);
              }
              maxR = Math.max(maxR, Math.hypot(p[0] - center[0], p[1] - center[1]));
            }
          }

          // `<use>` only resolves against ids in the *same* document, so the standalone SVG needs
          // both the shared gradient `<defs>` and the target `<symbol>` itself, not just the defs.
          const defs = document.querySelector('[data-testid="arch-sprite"] defs')!;
          const rootStyle = getComputedStyle(document.documentElement);
          const substituteTokens = (markup: string): string =>
            markup.replace(/var\((--c-[\w-]+)\)/g, (_match, token: string) => rootStyle.getPropertyValue(token).trim() || '#000');
          const serializer = new XMLSerializer();
          const defsMarkup = substituteTokens(serializer.serializeToString(defs));
          const symbolMarkup = substituteTokens(serializer.serializeToString(symbolEl));

          const svg = `<svg xmlns="${NS}" width="256" height="256"><defs>${defsMarkup}</defs>${symbolMarkup}<use href="#${symbolId}" width="256" height="256" /></svg>`;

          return new Promise<{ tainted: boolean; scale: number; r: number; pixels: number[] }>((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d')!;
            const img = new Image();
            img.onload = () => {
              ctx.clearRect(0, 0, 256, 256);
              ctx.drawImage(img, 0, 0, 256, 256);
              try {
                const data = ctx.getImageData(0, 0, 256, 256);
                resolve({ tainted: false, scale: 256 / width, r: maxR, pixels: Array.from(data.data) });
              } catch {
                resolve({ tainted: true, scale: 256 / width, r: maxR, pixels: [] });
              }
            };
            img.onerror = () => reject(new Error('the isolated flower SVG failed to decode as an image'));
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          });
        },
        { symbolId, petalFillIds },
      );

      // Fallback if the canvas is ever tainted in some browser/runner combination: the test still
      // has to prove the pixels, not just skip, so fail loudly instead of passing vacuously.
      expect(result.tainted).toBe(false);

      const rPx = result.r * result.scale;
      let maxAlphaOuter = 0;
      let maxAlphaBand = 0;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const alpha = result.pixels[(y * 256 + x) * 4 + 3];
          const r = Math.hypot(x + 0.5 - 128, y + 0.5 - 128);
          if (r >= 1.1 * rPx) {
            maxAlphaOuter = Math.max(maxAlphaOuter, alpha);
          } else if (r >= rPx) {
            maxAlphaBand = Math.max(maxAlphaBand, alpha);
          }
        }
      }

      expect(maxAlphaOuter).toBeLessThanOrEqual(12);
      expect(maxAlphaBand).toBeLessThanOrEqual(64);
    });
  }
});
