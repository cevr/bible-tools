import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
      // Mock bun module for vitest
      bun: path.resolve(__dirname, './test/lib/bun-shim.ts'),
    },
  },
});
