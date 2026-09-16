import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias to each package's source rather than its built dist/ output,
      // same reasoning as packages/react/vitest.config.ts — lets the demo
      // run on a fresh checkout without requiring every package to be
      // built first.
      '@sulacharts/core': path.resolve(dirname, '../../packages/core/src/index.ts'),
      '@sulacharts/react': path.resolve(dirname, '../../packages/react/src/index.ts'),
      '@sulacharts/angular': path.resolve(dirname, '../../packages/angular/src/index.ts'),
    },
  },
});
