// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';

// `ArchSprite.astro` stays static markup (no `{expressions}`) specifically so this file can parse
// it the same way a browser would: slice out the `<svg>…</svg>` sheet and run it through
// `DOMParser`. That lets every art-richness rule the premium cover pass needs (stop counts, shared
// shapes pulled in through `<use>`, no raster filters) live in one place instead of being eyeballed
// per screenshot.

const TEST_DIR = fileURLToPath(new NodeURL('.', import.meta.url));
const SPRITE_PATH = join(TEST_DIR, '..', '..', 'components', 'ArchSprite.astro');

function loadSpriteRoot(): Element {
  const source = readFileSync(SPRITE_PATH, 'utf-8');
  // Drop the Astro frontmatter (the `---`-fenced comment block) before slicing out the sprite:
  // its prose mentions `<svg>`/`<defs>`/`<symbol>` as plain words, and matching from the first
  // literal "<svg" in the whole file would grab that text instead of the real markup below it.
  const body = source.replace(/^---[\s\S]*?---\n/, '');
  const match = body.match(/<svg[\s\S]*<\/svg>/);
  if (!match) {
    throw new Error('ArchSprite.astro has no <svg>…</svg> sheet to parse');
  }
  const doc = new DOMParser().parseFromString(match[0], 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`ArchSprite.astro's sprite sheet is not well-formed XML: ${parserError.textContent}`);
  }
  return doc.documentElement;
}

const root = loadSpriteRoot();

/** A `<symbol id="…">` from the sprite, or a thrown error naming the missing id. */
function symbol(id: string): Element {
  const el = root.querySelector(`symbol#${id}`);
  if (!el) {
    throw new Error(`no <symbol id="${id}"> in the sprite`);
  }
  return el;
}

/** A gradient (or any other) def from the sprite, by id. */
function gradient(id: string): Element {
  const el = root.querySelector(`#${id}`);
  if (!el) {
    throw new Error(`no def with id "${id}" in the sprite`);
  }
  return el;
}

function useTargets(el: Element): Element[] {
  const targets: Element[] = [];
  for (const use of Array.from(el.querySelectorAll('use'))) {
    const href = use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? '';
    if (!href.startsWith('#')) continue;
    const target = root.querySelector(`#${href.slice(1)}`);
    if (target) targets.push(target);
  }
  return targets;
}

/** Counts elements inside `el` that match `selector`, following `<use href="#…">` into the
 *  symbols it references (e.g. a balloon's `<use href="#balloon-gloss">` pulls `balloon-gloss`'s
 *  own shapes into the count) so shared, reused art still gets counted where it's displayed. */
function countDeep(el: Element, selector: string, seen: Set<Element> = new Set()): number {
  if (seen.has(el)) return 0;
  seen.add(el);
  let count = el.querySelectorAll(selector).length;
  for (const target of useTargets(el)) {
    count += countDeep(target, selector, seen);
  }
  return count;
}

const CHROME_BALLOONS = ['balloon-rosegold', 'balloon-champagne'];
const SATIN_BALLOONS = ['balloon-rosegold-satin', 'balloon-champagne-satin'];
const ALL_BALLOONS = ['balloon-pink', ...CHROME_BALLOONS, ...SATIN_BALLOONS];

// Each balloon's knot is tone-matched (a darker shade of its own body colour) rather than every
// tone sharing one wine-coloured knot; chrome and satin siblings of the same tone share a gradient.
const KNOT_GRADIENT_BY_BALLOON: Record<string, string> = {
  'balloon-pink': 'balloon-pink-knot',
  'balloon-rosegold': 'balloon-rosegold-knot',
  'balloon-rosegold-satin': 'balloon-rosegold-knot',
  'balloon-champagne': 'balloon-champagne-knot',
  'balloon-champagne-satin': 'balloon-champagne-knot',
};

function stopColors(el: Element): string[] {
  return Array.from(el.querySelectorAll('stop')).map((stop) => stop.getAttribute('style') ?? '');
}

/** A loose bounding box for a simple `path` `d` string: every numeric token is treated as
 *  alternating x/y coordinates (true for the M/L/H/V/C/S/Q/T/Z commands the sprite's small shapes
 *  use), so control points slightly widen the box but it never under-reports a shape's extent —
 *  good enough to check "this knot shrank" without a full path-geometry engine. */
function pathBoundingBox(d: string): { width: number; height: number } {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    xs.push(numbers[i]);
    ys.push(numbers[i + 1]);
  }
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

describe('ArchSprite balloons', () => {
  it('gives every balloon tone both a chrome and a satin finish, pink stays pearl', () => {
    expect(ALL_BALLOONS).toEqual(
      expect.arrayContaining(['balloon-pink', 'balloon-rosegold', 'balloon-rosegold-satin', 'balloon-champagne', 'balloon-champagne-satin']),
    );
    expect(root.querySelector('symbol#balloon-pink-satin')).toBeNull();
  });

  it.each(ALL_BALLOONS)('%s has a body gradient with at least 6 stops, all token colours', (id) => {
    const bodyGradient = gradient(`${id}-gradient`);
    const stops = stopColors(bodyGradient);
    expect(stops.length).toBeGreaterThanOrEqual(6);
    for (const style of stops) {
      expect(style).toMatch(/stop-color:\s*var\(--c-/);
    }
  });

  it.each(ALL_BALLOONS)('%s has a contact shadow, an environment tint and a knot', (id) => {
    const el = symbol(id);
    expect(el.querySelector('[fill="url(#balloon-contact-shadow)"]')).not.toBeNull();
    expect(el.querySelector('[fill="url(#balloon-env-tint)"]')).not.toBeNull();
    expect(el.querySelector(`[fill="url(#${KNOT_GRADIENT_BY_BALLOON[id]})"]`)).not.toBeNull();
  });

  it.each(ALL_BALLOONS)('%s reuses the shared gloss via <use>', (id) => {
    const el = symbol(id);
    expect(el.querySelector('use[href="#balloon-gloss"]')).not.toBeNull();
  });

  it.each(CHROME_BALLOONS)('%s (chrome) carries a reflection band', (id) => {
    const el = symbol(id);
    expect(el.querySelector(`[fill="url(#${id}-chrome-band)"]`)).not.toBeNull();
  });

  it.each(SATIN_BALLOONS)('%s (satin) has no reflection band', (id) => {
    const el = symbol(id);
    const bandFill = Array.from(el.querySelectorAll('[fill]')).find((node) =>
      (node.getAttribute('fill') ?? '').includes('chrome-band'),
    );
    expect(bandFill).toBeUndefined();
  });

  it('balloon bodies stay within their element budget (8 own shapes + the shared gloss use)', () => {
    for (const id of ALL_BALLOONS) {
      const ownChildren = symbol(id).children.length;
      expect(ownChildren).toBeLessThanOrEqual(9); // 8 own shapes + the <use> pulling in the gloss
    }
  });

  it.each(ALL_BALLOONS)("%s's knot is a small, rounded, tone-matched shape with a tiny highlight", (id) => {
    const el = symbol(id);
    const knotGradientId = KNOT_GRADIENT_BY_BALLOON[id];
    const knotPath = el.querySelector(`path[fill="url(#${knotGradientId})"]`);
    expect(knotPath).not.toBeNull();
    // Rounded/pinched, not the old flat-edged triangle: expect a curve command, not just lines.
    expect(knotPath!.getAttribute('d')).toMatch(/[cCqQ]/);
    const bbox = pathBoundingBox(knotPath!.getAttribute('d') ?? '');
    // The old knot ("M50 92l-6 10h12l-6-10Z") was 12 wide x 10 tall; ~60% of that is 7.2 x 6 —
    // give a little slack for the rounding control points without losing the "smaller" intent.
    expect(bbox.width).toBeLessThanOrEqual(8);
    expect(bbox.height).toBeLessThanOrEqual(7);
    // A tiny highlight sibling near the knot (not the knot shape itself, not the shared gloss).
    const highlight = Array.from(el.querySelectorAll('ellipse, circle')).find(
      (shape) => shape !== knotPath && Number(shape.getAttribute('cy') ?? '0') > 85,
    );
    expect(highlight).not.toBeUndefined();
  });

  it('no balloon uses the old one-size wine knot gradient', () => {
    expect(root.querySelector('#balloon-knot')).toBeNull();
    for (const id of ALL_BALLOONS) {
      expect(symbol(id).querySelector('[fill="url(#balloon-knot)"]')).toBeNull();
    }
  });
});

describe('ArchSprite chrome reflection band', () => {
  it.each(CHROME_BALLOONS)('%s band follows the sphere curvature with an elliptical arc', (id) => {
    const el = symbol(id);
    const band = el.querySelector(`[fill="url(#${id}-chrome-band)"]`);
    expect(band).not.toBeNull();
    expect(band!.getAttribute('d')).toMatch(/[Aa]/);
  });

  it.each(CHROME_BALLOONS)('%s band gradient feathers to 0 opacity at both ends', (id) => {
    const bandGradient = gradient(`${id}-chrome-band`);
    const stops = Array.from(bandGradient.querySelectorAll('stop'));
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0].getAttribute('stop-opacity')).toBe('0');
    expect(stops[stops.length - 1].getAttribute('stop-opacity')).toBe('0');
  });

  it.each(CHROME_BALLOONS)('%s band is lower-contrast than a hard liquid-line stripe', (id) => {
    const bandGradient = gradient(`${id}-chrome-band`);
    const stops = Array.from(bandGradient.querySelectorAll('stop'));
    const innerOpacities = stops.slice(1, -1).map((stop) => Number(stop.getAttribute('stop-opacity')));
    for (const opacity of innerOpacities) {
      expect(opacity).toBeLessThanOrEqual(0.35);
    }
  });
});

describe('ArchSprite gloss', () => {
  it('has a soft highlight, a specular hot spot, a secondary reflection and a stroked rim', () => {
    const gloss = symbol('balloon-gloss');
    expect(gloss.querySelector('[fill="url(#balloon-gloss-soft)"]')).not.toBeNull();
    expect(gloss.querySelector('[fill="url(#balloon-gloss-spec)"]')).not.toBeNull();
    expect(gloss.querySelector('[fill="url(#balloon-gloss-secondary)"]')).not.toBeNull();
    const rim = Array.from(gloss.querySelectorAll('path')).find(
      (path) => path.getAttribute('stroke') && path.getAttribute('stroke') !== 'none',
    );
    expect(rim).not.toBeUndefined();
    expect(rim!.getAttribute('fill')).toBe('none');
  });

  it('stays within its element budget (4 shapes, up to 5)', () => {
    const children = symbol('balloon-gloss').children.length;
    expect(children).toBeGreaterThanOrEqual(4);
    expect(children).toBeLessThanOrEqual(5);
  });
});

describe('ArchSprite perf guard', () => {
  it('has no <filter> element anywhere in the sprite', () => {
    expect(root.querySelectorAll('filter').length).toBe(0);
  });

  it('stays within the sprite-wide gradient budget (<= 40 defs)', () => {
    const count = root.querySelectorAll('linearGradient, radialGradient').length;
    expect(count).toBeLessThanOrEqual(40);
  });
});

// Each rose tone shares the same petal geometry (the "accepted duplication" from the design doc)
// but paints its three rings — outer/mid/inner — from its own tone-specific gradient trio, so a
// "petal path" is any path filled from one of those three ring gradients (as opposed to the
// center spiral bud or the curl-highlight stroke, which are not counted as petals).
const ROSE_IDS = ['rose-pink', 'rose-cream'];
const roseRingGradientIds = (id: string): string[] => [`${id}-outer`, `${id}-mid`, `${id}-inner`];

function petalPaths(el: Element, ringGradientIds: string[]): Element[] {
  return Array.from(el.querySelectorAll('path')).filter((path) =>
    ringGradientIds.some((ringId) => path.getAttribute('fill') === `url(#${ringId})`),
  );
}

describe('ArchSprite flowers', () => {
  it.each(ROSE_IDS)('%s has at least 12 petal paths drawn from 3 distinct ring gradients', (id) => {
    const el = symbol(id);
    const ringIds = roseRingGradientIds(id);
    for (const ringId of ringIds) {
      expect(root.querySelector(`#${ringId}`)).not.toBeNull();
    }
    const petals = petalPaths(el, ringIds);
    expect(petals.length).toBeGreaterThanOrEqual(12);
    for (const ringId of ringIds) {
      expect(petals.some((petal) => petal.getAttribute('fill') === `url(#${ringId})`)).toBe(true);
    }
  });

  it.each(ROSE_IDS)('%s stays within its element budget (<= 18 elements)', (id) => {
    expect(symbol(id).children.length).toBeLessThanOrEqual(18);
  });

  it.each(ROSE_IDS)('%s has a multi-subpath curl-highlight stroke along the petal rims', (id) => {
    const el = symbol(id);
    const highlight = Array.from(el.querySelectorAll('path')).find((path) => {
      const stroke = path.getAttribute('stroke') ?? '';
      return path.getAttribute('fill') === 'none' && stroke.includes('var(--c-white)');
    });
    expect(highlight).not.toBeUndefined();
    const subpathCount = (highlight!.getAttribute('d')?.match(/M/g) ?? []).length;
    expect(subpathCount).toBeGreaterThanOrEqual(2);
  });

  it.each(ROSE_IDS)('%s shows a darker spiral bud furled at its center', (id) => {
    const el = symbol(id);
    const bud = Array.from(el.querySelectorAll('path')).find((path) => {
      const fill = path.getAttribute('fill') ?? '';
      return fill.startsWith('var(--c-');
    });
    expect(bud).not.toBeUndefined();
    // A swirl, not a straight-edged shape: at least one curve command.
    expect(bud!.getAttribute('d')).toMatch(/[cCqQ]/);
  });

  it('peony-blush has at least 16 petal paths drawn from 2 ring gradients', () => {
    const el = symbol('peony-blush');
    const ringIds = ['peony-blush-outer', 'peony-blush-inner'];
    for (const ringId of ringIds) {
      expect(root.querySelector(`#${ringId}`)).not.toBeNull();
    }
    const petals = petalPaths(el, ringIds);
    expect(petals.length).toBeGreaterThanOrEqual(16);
    for (const ringId of ringIds) {
      expect(petals.some((petal) => petal.getAttribute('fill') === `url(#${ringId})`)).toBe(true);
    }
  });

  it('peony-blush stays within its element budget (<= 22 elements)', () => {
    expect(symbol('peony-blush').children.length).toBeLessThanOrEqual(22);
  });

  it('peony-blush shows a few champagne stamen hints peeking from its center', () => {
    const el = symbol('peony-blush');
    const stamens = Array.from(el.querySelectorAll('circle, ellipse')).filter(
      (shape) => shape.getAttribute('fill') === 'var(--c-champagne-300)',
    );
    expect(stamens.length).toBeGreaterThanOrEqual(3);
  });
});

describe('arch-sprite.test.ts helpers', () => {
  it('countDeep follows <use href> into the symbol it references', () => {
    const own = symbol('balloon-pink').querySelectorAll('ellipse, path, circle').length;
    const deep = countDeep(symbol('balloon-pink'), 'ellipse, path, circle');
    const glossShapes = symbol('balloon-gloss').querySelectorAll('ellipse, path, circle').length;
    expect(deep).toBe(own + glossShapes);
  });
});
