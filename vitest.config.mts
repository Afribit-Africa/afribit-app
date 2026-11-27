import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'root',
          include: ['packages/*/test/**/*.test.ts', 'tools/admission-check/**/*.test.ts', 'apps/shell/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      'features/*/vitest.config.mts',
    ],
  },
});
