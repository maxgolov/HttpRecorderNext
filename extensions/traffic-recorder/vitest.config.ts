import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.spec.ts',
        '**/*.test.ts'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@mcp': path.resolve(__dirname, './src/mcp'),
      '@detectors': path.resolve(__dirname, './src/detectors'),
      '@test': path.resolve(__dirname, './src/test')
    }
  }
});
