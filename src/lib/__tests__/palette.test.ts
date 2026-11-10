import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Palette discipline: every color under `src/` must come from a token in tokens.css (or the one
// legitimate swatch-data file) — never a literal pasted into a component — so the app stays
// re-themeable from one place.

// Matches a valid CSS hex color (3/4/6/8 digits); the trailing lookahead rejects a longer run and
// naturally excludes id selectors like `#trivia-game` (they contain letters outside a-f).
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
// The only other way a raw color sneaks in — the token system uses `color-mix()` instead.
const RGB_FUNCTION = /\brgba?\(/gi;

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, '..', '..', '..');
const SRC_DIR = join(PROJECT_ROOT, 'src');

const ALLOWED_FILES = [join(SRC_DIR, 'styles', 'tokens.css'), join(SRC_DIR, 'data', 'dress-colors.ts')];
const ALLOWED_DIR = join(SRC_DIR, 'lib', '__tests__') + sep;

const RETIRED_THEME_HEXES = ['#0a0a0f', '#c9ccd1', '#d4af37', '#eef0f3', '#f0d987', '#fbf0c4'];

// Matches a single `--token-name: #hex;` custom-property declaration anywhere in the stylesheet.
const CUSTOM_PROPERTY_HEX = /--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;

function parseCustomPropertyHexes(cssContent: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of cssContent.matchAll(CUSTOM_PROPERTY_HEX)) {
    tokens[`--${match[1]}`] = match[2].toLowerCase();
  }
  return tokens;
}

// WCAG 2.x relative luminance + contrast ratio, used to prove the new wine tokens keep white text
// readable rather than just eyeballing the hex values.
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [r, g, b].map(channel);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastWithWhiteRgb(rgb: [number, number, number]): number {
  const whiteLuminance = relativeLuminance(hexToRgb('#ffffff'));
  const luminance = relativeLuminance(rgb);
  return (whiteLuminance + 0.05) / (luminance + 0.05);
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(astro|ts|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isExempt(file: string): boolean {
  return ALLOWED_FILES.includes(file) || file.startsWith(ALLOWED_DIR);
}

function findOffenses(file: string): string[] {
  const relPath = relative(PROJECT_ROOT, file);
  const offenses: string[] = [];

  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const hexHits = line.match(HEX_COLOR) ?? [];
      const rgbHits = line.match(RGB_FUNCTION) ?? [];
      [...hexHits, ...rgbHits].forEach((hit) => {
        offenses.push(`${relPath}:${index + 1}: ${hit}`);
      });
    });

  return offenses;
}

describe('palette discipline', () => {
  it('has no raw #hex or rgb()/rgba() literal outside the token, data and test exceptions', () => {
    const offenders = listSourceFiles(SRC_DIR)
      .filter((file) => !isExempt(file))
      .flatMap((file) => findOffenses(file));

    expect(offenders).toEqual([]);
  });

  it('keeps none of the retired theme hexes in tokens.css', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8').toLowerCase();

    const stillPresent = RETIRED_THEME_HEXES.filter((hex) => tokensCss.includes(hex));

    expect(stillPresent).toEqual([]);
  });

  it('declares the champagne gold scale with exact values', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
    const tokens = parseCustomPropertyHexes(tokensCss);

    expect(tokens).toMatchObject({
      '--c-champagne-100': '#fbf3e4',
      '--c-champagne-200': '#f2e0c2',
      '--c-champagne-300': '#e6c99a',
      '--c-champagne-500': '#cda869',
      '--c-champagne-700': '#a07e46',
      '--c-rosegold-200': '#f3d3c8',
      '--c-rosegold-400': '#dba592',
      '--c-wine-500': '#9a4462',
      '--c-wine-700': '#6e2440',
    });
  });

  // Resolves the open button's fill gradient into its ordered stop tokens, so the contrast checks
  // below follow the gradient as declared instead of re-stating its stops.
  function buttonFillStops(tokensCss: string): string[] {
    const declaration = tokensCss.match(/--gradient-button-wine-rose:\s*linear-gradient\(([^;]*)\);/);
    expect(declaration).not.toBeNull();
    return [...declaration![1].matchAll(/var\((--c-[\w-]+)\)/g)].map((match) => match[1]);
  }

  it('the open button fill runs rose to deep wine, built only from palette tokens', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');

    expect(buttonFillStops(tokensCss)).toEqual(['--c-rose-700', '--c-wine-500', '--c-wine-700']);
  });

  it('white label text keeps at least 4.5:1 on every button fill stop', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
    const tokens = parseCustomPropertyHexes(tokensCss);
    const stops = buttonFillStops(tokensCss);

    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const stop of stops) {
      expect(contrastRatio('#ffffff', tokens[stop])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('white stays at least 4.5:1 under the 10% button sheen', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
    const tokens = parseCustomPropertyHexes(tokensCss);

    const sheenAlphaMatch = tokensCss.match(/--button-sheen-alpha:\s*([\d.]+)%/);
    expect(sheenAlphaMatch).not.toBeNull();
    const sheenAlpha = parseFloat(sheenAlphaMatch![1]) / 100;
    expect(sheenAlpha).toBe(0.1);

    // The sheen is a white layer painted at `sheenAlpha` over the fill, so the worst-case backdrop
    // for the label is the lightest (top) stop composited with white at that alpha (source-over).
    const topStop = hexToRgb(tokens[buttonFillStops(tokensCss)[0]]);
    const white = hexToRgb('#ffffff');
    const composite: [number, number, number] = [
      white[0] * sheenAlpha + topStop[0] * (1 - sheenAlpha),
      white[1] * sheenAlpha + topStop[1] * (1 - sheenAlpha),
      white[2] * sheenAlpha + topStop[2] * (1 - sheenAlpha),
    ];

    expect(contrastWithWhiteRgb(composite)).toBeGreaterThanOrEqual(4.5);
  });

  it("the button fill's darkest stop is a deep wine", () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
    const tokens = parseCustomPropertyHexes(tokensCss);

    const luminances = buttonFillStops(tokensCss).map((stop) => relativeLuminance(hexToRgb(tokens[stop])));
    expect(luminances.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...luminances)).toBeLessThanOrEqual(0.06);
  });

  it('the deep wine name reads strongly on the warm glow', () => {
    const tokensCss = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');
    const tokens = parseCustomPropertyHexes(tokensCss);

    expect(
      contrastRatio(tokens['--c-wine-700'], tokens['--c-champagne-100']),
    ).toBeGreaterThanOrEqual(7);
  });
});
