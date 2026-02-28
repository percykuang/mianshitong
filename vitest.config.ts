import { defineConfig } from 'vitest/config';

// Vitest supports multi-project via `test.projects`.
// Each workspace can optionally add its own vitest config later.
export default defineConfig({
  test: {
    projects: ['./packages/*'],
    coverage: {
      enabled: false,
    },
  },
});
