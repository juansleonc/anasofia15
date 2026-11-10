import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
    environment: 'node',
    // Remaining foundation/feature tasks (T9/T12/T14/T18) still land their pure-logic modules
    // incrementally; keep passing with zero matches until then instead of a placeholder test.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
    },
  },
});
