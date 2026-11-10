import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../src/data/site.config';

// Secrets sweep: scans every TEXT file emitted into the built `dist/` (the actual
// deployed artifact — HTML, CSS, JS bundles, JSON, SVG; binary assets like fonts/audio are
// skipped, they can't contain a copy-pasteable email) for ANY email address at all. No address
// is allowlisted by default — the Web3Forms destination address is configured on Web3Forms' own
// dashboard (see `src/data/site.config.ts`'s comment) and must never appear literally here. A
// legitimate public address, if one is ever genuinely needed in the build, must be added to
// `ALLOWED_EMAILS` explicitly rather than the sweep being weakened. The Web3Forms public
// `access_key` is public-by-design (it only identifies which form to submit to) and is
// explicitly allowed to appear — this test asserts it DOES appear, to prove the sweep isn't just
// vacuously empty. It reads the key straight from `site.config.ts` rather than hardcoding it, so
// it can never drift out of sync.
//
// Precondition: `pnpm run build` must have already run (same precondition every other e2e spec
// has via playwright.config.ts's `webServer: pnpm run preview`, which serves the same `dist/`).

const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TEXT_FILE_PATTERN = /\.(html|css|js|mjs|cjs|json|txt|xml|svg)$/i;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
// Explicit, empty-by-default allowlist of addresses permitted to appear in the built site. Add
// an entry here only when a genuinely public address is needed — left empty, no address of any
// kind is allowed to appear in dist/.
const ALLOWED_EMAILS: readonly string[] = [];

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    out.push(...(statSync(full).isDirectory() ? listFilesRecursive(full) : [full]));
  }
  return out;
}

test.describe('Secrets sweep over dist/', () => {
  test.beforeAll(() => {
    if (!existsSync(DIST_DIR)) {
      throw new Error('dist/ not found — run `pnpm run build` before `pnpm run test:e2e`.');
    }
  });

  test('no email address outside the allowlist is present in any emitted file', () => {
    const textFiles = listFilesRecursive(DIST_DIR).filter((file) => TEXT_FILE_PATTERN.test(file));
    expect(textFiles.length).toBeGreaterThan(0);

    const offenders: { file: string; matches: string[] }[] = [];
    for (const file of textFiles) {
      const content = readFileSync(file, 'utf-8');
      const matches = (content.match(EMAIL_PATTERN) ?? []).filter(
        (match) => !ALLOWED_EMAILS.includes(match),
      );
      if (matches.length > 0) offenders.push({ file, matches });
    }

    expect(offenders).toEqual([]);
  });

  test('the public Web3Forms access_key is allowed and present (sweep is not vacuous)', () => {
    const textFiles = listFilesRecursive(DIST_DIR).filter((file) => TEXT_FILE_PATTERN.test(file));
    const hasAccessKey = textFiles.some((file) =>
      readFileSync(file, 'utf-8').includes(siteConfig.web3formsAccessKey),
    );

    expect(hasAccessKey).toBe(true);
  });
});
