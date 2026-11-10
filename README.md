# Ana Sofía's quinceañera invitation

A static Astro site: an online invitation for Ana Sofía's 15th birthday celebration.

## Drop-in files

These three files are intentionally not checked into the repo. Each feature they back stays
hidden (gracefully, with a fallback) until its file is present:

| File | Enables |
| :--- | :--- |
| `public/music/song.mp3` | The background-music toggle button |
| `public/images/portrait.jpg` | Ana Sofía's photo on the cover/hero section |
| `public/images/og-image.jpg` | The social-share link-preview image |

Drop a file into place, commit it, and rebuild — no code change required.

## Commands

All commands must be run from the repo root (relative asset lookups depend on it):

| Command | Action |
| :--- | :--- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the local dev server |
| `pnpm build` | Build the production site to `./dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run the unit test suite |
| `pnpm test:e2e` | Run the end-to-end test suite |
