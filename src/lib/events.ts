/**
 * Single home for the window `CustomEvent` name the "Abrir invitación" open gesture dispatches.
 * `Cover.astro` dispatches it; `MusicToggle.astro` and `PetalFall.astro` listen for it. Namespaced
 * with the site's own prefix so it can never collide with another site that happens to share
 * the same GitHub Pages origin.
 */
export const OPEN_INVITATION_EVENT = 'anasofia15:open-invitation';
