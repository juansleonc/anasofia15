import { defineConfig, devices } from '@playwright/test';

// Port defaults to 4321; set E2E_PORT to run beside another preview server.
// E2e runs against the built `dist/` (served via `pnpm run preview`), not `astro dev`,
// so the GH Pages `base` subpath is exercised the same way it is in production.
const port = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${port}/anasofia15/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    // Astro's `base: '/anasofia15/'` (astro.config.mjs) means `astro preview` only serves content
    // under that subpath — navigating to bare `http://localhost:${port}/` 404s. Match production.
    baseURL,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `pnpm run preview --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
