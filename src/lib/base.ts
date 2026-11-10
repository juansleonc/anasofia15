/**
 * Builds an internal asset/link path prefixed with the site's deploy base, so it resolves
 * correctly whether the site is served from the domain root or from a GitHub Pages subpath
 * (e.g. `/anasofia15/`). Never author an internal `href`/`src` as a root-absolute string directly —
 * always route it through this helper.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${relativePath}`;
}
