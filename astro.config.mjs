// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://juansleonc.github.io',
  base: '/anasofia15/',
  // `server` applies to both `astro dev` and `astro preview` in Astro 7.
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
});
