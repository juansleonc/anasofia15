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

const TOKEN_HEXES: Record<string, string> = Object.fromEntries(
  Array.from(
    readFileSync(join(TEST_DIR, '..', '..', 'styles', 'tokens.css'), 'utf-8').matchAll(/(--c-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g),
    (match) => [match[1], match[2]],
  ),
);

/** WCAG relative luminance of the token a gradient stop paints with. */
function tokenLuminance(stop: Element): number {
  const token = (stop.getAttribute('style') ?? '').match(/var\((--c-[\w-]+)\)/)?.[1] ?? '';
  const hex = TOKEN_HEXES[token];
  if (!hex) throw new Error(`stop paints with unknown token "${token}"`);
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const linear = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

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
const PEARL_BALLOONS = ['balloon-rosegold-satin', 'balloon-rosegold', 'balloon-champagne-satin'];

const BRANCH_IDS = ['leaf-olive', 'leaf-gold'];
const BRANCH_LEAF_GRADIENT: Record<string, string> = { 'leaf-olive': 'leaf-olive-gradient', 'leaf-gold': 'leaf-gold-metal' };
const LEAF_IDS = ['leaf-eucalyptus', 'leaf-olive', 'leaf-gold'];
const FLOWER_IDS = ['rose-pink', 'rose-cream', 'peony-blush', 'peony-ivory', 'blossom'];
const CLUSTER_IDS = ['leaf-laurel-cluster'];

/** Both ends of a single stem path drawn with M plus absolute C or relative c curves. */
function stemEnds(d: string): Point[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let pen: Point = [0, 0];
  let start: Point = [0, 0];
  let cmd = '';
  for (let i = 0; i < tokens.length; ) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const take = (): number => Number(tokens[i++]);
    if (cmd === 'M') {
      pen = [take(), take()];
      start = pen;
    } else if (cmd === 'C' || cmd === 'c') {
      i += 4;
      const to: Point = [take(), take()];
      pen = cmd === 'C' ? to : [pen[0] + to[0], pen[1] + to[1]];
    } else {
      throw new Error(`unsupported stem command "${cmd}" in "${d}"`);
    }
  }
  return [start, pen];
}

/** The symbol's viewBox as numbers: [minX, minY, width, height]. */
function viewBoxOf(el: Element): number[] {
  return (el.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
}

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

/** The stem paths (`fill="none"`, each a single `M`) that fan out from a cluster's shared root. */
function clusterStems(el: Element): Element[] {
  return Array.from(el.querySelectorAll('path[fill="none"]')).filter(
    (path) => (path.getAttribute('d')?.match(/M/g) ?? []).length === 1,
  );
}

/** Applies an SVG `transform` (any sequence of `translate(x y)` / `rotate(a)` / `rotate(a cx cy)`,
 *  composed in SVG's usual right-to-left order) to a point in the element's own coordinate space —
 *  a generalization of `transformPoint` below, which only understands a lone `rotate(a cx cy)`. */
function applyTransform(transform: string, [x, y]: Point): Point {
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
}

/** Every numeric pair in a path's `d` string, treated as alternating x/y — a conservative
 *  (superset) point set that works for any command (M/L/C/Z/...), good enough for a bounds check. */
function rawPoints(d: string): Point[] {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return points;
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

  it.each(ALL_BALLOONS)('%s draws its body as one teardrop path, not an ellipse', (id) => {
    const el = symbol(id);
    expect(el.querySelector(`ellipse[fill="url(#${id}-gradient)"]`)).toBeNull();
    const body = el.querySelector(`path[fill="url(#${id}-gradient)"]`);
    expect(body).not.toBeNull();
    // Narrower toward the knot: the widest row sits above the body's vertical middle.
    const points = pathPoints(body!);
    const box = boxOf(points);
    const widest = points.reduce((best, point) => (point[0] > best[0] ? point : best));
    expect(widest[1]).toBeLessThan((box.minY + box.maxY) / 2);
  });

  it('every balloon tone shares the same teardrop outline', () => {
    const outlines = new Set(
      ALL_BALLOONS.map((id) => symbol(id).querySelector(`path[fill="url(#${id}-gradient)"]`)?.getAttribute('d')),
    );
    expect(outlines.size).toBe(1);
    expect([...outlines][0]).toBeTruthy();
  });

  it('no balloon carries the old arc reflection band', () => {
    const balloonPaths = ALL_BALLOONS.flatMap((id) => Array.from(symbol(id).querySelectorAll('path')));
    expect(balloonPaths.length).toBeGreaterThanOrEqual(ALL_BALLOONS.length * 2);
    for (const path of balloonPaths) {
      expect(path.getAttribute('d') ?? '').not.toMatch(/A40 46/);
      expect(path.getAttribute('fill') ?? '').not.toContain('chrome-band');
    }
    expect(root.querySelectorAll('[id$="chrome-band"]').length).toBe(0);
  });

  it('metallic gold has >= 7 stops from a champagne-100 core to a champagne-800 terminator, and a horizon reflection', () => {
    const stops = Array.from(gradient('balloon-champagne-gradient').querySelectorAll('stop'));
    expect(stops.length).toBeGreaterThanOrEqual(7);
    expect(stops[0].getAttribute('style')).toMatch(/var\(--c-champagne-100\)/);
    const terminator = stops.find((stop) => (stop.getAttribute('style') ?? '').includes('--c-champagne-800'));
    expect(terminator).not.toBeUndefined();
    const offset = parseFloat(terminator!.getAttribute('offset') ?? '');
    expect(offset).toBeGreaterThanOrEqual(86);
    expect(offset).toBeLessThanOrEqual(92);

    const horizonGradient = gradient('balloon-champagne-horizon');
    const horizonStops = Array.from(horizonGradient.querySelectorAll('stop'));
    // Feathered to nothing at its edge, and never brighter than a soft sheen.
    expect(horizonStops[horizonStops.length - 1].getAttribute('stop-opacity')).toBe('0');
    expect(peakOpacity(horizonGradient)).toBeLessThanOrEqual(0.5);
    const horizon = symbol('balloon-champagne').querySelector('path[fill="url(#balloon-champagne-horizon)"]');
    expect(horizon).not.toBeNull();
    // A soft, wide band, not a thin arc stripe.
    expect(horizon!.getAttribute('d')).not.toMatch(/[Aa]/);
    const box = boxOf(pathPoints(horizon!));
    expect(box.maxX - box.minX).toBeGreaterThanOrEqual(50);
    expect(box.maxY - box.minY).toBeGreaterThanOrEqual(10);
  });

  it.each(PEARL_BALLOONS)('%s (pearl) carries a nacre overlay over its body and a soft specular', (id) => {
    const el = symbol(id);
    const children = Array.from(el.children);
    const bodyIndex = children.findIndex((child) => child.getAttribute('fill') === `url(#${id}-gradient)`);
    const nacreIndex = children.findIndex((child) => /^url\(#[\w-]+-nacre\)$/.test(child.getAttribute('fill') ?? ''));
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    expect(nacreIndex).toBeGreaterThan(bodyIndex);

    const nacreId = (children[nacreIndex].getAttribute('fill') ?? '').slice(5, -1);
    const stops = Array.from(gradient(nacreId).querySelectorAll('stop'));
    expect(stops[0].getAttribute('style')).toMatch(/var\(--c-champagne-100\)/);
    expect(Number(stops[0].getAttribute('stop-opacity'))).toBeCloseTo(0.45);
    const rose = stops.find((stop) => (stop.getAttribute('style') ?? '').includes('--c-rose-200'));
    expect(Number(rose?.getAttribute('stop-opacity'))).toBeCloseTo(0.25);
    expect(stops[stops.length - 1].getAttribute('stop-opacity')).toBe('0');

    const glossUse = el.querySelector('use[href="#balloon-gloss"]');
    const specStrength = Number((glossUse?.getAttribute('style') ?? '').match(/--balloon-spec:\s*([\d.]+)/)?.[1]);
    expect(specStrength).toBeLessThanOrEqual(0.6);
  });

  it('the shared specular spot takes its strength from the balloon that uses it, full by default', () => {
    const spot = symbol('balloon-gloss').querySelector('[fill="url(#balloon-gloss-spec)"]');
    expect(spot?.getAttribute('style') ?? '').toMatch(/opacity:\s*var\(--balloon-spec,\s*1\)/);
    expect(symbol('balloon-champagne').querySelector('use[href="#balloon-gloss"]')?.getAttribute('style') ?? '').not.toContain('--balloon-spec');
  });

  it('pastel pink keeps a rose-400 terminator and >= 6 stops, from a rose-100 core to a rose-300 rim', () => {
    const stops = Array.from(gradient('balloon-pink-gradient').querySelectorAll('stop'));
    const tokenAt = (k: number): string => (stops[k].getAttribute('style') ?? '').match(/--c-[\w-]+/)?.[0] ?? '';
    expect(stops.length).toBeGreaterThanOrEqual(6);
    expect(tokenAt(0)).toBe('--c-rose-100');
    expect(tokenAt(stops.length - 1)).toBe('--c-rose-300');
    expect(tokenAt(stops.length - 2)).toBe('--c-rose-400');
    const terminatorOffset = parseFloat(stops[stops.length - 2].getAttribute('offset') ?? '');
    expect(terminatorOffset).toBeGreaterThanOrEqual(80);
    expect(terminatorOffset).toBeLessThanOrEqual(92);
    expect(stops.slice(1, -2).some((_, k) => tokenAt(k + 1) === '--c-rose-300')).toBe(true);
  });

  it('pastel pink shows the softbox at full strength with a moderate specular', () => {
    const style = symbol('balloon-pink').querySelector('use[href="#balloon-gloss"]')?.getAttribute('style') ?? '';
    expect(style).not.toContain('--balloon-window');
    const spec = Number(style.match(/--balloon-spec:\s*([\d.]+)/)?.[1]);
    expect(spec).toBeGreaterThan(0.6);
    expect(spec).toBeLessThan(1);
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

/** Highest `stop-opacity` in a gradient (a missing attribute counts as fully opaque). */
function peakOpacity(gradientEl: Element): number {
  return Math.max(...Array.from(gradientEl.querySelectorAll('stop')).map((stop) => Number(stop.getAttribute('stop-opacity') ?? '1')));
}

describe('ArchSprite gloss', () => {
  it('has a softbox window highlight: a curved quad under a white 70% to 0 linear gradient', () => {
    const windowGradient = gradient('balloon-gloss-window');
    expect(windowGradient.tagName.toLowerCase()).toBe('lineargradient');
    const stops = Array.from(windowGradient.querySelectorAll('stop'));
    expect(stops[0].getAttribute('style')).toMatch(/var\(--c-white\)/);
    expect(Number(stops[0].getAttribute('stop-opacity'))).toBeCloseTo(0.7);
    expect(Number(stops[stops.length - 1].getAttribute('stop-opacity'))).toBe(0);
    const shape = symbol('balloon-gloss').querySelector('path[fill="url(#balloon-gloss-window)"]');
    expect(shape).not.toBeNull();
    const [outline] = cubicSubpaths(shape!.getAttribute('d') ?? '');
    expect(outline.closed).toBe(true);
    expect(outline.segments.length).toBe(4);
  });

  it('keeps a small specular hot spot', () => {
    const spot = symbol('balloon-gloss').querySelector('[fill="url(#balloon-gloss-spec)"]');
    expect(spot).not.toBeNull();
    expect(Number(spot!.getAttribute('rx'))).toBeLessThanOrEqual(8);
  });

  it('has a champagne rim-light crescent on the lower right at 35-50%', () => {
    const rimGradient = gradient('balloon-gloss-rim');
    for (const style of stopColors(rimGradient)) expect(style).toMatch(/var\(--c-champagne-100\)/);
    expect(peakOpacity(rimGradient)).toBeGreaterThanOrEqual(0.35);
    expect(peakOpacity(rimGradient)).toBeLessThanOrEqual(0.5);
    const rim = symbol('balloon-gloss').querySelector('path[fill="url(#balloon-gloss-rim)"]');
    expect(rim).not.toBeNull();
    const box = boxOf(pathPoints(rim!));
    expect(box.minX).toBeGreaterThan(50);
    expect(box.minY).toBeGreaterThan(30);
  });

  it('has an ambient-occlusion crescent inside the bottom edge at 25-35%', () => {
    const aoGradient = gradient('balloon-gloss-ao');
    expect(peakOpacity(aoGradient)).toBeGreaterThanOrEqual(0.25);
    expect(peakOpacity(aoGradient)).toBeLessThanOrEqual(0.35);
    const ao = symbol('balloon-gloss').querySelector('path[fill="url(#balloon-gloss-ao)"]');
    expect(ao).not.toBeNull();
    const box = boxOf(pathPoints(ao!));
    expect(box.minY).toBeGreaterThan(55);
  });

  it('stays within its element budget (4 shapes, up to 5)', () => {
    const children = symbol('balloon-gloss').children.length;
    expect(children).toBeGreaterThanOrEqual(4);
    expect(children).toBeLessThanOrEqual(5);
  });
});

// The garland's text clearance (cover-garland) sizes every item from these symbol extents, so the
// art may change freely only while each symbol stays inside the footprint it promised.
describe('footprint contract', () => {
  it.each(LEAF_IDS)('%s is a slender sprig with its stem base at the bottom centre', (id) => {
    const el = symbol(id);
    const [, , width, height] = viewBoxOf(el);
    expect(width / height).toBeLessThanOrEqual(0.45);
    const stem = Array.from(el.querySelectorAll('path[fill="none"]')).find((path) => (path.getAttribute('d')?.match(/M/g) ?? []).length === 1);
    expect(stem).not.toBeUndefined();
    const base = stemEnds(stem!.getAttribute('d') ?? '').reduce((lower, end) => (end[1] > lower[1] ? end : lower));
    expect(Math.abs(base[0] - width / 2)).toBeLessThanOrEqual(0.04 * height);
    expect(Math.abs(base[1] - height)).toBeLessThanOrEqual(0.04 * height);
  });

  it.each(['rose-pink', 'rose-cream', 'peony-blush', 'peony-ivory'])('%s keeps every petal inside the inscribed circle', (id) => {
    const el = symbol(id);
    const [, , width] = viewBoxOf(el);
    const shapes = Array.from(el.querySelectorAll('path[fill^="url(#"]'));
    expect(shapes.length).toBeGreaterThanOrEqual(12);
    for (const shape of shapes) {
      for (const point of pathPoints(shape).map((p) => transformPoint(shape, p))) {
        expect(Math.hypot(point[0] - width / 2, point[1] - width / 2)).toBeLessThanOrEqual(width / 2);
      }
    }
  });

  it.each(FLOWER_IDS)('%s keeps its seat shadow inside the inscribed circle', (id) => {
    const el = symbol(id);
    const seat = el.querySelector('ellipse[fill="url(#flower-seat-shadow)"]');
    expect(seat).not.toBeNull();
    const [, , width] = viewBoxOf(el);
    const offset = Math.hypot(Number(seat!.getAttribute('cx')) - width / 2, Number(seat!.getAttribute('cy')) - width / 2);
    const reach = offset + Math.max(Number(seat!.getAttribute('rx')), Number(seat!.getAttribute('ry')));
    expect(reach).toBeLessThanOrEqual(width / 2);
  });

  it.each(CLUSTER_IDS)('%s is a 120x120 square rooted near (60, 114), with every drawn point inside it', (id) => {
    const el = symbol(id);
    expect(el.getAttribute('viewBox')).toBe('0 0 120 120');
    const stems = clusterStems(el);
    expect(stems.length).toBe(3);
    for (const stem of stems) {
      const [start] = stemEnds(stem.getAttribute('d') ?? '');
      expect(Math.hypot(start[0] - 60, start[1] - 114)).toBeLessThanOrEqual(4.8);
    }
    for (const path of Array.from(el.querySelectorAll('path'))) {
      const transform = path.getAttribute('transform') ?? '';
      for (const point of rawPoints(path.getAttribute('d') ?? '').map((p) => applyTransform(transform, p))) {
        expect(point[0]).toBeGreaterThanOrEqual(0);
        expect(point[0]).toBeLessThanOrEqual(120);
        expect(point[1]).toBeGreaterThanOrEqual(0);
        expect(point[1]).toBeLessThanOrEqual(120);
      }
    }
  });

  it.each(ALL_BALLOONS)('%s keeps its visible body within the old 88 x 92 body box, give or take 2 units', (id) => {
    const el = symbol(id);
    expect(el.getAttribute('viewBox')).toBe('0 0 100 110');
    const body = el.querySelector(`path[fill="url(#${id}-gradient)"]`);
    expect(body).not.toBeNull();
    const box = boxOf(pathPoints(body!));
    expect(Math.abs(box.minX - 6)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.maxX - 94)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.minY - 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.maxY - 94)).toBeLessThanOrEqual(2);
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

// Each rose tone paints its petals from its own tone-specific ring gradients (outer/mid/inner), so a
// "petal path" is any path filled from one of those ring gradients — as opposed to the center bud
// or the lip-highlight stroke, which are not counted as petals.
const ROSE_IDS = ['rose-pink', 'rose-cream'];
const GARDEN_ROSE_IDS = ['rose-pink', 'rose-cream'];
const roseRingGradientIds = (id: string): string[] => [`${id}-outer`, `${id}-mid`, `${id}-inner`];
const PEONY_RING_IDS = ['peony-blush-outer', 'peony-blush-mid', 'peony-blush-inner'];
const PEONY_IDS = ['peony-blush', 'peony-ivory'];
const peonyRingGradientIds = (id: string): string[] => [`${id}-outer`, `${id}-mid`, `${id}-inner`];

function petalPaths(el: Element, ringGradientIds: string[]): Element[] {
  return Array.from(el.querySelectorAll('path')).filter((path) =>
    ringGradientIds.some((ringId) => path.getAttribute('fill') === `url(#${ringId})`),
  );
}

type Point = [number, number];
interface Segment {
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
}

/** Parses an absolute `M…C…Z` path (the only commands the flower petals and highlights use) into
 *  subpaths of cubic segments. Any other command throws, so a petal drawn with straight `L`/`H`/`V`
 *  edges or an unparsed shape fails loudly instead of being silently mis-measured. */
function cubicSubpaths(d: string): { segments: Segment[]; closed: boolean }[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const subpaths: { segments: Segment[]; closed: boolean }[] = [];
  let current: { segments: Segment[]; closed: boolean } | null = null;
  let pen: Point = [0, 0];
  let i = 0;
  const num = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      pen = [num(), num()];
      current = { segments: [], closed: false };
      subpaths.push(current);
    } else if (cmd === 'C') {
      while (i < tokens.length && !/[A-Za-z]/.test(tokens[i])) {
        const c1: Point = [num(), num()];
        const c2: Point = [num(), num()];
        const to: Point = [num(), num()];
        current!.segments.push({ from: pen, c1, c2, to });
        pen = to;
      }
    } else if (cmd === 'Z') {
      current!.closed = true;
    } else {
      throw new Error(`unsupported path command "${cmd}" in "${d}" — flower art is absolute M/C/Z only`);
    }
  }
  return subpaths;
}

/** The `rotate(a cx cy)` transform on a petal, applied to a point (identity when absent). */
function transformPoint(el: Element, [x, y]: Point): Point {
  const match = (el.getAttribute('transform') ?? '').match(/rotate\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/);
  if (!match) return [x, y];
  const [a, cx, cy] = match.slice(1).map(Number);
  const rad = (a * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
}

/** Every point (anchors and control points) of a path, in its own untransformed coordinates. */
function pathPoints(el: Element): Point[] {
  return cubicSubpaths(el.getAttribute('d') ?? '').flatMap(({ segments }) =>
    segments.flatMap(({ from, c1, c2, to }) => [from, c1, c2, to]),
  );
}

function boxOf(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** The petal outline as a polygon through its on-curve anchors, placed by its transform. */
function petalPolygon(el: Element): Point[] {
  const [{ segments }] = cubicSubpaths(el.getAttribute('d') ?? '');
  return segments.map(({ to }) => transformPoint(el, to));
}

/** Largest change of direction (degrees) where two consecutive cubic segments meet, including the
 *  closing joint of a closed outline — a sharp corner (a pointy petal tip or a V notch) shows up as
 *  a large turn, a smoothly rounded outline stays small everywhere. */
function sharpestJoint(d: string): number {
  let worst = 0;
  for (const { segments, closed } of cubicSubpaths(d)) {
    const jointCount = closed ? segments.length : segments.length - 1;
    for (let k = 0; k < jointCount; k++) {
      const incoming = segments[k];
      const outgoing = segments[(k + 1) % segments.length];
      const inDir = Math.atan2(incoming.to[1] - incoming.c2[1], incoming.to[0] - incoming.c2[0]);
      const outDir = Math.atan2(outgoing.c1[1] - outgoing.from[1], outgoing.c1[0] - outgoing.from[0]);
      let turn = Math.abs(((outDir - inDir) * 180) / Math.PI) % 360;
      if (turn > 180) turn = 360 - turn;
      worst = Math.max(worst, turn);
    }
  }
  return worst;
}

/** The first unstroked `fill="none"` path in `el` whose `d` has at least `minSubpaths` `M`
 *  commands — picks out a multi-leaf/multi-crease vein path without depending on which token
 *  colours its stroke, and without confusing it with a single-subpath stem outline. */
function veinPath(el: Element, minSubpaths: number): Element | undefined {
  return Array.from(el.querySelectorAll('path[fill="none"]')).find(
    (path) => (path.getAttribute('d')?.match(/M/g) ?? []).length >= minSubpaths,
  );
}

describe('ArchSprite flower seat shadow', () => {
  it('shares one soft rose-700 seat-shadow gradient fading from 18% to nothing', () => {
    const seat = gradient('flower-seat-shadow');
    expect(seat.tagName.toLowerCase()).toBe('radialgradient');
    const stops = Array.from(seat.querySelectorAll('stop'));
    for (const style of stopColors(seat)) expect(style).toMatch(/var\(--c-rose-700\)/);
    expect(Number(stops[0].getAttribute('stop-opacity'))).toBeCloseTo(0.18);
    expect(stops[stops.length - 1].getAttribute('stop-opacity')).toBe('0');
  });

  it.each(FLOWER_IDS)('%s starts with a seat-shadow ellipse offset down and right', (id) => {
    const el = symbol(id);
    const first = el.firstElementChild!;
    expect(first.tagName.toLowerCase()).toBe('ellipse');
    expect(first.getAttribute('fill')).toBe('url(#flower-seat-shadow)');
    const [, , width, height] = viewBoxOf(el);
    expect(Number(first.getAttribute('cx'))).toBeGreaterThan(width / 2);
    expect(Number(first.getAttribute('cy'))).toBeGreaterThan(height / 2);
  });
});

describe('ArchSprite roses', () => {
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

  it.each(ROSE_IDS)('%s stays within its element budget (<= 24 elements)', (id) => {
    expect(symbol(id).children.length).toBeLessThanOrEqual(24);
  });

  it.each(ROSE_IDS)('%s outer petals are broad shells: each wider than it is tall', (id) => {
    const outer = petalPaths(symbol(id), [`${id}-outer`]);
    expect(outer.length).toBeGreaterThanOrEqual(5);
    for (const petal of outer) {
      const box = boxOf(pathPoints(petal));
      expect(box.maxX - box.minX).toBeGreaterThan(box.maxY - box.minY);
    }
  });

  it.each(ROSE_IDS)('%s has a round, near-circular overall silhouette', (id) => {
    const placed = petalPaths(symbol(id), roseRingGradientIds(id)).flatMap((petal) => petalPolygon(petal));
    const box = boxOf(placed);
    const aspect = (box.maxX - box.minX) / (box.maxY - box.minY);
    expect(aspect).toBeGreaterThanOrEqual(0.85);
    expect(aspect).toBeLessThanOrEqual(1.15);
  });

  it.each(ROSE_IDS)('%s petals are smoothly rounded and fully opaque (no pointed corners, no wash)', (id) => {
    for (const petal of petalPaths(symbol(id), roseRingGradientIds(id))) {
      expect(sharpestJoint(petal.getAttribute('d') ?? '')).toBeLessThanOrEqual(20);
      expect(petal.getAttribute('fill-opacity')).toBeNull();
      expect(petal.getAttribute('opacity')).toBeNull();
    }
  });

  it('rose-pink and rose-cream have different silhouettes, not just different colours', () => {
    const outline = (id: string): string[] =>
      petalPaths(symbol(id), roseRingGradientIds(id)).map((petal) => `${petal.getAttribute('d')}|${petal.getAttribute('transform')}`);
    const pink = outline('rose-pink');
    const cream = outline('rose-cream');
    expect(pink.length === cream.length && pink.every((petal, k) => petal === cream[k])).toBe(false);
  });

  it.each(GARDEN_ROSE_IDS)('%s has >= 15 petals in 3 cupped rings, a >= 4-crescent centre and no white outline stroke', (id) => {
    const el = symbol(id);
    const petals = petalPaths(el, roseRingGradientIds(id));
    expect(petals.length).toBeGreaterThanOrEqual(15);
    for (const ringId of roseRingGradientIds(id)) {
      expect(petals.filter((petal) => petal.getAttribute('fill') === `url(#${ringId})`).length).toBeGreaterThanOrEqual(3);
      // Each petal's own gradient carries the shading: a light lip (first stop) over a darker base.
      const stops = Array.from(gradient(ringId).querySelectorAll('stop'));
      expect(tokenLuminance(stops[0])).toBeGreaterThan(tokenLuminance(stops[stops.length - 1]));
    }

    const crescents = Array.from(el.querySelectorAll(`path[fill="url(#${id}-heart)"]`));
    expect(crescents.length).toBeGreaterThanOrEqual(4);
    const [, , width] = viewBoxOf(el);
    const reaches = crescents.map((crescent) =>
      Math.max(...pathPoints(crescent).map(([x, y]) => Math.hypot(x - width / 2, y - width / 2))),
    );
    for (const reach of reaches) expect(reach).toBeLessThanOrEqual(width * 0.2);
    expect(new Set(reaches.map((reach) => reach.toFixed(1))).size).toBeGreaterThanOrEqual(4);

    const shapes = Array.from(el.querySelectorAll('path, ellipse, circle'));
    expect(shapes.length).toBeGreaterThan(petals.length);
    for (const shape of shapes) {
      expect(shape.getAttribute('stroke') ?? 'none').toBe('none');
    }
  });

  it('rose-cream is ivory: champagne lips shaded with rose-gold, and no glassy white in its heart', () => {
    const ringStops = roseRingGradientIds('rose-cream').flatMap((ringId) => stopColors(gradient(ringId)));
    const heartStops = stopColors(gradient('rose-cream-heart'));
    expect(ringStops.length).toBeGreaterThanOrEqual(9);
    expect(stopColors(gradient('rose-cream-outer'))[0]).toMatch(/--c-champagne-(100|200)/);
    expect(ringStops.some((style) => style.includes('--c-rosegold-200'))).toBe(true);
    expect(heartStops.length).toBeGreaterThanOrEqual(3);
    for (const style of [...ringStops, ...heartStops]) expect(style).not.toContain('--c-white');
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
});

describe('ArchSprite peony', () => {
  it('peony-blush has at least 16 petal paths drawn from 3 ring gradients', () => {
    const el = symbol('peony-blush');
    for (const ringId of PEONY_RING_IDS) {
      expect(root.querySelector(`#${ringId}`)).not.toBeNull();
    }
    const petals = petalPaths(el, PEONY_RING_IDS);
    expect(petals.length).toBeGreaterThanOrEqual(16);
    for (const ringId of PEONY_RING_IDS) {
      expect(petals.some((petal) => petal.getAttribute('fill') === `url(#${ringId})`)).toBe(true);
    }
  });

  it('peony-blush stays within its element budget (<= 30 elements)', () => {
    expect(symbol('peony-blush').children.length).toBeLessThanOrEqual(30);
  });

  it('peony-blush petals are soft, rounded ruffles with no pointed corners anywhere on the outline', () => {
    for (const petal of petalPaths(symbol('peony-blush'), PEONY_RING_IDS)) {
      expect(sharpestJoint(petal.getAttribute('d') ?? '')).toBeLessThanOrEqual(20);
    }
  });

  it.each(PEONY_IDS)('%s has >= 18 ruffled petals and >= 5 gold stamens', (id) => {
    const el = symbol(id);
    const petals = petalPaths(el, peonyRingGradientIds(id));
    expect(petals.length).toBeGreaterThanOrEqual(18);
    for (const petal of petals) {
      // A ruffled lip: walking the outline, the distance from the petal's base swings out and
      // back several times instead of rising once to a smooth dome and falling again.
      const [{ segments }] = cubicSubpaths(petal.getAttribute('d') ?? '');
      const base = segments[0].from;
      const reach = segments.map(({ to }) => Math.hypot(to[0] - base[0], to[1] - base[1]));
      let turns = 0;
      for (let k = 2; k < reach.length; k++) {
        if (Math.sign(reach[k] - reach[k - 1]) !== Math.sign(reach[k - 1] - reach[k - 2])) turns += 1;
      }
      expect(turns).toBeGreaterThanOrEqual(4);
    }
    const stamens = Array.from(el.querySelectorAll('circle, ellipse')).filter((shape) =>
      /^var\(--c-champagne-(300|500|700)\)$/.test(shape.getAttribute('fill') ?? ''),
    );
    expect(stamens.length).toBeGreaterThanOrEqual(5);
    // Stamens peek out of the heart of the bloom, not from its petals' edges.
    const [, , width] = viewBoxOf(el);
    for (const stamen of stamens) {
      const offset = Math.hypot(Number(stamen.getAttribute('cx')) - width / 2, Number(stamen.getAttribute('cy')) - width / 2);
      expect(offset).toBeLessThanOrEqual(width * 0.12);
    }
  });

  it('peony-ivory reuses the blush petal outlines, painted only from ivory tokens', () => {
    const outline = (id: string): string[] =>
      petalPaths(symbol(id), peonyRingGradientIds(id)).map((petal) => `${petal.getAttribute('d')}|${petal.getAttribute('transform')}`);
    expect(outline('peony-ivory').length).toBeGreaterThanOrEqual(18);
    expect(outline('peony-ivory')).toEqual(outline('peony-blush'));
    const ivoryStops = peonyRingGradientIds('peony-ivory').flatMap((ringId) => stopColors(gradient(ringId)));
    expect(ivoryStops.length).toBeGreaterThanOrEqual(9);
    for (const style of ivoryStops) expect(style).toMatch(/var\(--c-(champagne|rosegold)-\d+\)/);
  });
});

describe('ArchSprite blossom', () => {
  it('has 5 petal paths sharing one radial petal gradient', () => {
    const petalGradient = gradient('blossom-petal');
    expect(petalGradient.tagName.toLowerCase()).toBe('radialgradient');
    const petals = Array.from(symbol('blossom').querySelectorAll('path[fill="url(#blossom-petal)"]'));
    expect(petals.length).toBe(5);
  });

  it('petals are smoothly rounded and fully opaque (no pointed corners, no wash)', () => {
    const petals = Array.from(symbol('blossom').querySelectorAll('path[fill="url(#blossom-petal)"]'));
    for (const petal of petals) {
      expect(sharpestJoint(petal.getAttribute('d') ?? '')).toBeLessThanOrEqual(20);
      expect(petal.getAttribute('fill-opacity')).toBeNull();
      expect(petal.getAttribute('opacity')).toBeNull();
    }
  });

  it('has one multi-subpath vein path, one crease per petal', () => {
    const el = symbol('blossom');
    const vein = Array.from(el.querySelectorAll('path')).find((path) => {
      const stroke = path.getAttribute('stroke') ?? '';
      return path.getAttribute('fill') === 'none' && stroke.startsWith('var(--c-') && !stroke.includes('white');
    });
    expect(vein).not.toBeUndefined();
    const subpathCount = (vein!.getAttribute('d')?.match(/M/g) ?? []).length;
    expect(subpathCount).toBeGreaterThanOrEqual(5);
  });

  it('has a centre disk with its own gradient, distinct from the petal gradient', () => {
    const el = symbol('blossom');
    const centre = Array.from(el.querySelectorAll('circle, ellipse')).find((shape) =>
      (shape.getAttribute('fill') ?? '').startsWith('url(#'),
    );
    expect(centre).not.toBeUndefined();
    const centreGradientId = (centre!.getAttribute('fill') ?? '').replace('url(#', '').replace(')', '');
    expect(centreGradientId).not.toBe('blossom-petal');
    expect(root.querySelector(`#${centreGradientId}`)).not.toBeNull();
  });

  it('petals are a clear, saturated pink — the rim is a light rose token at full opacity, not a washed-out white', () => {
    const petalGradient = gradient('blossom-petal');
    const stops = Array.from(petalGradient.querySelectorAll('stop'));
    const first = stops[0];
    const last = stops[stops.length - 1];
    expect(last.getAttribute('style')).toMatch(/stop-color:\s*var\(--c-rose-/);
    expect(last.getAttribute('stop-opacity')).toBeNull();
    // Lightness rank of the rose scale, lightest first: the rim (last stop) must be a lighter
    // token than the base (first stop), so the petal still reads light-at-the-tip without the
    // old alpha-based wash.
    const ROSE_LIGHTNESS = ['100', '200', '300', '400', '600', '700'];
    const tokenNumber = (stop: Element): string | undefined =>
      (stop.getAttribute('style') ?? '').match(/--c-rose-(\d+)/)?.[1];
    const firstRank = ROSE_LIGHTNESS.indexOf(tokenNumber(first) ?? '');
    const lastRank = ROSE_LIGHTNESS.indexOf(tokenNumber(last) ?? '');
    expect(firstRank).toBeGreaterThanOrEqual(0);
    expect(lastRank).toBeGreaterThanOrEqual(0);
    expect(lastRank).toBeLessThan(firstRank);
  });

  it('veins are short (<= 45% of the petal reach from the centre), slightly curved, thin and low-opacity', () => {
    const el = symbol('blossom');
    const petal = Array.from(el.querySelectorAll('path[fill="url(#blossom-petal)"]')).find(
      (path) => !path.getAttribute('transform'),
    )!;
    const petalReach = Math.max(...pathPoints(petal).map(([x, y]) => Math.hypot(x, y)));
    const vein = veinPath(el, 5)!;
    expect(vein).not.toBeUndefined();
    expect(Number(vein.getAttribute('stroke-width'))).toBeLessThanOrEqual(0.45);
    expect(Number(vein.getAttribute('stroke-opacity'))).toBeLessThanOrEqual(0.3);
    for (const { segments } of cubicSubpaths(vein.getAttribute('d') ?? '')) {
      for (const segment of segments) {
        for (const point of [segment.from, segment.c1, segment.c2, segment.to]) {
          expect(Math.hypot(point[0], point[1])).toBeLessThanOrEqual(petalReach * 0.45);
        }
        // Slightly curved: the control points must not sit on the straight line between the
        // segment's own endpoints (the old veins were plain straight lines).
        const [x1, y1] = segment.from;
        const [x2, y2] = segment.to;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        const deviation = (point: Point): number => Math.abs((point[0] - x1) * dy - (point[1] - y1) * dx) / length;
        expect(Math.max(deviation(segment.c1), deviation(segment.c2))).toBeGreaterThan(0.1);
      }
    }
  });

  it('has a filament path and an anther path, each with at least 8 stamen subpaths, token colours', () => {
    const el = symbol('blossom');
    const filament = Array.from(el.querySelectorAll('path')).find(
      (path) => path.getAttribute('fill') === 'none' && (path.getAttribute('stroke') ?? '').includes('--c-champagne-500'),
    );
    const anther = Array.from(el.querySelectorAll('path')).find(
      (path) => (path.getAttribute('fill') ?? '').includes('--c-champagne-700'),
    );
    expect(filament).not.toBeUndefined();
    expect(anther).not.toBeUndefined();
    expect((filament!.getAttribute('d')?.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect((anther!.getAttribute('d')?.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('stays within its element budget (<= 12 elements)', () => {
    // Counted by descendant shape, not direct children: blossom's shapes sit inside one
    // positioning `<g>` (unlike the roses/peony, which paint their petals flat), so a direct
    // `children.length` would only ever see that single wrapper.
    expect(symbol('blossom').querySelectorAll('path, circle, ellipse').length).toBeLessThanOrEqual(12);
  });
});

describe('ArchSprite foliage', () => {
  it('leaf-eucalyptus has at least 7 round leaves lit by a lightened radial gradient', () => {
    const el = symbol('leaf-eucalyptus');
    const leafGradient = gradient('leaf-eucalyptus-gradient');
    expect(leafGradient.tagName.toLowerCase()).toBe('radialgradient');
    const stops = stopColors(leafGradient);
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const style of stops) expect(style).toMatch(/stop-color:\s*var\(--c-/);
    const leaves = el.querySelectorAll('[fill="url(#leaf-eucalyptus-gradient)"]');
    expect(leaves.length).toBeGreaterThanOrEqual(7);
  });

  it('leaf-eucalyptus carries 1-2 gilt leaf edges', () => {
    const leaves = symbol('leaf-eucalyptus').querySelectorAll('[fill="url(#leaf-eucalyptus-gradient)"]');
    const gilt = Array.from(leaves).filter((leaf) => leaf.getAttribute('stroke') === 'var(--c-champagne-500)');
    expect(leaves.length).toBeGreaterThanOrEqual(7);
    expect(gilt.length).toBeGreaterThanOrEqual(1);
    expect(gilt.length).toBeLessThanOrEqual(2);
  });

  it('leaf-eucalyptus has one multi-subpath midrib vein path, one per leaf', () => {
    const vein = veinPath(symbol('leaf-eucalyptus'), 7);
    expect(vein).not.toBeUndefined();
    expect(vein!.getAttribute('stroke') ?? '').toMatch(/var\(--c-leaf/);
  });

  it('leaf-eucalyptus stays within its element budget (<= 12 elements)', () => {
    expect(symbol('leaf-eucalyptus').querySelectorAll('path, ellipse, circle').length).toBeLessThanOrEqual(12);
  });

  it.each(BRANCH_IDS)('%s is a gently curved branch of >= 9 alternating leaves, each with a midrib', (id) => {
    const el = symbol(id);
    const leafFill = `url(#${BRANCH_LEAF_GRADIENT[id]})`;
    const leaves = Array.from(el.querySelectorAll(`[fill="${leafFill}"]`));
    expect(leaves.length).toBeGreaterThanOrEqual(9);
    expect(leaves.length).toBeLessThanOrEqual(11);
    // Alternating: consecutive side leaves lean to opposite sides of the stem.
    const leans = leaves.map((leaf) => Number((leaf.getAttribute('transform') ?? '').match(/rotate\((-?[\d.]+)/)?.[1] ?? 0));
    const sideLeans = leans.filter((lean) => Math.abs(lean) > 10);
    expect(sideLeans.length).toBeGreaterThanOrEqual(8);
    for (let k = 1; k < sideLeans.length; k++) expect(Math.sign(sideLeans[k])).not.toBe(Math.sign(sideLeans[k - 1]));

    const stem = Array.from(el.querySelectorAll('path[fill="none"]')).find((path) => (path.getAttribute('d')?.match(/M/g) ?? []).length === 1);
    expect(stem).not.toBeUndefined();
    const [{ segments }] = cubicSubpaths(stem!.getAttribute('d') ?? '');
    const bend = Math.max(
      ...segments.flatMap(({ from, c1, c2, to }) => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
        return [c1, c2].map(([x, y]) => Math.abs((x - from[0]) * (to[1] - from[1]) - (y - from[1]) * (to[0] - from[0])) / length);
      }),
    );
    expect(bend).toBeGreaterThan(1.5);

    expect(veinPath(el, leaves.length)).not.toBeUndefined();
  });

  it('leaf-olive leaves are two-tone sage, from leaf-deep at the base to leaf at the tip', () => {
    const stops = stopColors(gradient('leaf-olive-gradient'));
    expect(stops[0]).toMatch(/var\(--c-leaf-deep\)/);
    expect(stops[stops.length - 1]).toMatch(/var\(--c-leaf\)/);
  });

  it('leaf-olive carries >= 2 gilt leaf edges', () => {
    const gilt = symbol('leaf-olive').querySelectorAll('[fill="url(#leaf-olive-gradient)"][stroke="var(--c-champagne-500)"]');
    expect(gilt.length).toBeGreaterThanOrEqual(2);
  });

  it('leaf-olive has one multi-subpath midrib vein path, one per leaf', () => {
    const vein = veinPath(symbol('leaf-olive'), 9);
    expect(vein).not.toBeUndefined();
    expect(vein!.getAttribute('stroke') ?? '').toMatch(/var\(--c-leaf/);
  });

  it('leaf-olive stays within its element budget (<= 14 elements)', () => {
    expect(symbol('leaf-olive').querySelectorAll('path, ellipse, circle').length).toBeLessThanOrEqual(14);
  });

  it('leaf-gold is made of filled foil leaves, no lone outline', () => {
    const el = symbol('leaf-gold');
    const metalGradient = gradient('leaf-gold-metal');
    const stops = stopColors(metalGradient);
    expect(stops.length).toBeGreaterThanOrEqual(4);
    for (const style of stops) expect(style).toMatch(/stop-color:\s*var\(--c-/);
    const leaves = Array.from(el.querySelectorAll('[fill="url(#leaf-gold-metal)"]'));
    expect(leaves.length).toBeGreaterThanOrEqual(7);
    for (const leaf of leaves) {
      expect(leaf.getAttribute('fill')).not.toBe('none');
      const fillOpacity = leaf.getAttribute('fill-opacity');
      if (fillOpacity !== null) expect(Number(fillOpacity)).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('leaf-gold has one multi-subpath vein path', () => {
    const vein = veinPath(symbol('leaf-gold'), 7);
    expect(vein).not.toBeUndefined();
    expect(vein!.getAttribute('stroke') ?? '').toMatch(/var\(--c-champagne-700\)/);
  });

  it('leaf-gold stays within its element budget (<= 12 elements)', () => {
    expect(symbol('leaf-gold').querySelectorAll('path, ellipse, circle').length).toBeLessThanOrEqual(12);
  });
});

describe('ArchSprite foliage clusters', () => {
  it('the laurel cluster has >= 15 leaves on 3 stems from one root, >= 30% gold', () => {
    const el = symbol('leaf-laurel-cluster');
    const stems = clusterStems(el);
    expect(stems.length).toBe(3);
    for (const stem of stems) {
      const [start] = stemEnds(stem.getAttribute('d') ?? '');
      expect(Math.hypot(start[0] - 60, start[1] - 114)).toBeLessThanOrEqual(4.8);
    }
    const leaves = Array.from(el.querySelectorAll('[fill="url(#leaf-olive-gradient)"], [fill="url(#leaf-gold-metal)"]'));
    expect(leaves.length).toBeGreaterThanOrEqual(15);
    const gold = leaves.filter((leaf) => leaf.getAttribute('fill') === 'url(#leaf-gold-metal)');
    expect(gold.length / leaves.length).toBeGreaterThanOrEqual(0.3);
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
