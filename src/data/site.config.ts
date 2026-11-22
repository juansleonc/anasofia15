/**
 * === THE ONE PLACE THE FAMILY EDITS: integration & site config ===
 * Non-content integration values (external service keys/URLs, OG defaults). Placeholder values
 * below are marked "REEMPLAZAR" and must be swapped for real ones before launch.
 */

export interface SiteConfig {
  /**
   * Web3Forms public access key for this event's forms, configured for delivery. If this ever
   * needs to change, generate a new key at web3forms.com and paste the UUID here — or clear it
   * back to `''` to fall back to a visible "not configured" state (`isWeb3FormsKeyConfigured`,
   * src/lib/web3forms.ts), in which no request is ever sent. The key is public-by-design (safe
   * in the client bundle): it only identifies which Web3Forms form to submit to. The destination
   * address is set on Web3Forms' own dashboard, NOT here — it never appears in this codebase or
   * the bundle.
   */
  web3formsAccessKey: string;
  /** Full deployed site origin (must match `site` in astro.config.mjs). */
  siteUrl: string;
  /** GitHub Pages deploy subpath (must match `base` in astro.config.mjs). */
  base: string;
  /** Default Open Graph / meta tags used by BaseLayout unless a page overrides them. */
  og: {
    title: string;
    description: string;
    /** Path (relative to `base`) to the OG preview image. PLACEHOLDER until the family supplies one. */
    imagePath: string;
  };
  /**
   * Path (relative to `base`, route it through `withBase()`) to the background-music track
   * played by `islands/MusicToggle.astro`. The real track chosen by the family, served from
   * `public/music/song.mp3`.
   */
  musicSrc: string;
  /**
   * Path (relative to `base`, route it through `withBase()`) to the Hero portrait photo, served
   * from `public/images/portrait.jpg` — supplied by the family. `Hero.astro` falls back to an
   * "AS" medallion if it's ever removed (see `publicAssetExists`).
   */
  portraitPath: string;
}

export const siteConfig: SiteConfig = {
  web3formsAccessKey: 'b0737026-e800-4133-bf1c-68b8ab8cd045',
  siteUrl: 'https://juansleonc.github.io',
  base: '/anasofia15/',
  og: {
    title: 'Mis XV años · Ana Sofía',
    description: 'Invitación para los quince años de Ana Sofía · Sábado 19 de diciembre de 2026.',
    imagePath: '/images/og-image.jpg',
  },
  musicSrc: '/music/song.mp3',
  portraitPath: '/images/portrait.jpg',
};
