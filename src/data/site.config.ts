/**
 * === THE ONE PLACE THE FAMILY EDITS: integration & site config ===
 * Non-content integration values (external service keys/URLs, OG defaults). Placeholder values
 * below are marked "REEMPLAZAR" and must be swapped for real ones before launch.
 */

export interface SiteConfig {
  /**
   * Web3Forms public access key for this event's form. PLACEHOLDER until the family creates the
   * real form — `isWeb3FormsKeyConfigured` (src/lib/rsvp.ts) keeps the RSVP form in a visible
   * "not configured" state (no fetch ever sent) until this is swapped for a real UUID key. This
   * key is public-by-design (safe to ship in the client bundle): it only identifies which
   * Web3Forms form to submit to. The destination email address is configured on Web3Forms' own
   * dashboard, NOT here — it never appears in this codebase or the bundle.
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
   * from `public/images/portrait.jpg`. PLACEHOLDER until the family supplies one — `Hero.astro`
   * falls back to an "AS" medallion while it's absent (see `publicAssetExists`).
   */
  portraitPath: string;
}

export const siteConfig: SiteConfig = {
  web3formsAccessKey: 'REEMPLAZAR-CON-LLAVE-WEB3FORMS',
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
