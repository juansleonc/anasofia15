import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Leftovers guard: this site was copied from a sibling quinceañera invitation and must carry no
// trace of that project's identity or former party theme. Every forbidden token below is written
// with a regex character class around one inner letter/digit so the *literal source of this file*
// never contains the banned substring contiguously — the guard cannot flag itself. Word boundaries
// are added to the shorter tokens, since without them they'd also match unrelated real words or
// usernames that merely contain the token as a substring; the longer, more specific tokens don't
// need one.
const FORBIDDEN_TOKENS: RegExp[] = [
  /\bl[u]\b/i,
  /l[u]15/i,
  /\bd[i]sco\b/i,
  /\bl[e][oó]n\b/i,
  /n[u]evo futuro/i,
  /s[t]arfield/i,
  /s[p]otlight/i,
  /b073702[6]-e800/i,
];

// sha256 of the sibling site's real song file, kept here so a reused `public/music/song.mp3` (or
// a stray copy anywhere else in the scanned tree) is caught even after the old track was deleted.
const OLD_SONG_SHA256 = '87d30123864bed0ca213ad1c242521bba3880a9c7d664745c40b57bc5004f4c1';

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, '..', '..', '..');

const SCAN_DIR_NAMES = ['src', 'e2e', 'public', '.github'];
const SCAN_ROOT_FILE_NAMES = [
  'astro.config.mjs',
  'playwright.config.ts',
  'vitest.config.ts',
  'eslint.config.mjs',
  'package.json',
  'README.md',
  'tsconfig.json',
];

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.astro',
  '.git',
  'investigations',
  '.claude',
  'memory',
  'openspec',
  'test-results',
  'playwright-report',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.astro',
  '.css',
  '.md',
  '.mjs',
  '.cjs',
  '.js',
  '.json',
  '.yml',
  '.yaml',
  '.svg',
  '.txt',
]);

function exists(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false }) !== undefined;
}

function listFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function collectScanTargets(): string[] {
  const fromDirs = SCAN_DIR_NAMES.map((name) => join(PROJECT_ROOT, name))
    .filter(exists)
    .flatMap((dir) => listFilesRecursively(dir));
  const fromFiles = SCAN_ROOT_FILE_NAMES.map((name) => join(PROJECT_ROOT, name)).filter(exists);
  return [...fromDirs, ...fromFiles];
}

describe('leftovers guard', () => {
  const targets = collectScanTargets();

  it("has no trace of the prior site's identity or former theme", () => {
    const offenders: string[] = [];

    for (const file of targets) {
      if (!TEXT_EXTENSIONS.has(extname(file))) continue; // binaries (images, audio, icons) skipped

      const relPath = relative(PROJECT_ROOT, file);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (FORBIDDEN_TOKENS.some((token) => token.test(line))) {
            offenders.push(`${relPath}:${index + 1}: ${line.trim()}`);
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it("carries no file with the prior site's song fingerprint", () => {
    const matches = targets
      .filter((file) => createHash('sha256').update(readFileSync(file)).digest('hex') === OLD_SONG_SHA256)
      .map((file) => relative(PROJECT_ROOT, file));

    expect(matches).toEqual([]);
  });
});
