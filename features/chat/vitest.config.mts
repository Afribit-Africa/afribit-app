import { defineConfig } from 'vitest/config';

// Pin the root to this feature so the suite resolves its paths whether it runs
// standalone (`--config features/chat/vitest.config.mts`) or as a root project.
export default defineConfig({
  root: import.meta.dirname,
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
