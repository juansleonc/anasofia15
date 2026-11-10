// @ts-check
import { defineConfig } from 'eslint/config';
import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default defineConfig([
  tseslint.configs.recommended,
  eslintPluginAstro.configs.recommended,
  {
    ignores: [
      'dist/',
      '.astro/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      // Investigation workspaces hold reference dumps and process artifacts, not shipped source.
      'investigations/',
    ],
  },
]);
