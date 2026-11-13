import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// No-emails guard: the site must not carry any email address in its source or e2e files. The
// pattern is the same one the built-output sweep in e2e/secrets.spec.ts uses, so a leak is caught
// at the source level before it can ever reach an emitted file.
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(TEST_DIR, '..', '..', '..');

const SCAN_DIR_NAMES = ['src', 'e2e'];
const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'dist', '.astro', '.git', 'test-results', 'playwright-report']);
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
  '.webmanifest',
  '.html',
  '.xml',
]);

function listFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIR_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursively(full));
    else files.push(full);
  }
  return files;
}

describe('no-emails guard', () => {
  it('has no email address anywhere in src/ or e2e/', () => {
    const offenders: string[] = [];

    for (const dirName of SCAN_DIR_NAMES) {
      for (const file of listFilesRecursively(join(PROJECT_ROOT, dirName))) {
        if (!TEXT_EXTENSIONS.has(extname(file))) continue;
        const relPath = relative(PROJECT_ROOT, file);
        for (const match of readFileSync(file, 'utf8').match(EMAIL_PATTERN) ?? []) {
          offenders.push(`${relPath}: ${match}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
