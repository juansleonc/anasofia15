import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
    },
  },
});
