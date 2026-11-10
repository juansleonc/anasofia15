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
});
