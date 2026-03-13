import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts', 'apps/tenant/**/__tests__/**/*.test.ts'],
    alias: {
      '@/core': path.resolve(__dirname, './packages/@tinadmin/core/src'),
    },
  },
});
