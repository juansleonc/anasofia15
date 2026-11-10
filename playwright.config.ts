import { defineConfig, devices } from '@playwright/test';

// E2e runs against the built `dist/` (served via `pnpm run preview`), not `astro dev`,
// so the GH Pages `base` subpath is exercised the same way it is in production.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    // Astro's `base: '/anasofia15/'` (astro.config.mjs) means `astro preview` only serves content
    // under that subpath — navigating to bare `http://localhost:4321/` 404s. Match production.
    baseURL: 'http://localhost:4321/anasofia15/',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm run preview',
    url: 'http://localhost:4321/anasofia15/',
    reuseExistingServer: !process.env.CI,
  },
});
