import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-time check for whether a public asset file has actually been dropped into `public/`.
 * Used to gate rendering of the music toggle, the hero portrait, and the OG image meta tag so
 * each "turns on" the moment the real file is committed, with no separate config flag that could
 * drift from the filesystem. Fails closed: any path that tries to escape `publicDir` (contains
 * `..`) is reported as absent WITHOUT ever touching the filesystem — a public-asset path is
 * always relative to `public/`, so an escape attempt can only be a bug, not a legitimate request.
 */
export function publicAssetExists(
  assetPath: string,
  publicDir: string = join(process.cwd(), 'public'),
  exists: (path: string) => boolean = existsSync,
): boolean {
  if (assetPath.includes('..')) return false;

  const relativePath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return exists(join(publicDir, relativePath));
}
