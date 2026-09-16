import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias to the core package's source rather than its built dist/
      // output so `pnpm test` works standalone without requiring core to
      // be built first (a plain workspace:* dependency would resolve
      // through package.json "exports" -> dist/, which may not exist yet
      // on a fresh checkout or in CI before a build step runs).
      '@chart-lib/core': path.resolve(dirname, '../core/src/index.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
