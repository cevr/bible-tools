import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/perf/**/*.test.ts'], // Perf tests use bun:test, run with `bun test test/perf/`
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
      // Mock bun modules for vitest (runs on Node)
      bun: path.resolve(__dirname, './test/lib/bun-shim.ts'),
      'bun:sqlite': path.resolve(__dirname, './test/lib/bun-sqlite-shim.ts'),
    },
  },
});
