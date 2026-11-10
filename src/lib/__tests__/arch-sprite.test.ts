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

function stopColors(el: Element): string[] {
  return Array.from(el.querySelectorAll('stop')).map((stop) => stop.getAttribute('style') ?? '');
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
    expect(el.querySelector('[fill="url(#balloon-knot)"]')).not.toBeNull();
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
});

describe('ArchSprite perf guard', () => {
  it('has no <filter> element anywhere in the sprite', () => {
    expect(root.querySelectorAll('filter').length).toBe(0);
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
